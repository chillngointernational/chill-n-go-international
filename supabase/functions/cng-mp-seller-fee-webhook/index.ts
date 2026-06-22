// cng-mp-seller-fee-webhook — notificaciones de Mercado Pago para la CUOTA de verificación de
// VENDEDOR (pago ÚNICO vía Checkout Pro / preference). INDEPENDIENTE del webhook de membresía
// (cng-mp-webhook), que NO se toca. Misma validación HMAC (MP_WEBHOOK_SECRET).
//  1) Valida la firma HMAC (x-signature).
//  2) Reconsulta el pago real en MP (GET /v1/payments/{id}); NUNCA confía en el payload.
//  3) Solo actúa si external_reference es una fila de seller_verification_payments Y el monto/
//     moneda/usuario coinciden -> aplica vía RPC atómico e idempotente. Cualquier otra cosa: ignora.
// verify_jwt: false. Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Misma plantilla oficial de firma que el webhook de membresía (función AISLADA, sin código compartido).
async function validSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const sig = req.headers.get('x-signature') || ''
  const reqId = req.headers.get('x-request-id') || ''
  if (!sig || !dataId) return false
  const parts: Record<string, string> = {}
  for (const kv of sig.split(',')) {
    const idx = kv.indexOf('=')
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim()
  }
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
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
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Config incompleta.' }, 500)
  if (!mpToken || !webhookSecret) return json({ error: 'Faltan secrets de MP.' }, 500)

  const url = new URL(req.url)
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* puede venir vacío con datos en query */ }

  const type = String(body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '')
  const queryDataId = url.searchParams.get('data.id') || url.searchParams.get('id') || ''
  const dataId = String(body?.data?.id || queryDataId || '')

  // 1) Validar firma (mismo data.id que manda MP).
  const ok = await validSignature(req, queryDataId || dataId, webhookSecret)
  if (!ok) {
    console.error('[seller-fee-webhook] firma inválida', { type, dataId })
    return json({ error: 'Firma inválida.' }, 401)
  }

  // La cuota es un pago ÚNICO -> solo 'payment'. Otros topics se ignoran (200).
  if (type !== 'payment' || !dataId) {
    return json({ received: true, ignored: type || 'no_type' }, 200)
  }

  // 2) Reconsultar el pago real en MP (jamás confiar en el payload).
  const pr = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!pr.ok) {
    console.error('[seller-fee-webhook] no se pudo consultar el pago', dataId, pr.status)
    return json({ error: 'No se pudo consultar el pago.' }, 500) // 500 -> MP reintenta
  }
  const pay = await pr.json().catch(() => ({}))
  const extRef = String(pay?.external_reference || '')
  const payStatus = String(pay?.status || '')
  const payAmount = Number(pay?.transaction_amount)
  const payCurrency = String(pay?.currency_id || '')
  const metaUserId = pay?.metadata?.user_id ? String(pay.metadata.user_id) : ''

  // 3) ¿Es NUESTRO? external_reference debe ser un UUID de seller_verification_payments.
  //    Si no, NO es la cuota de vendedor (p.ej. un pago de membresía mal enrutado) -> ignorar.
  if (!UUID_RE.test(extRef)) {
    return json({ received: true, ignored: 'not_seller_fee' }, 200)
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: row, error: rowErr } = await admin
    .from('seller_verification_payments')
    .select('id, user_id, amount_cents, currency, status')
    .eq('id', extRef)
    .maybeSingle()
  if (rowErr) {
    console.error('[seller-fee-webhook] error leyendo el pago:', rowErr.message)
    return json({ error: 'Error leyendo el pago.' }, 500) // transitorio -> MP reintenta
  }
  if (!row) {
    return json({ received: true, ignored: 'not_seller_fee' }, 200) // external_reference no es nuestro
  }

  // Cross-checks anti-fraude: monto + moneda + usuario deben coincidir con lo que cobramos.
  const amountCents = Number.isFinite(payAmount) ? Math.round(payAmount * 100) : -1
  const amountOk = amountCents === row.amount_cents
  const currencyOk = payCurrency === row.currency
  const userOk = !metaUserId || metaUserId === row.user_id
  if (!amountOk || !currencyOk || !userOk) {
    console.error('[seller-fee-webhook] mismatch; NO se activa la cuota', {
      extRef, payAmount, payCurrency, metaUserId,
      expected_cents: row.amount_cents, expected_currency: row.currency, expected_user: row.user_id, payStatus,
    })
    return json({ received: true, ignored: 'mismatch' }, 200) // definitivo: no concedemos beneficio
  }

  // 4) Aplicar atómico e idempotente (marca pagado + activa el ciclo del vendedor).
  const { data: result, error: rpcErr } = await admin.rpc('rpc_apply_seller_fee_payment', {
    p_payment_row_id: row.id,
    p_mp_payment_id: dataId,
    p_status: payStatus,
  })
  if (rpcErr) {
    console.error('[seller-fee-webhook] RPC error:', rpcErr.message)
    return json({ error: 'Error procesando el pago.' }, 500) // -> MP reintenta
  }

  return json({ received: true, result, status: payStatus }, 200)
})
