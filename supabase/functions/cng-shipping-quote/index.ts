// cng-shipping-quote — cotiza envío EN VIVO con Envia (sandbox), fan-out por carrier curado.
// verify_jwt:FALSE (cotizar SIN login: el comprador invitado ve el envío, coherente con "compran
// todos"). 🟢 sin dinero: /ship/rate/ es GRATIS y NO genera guía; se re-cotiza al cobrar (E-5).
//
// SERVER-SIDE estricto: NUNCA confía en precio/peso/origen del cliente. El cliente solo manda
// { variant_id, quantity, destination:{postal_code,city,state,country} }; el server resuelve precio,
// peso, dimensiones y dirección de ORIGEN desde la DB por variant_id. La respuesta NO expone PII del
// origen (solo carrier/precio/tiempo).
//
// Anti-abuso (edge público): rate-limit por IP respaldado en DB (rpc_quote_rate_hit), validación
// estricta de entrada, cap de cantidad, y solo cotiza productos de tienda+listing 'active'.
//
// Fan-out: un /ship/rate/ por carrier ENABLED (tabla shipping_carriers), en paralelo con timeout
// por carrier (uno lento/caído NO tumba al resto). Junta, descarta vacíos (sin cobertura), ordena
// por precio. Si todos vacíos -> { options:[], sin_cobertura:true } con HTTP 200 (no es error).
//
// Secrets del runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENVIA_TOKEN_TEST.

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
const CP_RE = /^[0-9]{5}$/
const ENVIA_TEST_HOST = 'https://api-test.envia.com'
const RATE_LIMIT_PER_MIN = 20      // cotizaciones por IP por minuto (anti-abuso)
const CARRIER_TIMEOUT_MS = 8000    // un carrier lento se aborta a los 8s y aporta 0 opciones
const MAX_QTY = 100

// Cotiza UN carrier con timeout propio. Devuelve [] ante timeout / error / sin cobertura.
async function quoteCarrier(carrier: { code: string; label: string }, base: Record<string, unknown>, token: string) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), CARRIER_TIMEOUT_MS)
  try {
    const r = await fetch(`${ENVIA_TEST_HOST}/ship/rate/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...base, shipment: { type: 1, carrier: carrier.code } }),
      signal: ctrl.signal,
    })
    const data: any = await r.json().catch(() => null)
    if (!data || data.meta !== 'rate' || !Array.isArray(data.data)) return []
    return data.data
      .map((o: any) => ({
        carrier: o.carrier || carrier.code,
        carrier_label: carrier.label,
        service: o.service ?? null,
        service_description: o.serviceDescription ?? null,
        price: Number(o.totalPrice),
        currency: o.currency || (base.settings as any)?.currency || 'MXN',
        delivery_estimate: o.deliveryEstimate ?? null,
        delivery_date: o.deliveryDate?.date ?? null,
      }))
      .filter((o: any) => Number.isFinite(o.price) && o.price >= 0)
  } catch {
    return [] // timeout o error de red -> este carrier no aporta, no tumba al resto
  } finally {
    clearTimeout(t)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const enviaToken = Deno.env.get('ENVIA_TOKEN_TEST')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  if (!enviaToken) return json({ error: 'Cotizador de envío no disponible por ahora.', code: 'envia_token_missing' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Anti-abuso: rate-limit por IP (fail-open si el limitador falla -> no bloquea la disponibilidad).
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const { data: allowed } = await admin.rpc('rpc_quote_rate_hit', { p_ip: ip, p_limit: RATE_LIMIT_PER_MIN, p_window_seconds: 60 })
  if (allowed === false) return json({ error: 'Demasiadas solicitudes. Intenta en un momento.', code: 'rate_limited' }, 429)

  // Entrada.
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* body opcional */ }
  const variantId = String(body.variant_id || '')
  const quantity = Number.isFinite(Number(body.quantity)) ? Math.floor(Number(body.quantity)) : 1
  const dest = (body.destination && typeof body.destination === 'object') ? body.destination : {}
  const destCp = String(dest.postal_code || '').trim()

  if (!UUID_RE.test(variantId)) return json({ error: 'Producto inválido.', code: 'invalid_variant' }, 400)
  if (quantity < 1 || quantity > MAX_QTY) return json({ error: 'Cantidad inválida.', code: 'invalid_quantity' }, 400)
  if (!CP_RE.test(destCp)) return json({ error: 'Código postal de destino inválido.', code: 'invalid_destination_cp' }, 400)

  // Resolución SERVER-SIDE desde la DB (service_role -> sin RLS). Nunca del cliente.
  const { data: variant } = await admin
    .from('listing_variants')
    .select('id, listing_id, price, weight_grams, length_cm, width_cm, height_cm, is_active')
    .eq('id', variantId)
    .maybeSingle()
  if (!variant) return json({ error: 'Este producto ya no está disponible.', code: 'variant_not_found' }, 404)

  const { data: listing } = await admin
    .from('listings')
    .select('id, title, status, currency, origin_address_id, store_id')
    .eq('id', variant.listing_id)
    .maybeSingle()
  if (!listing) return json({ error: 'Este producto ya no está disponible.', code: 'listing_not_found' }, 404)
  if (listing.status !== 'active' || variant.is_active !== true) {
    return json({ error: 'Este producto no está disponible para compra.', code: 'not_purchasable' }, 409)
  }

  const { data: store } = await admin.from('stores').select('status').eq('id', listing.store_id).maybeSingle()
  if (!store || store.status !== 'active') {
    return json({ error: 'Esta tienda no está disponible.', code: 'store_not_active' }, 409)
  }

  // El producto debe tener origen + peso/dimensiones (todos NULLABLE -> validar antes de Envia).
  const w = Number(variant.weight_grams), l = Number(variant.length_cm), wi = Number(variant.width_cm), h = Number(variant.height_cm)
  if (!listing.origin_address_id || !(w >= 1) || !(l > 0) || !(wi > 0) || !(h > 0)) {
    return json({ error: 'Este producto aún no tiene datos de envío configurados.', code: 'producto_sin_datos_envio' }, 409)
  }

  const { data: origin } = await admin
    .from('seller_addresses')
    .select('contact_name, phone, email, street, ext_number, int_number, district, city, state, postal_code, country, reference')
    .eq('id', listing.origin_address_id)
    .maybeSingle()
  if (!origin) return json({ error: 'Este producto aún no tiene datos de envío configurados.', code: 'producto_sin_datos_envio' }, 409)

  // Carriers habilitados (curados desde admin), en orden.
  const { data: carriers } = await admin
    .from('shipping_carriers')
    .select('code, label')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
  if (!carriers || carriers.length === 0) {
    return json({ options: [], sin_cobertura: true }) // sin paqueterías habilitadas
  }

  // Request base (anclado a la sonda E-0 que cotizó OK). Peso de gramos -> KG; dims en CM.
  const currency = listing.currency || 'MXN'
  const base = {
    origin: {
      name: origin.contact_name, company: 'CNG', email: origin.email || 'envios@chillngointernational.com',
      phone: origin.phone, street: origin.street, number: origin.ext_number,
      district: origin.district, city: origin.city, state: origin.state, country: origin.country || 'MX',
      postalCode: origin.postal_code,
      reference: [origin.reference, origin.int_number ? `Int. ${origin.int_number}` : null].filter(Boolean).join(' · ') || undefined,
    },
    destination: {
      name: 'Cliente', company: 'CNG', email: 'cliente@chillngointernational.com', phone: '0000000000',
      street: '-', number: '0', district: '-',
      city: String(dest.city || '-'), state: String(dest.state || '-'),
      country: String(dest.country || 'MX'), postalCode: destCp,
    },
    packages: [{
      type: 'box', content: String(listing.title || 'Producto').slice(0, 40), amount: quantity,
      declaredValue: Number(variant.price) * quantity, weight: w / 1000, weightUnit: 'KG',
      lengthUnit: 'CM', dimensions: { length: l, width: wi, height: h },
    }],
    settings: { currency },
  }

  // Fan-out: un /ship/rate/ por carrier en paralelo, con timeout por carrier.
  const settled = await Promise.allSettled(carriers.map((c) => quoteCarrier(c, base, enviaToken)))
  const options: any[] = []
  for (const s of settled) if (s.status === 'fulfilled' && Array.isArray(s.value)) options.push(...s.value)
  options.sort((a, b) => a.price - b.price)

  return json({ options, sin_cobertura: options.length === 0, currency })
})
