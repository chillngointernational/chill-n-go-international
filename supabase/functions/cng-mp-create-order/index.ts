// cng-mp-create-order — crea la orden de compra y un checkout de Mercado Pago (compra única).
// SEPARADA de la membresía (regla dura): usa la app "Chill N Go Checkout" con su PROPIO token.
// verify_jwt:true. Molde de cng-mp-create-subscription.
//
// E-5: ahora integra el ENVÍO. Si el body trae { shipping_address_id, carrier, service,
// expected_shipping_cost }, el server RE-COTIZA el envío con Envia (sandbox), valida la opción
// elegida y obtiene el PRECIO DEL SERVIDOR (nunca confía en el precio del cliente). Suma el envío al
// total y agrega un 3er ítem a la preferencia. Si NO trae datos de envío -> camino C-3 IDÉNTICO
// (2 ítems, sin envío). La lógica de cotización es la MISMA de cng-shipping-quote (_shared) -> el
// precio re-cotizado coincide exacto con el mostrado.
//
// Flujo:
//  1) Usuario autenticado (getUser). Sin sesión -> 401.
//  2) (E-5) Si hay envío: resuelve dirección del comprador (propia), origen del producto, dims, y
//     RE-COTIZA el carrier+service elegido. price cambió -> shipping_price_changed; opción ida/
//     deshabilitada -> shipping_option_unavailable. Toma el precio del servidor.
//  3) Orden SERVER-SIDE y ATÓMICA vía rpc_create_order: lee precio real de la DB, aplica comisión
//     (solo producto), suma envío (re-cotizado), inserta orders('pending_payment') + items.
//  4) Métodos de pago: miembro -> todos; invitado -> solo transferencia/depósito.
//  5) Preferencia de Checkout Pro -> init_point. Respeta checkout_live (false = SANDBOX).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, MP_CHECKOUT_ACCESS_TOKEN
//   (PRUEBA), MP_CHECKOUT_ACCESS_TOKEN_LIVE (solo si checkout_live=true), ENVIA_TOKEN_TEST (envío sandbox).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ENVIA_TEST_HOST, buildRateBase, quoteCarrier } from '../_shared/envia-rate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mapea errores del RPC a mensajes amables.
const RPC_ERRORS: Record<string, string> = {
  quantity_invalid: 'Cantidad inválida.',
  shipping_invalid: 'Costo de envío inválido.',
  buyer_not_found: 'No encontramos tu perfil de comprador.',
  listing_not_available: 'Este producto ya no está disponible.',
  listing_not_purchasable: 'Este producto no se puede comprar en línea.',
  variant_not_available: 'Esta opción del producto no está disponible.',
  insufficient_stock: 'No hay suficiente stock para tu compra.',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  // 1) Usuario autenticado desde su JWT (no confiar en un user_id del cliente).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Inicia sesión para comprar.', code: 'not_authenticated' }, 401)

  // Entrada.
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }
  const listingId = String(body.listing_id || '')
  const variantId = String(body.variant_id || '')
  const quantity = Number.isFinite(Number(body.quantity)) ? Math.floor(Number(body.quantity)) : 1
  if (!UUID_RE.test(listingId)) return json({ error: 'Producto inválido.', code: 'invalid_listing' }, 400)
  if (!UUID_RE.test(variantId)) return json({ error: 'Variante inválida.', code: 'invalid_variant' }, 400)
  if (quantity < 1) return json({ error: 'Cantidad inválida.', code: 'invalid_quantity' }, 400)

  // Datos de envío (opcionales -> sin ellos es el camino C-3 idéntico, sin envío).
  const shippingAddressId = String(body.shipping_address_id || '')
  const carrierCode = String(body.carrier || '')
  const serviceCode = String(body.service || '')
  const expectedShipping = body.expected_shipping_cost != null && Number.isFinite(Number(body.expected_shipping_cost))
    ? Number(body.expected_shipping_cost) : null
  const wantsShipping = shippingAddressId !== ''

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 2) RE-COTIZACIÓN del envío (server-side). Solo si el comprador eligió envío.
  let shippingCost = 0
  let shippingSnapshot: Record<string, unknown> | null = null
  let shipCarrier: string | null = null
  let shipService: string | null = null
  if (wantsShipping) {
    if (!UUID_RE.test(shippingAddressId)) return json({ error: 'Dirección de envío inválida.', code: 'invalid_shipping_address' }, 400)
    if (!carrierCode || !serviceCode) return json({ error: 'Elige una opción de envío.', code: 'invalid_shipping_selection' }, 400)
    const enviaToken = Deno.env.get('ENVIA_TOKEN_TEST')
    if (!enviaToken) return json({ error: 'Cotizador de envío no disponible por ahora.', code: 'envia_token_missing' }, 500)

    // Miembro (perfil) del comprador -> para validar que la dirección es PROPIA.
    const { data: prof } = await admin.from('identity_profiles').select('id').eq('user_id', user.id).maybeSingle()
    const buyerMemberId = prof?.id
    if (!buyerMemberId) return json({ error: 'Completa tu perfil antes de comprar.', code: 'buyer_not_found' }, 400)

    // Dirección de entrega del comprador (debe ser SUYA).
    const { data: dest } = await admin.from('buyer_addresses')
      .select('owner_id, contact_name, phone, street, ext_number, int_number, district, city, state, postal_code, country, reference')
      .eq('id', shippingAddressId).maybeSingle()
    if (!dest || dest.owner_id !== buyerMemberId) return json({ error: 'Dirección de envío inválida.', code: 'shipping_address_invalid' }, 400)

    // Variante + listing + origen del producto (server-side; nunca del cliente).
    const { data: variant } = await admin.from('listing_variants')
      .select('listing_id, price, weight_grams, length_cm, width_cm, height_cm, is_active')
      .eq('id', variantId).maybeSingle()
    if (!variant || variant.is_active !== true || variant.listing_id !== listingId) {
      return json({ error: 'Esta opción del producto no está disponible.', code: 'variant_not_available' }, 400)
    }
    const { data: listing } = await admin.from('listings')
      .select('title, currency, origin_address_id, status').eq('id', listingId).maybeSingle()
    if (!listing || listing.status !== 'active') return json({ error: 'Este producto ya no está disponible.', code: 'listing_not_available' }, 400)

    const w = Number(variant.weight_grams), l = Number(variant.length_cm), wi = Number(variant.width_cm), h = Number(variant.height_cm)
    if (!listing.origin_address_id || !(w >= 1) || !(l > 0) || !(wi > 0) || !(h > 0)) {
      return json({ error: 'Este producto aún no tiene datos de envío configurados.', code: 'producto_sin_datos_envio' }, 409)
    }
    const { data: origin } = await admin.from('seller_addresses')
      .select('contact_name, phone, email, street, ext_number, int_number, district, city, state, postal_code, country, reference')
      .eq('id', listing.origin_address_id).maybeSingle()
    if (!origin) return json({ error: 'Este producto aún no tiene datos de envío configurados.', code: 'producto_sin_datos_envio' }, 409)

    // El carrier elegido debe seguir EXISTIENDO y ENABLED (el admin pudo deshabilitarlo).
    const { data: carrierRow } = await admin.from('shipping_carriers').select('code, label, enabled').eq('code', carrierCode).maybeSingle()
    if (!carrierRow || carrierRow.enabled !== true) {
      return json({ error: 'La opción de envío ya no está disponible. Vuelve a elegir.', code: 'shipping_option_unavailable' }, 409)
    }

    // RE-COTIZAR el carrier elegido (misma lógica que la cotización mostrada -> precio exacto).
    const base = buildRateBase({
      origin,
      destCity: dest.city, destState: dest.state, destCountry: dest.country, destPostalCode: dest.postal_code,
      weightGrams: w, lengthCm: l, widthCm: wi, heightCm: h,
      declaredValue: Number(variant.price) * quantity, content: listing.title, quantity, currency: listing.currency || 'MXN',
    })
    const opts = await quoteCarrier(ENVIA_TEST_HOST, enviaToken, base, { code: carrierRow.code, label: carrierRow.label })
    const chosen = opts.find((o) => o.service === serviceCode)
    if (!chosen) {
      return json({ error: 'La opción de envío ya no está disponible. Vuelve a elegir.', code: 'shipping_option_unavailable' }, 409)
    }
    const serverPrice = Math.round(Number(chosen.price) * 100) / 100

    // Si el precio cambió respecto al mostrado, NO cobrar: pedir reconfirmación con el nuevo precio.
    if (expectedShipping != null && Math.abs(serverPrice - expectedShipping) >= 0.01) {
      return json({ error: 'El costo de envío cambió.', code: 'shipping_price_changed', new_cost: serverPrice, currency: chosen.currency || (listing.currency || 'MXN') }, 409)
    }

    shippingCost = serverPrice
    shipCarrier = carrierRow.code
    shipService = chosen.service
    shippingSnapshot = {
      contact_name: dest.contact_name, phone: dest.phone,
      street: dest.street, ext_number: dest.ext_number, int_number: dest.int_number,
      district: dest.district, city: dest.city, state: dest.state, postal_code: dest.postal_code,
      country: dest.country, reference: dest.reference,
      carrier: carrierRow.code, carrier_label: carrierRow.label, service: chosen.service,
      service_description: chosen.service_description, delivery_estimate: chosen.delivery_estimate,
    }
  }

  // ¿Miembro activo? -> define el set de métodos de pago.
  const { data: prof } = await admin.from('identity_profiles').select('membership_status').eq('user_id', user.id).maybeSingle()
  const isMember = prof?.membership_status === 'active'

  // Config + kill-switch.
  const { data: cfg } = await admin.from('platform_config').select('checkout_live').eq('id', true).maybeSingle()
  const checkoutLive = cfg?.checkout_live === true

  const mpToken = checkoutLive
    ? Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN_LIVE')
    : Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN')
  if (!mpToken) {
    return json({ error: checkoutLive ? 'Falta el token de producción de checkout.' : 'Falta MP_CHECKOUT_ACCESS_TOKEN (prueba).', code: 'mp_token_missing' }, 500)
  }

  // 3) Crear la orden ATÓMICA y server-side (precio real de la DB, comisión, stock, + envío).
  const { data: created, error: rpcErr } = await admin.rpc('rpc_create_order', {
    p_buyer_user_id: user.id,
    p_listing_id: listingId,
    p_variant_id: variantId,
    p_quantity: quantity,
    p_shipping_cost: shippingCost,
    p_shipping_address: shippingSnapshot,
    p_shipping_carrier: shipCarrier,
    p_shipping_service: shipService,
  })
  if (rpcErr) {
    const key = (rpcErr.message || '').match(/[a-z_]+/)?.[0] || ''
    const msg = RPC_ERRORS[key] || 'No se pudo iniciar la compra. Intenta de nuevo.'
    console.error('[cng-mp-create-order] rpc error:', rpcErr.message)
    return json({ error: msg, code: key || 'create_order_failed' }, 400)
  }
  const row = Array.isArray(created) ? created[0] : created
  if (!row?.order_id) return json({ error: 'No se pudo crear la orden.' }, 500)
  const orderId: string = row.order_id
  const subtotal = Number(row.subtotal)
  const commission = Number(row.commission)
  const currency: string = row.currency || 'MXN'

  // 4) Métodos de pago según el comprador.
  const payment_methods = isMember
    ? {}
    : { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }] }

  // 5) Preferencia de Checkout Pro. Ítems: producto + comisión + (envío si aplica).
  const items: Array<Record<string, unknown>> = [
    { title: 'Compra GoShop', quantity: 1, unit_price: subtotal, currency_id: currency },
    { title: 'Comisión de servicio Chill N Go', quantity: 1, unit_price: commission, currency_id: currency },
  ]
  if (shippingCost > 0) {
    items.push({ title: 'Envío', quantity: 1, unit_price: shippingCost, currency_id: currency })
  }

  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const expiresTo = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // P3D (recomendación MP)
  const preference = {
    items,
    external_reference: orderId,
    payer: { email: user.email },
    payment_methods,
    back_urls: {
      success: `${SITE_URL}/app/explore?order=ok`,
      failure: `${SITE_URL}/app/explore?order=fail`,
      pending: `${SITE_URL}/app/explore?order=pending`,
    },
    auto_return: 'approved',
    notification_url: `${supabaseUrl}/functions/v1/cng-mp-order-webhook`, // C-4 (aún por construir)
    expires: true,
    expiration_date_to: expiresTo,
    metadata: { order_id: orderId },
  }

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(preference),
  })
  const mpData = await mpRes.json().catch(() => ({}))
  if (!mpRes.ok || !mpData?.id) {
    console.error('[cng-mp-create-order] MP error:', mpRes.status, JSON.stringify(mpData))
    return json({ error: 'No se pudo crear el checkout en Mercado Pago.', mp_status: mpRes.status }, 502)
  }

  await admin.from('orders').update({ mp_preference_id: mpData.id }).eq('id', orderId)

  const checkoutUrl = checkoutLive ? mpData.init_point : (mpData.sandbox_init_point || mpData.init_point)
  return json({
    init_point: checkoutUrl,
    order_id: orderId,
    subtotal,
    commission,
    shipping_cost: shippingCost,
    total: subtotal + commission + shippingCost,
    currency,
    is_member: isMember,
    sandbox: !checkoutLive,
  })
})
