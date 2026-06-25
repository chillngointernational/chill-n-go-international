// cng-mp-create-order — crea la orden de compra y un checkout de Mercado Pago (compra única).
// SEPARADA de la membresía (regla dura): usa la app "Chill N Go Checkout" con su PROPIO token.
// verify_jwt:true. Molde de cng-mp-create-subscription.
//
// Flujo:
//  1) Usuario autenticado (getUser). Sin sesión -> 401.
//  2) Orden SERVER-SIDE y ATÓMICA vía rpc_create_order: lee el precio real de la DB (ignora
//     cualquier monto del cliente), aplica commission_pct (10% encima), valida active+stock,
//     inserta orders('pending_payment') + items con snapshot. El cliente NO puede fabricar 'paid'.
//  3) DOS CAMINOS de comprador:
//       - Miembro (membership_status='active') -> TODOS los métodos de pago.
//       - Invitado/no-miembro -> SOLO transferencia/depósito (excluye credit_card + debit_card).
//         Caveat MX: account_money / billetera MP NO se puede excluir.
//  4) Preferencia de Checkout Pro -> devuelve init_point. Respeta checkout_live: false = SANDBOX
//     (token de PRUEBA -> sandbox_init_point; nada de dinero real).
//
// Secrets del runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   MP_CHECKOUT_ACCESS_TOKEN (PRUEBA), MP_CHECKOUT_ACCESS_TOKEN_LIVE (solo si checkout_live=true).

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // ¿Miembro activo? -> define el set de métodos de pago.
  const { data: prof } = await admin.from('identity_profiles').select('membership_status').eq('user_id', user.id).maybeSingle()
  const isMember = prof?.membership_status === 'active'

  // Config + kill-switch.
  const { data: cfg } = await admin.from('platform_config').select('checkout_live').eq('id', true).maybeSingle()
  const checkoutLive = cfg?.checkout_live === true

  // Token de la app de checkout (separada de membresía). live -> prod token; sandbox -> test token.
  const mpToken = checkoutLive
    ? Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN_LIVE')
    : Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN')
  if (!mpToken) {
    return json({ error: checkoutLive ? 'Falta el token de producción de checkout.' : 'Falta MP_CHECKOUT_ACCESS_TOKEN (prueba).', code: 'mp_token_missing' }, 500)
  }

  // 2) Crear la orden ATÓMICA y server-side (precio real de la DB, comisión, stock).
  const { data: created, error: rpcErr } = await admin.rpc('rpc_create_order', {
    p_buyer_user_id: user.id,
    p_listing_id: listingId,
    p_variant_id: variantId,
    p_quantity: quantity,
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

  // 3) Métodos de pago según el comprador.
  const payment_methods = isMember
    ? {}
    : { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }] }

  // 4) Preferencia de Checkout Pro.
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const expiresTo = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // P3D (recomendación MP)
  const preference = {
    items: [
      { title: 'Compra GoShop', quantity: 1, unit_price: subtotal, currency_id: currency },
      { title: 'Comisión de servicio Chill N Go', quantity: 1, unit_price: commission, currency_id: currency },
    ],
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

  // Guardar la referencia de la preferencia en la orden.
  await admin.from('orders').update({ mp_preference_id: mpData.id }).eq('id', orderId)

  // En sandbox (checkout_live=false) usamos sandbox_init_point (checkout de PRUEBA).
  const checkoutUrl = checkoutLive ? mpData.init_point : (mpData.sandbox_init_point || mpData.init_point)
  return json({
    init_point: checkoutUrl,
    order_id: orderId,
    total: subtotal + commission,
    currency,
    is_member: isMember,
    sandbox: !checkoutLive,
  })
})
