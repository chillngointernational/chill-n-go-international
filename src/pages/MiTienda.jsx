import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Mi Tienda (/mi-tienda) — pantalla del VENDEDOR para crear/editar su tienda.
// Ruta independiente (ProtectedRoute = solo login, SIN muro de membresía; vender no requiere membresía).
// Crear -> edge function cng-create-store (slug único server-side, status='pending', one-per-seller).
// Editar -> UPDATE directo de SOLO name/description/logo_url (column-grant); NUNCA status/slug.
// Logo -> bucket cng-store-assets/<user_id>/...  (público; la policy lo limita a la carpeta del user).

const NAME_MIN = 2, NAME_MAX = 60
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Espejo de la slugificación del backend, SOLO para la vista previa (la final la confirma el server).
function previewSlug(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export default function MiTienda() {
  const { user, member, loading: authLoading } = useAuth()
  const fileRef = useRef(null)

  const [checking, setChecking] = useState(true)
  const [seller, setSeller] = useState(null)
  const [store, setStore] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const load = useCallback(async () => {
    if (!user || !member) { setChecking(false); return }
    setChecking(true)
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase.from('sellers').select('status, seller_type, accepted_seller_terms_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('stores').select('id, name, slug, description, logo_url, status').eq('owner_id', member.id).maybeSingle(),
    ])
    setSeller(s || null)
    setStore(st || null)
    if (st) { setName(st.name || ''); setDescription(st.description || ''); setLogoUrl(st.logo_url || null) }
    setChecking(false)
  }, [user, member])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  const isVerified = seller?.status === 'verified'

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setError('')
    if (!LOGO_TYPES.includes(file.type)) { setError('Formato no permitido. Usa PNG, JPG, WEBP o GIF.'); return }
    if (file.size > LOGO_MAX_BYTES) { setError('La imagen pesa más de 5 MB. Usa una más ligera.'); return }
    setUploadingLogo(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${user.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('cng-store-assets').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) { setError('No se pudo subir el logo. Intenta de nuevo.'); return }
      const { data: urlData } = supabase.storage.from('cng-store-assets').getPublicUrl(path)
      setLogoUrl(urlData.publicUrl)
    } catch {
      setError('No se pudo subir el logo. Intenta de nuevo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  function validName() {
    const n = name.trim()
    if (n.length < NAME_MIN || n.length > NAME_MAX) {
      setError(`El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`); return false
    }
    return true
  }

  async function handleCreate() {
    setError(''); setOkMsg('')
    if (!validName()) return
    setSubmitting(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-create-store', {
        body: { name: name.trim(), description: description.trim() || null, logo_url: logoUrl || null },
      })
      if (fnErr) {
        let msg = 'No se pudo crear tu tienda. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
        setError(msg); return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.store) {
        setStore(data.store)
        setOkMsg(data.already_exists ? 'Ya tenías una tienda; aquí está.' : '¡Tienda creada! Quedó en revisión.')
      } else {
        setError('Respuesta inesperada del servidor.')
      }
    } catch (e) {
      setError(e?.message || 'No se pudo crear tu tienda.')
    } finally { setSubmitting(false) }
  }

  async function handleSave() {
    setError(''); setOkMsg('')
    if (!validName() || !store?.id) return
    setSubmitting(true)
    try {
      // SOLO name/description/logo_url (column-grant). NUNCA status ni slug.
      const { error: upErr } = await supabase.from('stores')
        .update({ name: name.trim(), description: description.trim() || null, logo_url: logoUrl || null })
        .eq('id', store.id)
      if (upErr) { setError('No se pudieron guardar los cambios.'); return }
      setOkMsg('Cambios guardados.')
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudieron guardar los cambios.')
    } finally { setSubmitting(false) }
  }

  function renderForm(mode) {
    const slug = store?.slug || previewSlug(name)
    return (
      <div style={S.form}>
        <div style={S.field}>
          <label style={S.label}>Nombre de la tienda</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} style={S.input} placeholder="Mi Tienda" />
          <span style={S.hint}>{name.trim().length}/{NAME_MAX}</span>
        </div>

        <div style={S.field}>
          <label style={S.label}>Dirección (URL)</label>
          <div style={S.slugBox}>/tienda/<b style={{ color: C.primary }}>{slug || '—'}</b></div>
          <span style={S.hint}>
            {mode === 'create'
              ? 'Tu dirección se confirma al crear (podría ajustarse para que sea única).'
              : 'La dirección es fija y no se puede cambiar.'}
          </span>
        </div>

        <div style={S.field}>
          <label style={S.label}>Descripción (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="¿Qué vendes?" />
        </div>

        <div style={S.field}>
          <label style={S.label}>Logo (opcional)</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleLogoSelect} style={{ display: 'none' }} />
          <div style={S.logoEditRow}>
            <div style={S.logoPrev}>
              {logoUrl
                ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name="image" size={22} style={{ color: C.onSurfaceVariant }} />}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingLogo} style={S.secondaryBtn}>
              {uploadingLogo ? 'Subiendo…' : (logoUrl ? 'Cambiar logo' : 'Subir logo')}
            </button>
          </div>
          <span style={S.hint}>PNG, JPG, WEBP o GIF · máx 5 MB.</span>
        </div>

        <button
          onClick={mode === 'create' ? handleCreate : handleSave}
          disabled={submitting || uploadingLogo}
          style={{ ...S.button, opacity: (submitting || uploadingLogo) ? 0.5 : 1 }}
        >
          {submitting ? (mode === 'create' ? 'Creando…' : 'Guardando…') : (mode === 'create' ? 'Crear mi tienda' : 'Guardar cambios')}
        </button>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <Link to="/app/explore" style={S.back}>← Volver a GoShop</Link>
      <div style={S.card}>
        <div style={S.logoRow}>
          <div style={S.logo}><Icon name="storefront" size={18} style={{ color: '#06140d' }} /></div>
          <span style={S.logoText}>MI TIENDA</span>
        </div>

        {(authLoading || checking) ? (
          <p style={S.subtitle}>Cargando…</p>
        ) : !isVerified ? (
          // a) No verificado -> gate
          <>
            <h1 style={S.title}>Tu tienda en GoShop</h1>
            <p style={S.subtitle}>Para crear tu tienda primero completa tu <b>verificación de vendedor</b> (registro + cuota + identidad).</p>
            <Link to="/vender" style={S.button}>Completar verificación de vendedor</Link>
          </>
        ) : (
          <>
            {error && <div style={S.error}>{error}</div>}
            {okMsg && <div style={S.ok}>{okMsg}</div>}

            {!store ? (
              // b) Verificado sin tienda -> crear
              <>
                <h1 style={S.title}>Crea tu tienda</h1>
                <p style={S.subtitle}>Tu tienda nacerá <b>en revisión</b>; un administrador la aprobará para publicarla.</p>
                {renderForm('create')}
              </>
            ) : (
              // c/d/e: ya tiene tienda
              <>
                <h1 style={S.title}>{store.name}</h1>

                {store.status === 'pending' && (
                  <div style={S.bannerPending}>
                    <Icon name="schedule" size={20} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 1 }} />
                    <span><b>En revisión.</b> Un administrador revisará tu tienda; cuando la apruebe, quedará publicada en GoShop.</span>
                  </div>
                )}
                {store.status === 'active' && (
                  <div style={S.bannerActive}>
                    <Icon name="verified" size={20} style={{ color: C.primary, flexShrink: 0, marginTop: 1 }} />
                    <span><b>Publicada.</b> Tu tienda está en vivo: <a href={`/tienda/${store.slug}`} style={S.linkInline}>/tienda/{store.slug}</a></span>
                  </div>
                )}
                {store.status === 'rejected' && (
                  <div style={S.bannerRejected}>
                    <Icon name="error_outline" size={20} style={{ color: C.error, flexShrink: 0, marginTop: 1 }} />
                    <span><b>Tienda rechazada.</b> Pronto podrás ver el motivo y corregirla.</span>
                  </div>
                )}

                <Link to="/mi-tienda/productos" style={S.manageProducts}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="inventory_2" size={18} style={{ color: C.primary }} /><b style={{ fontWeight: 700 }}>Mis productos</b></span>
                  <Icon name="chevron_right" size={16} style={{ color: C.onSurfaceVariant }} />
                </Link>

                <p style={S.subtitle}>Dirección: <b style={{ color: C.primary }}>/tienda/{store.slug}</b> (fija)</p>
                {renderForm('edit')}
              </>
            )}
          </>
        )}

        <Link to="/app/explore" style={S.secondary}>Volver a GoShop</Link>
      </div>
    </div>
  )
}

const S = {
  wrap: { minHeight: '100dvh', background: C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body },
  back: { color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, marginBottom: 24 },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 460 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26, justifyContent: 'center' },
  logo: { width: 32, height: 32, borderRadius: 8, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: 2, fontFamily: FONT.headline },
  title: { fontSize: 22, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT.headline },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.6 },
  error: { background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 16, textAlign: 'center' },
  ok: { background: 'rgba(104,219,174,0.1)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.primary, marginBottom: 16, textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.4 },
  slugBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13.5, color: C.onSurface, wordBreak: 'break-all' },
  logoEditRow: { display: 'flex', alignItems: 'center', gap: 14 },
  logoPrev: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerPending: { display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: 13.5, color: C.onSurface, background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, lineHeight: 1.5 },
  bannerActive: { display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: 13.5, color: C.onSurface, background: 'rgba(104,219,174,0.08)', border: '1px solid rgba(104,219,174,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, lineHeight: 1.5 },
  bannerRejected: { display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: 13.5, color: C.onSurface, background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, lineHeight: 1.5 },
  linkInline: { color: C.primary, fontWeight: 700, textDecoration: 'none' },
  manageProducts: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: C.onSurface, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', fontSize: 14, marginBottom: 16 },
  button: { display: 'block', width: '100%', boxSizing: 'border-box', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none', marginTop: 4 },
  secondaryBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  secondary: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 16 },
}
