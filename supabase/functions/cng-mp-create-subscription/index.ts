// cng-mp-create-subscription — crea una suscripción (preapproval) de Mercado Pago para la
// membresía de Chill N Go (140 MXN/mes). SOLO cobro: NO reparte Chilliums.
//
// Llamada por el usuario autenticado (verify_jwt: true). Devuelve el init_point (checkout MP).
// Secretos del runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, MP_ACCESS_TOKEN.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const MEMBERSHIP_AMOUNT = 140
const MEMBERSHIP_CURRENCY = 'MXN'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  if (!mpToken) return json({ error: 'Falta MP_ACCESS_TOKEN en el servidor.' }, 500)

  // Usuario autenticado desde el JWT (no confiar en un user_id del cliente).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }
  const rawOrigin = (typeof body.return_url === 'string' && body.return_url) ? body.return_url : (req.headers.get('origin') || '')
  const baseOrigin = rawOrigin.endsWith('/') ? rawOrigin.slice(0, -1) : rawOrigin
  const backUrl = baseOrigin ? `${baseOrigin}/app/feed?sub=return` : 'https://chillngointernational.com/app/feed'

  // Crear preapproval en Mercado Pago
  const preapproval = {
    reason: 'Membresía Chill N Go',
    external_reference: user.id,
    payer_email: user.email,
    back_url: backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: MEMBERSHIP_AMOUNT,
      currency_id: MEMBERSHIP_CURRENCY,
    },
    status: 'pending',
  }

  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(preapproval),
  })
  const mpData = await mpRes.json().catch(() => ({}))
  if (!mpRes.ok || !mpData?.id || !mpData?.init_point) {
    console.error('[cng-mp-create-subscription] MP error:', mpRes.status, JSON.stringify(mpData))
    return json({ error: 'No se pudo crear la suscripción en Mercado Pago.', mp_status: mpRes.status, mp_message: mpData?.message }, 502)
  }

  // Registrar la suscripción (service_role; bypassa RLS)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { error: insErr } = await admin.from('subscriptions').insert({
    user_id: user.id,
    mp_preapproval_id: mpData.id,
    status: mpData.status || 'pending',
    amount_cents: MEMBERSHIP_AMOUNT * 100,
    currency: MEMBERSHIP_CURRENCY,
  })
  if (insErr) console.error('[cng-mp-create-subscription] insert subscription fallo:', insErr.message)

  return json({ init_point: mpData.init_point, preapproval_id: mpData.id })
})
