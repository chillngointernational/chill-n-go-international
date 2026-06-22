// cng-create-seller-verification — verificación INE del VENDEDOR. verify_jwt:true.
// Reusa el webhook COMPARTIDO (cng-verificamex-webhook), que NO se toca: marca el flag a nivel
// persona (identity_profiles.identity_verification_status). FLUJO DE DOS FASES: al crear la sesión
// la persona AÚN no está verificada; la pata INE del seller (status + rep_legal_ine_verified para
// empresa) se marca en el camino de REÚSO/REFRESH, cuando el frontend RE-LLAMA esta función al
// volver de Verificamex y la persona ya quedó 'verified'. (1c-5 además debe DERIVAR la pata INE de
// empresa de identity_verification_status, por si el refresh no ocurre.)
//
// Candados (en orden):
//  (1) Debe existir seller con términos aceptados -> si no, 403.
//  (2) INE COMPARTIDO: si la persona ya está 'verified', NO gasta tokens -> marca la pata INE del
//      seller (empresa: rep_legal_ine_verified=true) y devuelve reused.
//  (FEE) Crear sesión nueva (~20 tokens) EXIGE verification_fee_paid=true (gate anti-quema). El
//        reúso (0 tokens) no exige cuota.
//  (3) LÍMITE 3 intentos por ciclo: sellers.verification_attempts (se incrementa al crear sesión;
//      1c-5 lo resetea al pagar una nueva cuota).
//  (4) ANTI-DUPLICADO fail-closed: reusa OPEN/VERIFYING; 409 si no se confirma; carrera 23505.
// redirect_url SIEMPRE = SITE_URL/vender (nunca el origin -> no rebota a localhost).

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
  const nowIso = new Date().toISOString()

  // (1) seller + términos
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

  const { data: profile, error: profErr } = await admin
    .from('identity_profiles')
    .select('id, identity_verification_status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profErr || !profile) return json({ error: 'No se pudo validar tu perfil. Intenta de nuevo.' }, 500)

  // Avanza la "pata INE" del vendedor (sin degradar un status 'verified'/'rejected').
  async function markSellerIneLeg() {
    if (seller.status === 'draft') {
      await admin.from('sellers').update({ status: 'pending_verification', updated_at: nowIso }).eq('id', seller.id)
    }
    if (seller.seller_type === 'company') {
      const { data: fd } = await admin.from('seller_fiscal_data').select('id').eq('seller_id', seller.id).maybeSingle()
      if (fd) {
        await admin.from('seller_fiscal_data').update({ rep_legal_ine_verified: true, updated_at: nowIso }).eq('id', fd.id)
      } else {
        await admin.from('seller_fiscal_data').insert({ seller_id: seller.id, user_id: user.id, rep_legal_ine_verified: true })
      }
    }
  }

  // (2) INE COMPARTIDO: ya verificado -> 0 tokens, marca la pata y devuelve.
  if (profile.identity_verification_status === 'verified') {
    await markSellerIneLeg()
    return json({ ine_verified: true, reused: true, message: 'Tu identidad ya estaba verificada.' })
  }

  // (FEE) Crear sesión nueva gasta ~20 tokens -> EXIGE cuota pagada.
  if (!seller.verification_fee_paid) {
    return json({ error: 'Debes pagar la cuota de verificación de vendedor antes de verificar tu identidad.', code: 'fee_required' }, 403)
  }

  // (3) LÍMITE 3 intentos por ciclo: sellers.verification_attempts (se incrementa al crear una
  //     sesión nueva; 1c-5 lo resetea a 0 al confirmar el pago de una nueva cuota).
  if ((seller.verification_attempts || 0) >= MAX_ATTEMPTS) {
    return json({
      error: `Has alcanzado el límite de intentos de verificación. Escríbenos a ${SUPPORT_EMAIL} para ayudarte.`,
      code: 'attempts_exhausted',
    }, 403)
  }

  // (4) ANTI-DUPLICADO fail-closed: reusa OPEN/VERIFYING; jamás crea una 2ª.
  const { data: inProgress, error: ipErr } = await admin
    .from('identity_verifications')
    .select('session_id')
    .eq('user_id', user.id)
    .in('status', ['OPEN', 'VERIFYING'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (ipErr) return json({ error: 'No se pudo validar tu sesión en curso. Intenta de nuevo.' }, 500)
  if (inProgress?.session_id) {
    let chk: Response | null = null
    try {
      chk = await fetch(`${VM_BASE}/${inProgress.session_id}`, {
        headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json' },
      })
    } catch (e) { console.error('[seller-idv] reuse fetch error:', (e as Error)?.message) }
    if (chk && chk.ok) {
      const cd = (await chk.json().catch(() => ({})))?.data
      if (cd?.form_url && (cd.status === 'OPEN' || cd.status === 'VERIFYING')) {
        return json({ form_url: cd.form_url, session_id: cd.id, reused: true })
      }
      if (cd?.status && cd.status !== 'OPEN' && cd.status !== 'VERIFYING') {
        await admin.from('identity_verifications').update({ status: cd.status, updated_at: nowIso }).eq('session_id', inProgress.session_id)
      }
    }
    return json({ error: 'Tienes una verificación en curso. Reinténtalo en unos segundos.', code: 'in_progress' }, 409)
  }

  // Crear sesión INE nueva (redirect SIEMPRE a producción vía SITE_URL).
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const redirectUrl = `${SITE_URL}/vender?idv=return`
  const payload = {
    validations: ['INE', 'CURP'],
    only_mobile_devices: false,
    redirect_url: redirectUrl,
    webhook: WEBHOOK_URL,
    with_webhook_binaries: false,
  }
  const vmRes = await fetch(VM_BASE, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const vmData = await vmRes.json().catch(() => ({}))
  const session = vmData?.data
  if (!vmRes.ok || !session?.id || !session?.form_url) {
    console.error('[cng-create-seller-verification] VM error:', vmRes.status, JSON.stringify(vmData))
    return json({ error: 'No se pudo iniciar la verificación de identidad.', vm_status: vmRes.status }, 502)
  }

  const { error: insErr } = await admin.from('identity_verifications').insert({
    user_id: user.id,
    session_id: session.id,
    status: session.status || 'OPEN',
  })
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') {
      console.error('[seller-idv] carrera (23505); sesión VM huérfana:', session.id)
      return json({ error: 'Tienes una verificación en curso. Reinténtalo en unos segundos.', code: 'in_progress' }, 409)
    }
    // FAIL-CLOSED: sin la fila de mapeo, el webhook ignoraría la sesión. NO devolvemos éxito
    // (evita un falso OK con sesión huérfana). El usuario reintenta.
    console.error('[cng-create-seller-verification] insert fallo:', insErr.message)
    return json({ error: 'No se pudo registrar tu sesión de verificación. Intenta de nuevo.' }, 500)
  }

  // Token gastado + sesión registrada: contabiliza el intento y avanza status (no degrada terminales).
  await admin.from('sellers').update({
    verification_attempts: (seller.verification_attempts || 0) + 1,
    status: seller.status === 'draft' ? 'pending_verification' : seller.status,
    updated_at: nowIso,
  }).eq('id', seller.id)

  return json({ form_url: session.form_url, session_id: session.id })
})
