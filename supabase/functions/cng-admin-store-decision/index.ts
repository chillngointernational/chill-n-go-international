// cng-admin-store-decision — ÚNICA puerta admin-gated para cambiar el estado de una tienda.
// verify_jwt:true. Fail-closed + idempotente + ATÓMICO.
//
// La decisión la ejecuta el RPC public.rpc_admin_decide_store, que hace EN UNA SOLA
// TRANSACCIÓN: transición de stores.status + fila en store_moderation. O pasan los dos
// o no pasa ninguno -> nunca una tienda transicionada sin su auditoría.
//
// DOBLE CIERRE de admin:
//   1) aquí gateamos cng_is_admin() con el JWT del caller (403 limpio antes de llamar al RPC),
//   2) el RPC SE AUTO-GATEA con cng_is_admin() (fail-closed). Por eso lo llamamos con el
//      userClient (JWT del caller): así auth.uid() dentro del RPC = el admin real.
//
// El UPDATE dentro del RPC es CONDICIONAL (`... and status='pending'`): candado +
// idempotencia + fail-closed a la vez. El cliente NO puede mutar stores.status (blindaje
// por columnas); esta función + su RPC son el ÚNICO camino.
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY.

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  // Caller autenticado desde su JWT. TODO se ejecuta con este client (incluido el RPC),
  // para que el auto-gate del RPC evalúe al admin real (auth.uid() = caller).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  // GATE DE ADMIN #1 (server-side, fail-closed). 403 limpio antes de tocar el RPC.
  const { data: isAdmin, error: adminErr } = await userClient.rpc('cng_is_admin')
  if (adminErr || isAdmin !== true) return json({ error: 'No autorizado.', code: 'not_admin' }, 403)

  // Entrada.
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }

  const storeId = String(body.store_id || '')
  const decision = String(body.decision || '')
  if (!UUID_RE.test(storeId)) return json({ error: 'store_id inválido.', code: 'invalid_store_id' }, 400)
  if (decision !== 'approve' && decision !== 'reject') {
    return json({ error: 'Decisión inválida.', code: 'invalid_decision' }, 400)
  }
  const reason = (body.reason != null) ? String(body.reason).trim() : ''
  if (decision === 'reject' && reason.length === 0) {
    return json({ error: 'El motivo de rechazo es obligatorio.', code: 'reason_required' }, 400)
  }

  const action = decision === 'approve' ? 'approved' : 'rejected'

  // Decisión ATÓMICA (status + auditoría) en el RPC. GATE DE ADMIN #2 vive dentro del RPC.
  const { data: result, error: rpcErr } = await userClient.rpc('rpc_admin_decide_store', {
    p_store_id: storeId,
    p_action: action,
    p_reason: reason || null,
  })
  if (rpcErr) {
    console.error('[cng-admin-store-decision] rpc error:', rpcErr.message)
    return json({ error: 'No se pudo procesar la decisión. Intenta de nuevo.' }, 500)
  }

  switch (result) {
    case 'approved':
      return json({ ok: true, store_id: storeId, status: 'active', action: 'approved' })
    case 'rejected':
      return json({ ok: true, store_id: storeId, status: 'rejected', action: 'rejected' })
    case 'idempotent':
      return json({ ok: true, idempotent: true })
    case 'not_found':
      return json({ error: 'Tienda no encontrada.', code: 'not_found' }, 404)
    case 'forbidden':
      // Defensa: el RPC re-cerró el gate (no debería pasar tras el gate #1).
      return json({ error: 'No autorizado.', code: 'not_admin' }, 403)
    case 'reason_required':
      return json({ error: 'El motivo de rechazo es obligatorio.', code: 'reason_required' }, 400)
    case 'invalid_action':
      return json({ error: 'Decisión inválida.', code: 'invalid_decision' }, 400)
    default:
      console.error('[cng-admin-store-decision] respuesta inesperada del RPC:', result)
      return json({ error: 'Respuesta inesperada del servidor.' }, 500)
  }
})
