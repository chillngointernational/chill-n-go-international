// cng-mp-webhook — recibe notificaciones de Mercado Pago para la suscripción de membresía.
// 1) Valida la firma HMAC (x-signature) con MP_WEBHOOK_SECRET.
// 2) Reconsulta el recurso en la API de MP (NUNCA confía en el payload).
// 3) Aplica el estado vía RPC atómico e idempotente (activa/cancela la membresía).
// NO reparte Chilliums. verify_jwt: false (MP no envía JWT de Supabase; la seguridad es la firma).
// Secretos del runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Valida la firma del webhook de MP (https://www.mercadopago.com.mx/developers — Webhooks/Firma).
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
  // Plantilla oficial: id:<data.id>;request-id:<x-request-id>;ts:<ts>;  (data.id en minúsculas)
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // Comparación de igual longitud (ambos hex)
  if (hex.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

// Resuelve el id de preapproval a partir del tipo de evento.
async function resolvePreapprovalId(type: string, dataId: string, mpToken: string): Promise<string | null> {
  if (!dataId) return null
  if (type.includes('preapproval')) return dataId
  if (type.includes('authorized_payment')) {
    const r = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    if (r.ok) { const d = await r.json().catch(() => ({})); return d?.preapproval_id || null }
    return null
  }
  if (type === 'payment') {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    if (r.ok) { const d = await r.json().catch(() => ({})); return d?.metadata?.preapproval_id || d?.preapproval_id || null }
    return null
  }
  return null
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
  // data.id puede venir en el body o como query param "data.id"
  const queryDataId = url.searchParams.get('data.id') || url.searchParams.get('id') || ''
  const dataId = String(body?.data?.id || queryDataId || '')
  const notifId = String(body?.id || req.headers.get('x-request-id') || dataId)

  // 1) Validar firma (usa el data.id tal cual lo manda MP)
  const ok = await validSignature(req, queryDataId || dataId, webhookSecret)
  if (!ok) {
    console.error('[cng-mp-webhook] firma inválida', { type, dataId })
    return json({ error: 'Firma inválida.' }, 401)
  }

  // 2) Resolver preapproval y reconsultar su estado real en MP
  const preId = await resolvePreapprovalId(type, dataId, mpToken)
  if (!preId) return json({ received: true, ignored: type }, 200)

  const pr = await fetch(`https://api.mercadopago.com/preapproval/${preId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!pr.ok) {
    console.error('[cng-mp-webhook] no se pudo consultar preapproval', preId, pr.status)
    return json({ error: 'No se pudo consultar el preapproval.' }, 500) // 500 -> MP reintenta
  }
  const pre = await pr.json().catch(() => ({}))
  const userId = pre?.external_reference || null
  const status = pre?.status || null

  // 3) Aplicar de forma atómica e idempotente
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: result, error: rpcErr } = await admin.rpc('rpc_apply_mp_subscription_event', {
    p_event_id: notifId,
    p_topic: type,
    p_preapproval_id: preId,
    p_user_id: userId,
    p_status: status,
    p_raw: pre,
  })
  if (rpcErr) {
    console.error('[cng-mp-webhook] RPC error:', rpcErr.message)
    return json({ error: 'Error procesando el evento.' }, 500)
  }

  return json({ received: true, result, status }, 200)
})
