// cng-seller-signup — registro PÚBLICO de vendedor (SIN invitación, SIN membresía). verify_jwt:false.
// Crea (o reusa) la cuenta + identity_profiles (membership 'pending' = NO miembro) + sellers ('draft')
// + evidencia de términos de vendedor (versión + timestamp). service_role.
//
// Dos caminos en una sola función:
//  - SIGNUP: sin sesión -> crea auth user (admin, email_confirm:true) con email/password/full_name.
//  - BECOME: con sesión (miembro o ya registrado) -> reusa su identity_profiles, solo crea sellers.
//
// NO toca el flujo de invitación de miembros (cng-accept-invitation). Secretos: SUPABASE_*.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const SELLER_TERMS_VERSION = 'v1'

async function generateUniqueRefCode(admin: ReturnType<typeof createClient>): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(7))
    let code = ''
    for (let i = 0; i < bytes.length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    const { data, error } = await admin.from('identity_profiles').select('id').eq('ref_code', code).maybeSingle()
    if (error) return null
    if (!data) return code
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return json({ error: 'Cuerpo inválido.' }, 400) }

  const sellerType = String(body.seller_type || '')
  if (sellerType !== 'individual' && sellerType !== 'company') {
    return json({ error: 'Tipo de vendedor inválido.' }, 400)
  }
  if (body.terms_accepted !== true) {
    return json({ error: 'Debes aceptar los términos de vendedor para continuar.', code: 'terms_required' }, 403)
  }

  // ---- Resolver usuario: sesión real (BECOME) vs signup nuevo ----
  let userId: string | null = null
  let profileEmail = ''
  const authHeader = req.headers.get('Authorization') || ''
  if (authHeader) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (user) { userId = user.id; profileEmail = user.email || '' }  // BECOME (anon key -> user null -> SIGNUP)
  }

  let createdNew = false
  if (!userId) {
    // ---- SIGNUP: crear cuenta nueva ----
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const fullName = String(body.full_name || '').trim()
    if (!EMAIL_RE.test(email)) return json({ error: 'El correo no es válido.' }, 400)
    if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    if (!fullName) return json({ error: 'Falta tu nombre completo.' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, is_seller_signup: true },
    })
    if (createErr || !created?.user) {
      const m = (createErr?.message || '').toLowerCase()
      if (m.includes('already') || m.includes('registered') || m.includes('exist')) {
        return json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión y conviértete en vendedor.', code: 'account_exists' }, 409)
      }
      if (m.includes('password')) return json({ error: 'La contraseña no cumple los requisitos mínimos.' }, 400)
      return json({ error: 'No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.' }, 400)
    }
    userId = created.user.id
    profileEmail = email
    createdNew = true
  }

  // ---- Asegurar identity_profiles (membership 'pending' EXPLÍCITO: el default es 'active') ----
  const { data: prof, error: profSelErr } = await admin
    .from('identity_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (profSelErr) {
    if (createdNew) await admin.auth.admin.deleteUser(userId).catch(() => {})
    return json({ error: 'No se pudo validar tu perfil. Intenta de nuevo.' }, 500)
  }
  if (!prof) {
    const refCode = await generateUniqueRefCode(admin)
    if (!refCode) {
      if (createdNew) await admin.auth.admin.deleteUser(userId).catch(() => {})
      return json({ error: 'No se pudo generar tu código. Intenta de nuevo.' }, 500)
    }
    const fullName = String(body.full_name || '').trim() || null
    const { error: insProfErr } = await admin.from('identity_profiles').insert({
      user_id: userId,
      email: profileEmail,
      full_name: fullName,
      ref_code: refCode,
      membership_status: 'pending',          // NO miembro (default de la columna es 'active')
      identity_verification_status: 'unverified',
    })
    if (insProfErr) {
      if (createdNew) await admin.auth.admin.deleteUser(userId).catch(() => {})
      return json({ error: 'No se pudo crear tu perfil. Intenta de nuevo.' }, 500)
    }
  }

  // ---- Crear sellers (idempotente: si ya es vendedor, devolver su estado) ----
  const { data: existing, error: sellSelErr } = await admin
    .from('sellers').select('id, status').eq('user_id', userId).maybeSingle()
  if (sellSelErr) return json({ error: 'No se pudo validar tu registro de vendedor.' }, 500)
  if (existing) {
    return json({ success: true, already_seller: true, seller_status: existing.status, created_account: createdNew })
  }

  const { error: insSellErr } = await admin.from('sellers').insert({
    user_id: userId,
    seller_type: sellerType,
    status: 'draft',
    accepted_seller_terms_at: new Date().toISOString(),
    accepted_seller_terms_version: SELLER_TERMS_VERSION,
  })
  if (insSellErr) {
    // Solo limpiamos la cuenta si la creamos NOSOTROS en este request (no a un miembro existente).
    if (createdNew) await admin.auth.admin.deleteUser(userId).catch(() => {})
    return json({ error: 'No se pudo iniciar tu registro de vendedor. Intenta de nuevo.' }, 500)
  }

  return json({ success: true, created_account: createdNew, needs_login: createdNew, seller_status: 'draft' })
})
