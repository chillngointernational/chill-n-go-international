// cng-accept-invitation — alta de cuentas SOLO por invitación (link de referido reutilizable).
//
// El registro público de Supabase Auth está APAGADO. Las cuentas se crean exclusivamente
// aqui, con service_role, validando contra el arbol de referidos (identity_profiles.referred_by).
//
// Acciones (POST JSON con campo "action"):
//   { action: "validate", ref_code }
//       -> { valid: true, inviter_name } | { valid: false }
//   { action: "accept", ref_code, email, password, full_name }
//       -> { success: true, ref_code } | { error: "mensaje claro" }
//
// Secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan por el runtime (no hardcodear).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Alfabeto sin caracteres ambiguos (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function generateUniqueRefCode(admin: ReturnType<typeof createClient>): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(7))
    let code = ''
    for (let i = 0; i < bytes.length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    const { data, error } = await admin
      .from('identity_profiles')
      .select('id')
      .eq('ref_code', code)
      .maybeSingle()
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
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo de la petición inválido.' }, 400)
  }

  const action = String(body.action || '')

  try {
    // ----- (a) VALIDATE -----
    if (action === 'validate') {
      const refCode = String(body.ref_code || '').trim()
      if (!refCode) return json({ valid: false })

      const { data: referrer, error } = await admin
        .from('identity_profiles')
        .select('id, full_name, display_name, ref_code, membership_status')
        .eq('ref_code', refCode)
        .maybeSingle()
      if (error) return json({ error: 'No se pudo validar la invitación.' }, 500)

      // No revelar si no existe vs inactivo: ambos => invalid.
      if (!referrer || referrer.membership_status !== 'active') return json({ valid: false })

      const inviterName = referrer.full_name || referrer.display_name || referrer.ref_code
      return json({ valid: true, inviter_name: inviterName })
    }

    // ----- (b) ACCEPT -----
    if (action === 'accept') {
      const refCode = String(body.ref_code || '').trim()
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()

      if (!refCode) return json({ error: 'Falta el código de invitación.' }, 400)
      if (!EMAIL_RE.test(email)) return json({ error: 'El correo no es válido.' }, 400)
      if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
      if (!fullName) return json({ error: 'Falta el nombre completo.' }, 400)

      // 1. Validar invitador activo.
      const { data: referrer, error: refErr } = await admin
        .from('identity_profiles')
        .select('id, membership_status, direct_referrals_count, referral_depth')
        .eq('ref_code', refCode)
        .maybeSingle()
      if (refErr) return json({ error: 'No se pudo validar la invitación.' }, 500)
      if (!referrer || referrer.membership_status !== 'active') {
        return json({ error: 'La invitación no es válida o el miembro que te invitó no está activo.' }, 400)
      }

      // 2. Crear usuario de Auth (email ya confirmado para login inmediato).
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, referred_by_code: refCode },
      })
      if (createErr || !created?.user) {
        const m = (createErr?.message || '').toLowerCase()
        if (m.includes('already') || m.includes('registered') || m.includes('exist')) {
          return json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión.', code: 'account_exists' }, 409)
        }
        if (m.includes('password')) {
          return json({ error: 'La contraseña no cumple los requisitos mínimos.' }, 400)
        }
        return json({ error: 'No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.' }, 400)
      }
      const newUserId = created.user.id

      // 3. Generar ref_code único para el nuevo miembro.
      const newRefCode = await generateUniqueRefCode(admin)
      if (!newRefCode) {
        await admin.auth.admin.deleteUser(newUserId).catch(() => {})
        return json({ error: 'No se pudo generar tu código de referido. Intenta de nuevo.' }, 500)
      }

      // 4. Insertar perfil. membership_status='pending': el acceso se activa al pagar la
      //    membresía (webhook de Mercado Pago). counters/chilliums/flags => defaults.
      const { data: profile, error: insErr } = await admin
        .from('identity_profiles')
        .insert({
          user_id: newUserId,
          email,
          full_name: fullName,
          referred_by: referrer.id,
          ref_code: newRefCode,
          referral_depth: (referrer.referral_depth ?? 0) + 1,
          membership_status: 'pending',
        })
        .select('id')
        .single()
      if (insErr || !profile) {
        // Evitar usuario de Auth huérfano si el perfil no se pudo crear.
        await admin.auth.admin.deleteUser(newUserId).catch(() => {})
        return json({ error: 'No se pudo crear tu perfil. Intenta de nuevo.' }, 500)
      }

      // 5. +1 a referidos directos del invitador (fuente de verdad del árbol).
      await admin
        .from('identity_profiles')
        .update({ direct_referrals_count: (referrer.direct_referrals_count ?? 0) + 1 })
        .eq('id', referrer.id)

      // 6. Bitácora en invitations (best-effort; el árbol vive en identity_profiles.referred_by).
      const { error: logErr } = await admin
        .from('invitations')
        .insert({
          invited_by: referrer.id,
          accepted_by: profile.id,
          email,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
      if (logErr) console.error('[cng-accept-invitation] invitations log fallo:', logErr.message)

      return json({ success: true, ref_code: newRefCode })
    }

    return json({ error: 'Acción no reconocida.' }, 400)
  } catch (e) {
    console.error('[cng-accept-invitation] error inesperado:', e)
    return json({ error: 'Error inesperado del servidor.' }, 500)
  }
})
