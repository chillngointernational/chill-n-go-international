// cng-mp-create-seller-fee — pago ÚNICO (Checkout Pro / preference) de la CUOTA de verificación de
// VENDEDOR. NO es suscripción (eso es la membresía). Cubre un ciclo de verificación (3 intentos),
// NO reembolsable. Monto: $249 MXN individual / $499 MXN company.
//
// GATE DE CONSENTIMIENTO: exige fee_consent_accepted=true y registra evidencia en payment_consents
// (texto canónico 'seller_fee_v1') ANTES de crear la preference. No se salta por API.
//
// POLÍTICA DE RE-PAGO: solo si !verification_fee_paid (primer ciclo) O verification_attempts>=3
// (ciclo agotado -> nuevo ciclo). NUNCA si el vendedor ya está 'verified'.
//
// El pago lo confirma el webhook DEDICADO cng-mp-seller-fee-webhook (pone verification_fee_paid=true
// y reinicia verification_attempts=0). verify_jwt: true.
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, MP_ACCESS_TOKEN, SITE_URL (opcional).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const WEBHOOK_URL = 'https://osbsbrpdwjstvafhzjjj.supabase.co/functions/v1/cng-mp-seller-fee-webhook'
const FEE_CURRENCY = 'MXN'
const MAX_ATTEMPTS = 3
// Monto de la cuota por tipo de vendedor (en pesos; *100 = centavos para auditoría).
const FEE_BY_TYPE: Record<string, number> = { individual: 249, company: 499 }

// Texto CANÓNICO del consentimiento (no-reembolso). El backend guarda ESTE texto como evidencia;
// el frontend debe mostrar exactamente lo mismo para la versión 'seller_fee_v1'.
const CONSENT_VERSION = 'seller_fee_v1'
const CONSENT_TEXT = 'La cuota de verificación cubre un ciclo de verificación de identidad (hasta 3 intentos) y NO es reembolsable, aun si la verificación no se completa.'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  if (!mpToken) return json({ error: 'Falta MP_ACCESS_TOKEN en el servidor.' }, 500)

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // (1) Debe existir vendedor con términos aceptados.
  const { data: seller, error: sellErr } = await admin
    .from('sellers')
    .select('id, seller_type, status, verification_fee_paid, verification_attempts, accepted_seller_terms_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (sellErr) return json({ error: 'No se pudo validar tu cuenta de vendedor.' }, 500)
  if (!seller) return json({ error: 'Primero regístrate como vendedor.', code: 'seller_required' }, 403)
  if (!seller.accepted_seller_terms_at) {
    return json({ error: 'Debes aceptar los términos de vendedor.', code: 'terms_required' }, 403)
  }

  // (2) Ya verificado: no se cobra.
  if (seller.status === 'verified') {
    return json({ error: 'Tu cuenta de vendedor ya está verificada.', code: 'already_verified' }, 409)
  }

  // (3) Política de re-pago: solo si !verification_fee_paid O intentos agotados (>=3).
  const attempts = seller.verification_attempts || 0
  if (seller.verification_fee_paid && attempts < MAX_ATTEMPTS) {
    return json({
      error: 'Ya tienes un ciclo de verificación activo con intentos disponibles. No necesitas pagar de nuevo.',
      code: 'cycle_active',
    }, 409)
  }

  // (4) Monto según tipo de vendedor.
  const feeAmount = FEE_BY_TYPE[seller.seller_type]
  if (!feeAmount) return json({ error: 'Tipo de vendedor inválido.', code: 'invalid_seller_type' }, 400)

  // GATE DE CONSENTIMIENTO: obligatorio aceptar "no reembolsable" antes de cobrar.
  if (body.fee_consent_accepted !== true) {
    return json({ error: 'Debes aceptar que la cuota no es reembolsable para continuar.', code: 'consent_required' }, 403)
  }

  // Evidencia del consentimiento ANTES de crear la preference (texto canónico del servidor).
  const { error: consentErr } = await admin.from('payment_consents').insert({
    user_id: user.id,
    version: CONSENT_VERSION,
    consent_text: CONSENT_TEXT,
  })
  if (consentErr) {
    console.error('[cng-mp-create-seller-fee] consent insert fallo:', consentErr.message)
    return json({ error: 'No se pudo registrar tu aceptación. Intenta de nuevo.' }, 500)
  }

  // Fila de auditoría del pago ('pending'); su id es el external_reference (el ciclo).
  const { data: payRow, error: payErr } = await admin
    .from('seller_verification_payments')
    .insert({
      user_id: user.id,
      seller_type: seller.seller_type,
      amount_cents: feeAmount * 100,
      currency: FEE_CURRENCY,
      status: 'pending',
      attempts_granted: MAX_ATTEMPTS,
    })
    .select('id')
    .single()
  if (payErr || !payRow?.id) {
    console.error('[cng-mp-create-seller-fee] payment row insert fallo:', payErr?.message)
    return json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' }, 500)
  }

  // back_url SIEMPRE a producción (SITE_URL), nunca al origin -> sin rebote a localhost.
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const backUrl = `${SITE_URL}/vender?fee=return`

  // Preference de pago ÚNICO (Checkout Pro). 3D Secure lo maneja MP automáticamente (checkout hospedado).
  const preference = {
    items: [{
      id: 'seller-verification-fee',
      title: seller.seller_type === 'company'
        ? 'Cuota de verificación de vendedor (empresa)'
        : 'Cuota de verificación de vendedor (persona física)',
      description: 'Cubre un ciclo de verificación de identidad (3 intentos). No reembolsable.',
      quantity: 1,
      unit_price: feeAmount,
      currency_id: FEE_CURRENCY,
    }],
    external_reference: payRow.id,
    metadata: { user_id: user.id, purpose: 'seller_verification_fee', payment_row_id: payRow.id, seller_type: seller.seller_type },
    back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
    auto_return: 'approved',
    notification_url: WEBHOOK_URL,
    payer: { email: user.email },
  }

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mpToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `seller-fee-${payRow.id}`,
    },
    body: JSON.stringify(preference),
  })
  const mpData = await mpRes.json().catch(() => ({}))
  if (!mpRes.ok || !mpData?.id || !mpData?.init_point) {
    console.error('[cng-mp-create-seller-fee] MP error:', mpRes.status, JSON.stringify(mpData))
    // El pago no arrancó: marca la fila 'failed' para no dejar 'pending' colgado.
    await admin.from('seller_verification_payments').update({ status: 'failed' }).eq('id', payRow.id)
    return json({ error: 'No se pudo crear el pago en Mercado Pago.', mp_status: mpRes.status, mp_message: mpData?.message }, 502)
  }

  return json({ init_point: mpData.init_point, payment_id: payRow.id, preference_id: mpData.id })
})
