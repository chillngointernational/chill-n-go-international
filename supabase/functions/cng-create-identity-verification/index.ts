// cng-create-identity-verification — crea/REUSA una VerificationSession HOSPEDADA en Verificamex
// (INE + CURP + selfie/prueba de vida en el widget). Devuelve form_url y guarda session_id <-> user_id.
// only_mobile_devices=false: el usuario puede verificar en compu O celular (QR nativo para pasar al móvil).
// phone_number (opcional, 10 dígitos): envía el link de verificación por WhatsApp al celular.
// Privacidad: with_webhook_binaries=false (NO recibimos imágenes). verify_jwt: true.
// Secretos: SUPABASE_*, VERIFICAMEX_ACCESS_TOKEN.

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

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* opcional */ }
  // El redirect SIEMPRE va al dominio de producción (configurable vía SITE_URL),
  // NUNCA al origin del request -> así no rebota a localhost cuando la sesión se
  // crea desde un entorno de dev y se termina en el celular. (En dev, define el
  // secret SITE_URL=http://localhost:5173 solo en tu entorno local.)
  const SITE_URL = (Deno.env.get('SITE_URL') || 'https://chillngointernational.com').replace(/\/+$/, '')
  const redirectUrl = `${SITE_URL}/app/feed?idv=return`
  const phoneRaw = (typeof body.phone_number === 'string') ? body.phone_number.replace(/\D/g, '') : ''
  const phoneNumber = phoneRaw.length === 10 ? phoneRaw : ''

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // REUSAR sesión pendiente: si el usuario ya tiene una sesión OPEN que sigue vigente
  // en Verificamex, devolver su form_url en vez de crear otra (evita sesiones huérfanas).
  // (Si pidieron WhatsApp con phone_number, creamos una nueva para que se envíe el link.)
  if (!phoneNumber) {
    const { data: existing } = await admin
      .from('identity_verifications')
      .select('session_id')
      .eq('user_id', user.id)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing?.session_id) {
      const chk = await fetch(`${VM_BASE}/${existing.session_id}`, {
        headers: { 'Authorization': `Bearer ${vmToken}`, 'Accept': 'application/json' },
      })
      if (chk.ok) {
        const chkData = (await chk.json().catch(() => ({})))?.data
        if (chkData?.status === 'OPEN' && chkData?.form_url) {
          return json({ form_url: chkData.form_url, session_id: chkData.id, reused: true })
        }
      }
    }
  }

  // Crear la sesión hospedada en Verificamex
  const payload: Record<string, unknown> = {
    validations: ['INE', 'CURP'],
    only_mobile_devices: false, // permite verificar en compu O celular
    redirect_url: redirectUrl,
    webhook: WEBHOOK_URL,
    with_webhook_binaries: false,
  }
  if (phoneNumber) payload.phone_number = phoneNumber // envía el link por WhatsApp al celular

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

  // Guardar el mapeo session_id <-> user_id (el webhook resuelve el usuario por aquí)
  const { error: insErr } = await admin.from('identity_verifications').insert({
    user_id: user.id,
    session_id: session.id,
    status: session.status || 'OPEN',
  })
  if (insErr) console.error('[cng-create-identity-verification] insert fallo:', insErr.message)

  return json({ form_url: session.form_url, session_id: session.id, sent_whatsapp: !!phoneNumber })
})
