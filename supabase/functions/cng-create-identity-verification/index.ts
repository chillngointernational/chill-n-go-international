// cng-create-identity-verification — crea/REUSA una VerificationSession HOSPEDADA en Verificamex
// (INE + CURP + selfie/prueba de vida en el widget). Devuelve form_url y guarda session_id <-> user_id.
// only_mobile_devices=false: el usuario puede verificar en compu O celular (QR nativo para pasar al móvil).
// phone_number (opcional, 10 dígitos): envía el link de verificación por WhatsApp al celular.
// Privacidad: with_webhook_binaries=false (NO recibimos imágenes). verify_jwt: true.
// Secretos: SUPABASE_*, VERIFICAMEX_ACCESS_TOKEN, SITE_URL (opcional).
//
// CANDADOS ANTI-FUGA (server-side, ANTES de crear sesión, en este orden):
//  (8) PAGÓ: suscripción 'authorized' O cuenta de cortesía (membership_override). Si no -> 403.
//  (5) YA VERIFICADO: identity_verification_status='verified' -> 403 (nunca re-gasta tokens).
//  (7) LÍMITE 3: >=3 sesiones terminales no-verificadas (FINISHED/FAILED) -> 403.
//  (6) ANTI-DUPLICADO: sesión no terminal (OPEN/VERIFYING) -> reusar su form_url, nunca crear otra.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const VM_BASE = 'https://api.verificamex.com/identity/v2/identity/sessions'
const WEBHOOK_URL = 'https://osbsbrpdwjstvafhzjjj.supabase.co/functions/v1/cng-verificamex-webhook'
const SUPPORT_EMAIL = 'contact@chillngointernational.com'
const MAX_ATTEMPTS = 3

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const vmToken = Deno.env.get('VERIFICAMEX_ACCESS_TOKEN')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  if (!vmToken) return json({ error: 'Falta VERIFICAMEX_ACCESS_TOKEN en el servidor.' }, 500)

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // ---- CANDADOS ANTI-FUGA (server-side, antes de gastar tokens) ----

  // Perfil: estado de verificación + flag de cortesía.
  const { data: profile, error: profErr } = await admin
    .from('identity_profiles')
    .select('identity_verification_status, membership_override')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profErr) {
    console.error('[create-idv] perfil error:', profErr.message)
    return json({ error: 'No se pudo validar tu cuenta. Intenta de nuevo.' }, 500)
  }
  if (!profile) return json({ error: 'No se encontró tu perfil.', code: 'no_profile' }, 403)

  // (8) PAGÓ: suscripción 'authorized' o cuenta de cortesía.
  const { count: paidCount, error: paidErr } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'authorized')
  if (paidErr) {
    console.error('[create-idv] subs error:', paidErr.message)
    return json({ error: 'No se pudo validar tu membresía. Intenta de nuevo.' }, 500)
  }
  const hasPaid = (paidCount || 0) > 0 || profile.membership_override === true
  if (!hasPaid) {
    return json({ error: 'Debes activar tu membresía antes de verificar tu identidad.', code: 'payment_required' }, 403)
  }

  // (5) YA VERIFICADO: nunca re-gastar tokens.
  if (profile.identity_verification_status === 'verified') {
    return json({ error: 'Tu identidad ya está verificada.', code: 'already_verified' }, 403)
  }

  // (7) LÍMITE 3 INTENTOS: sesiones terminales no-verificadas (si llegamos aquí, ninguna pasó).
  const { count: terminalCount, error: termErr } = await admin
    .from('identity_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['FINISHED', 'FAILED'])
  if (termErr) {
    console.error('[create-idv] intentos error:', termErr.message)
    return json({ error: 'No se pudo validar tus intentos. Intenta de nuevo.' }, 500)
  }
  if ((terminalCount || 0) >= MAX_ATTEMPTS) {
    return json({
      error: `Has alcanzado el límite de intentos de verificación. Escríbenos a ${SUPPORT_EMAIL} para ayudarte.`,
      code: 'attempts_exhausted',
    }, 403)
  }

  // (6) ANTI-DUPLICADO: si hay sesión NO terminal (OPEN/VERIFYING), reusar su form_url
  //     (re-consultando a Verificamex), NUNCA crear otra. Aplica también con WhatsApp.
  //     FAIL-CLOSED: si no podemos confirmar/reusar, devolvemos 409 (jamás creamos una 2ª).
  const { data: inProgress, error: ipErr } = await admin
    .from('identity_verifications')
    .select('session_id')
    .eq('user_id', user.id)
    .in('status', ['OPEN', 'VERIFYING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ipErr) {
    console.error('[create-idv] inProgress error:', ipErr.message)
    return json({ error: 'No se pudo validar tu sesión en curso. Intenta de nuevo.' }, 500)
  }
  if (inProgress?.session_id) {
    let chk: Response | null = null
    try {
      chk = await fetch(`${VM_BASE}/${inProgress.session_id}`, {
        headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json' },
      })
    } catch (e) {
      console.error('[create-idv] reuse fetch error:', (e as Error)?.message)
    }
    if (chk && chk.ok) {
      const cd = (await chk.json().catch(() => ({})))?.data
      // Resumible -> reusar (nunca crear otra).
      if (cd?.form_url && (cd.status === 'OPEN' || cd.status === 'VERIFYING')) {
        return json({ form_url: cd.form_url, session_id: cd.id, reused: true })
      }
      // VM dice que ya NO está en progreso (terminal/otro): sincroniza nuestra fila para
      // no quedar atascados; el próximo intento ya no la verá "en curso".
      if (cd?.status && cd.status !== 'OPEN' && cd.status !== 'VERIFYING') {
        await admin.from('identity_verifications')
          .update({ status: cd.status, updated_at: new Date().toISOString() })
          .eq('session_id', inProgress.session_id)
      }
    }
    // Había una sesión no terminal que NO pudimos reusar (VM transitorio o recién sincronizada):
    // NUNCA creamos otra ahora. El cliente reintenta en unos segundos.
    return json({ error: 'Tienes una verificación en curso. Reinténtalo en unos segundos.', code: 'in_progress' }, 409)
  }

  // ---- Pasó los candados: crear sesión nueva ----

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* opcional */ }
  // El redirect SIEMPRE va al dominio de producción (configurable vía SITE_URL), nunca al origin.
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const redirectUrl = `${SITE_URL}/app/feed?idv=return`
  const phoneRaw = (typeof body.phone_number === 'string') ? body.phone_number.replace(/\D/g, '') : ''
  const phoneNumber = phoneRaw.length === 10 ? phoneRaw : ''

  const payload: Record<string, unknown> = {
    validations: ['INE', 'CURP'],
    only_mobile_devices: false,
    redirect_url: redirectUrl,
    webhook: WEBHOOK_URL,
    with_webhook_binaries: false,
  }
  if (phoneNumber) payload.phone_number = phoneNumber

  const vmRes = await fetch(VM_BASE, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const vmData = await vmRes.json().catch(() => ({}))
  const session = vmData?.data
  if (!vmRes.ok || !session?.id || !session?.form_url) {
    console.error('[cng-create-identity-verification] VM error:', vmRes.status, JSON.stringify(vmData))
    return json({ error: 'No se pudo iniciar la verificación de identidad.', vm_status: vmRes.status }, 502)
  }

  const { error: insErr } = await admin.from('identity_verifications').insert({
    user_id: user.id,
    session_id: session.id,
    status: session.status || 'OPEN',
  })
  if (insErr) {
    // 23505 = el índice único parcial (una sola sesión en curso por usuario) detectó una
    // CARRERA: otra petición concurrente ya creó la sesión en curso. La sesión VM que
    // acabamos de crear queda huérfana (el webhook la ignora por session_id desconocido).
    // No creamos un 2º registro; el cliente reintenta y reusa la sesión ganadora.
    if ((insErr as { code?: string }).code === '23505') {
      console.error('[create-idv] carrera (23505); sesión VM huérfana:', session.id)
      return json({ error: 'Tienes una verificación en curso. Reinténtalo en unos segundos.', code: 'in_progress' }, 409)
    }
    // FAIL-CLOSED: sin la fila de mapeo, el webhook ignoraría la sesión (session_id desconocido).
    // NO devolvemos éxito (evita un falso OK con sesión huérfana que re-quemaría tokens). El usuario reintenta.
    console.error('[cng-create-identity-verification] insert fallo:', insErr.message)
    return json({ error: 'No se pudo registrar tu sesión de verificación. Intenta de nuevo.' }, 500)
  }

  return json({ form_url: session.form_url, session_id: session.id, sent_whatsapp: !!phoneNumber })
})
