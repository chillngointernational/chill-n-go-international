// cng-mark-shipped — el VENDEDOR dueño de la store de la orden marca el pedido como ENVIADO y captura
// la guía + paquetería. verify_jwt:true. FAIL-CLOSED: la autorización la garantiza rpc_mark_shipped
// (p_actor_id = stores.owner_id); este edge resuelve el profile.id del vendedor desde su JWT y traduce
// el retorno de la RPC a códigos HTTP. NO toca Mercado Pago.
// Secretos del runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  // Usuario autenticado desde el JWT (no confiar en ids del cliente).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : ''
  const trackingNumber = typeof body.tracking_number === 'string' ? body.tracking_number.trim() : ''
  const trackingCarrier = typeof body.tracking_carrier === 'string' ? body.tracking_carrier.trim() : ''
  const trackingUrl = typeof body.tracking_url === 'string' ? body.tracking_url.trim() : ''

  if (!UUID_RE.test(orderId)) return json({ error: 'Pedido inválido.', code: 'bad_order_id' }, 400)
  if (!trackingNumber) return json({ error: 'Falta el número de guía.', code: 'tracking_number_required' }, 400)
  if (!trackingCarrier) return json({ error: 'Falta la paquetería.', code: 'tracking_carrier_required' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // profile.id del vendedor (= stores.owner_id). Sin perfil -> fail-closed (403).
  const { data: prof, error: profErr } = await admin
    .from('identity_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (profErr) {
    console.error('[cng-mark-shipped] perfil error:', profErr.message)
    return json({ error: 'No se pudo validar tu cuenta. Intenta de nuevo.' }, 500)
  }
  if (!prof) return json({ error: 'No se encontró tu perfil.', code: 'no_profile' }, 403)

  // La autorización real la hace la RPC: p_actor_id debe ser el dueño de la store de la orden.
  const { data: result, error: rpcErr } = await admin.rpc('rpc_mark_shipped', {
    p_order_id: orderId,
    p_actor_id: prof.id,
    p_tracking_number: trackingNumber,
    p_tracking_carrier: trackingCarrier,
    p_tracking_url: trackingUrl || null,
    p_shipping_label_url: null, // gancho E-6: aquí irá la URL de la guía generada por Envia
  })
  if (rpcErr) {
    console.error('[cng-mark-shipped] RPC error:', rpcErr.message)
    return json({ error: 'No se pudo marcar el envío. Intenta de nuevo.' }, 500)
  }

  switch (result) {
    case 'shipped':         return json({ ok: true, status: 'shipped' }, 200)
    case 'forbidden':       return json({ error: 'No tienes permiso sobre este pedido.', code: 'forbidden' }, 403)
    case 'unknown_order':   return json({ error: 'El pedido no existe.', code: 'unknown_order' }, 404)
    case 'already_shipped': return json({ error: 'Este pedido ya estaba marcado como enviado.', code: 'already_shipped' }, 409)
    case 'bad_status':      return json({ error: 'Solo puedes marcar como enviado un pedido pagado.', code: 'bad_status' }, 409)
    default:                return json({ error: 'Respuesta inesperada del servidor.', code: String(result || 'unknown') }, 500)
  }
})
