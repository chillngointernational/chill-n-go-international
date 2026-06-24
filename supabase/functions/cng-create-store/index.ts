// cng-create-store — crea la tienda de un VENDEDOR VERIFICADO. verify_jwt:true.
// Creación SOLO server-side (service_role): el cliente no tiene INSERT en stores.
// Candados fail-closed (en orden): autenticado -> sellers.status='verified' (+términos) ->
// resuelve owner_id (identity_profiles.id) -> ONE-PER-SELLER (devuelve la existente si ya hay).
// Slug: slugify(name), formato/longitud, reservados, unicidad (sufijo si choca); FIJO tras crear
// (el cliente no puede UPDATE slug). logo_url (opcional) DEBE ser de cng-store-assets/<user_id>/.
// La tienda nace status='pending' (la aprueba un admin en la Etapa D). Secretos: SUPABASE_*.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const NAME_MIN = 2, NAME_MAX = 60
const SLUG_MIN = 3, SLUG_MAX = 40
const RESERVED = new Set([
  'admin', 'app', 'api', 'vender', 'tienda', 'store', 'stores', 'goshop', 'www',
  'login', 'join', 'feed', 'explore', 'post', 'account', 'dashboard', 'null', 'undefined',
])
// Alfabeto sin caracteres ambiguos para sufijos de slug.
const SUFFIX_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
}
function randSuffix(n = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length]
  return out
}
function withSuffix(base: string, suffix: string): string {
  // Mantiene longitud <= SLUG_MAX recortando la base si hace falta.
  const room = SLUG_MAX - (suffix.length + 1)
  return `${base.slice(0, Math.max(1, room))}-${suffix}`.replace(/-{2,}/g, '-')
}

// Devuelve un slug único y válido, o null si no se pudo tras varios intentos.
async function resolveUniqueSlug(
  admin: ReturnType<typeof createClient>,
  proposed: string,
): Promise<string | null> {
  let candidate = proposed
  // Si es reservado o muy corto, arranca ya con sufijo.
  if (RESERVED.has(candidate) || candidate.length < SLUG_MIN) candidate = withSuffix(proposed || 'tienda', randSuffix())
  for (let i = 0; i < 12; i++) {
    if (candidate.length < SLUG_MIN || candidate.length > SLUG_MAX || !/^[a-z0-9-]+$/.test(candidate) || RESERVED.has(candidate)) {
      candidate = withSuffix(proposed || 'tienda', randSuffix()); continue
    }
    const { data, error } = await admin.from('stores').select('id').eq('slug', candidate).maybeSingle()
    if (error) return null
    if (!data) return candidate
    candidate = withSuffix(proposed || 'tienda', randSuffix())
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

  // Usuario autenticado desde el JWT (no confiar en un user_id del cliente).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'No autenticado.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // (1) Debe ser VENDEDOR VERIFICADO con términos aceptados.
  const { data: seller, error: sellErr } = await admin
    .from('sellers')
    .select('status, accepted_seller_terms_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (sellErr) return json({ error: 'No se pudo validar tu cuenta de vendedor.' }, 500)
  if (!seller) return json({ error: 'Primero regístrate como vendedor.', code: 'seller_required' }, 403)
  if (seller.status !== 'verified') {
    return json({ error: 'Debes completar tu verificación de vendedor antes de crear tu tienda.', code: 'not_verified' }, 403)
  }
  if (!seller.accepted_seller_terms_at) {
    return json({ error: 'Debes aceptar los términos de vendedor.', code: 'terms_required' }, 403)
  }

  // (2) owner_id = identity_profiles.id del caller.
  const { data: profile, error: profErr } = await admin
    .from('identity_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (profErr) return json({ error: 'No se pudo validar tu perfil. Intenta de nuevo.' }, 500)
  if (!profile) return json({ error: 'No se encontró tu perfil.', code: 'no_profile' }, 403)

  // (3) ONE-PER-SELLER: si ya tiene tienda, devuélvela (idempotente; refuerzo en uq_stores_owner).
  const { data: existing, error: exErr } = await admin
    .from('stores').select('id, slug, status').eq('owner_id', profile.id).maybeSingle()
  if (exErr) return json({ error: 'No se pudo validar tu tienda. Intenta de nuevo.' }, 500)
  if (existing) return json({ already_exists: true, store: existing })

  // (4) Validar entrada.
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body opcional */ }

  const name = String(body.name || '').trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return json({ error: `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`, code: 'invalid_name' }, 400)
  }
  const description = body.description != null ? String(body.description).trim() : null
  const logoUrl = body.logo_url != null ? String(body.logo_url).trim() : null

  // logo_url (opcional) DEBE apuntar a NUESTRO bucket y a la carpeta del propio user (A-3).
  if (logoUrl) {
    const expectedPrefix = `${supabaseUrl}/storage/v1/object/public/cng-store-assets/${user.id}/`
    if (!logoUrl.startsWith(expectedPrefix)) {
      return json({ error: 'El logo no es válido.', code: 'invalid_logo' }, 400)
    }
  }

  // Slug: del propuesto (si vino) o del nombre; validado + único; FIJO tras crear.
  const baseSlug = slugify(typeof body.slug === 'string' && body.slug.trim() ? String(body.slug) : name)
  const slug = await resolveUniqueSlug(admin, baseSlug)
  if (!slug) return json({ error: 'No se pudo generar la dirección de tu tienda. Intenta con otro nombre.', code: 'slug_failed' }, 500)

  // (5) Insertar la tienda (service_role; bypassa RLS). status='pending' (aprueba un admin).
  const { data: created, error: insErr } = await admin
    .from('stores')
    .insert({ owner_id: profile.id, name, slug, description, logo_url: logoUrl, status: 'pending', brand_config: {} })
    .select('id, slug, status')
    .single()

  if (insErr) {
    // Carrera: otra petición concurrente ya creó la tienda de este vendedor -> devuelve la existente.
    if ((insErr as { code?: string }).code === '23505') {
      const { data: again } = await admin.from('stores').select('id, slug, status').eq('owner_id', profile.id).maybeSingle()
      if (again) return json({ already_exists: true, store: again })
    }
    console.error('[cng-create-store] insert fallo:', insErr.message)
    return json({ error: 'No se pudo crear tu tienda. Intenta de nuevo.' }, 500)
  }

  return json({ store: created })
})
