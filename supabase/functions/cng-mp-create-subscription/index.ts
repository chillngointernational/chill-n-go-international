// cng-mp-create-subscription — crea una suscripción (preapproval) de Mercado Pago para la
// membresía de Chill N Go (140 MXN/mes). SOLO cobro: NO reparte Chilliums.
//
// GATE DE CONSENTIMIENTO: exige terms_accepted=true y registra evidencia en payment_consents
// (texto canónico v1 + timestamp) ANTES de crear el preapproval. No se puede saltar por API.
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

// Texto CANÓNICO del consentimiento de pago. El backend guarda ESTE texto (no el del cliente)
// como evidencia. El frontend (sub-paso 3) debe mostrar exactamente lo mismo para la versión 'v1'.
const CONSENT_VERSION = 'v1'
const CONSENT_TEXT_V1 = [
  'Antes de pagar, acepto que:',
  '• Mi membresía es un cargo mensual recurrente y no es reembolsable.',
  '• Después de pagar, debo verificar mi identidad con mi INE para activar mi cuenta.',
  '• Si no completo la verificación (por cualquier motivo), mi pago no se reembolsa y mi cuenta no se activa.',
  '• Acepto el tratamiento de mis datos según el Aviso de Privacidad.',
].join('\n')

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

  // GATE DE CONSENTIMIENTO: obligatorio aceptar términos (no-reembolso) antes de cobrar.
  if (body.terms_accepted !== true) {
    return json({ error: 'Debes aceptar los términos para continuar.', code: 'terms_required' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Registrar evidencia del consentimiento ANTES de crear el preapproval (texto canónico del servidor).
  const { error: consentErr } = await admin.from('payment_consents').insert({
    user_id: user.id,
    version: CONSENT_VERSION,
    consent_text: CONSENT_TEXT_V1,
  })
  if (consentErr) {
    console.error('[cng-mp-create-subscription] consent insert fallo:', consentErr.message)
    return json({ error: 'No se pudo registrar tu aceptación. Intenta de nuevo.' }, 500)
  }

  // back_url SIEMPRE al dominio de producción (configurable vía SITE_URL), nunca al origin
  // del request -> no rebota a localhost si se paga desde dev y se vuelve en el celular.
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const backUrl = `${SITE_URL}/app/feed?sub=return`

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
