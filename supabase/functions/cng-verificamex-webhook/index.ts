// cng-verificamex-webhook — recibe la notificación de Verificamex cuando una sesión termina.
// La doc NO define firma secreta para el webhook de sesiones: por eso la BARRERA DE SEGURIDAD
// es RE-CONSULTAR la sesión por GET (no confiar en el body). Mapeamos session_id -> user_id
// (solo sesiones que nosotros creamos) y aplicamos el resultado vía RPC atómico e idempotente.
// NO reparte Chilliums. verify_jwt: false. Secretos: SUPABASE_*, VERIFICAMEX_ACCESS_TOKEN.

import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const VM_BASE = 'https://api.verificamex.com/identity/v2/identity/sessions'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vmToken = Deno.env.get('VERIFICAMEX_ACCESS_TOKEN')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Config incompleta.' }, 500)
  if (!vmToken) return json({ error: 'Falta VERIFICAMEX_ACCESS_TOKEN.' }, 500)

  const url = new URL(req.url)
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* puede venir vacío / en query */ }

  const sessionId = String(
    body?.data?.id || body?.session_id || body?.id || body?.session?.id ||
    url.searchParams.get('id') || url.searchParams.get('session_id') || '',
  )
  if (!sessionId) return json({ received: true, ignored: 'sin session id' }, 200)

  // BARRERA DE SEGURIDAD: reconsultar el estado REAL en Verificamex.
  const r = await fetch(`${VM_BASE}/${sessionId}?include=ine,renapo,files`, {
    headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json' },
  })
  if (!r.ok) {
    console.error('[cng-verificamex-webhook] GET sesión falló', sessionId, r.status)
    return json({ error: 'No se pudo consultar la sesión.' }, 500) // 500 -> Verificamex reintenta
  }
  const d = ((await r.json().catch(() => ({})))?.data) || {}
  const status = d.status || null
  const result = (typeof d.result === 'number') ? d.result : null
  const ine = d?.ine?.data?.status
  const renapo = d?.renapo?.data?.status
  const ineStatus = (typeof ine === 'boolean') ? ine : null
  const renapoStatus = (typeof renapo === 'boolean') ? renapo : null
  const curp = d?.renapo?.data?.curp || d?.ine?.data?.curp || d?.ine_reading?.curp || null

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Resolver el usuario por session_id (solo sesiones creadas por nosotros).
  const { data: row } = await admin
    .from('identity_verifications')
    .select('user_id')
    .eq('session_id', sessionId)
    .maybeSingle()
  const userId = row?.user_id || null
  if (!userId) return json({ received: true, ignored: 'sesión desconocida' }, 200)

  const { data: outcome, error: rpcErr } = await admin.rpc('rpc_apply_identity_verification', {
    p_event_id: `${sessionId}:${status}`,
    p_session_id: sessionId,
    p_user_id: userId,
    p_status: status,
    p_result: result,
    p_ine: ineStatus,
    p_renapo: renapoStatus,
    p_curp: curp,
    p_raw: d,
  })
  if (rpcErr) {
    console.error('[cng-verificamex-webhook] RPC error:', rpcErr.message)
    return json({ error: 'Error procesando el resultado.' }, 500)
  }

  return json({ received: true, result: outcome, status }, 200)
})
