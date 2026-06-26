// cng-mp-order-webhook — notificaciones de pago de la app "Chill N Go Checkout" (compra de PRODUCTO).
// INDEPENDIENTE del webhook de membresía (cng-mp-webhook) y del de cuota de vendedor: NUNCA usa el
// secret/token de membresía. verify_jwt:false.
//   1) Valida la firma HMAC (x-signature) con MP_CHECKOUT_WEBHOOK_SECRET (de la app de Checkout).
//   2) Reconsulta el pago real en MP (GET /v1/payments/{id}) con el token de la app de Checkout
//      (live/sandbox según platform_config.checkout_live). JAMÁS confía en el payload.
//   3) external_reference debe ser un order_id real; monto + moneda deben coincidir con la orden.
//      Si algo no cuadra -> 200 ignored (no se concede beneficio). 500 -> MP reintenta.
//   4) Aplica vía rpc_apply_order_payment (atómico, idempotente). checkout_live NO se toca aquí.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_CHECKOUT_ACCESS_TOKEN(+_LIVE), MP_CHECKOUT_WEBHOOK_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Plantilla oficial de firma de MP (misma que los otros webhooks; función AISLADA, sin código compartido).
async function validSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const sig = req.headers.get('x-signature') || ''
  const reqId = req.headers.get('x-request-id') || ''
  if (!sig || !dataId) return false
  const parts: Record<string, string> = {}
  for (const kv of sig.split(',')) {
    const idx = kv.indexOf('=')
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim()
  }
  const ts = parts['ts'], v1 = parts['v1']
  if (!ts || !v1) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const webhookSecret = Deno.env.get('MP_CHECKOUT_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Config incompleta.' }, 500)
  if (!webhookSecret) return json({ error: 'Falta MP_CHECKOUT_WEBHOOK_SECRET.' }, 500)

  const url = new URL(req.url)
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* puede venir vacío con datos en query */ }

  const type = String(body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '')
  const queryDataId = url.searchParams.get('data.id') || url.searchParams.get('id') || ''
  const dataId = String(body?.data?.id || queryDataId || '')

  // 1) Firma HMAC.
  const ok = await validSignature(req, queryDataId || dataId, webhookSecret)
  if (!ok) {
    console.error('[order-webhook] firma inválida', { type, dataId })
    return json({ error: 'Firma inválida.' }, 401)
  }

  // Compra = pago único -> solo 'payment'. Otros topics se ignoran (200, MP deja de reintentar).
  if (type !== 'payment' || !dataId) {
    return json({ received: true, ignored: type || 'no_type' }, 200)
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 2) Token de la app de Checkout según checkout_live (NUNCA el de membresía).
  const { data: cfg } = await admin.from('platform_config').select('checkout_live').eq('id', true).maybeSingle()
  const live = cfg?.checkout_live === true
  const mpToken = live ? Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN_LIVE') : Deno.env.get('MP_CHECKOUT_ACCESS_TOKEN')
  if (!mpToken) {
    return json({ error: live ? 'Falta el token de producción de checkout.' : 'Falta MP_CHECKOUT_ACCESS_TOKEN.' }, 500)
  }

  // Reconsultar el pago real (jamás confiar en el payload).
  const pr = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, { headers: { Authorization: `Bearer ${mpToken}` } })
  if (!pr.ok) {
    console.error('[order-webhook] no se pudo consultar el pago', dataId, pr.status)
    return json({ error: 'No se pudo consultar el pago.' }, 500) // 500 -> MP reintenta
  }
  const pay = await pr.json().catch(() => ({}))
  const extRef = String(pay?.external_reference || '')
  const payStatus = String(pay?.status || '')
  const payAmount = Number(pay?.transaction_amount)
  const payCurrency = String(pay?.currency_id || '')
  const payMethod = pay?.payment_method_id ? String(pay.payment_method_id) : null
  const payType = pay?.payment_type_id ? String(pay.payment_type_id) : null

  // 3) ¿Es NUESTRA orden? external_reference = order_id (UUID).
  if (!UUID_RE.test(extRef)) {
    return json({ received: true, ignored: 'not_order' }, 200)
  }
  const { data: order, error: ordErr } = await admin
    .from('orders').select('id, total, currency, status').eq('id', extRef).maybeSingle()
  if (ordErr) {
    console.error('[order-webhook] error leyendo la orden:', ordErr.message)
    return json({ error: 'Error leyendo la orden.' }, 500) // transitorio -> MP reintenta
  }
  if (!order) {
    return json({ received: true, ignored: 'not_order' }, 200) // external_reference no es una orden nuestra
  }

  // Cross-checks anti-fraude: monto (en centavos) + moneda deben coincidir con la orden.
  const amountCents = Number.isFinite(payAmount) ? Math.round(payAmount * 100) : -1
  const expectedCents = Math.round(Number(order.total) * 100)
  if (amountCents !== expectedCents || payCurrency !== order.currency) {
    console.error('[order-webhook] mismatch; NO se aplica el pago', {
      extRef, payAmount, payCurrency, expectedCents, expected_currency: order.currency, payStatus,
    })
    return json({ received: true, ignored: 'mismatch' }, 200) // definitivo: no se marca pagada
  }

  // 4) Aplicar atómico e idempotente.
  const { data: result, error: rpcErr } = await admin.rpc('rpc_apply_order_payment', {
    p_order_id: order.id,
    p_mp_payment_id: dataId,
    p_status: payStatus,
    p_amount_cents: amountCents,
    p_currency: payCurrency,
    p_payment_method: payMethod,
    p_payment_type: payType,
  })
  if (rpcErr) {
    console.error('[order-webhook] RPC error:', rpcErr.message)
    return json({ error: 'Error procesando el pago.' }, 500) // -> MP reintenta
  }

  return json({ received: true, result, status: payStatus }, 200)
})
