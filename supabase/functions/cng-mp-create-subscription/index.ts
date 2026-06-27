// cng-mp-create-subscription — crea la suscripción de membresía ($140/mes) ENGANCHADA al
// preapproval_plan de MP (Palanca #1) usando un card_token (Bricks). status:'authorized' =
// cargo/validación inmediata de la tarjeta. La tarjeta NUNCA toca el servidor: el Card Payment
// Brick la tokeniza en el cliente; aquí solo llega el token de un solo uso.
//
// Conserva: auth (verify_jwt:true) + gate de consentimiento (terms_accepted) + evidencia en
// payment_consents (texto canónico v1). El webhook (cng-mp-webhook) NO cambia: mapea por
// external_reference=user.id. Además, al autorizar, activamos la membresía al instante con el
// MISMO RPC idempotente del webhook (rpc_apply_mp_subscription_event); el webhook reconcilia luego.
//
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
// como evidencia. El frontend debe mostrar exactamente lo mismo para la versión 'v1'.
const CONSENT_VERSION = 'v1'
const CONSENT_TEXT_V1 = [
  'Antes de pagar, acepto que:',
  '• Mi membresía es un cargo mensual recurrente y no es reembolsable.',
  '• Después de pagar, debo verificar mi identidad con mi INE para activar mi cuenta.',
  '• Si no completo la verificación (por cualquier motivo), mi pago no se reembolsa y mi cuenta no se activa.',
  '• Acepto el tratamiento de mis datos según el Aviso de Privacidad.',
].join('\n')

// Traduce el detalle de rechazo de Mercado Pago a un mensaje claro en español (motivo REAL).
function rejectionMessage(detail: string | null, fallback?: string | null): string {
  const map: Record<string, string> = {
    cc_rejected_call_for_authorize: 'Tu banco requiere que autorices este cargo. Llámalo y reintenta, o usa otra tarjeta.',
    cc_rejected_insufficient_amount: 'Fondos insuficientes en la tarjeta.',
    cc_rejected_bad_filled_security_code: 'El código de seguridad (CVV) es incorrecto.',
    cc_rejected_bad_filled_date: 'La fecha de vencimiento es incorrecta.',
    cc_rejected_bad_filled_card_number: 'El número de tarjeta es incorrecto.',
    cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta e intenta de nuevo.',
    cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Intenta con otra tarjeta.',
    cc_rejected_max_attempts: 'Alcanzaste el máximo de intentos. Intenta más tarde o con otra tarjeta.',
    cc_rejected_card_disabled: 'La tarjeta está inhabilitada. Llama a tu banco o usa otra.',
    cc_rejected_duplicated_payment: 'Ya hay un cargo igual reciente. Espera un momento o usa otra tarjeta.',
    cc_rejected_blacklist: 'El pago no pudo procesarse. Usa otra tarjeta.',
    cc_rejected_card_type_not_allowed: 'Ese tipo de tarjeta no está habilitada. Usa otra.',
    cc_rejected_other_reason: 'Tu banco rechazó el pago. Intenta con otra tarjeta o llama a tu banco.',
  }
  return (detail && map[detail]) || fallback || 'No se pudo procesar el pago. Intenta con otra tarjeta o más tarde.'
}

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

  const cardToken = typeof body.card_token === 'string' ? body.card_token.trim() : ''
  if (!cardToken) return json({ error: 'Falta el token de la tarjeta. Intenta de nuevo.', code: 'card_token_required' }, 400)
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : ''

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // GUARD PRE-COBRO 1: el perfil debe existir, si no la membresía nunca se activaría (cobro huérfano).
  const { data: prof, error: profErr } = await admin
    .from('identity_profiles').select('user_id').eq('user_id', user.id).maybeSingle()
  if (profErr) {
    console.error('[cng-mp-create-subscription] lectura de perfil fallo:', profErr.message)
    return json({ error: 'No se pudo verificar tu perfil. Intenta de nuevo.' }, 500)
  }
  if (!prof) return json({ error: 'Tu perfil aún no está listo. Contacta a soporte.', code: 'no_profile' }, 409)

  // GUARD PRE-COBRO 2 (anti-duplicado): si ya hay una suscripción activa, no cobrar otra vez.
  const { data: actives, error: actErr } = await admin
    .from('subscriptions').select('mp_preapproval_id').eq('user_id', user.id).eq('status', 'authorized').limit(1)
  if (actErr) {
    console.error('[cng-mp-create-subscription] lectura de suscripción fallo:', actErr.message)
    return json({ error: 'No se pudo verificar tu suscripción. Intenta de nuevo.' }, 500)
  }
  if (actives && actives.length > 0) {
    return json({ ok: true, preapproval_id: actives[0].mp_preapproval_id, status: 'authorized', already: true })
  }

  // Evidencia del consentimiento ANTES de cobrar (texto canónico del servidor).
  const { error: consentErr } = await admin.from('payment_consents').insert({
    user_id: user.id,
    version: CONSENT_VERSION,
    consent_text: CONSENT_TEXT_V1,
  })
  if (consentErr) {
    console.error('[cng-mp-create-subscription] consent insert fallo:', consentErr.message)
    return json({ error: 'No se pudo registrar tu aceptación. Intenta de nuevo.' }, 500)
  }

  // Plan de membresía desde la config (Palanca #1).
  const { data: cfg, error: cfgErr } = await admin
    .from('platform_config').select('membership_plan_id').eq('id', true).maybeSingle()
  const planId = cfg?.membership_plan_id || null
  if (cfgErr || !planId) {
    console.error('[cng-mp-create-subscription] sin membership_plan_id:', cfgErr?.message)
    return json({ error: 'Configuración de membresía incompleta. Contacta a soporte.' }, 500)
  }

  // back_url SIEMPRE al dominio de producción (en el flujo API no se usa como redirect, pero MP lo acepta).
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')

  // Suscripción ENGANCHADA al plan, con tarjeta tokenizada, autorizada de inmediato.
  // Cuerpo idéntico al que la sonda validó (plan + payer_email + back_url + status) + card_token_id.
  // NO se envía auto_recurring: la recurrencia ($140/mes MXN) la dicta el plan.
  const preapproval = {
    preapproval_plan_id: planId,
    reason: 'Membresía Chill N Go',
    external_reference: user.id, // el webhook mapea al usuario por aquí
    payer_email: user.email,
    card_token_id: cardToken,
    back_url: `${SITE_URL}/app/feed?sub=return`,
    status: 'authorized',
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${mpToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': crypto.randomUUID(),
  }
  if (deviceId) headers['X-meli-session-id'] = deviceId // antifraude (best-effort)

  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST', headers, body: JSON.stringify(preapproval),
  })
  const mpData = await mpRes.json().catch(() => ({} as Record<string, any>))

  // Detalle de rechazo (defensivo: MP lo coloca en distintos campos según el caso).
  const detail: string | null = (mpData?.status_detail)
    || (mpData?.summarized?.last_charged_payment_status_detail)
    || (Array.isArray(mpData?.cause) ? mpData.cause[0]?.description : null)
    || null

  if (!mpRes.ok || !mpData?.id) {
    console.error('[cng-mp-create-subscription] MP error', mpRes.status, JSON.stringify(mpData))
    return json({ error: rejectionMessage(detail, mpData?.message), code: detail || 'mp_error' }, 402)
  }
  if (mpData.status !== 'authorized') {
    console.error('[cng-mp-create-subscription] no autorizada', mpData.status, detail)
    return json({ error: rejectionMessage(detail, 'Tu banco no autorizó el cargo. Intenta con otra tarjeta.'), code: detail || mpData.status || 'not_authorized' }, 402)
  }

  // Autorizada: registrar la suscripción (service_role; bypassa RLS).
  // Si una carrera ya insertó una 'authorized' para este user, el índice único parcial
  // (subscriptions_one_active_per_user) lanza 23505: lo tratamos como ok (ya quedó activa).
  const { error: insErr } = await admin.from('subscriptions').insert({
    user_id: user.id,
    mp_preapproval_id: mpData.id,
    status: 'authorized',
    amount_cents: MEMBERSHIP_AMOUNT * 100,
    currency: MEMBERSHIP_CURRENCY,
  })
  if (insErr && insErr.code !== '23505') console.error('[cng-mp-create-subscription] insert subscription fallo:', insErr.message)
  else if (insErr) console.warn('[cng-mp-create-subscription] suscripción duplicada por carrera (user', user.id, ') — revisar MP para posible doble cargo')

  // Activación INMEDIATA (mismo RPC idempotente del webhook). El webhook reconcilia luego sin duplicar.
  const { error: rpcErr } = await admin.rpc('rpc_apply_mp_subscription_event', {
    p_event_id: `create-${mpData.id}`,
    p_topic: 'subscription_preapproval',
    p_preapproval_id: mpData.id,
    p_user_id: user.id,
    p_status: 'authorized',
    p_raw: mpData,
  })
  if (rpcErr) console.error('[cng-mp-create-subscription] apply rpc fallo:', rpcErr.message)

  return json({ ok: true, preapproval_id: mpData.id, status: mpData.status })
})
