import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Registro PÚBLICO de vendedor (/vender). Vender NO requiere membresía ni invitación.
// Crea cuenta + perfil (membership 'pending') + sellers ('draft') vía cng-seller-signup.
// Vive FUERA del muro de membresía. Verificación INE/fiscal + cuota = sub-pasos posteriores.

const TERMS_VERSION = 'v1'
const SELLER_TERMS = [
  'La verificación de vendedor tiene una cuota: $249 MXN (persona física) o $499 MXN (empresa).',
  'La cuota cubre hasta 3 intentos de verificación; si se agotan, se requiere una nueva cuota.',
  'Como vendedor, soy responsable de cumplir con mis obligaciones fiscales.',
  'Me comprometo a entregar los productos que venda.',
  '(Texto preliminar de vendedor, sujeto a revisión legal.)',
]

export default function SellerSignup() {
  const { user, loading: authLoading, signIn } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [seller, setSeller] = useState(null)      // fila sellers del usuario (si existe)
  const [sellerType, setSellerType] = useState('individual')
  const [consent, setConsent] = useState(false)
  // campos de signup (solo si no hay sesión)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accountExists, setAccountExists] = useState(false)
  const [doneNew, setDoneNew] = useState(false)   // recién registrado en este flujo

  const loadSeller = useCallback(async () => {
    if (!user) { setSeller(null); setChecking(false); return }
    setChecking(true)
    const { data } = await supabase.from('sellers').select('id, status, seller_type').eq('user_id', user.id).maybeSingle()
    setSeller(data || null)
    setChecking(false)
  }, [user])

  useEffect(() => { if (!authLoading) loadSeller() }, [authLoading, loadSeller])

  async function callSignup(payload) {
    const { data, error: fnErr } = await supabase.functions.invoke('cng-seller-signup', { body: payload })
    if (fnErr) {
      let msg = 'No se pudo completar el registro. Intenta de nuevo.'
      let code = null
      try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error; if (b?.code) code = b.code } catch { /* sin cuerpo */ }
      return { ok: false, error: msg, code }
    }
    if (data?.error) return { ok: false, error: data.error, code: data.code || null }
    return { ok: true, data }
  }

  // Camino BECOME (usuario logueado: miembro o ya registrado)
  async function handleBecome() {
    if (!consent) { setError('Debes aceptar los términos de vendedor.'); return }
    setError(''); setSubmitting(true)
    try {
      const res = await callSignup({ seller_type: sellerType, terms_accepted: true, terms_version: TERMS_VERSION })
      if (!res.ok) { setError(res.error); return }
      await loadSeller()
    } finally { setSubmitting(false) }
  }

  // Camino SIGNUP (sin sesión)
  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Ingresa tu nombre completo.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Ingresa un correo válido.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (!consent) { setError('Debes aceptar los términos de vendedor.'); return }
    setSubmitting(true)
    try {
      const res = await callSignup({
        seller_type: sellerType, terms_accepted: true, terms_version: TERMS_VERSION,
        email: email.trim(), password, full_name: fullName.trim(),
      })
      if (!res.ok) {
        if (res.code === 'account_exists') { setAccountExists(true); return }
        setError(res.error); return
      }
      // Cuenta creada (email confirmado): iniciar sesión -> el efecto cargará seller.
      await signIn(email.trim(), password)
      setDoneNew(true)
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión tras crear la cuenta.')
    } finally { setSubmitting(false) }
  }

  const typeLabel = (t) => t === 'company' ? 'Empresa' : 'Persona física'

  return (
    <div style={S.wrap}>
      <Link to="/" style={S.back}>← Volver al inicio</Link>
      <div style={S.card}>
        <div style={S.logoRow}><div style={S.logo}><Icon name="storefront" size={18} style={{ color: '#06140d' }} /></div><span style={S.logoText}>VENDER EN GOSHOP</span></div>

        {(authLoading || checking) ? (
          <p style={S.subtitle}>Cargando…</p>
        ) : seller ? (
          // ---- Ya es vendedor ----
          <>
            <h1 style={S.title}>Tu registro de vendedor está iniciado</h1>
            <p style={S.subtitle}>
              Tipo: <b style={{ color: C.primary }}>{typeLabel(seller.seller_type)}</b> · Estado: <b style={{ color: C.primary }}>{seller.status}</b>.
            </p>
            <div style={S.next}>
              <Icon name="schedule" size={18} style={{ color: C.onSurfaceVariant, flexShrink: 0, marginTop: 1 }} />
              <span><b>Próximo paso:</b> verificación de identidad y datos fiscales (con la cuota de verificación). Lo habilitaremos muy pronto.</span>
            </div>
            <Link to="/" style={S.secondary}>Volver al inicio</Link>
          </>
        ) : doneNew ? (
          <>
            <h1 style={S.title}>¡Listo! Cuenta de vendedor creada</h1>
            <p style={S.subtitle}>El siguiente paso es la verificación (próximamente).</p>
          </>
        ) : accountExists ? (
          <>
            <h1 style={S.title}>Ya tienes una cuenta</h1>
            <p style={S.subtitle}>Ya existe una cuenta con <b>{email}</b>. Inicia sesión y vuelve aquí para convertirte en vendedor sin crear otra cuenta.</p>
            <Link to={`/login?email=${encodeURIComponent(email)}`} style={S.button}>Iniciar sesión</Link>
            <button type="button" onClick={() => { setAccountExists(false); setEmail(''); setPassword(''); setConfirm('') }} style={S.linkBtn}>Usar otro correo</button>
          </>
        ) : (
          // ---- Form: tipo + términos (+ datos de cuenta si no hay sesión) ----
          <>
            <h1 style={S.title}>{user ? 'Conviértete en vendedor' : 'Crea tu cuenta de vendedor'}</h1>
            <p style={S.subtitle}>{user ? 'Usa tu cuenta actual para empezar a vender en GoShop.' : 'Vende en GoShop. No necesitas ser miembro ni invitación.'}</p>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.field}>
              <label style={S.label}>Tipo de vendedor</label>
              <div style={S.typeRow}>
                {['individual', 'company'].map((t) => (
                  <button key={t} type="button" onClick={() => setSellerType(t)} style={{ ...S.typeBtn, ...(sellerType === t ? S.typeBtnActive : {}) }}>
                    {typeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={user ? (e) => { e.preventDefault(); handleBecome() } : handleSignup} style={S.form}>
              {!user && (
                <>
                  <div style={S.field}><label style={S.label}>Nombre completo</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={S.input} placeholder="Tu nombre y apellido" autoComplete="name" /></div>
                  <div style={S.field}><label style={S.label}>Correo electrónico</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={S.input} placeholder="tu@email.com" autoComplete="email" /></div>
                  <div style={S.field}><label style={S.label}>Contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={S.input} placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></div>
                  <div style={S.field}><label style={S.label}>Confirmar contraseña</label>
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={S.input} placeholder="Repite tu contraseña" autoComplete="new-password" /></div>
                </>
              )}

              <div style={S.termsBox}>
                <p style={S.termsTitle}>Términos de vendedor</p>
                <ul style={S.termsList}>{SELLER_TERMS.map((t, i) => <li key={i} style={S.termsItem}>{t}</li>)}</ul>
              </div>
              <label style={S.consentRow}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Acepto los términos de vendedor.</span>
              </label>

              <button type="submit" style={{ ...S.button, opacity: (submitting || !consent) ? 0.5 : 1 }} disabled={submitting || !consent}>
                {submitting ? 'Procesando…' : (user ? 'Convertirme en vendedor' : 'Crear cuenta de vendedor')}
              </button>
            </form>

            {!user && <p style={S.footer}>¿Ya tienes cuenta? <Link to="/login" style={S.footerLink}>Inicia sesión</Link> y vuelve a <b>/vender</b>.</p>}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { minHeight: '100dvh', background: C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body },
  back: { color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, marginBottom: 24 },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 440 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26, justifyContent: 'center' },
  logo: { width: 32, height: 32, borderRadius: 8, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: 2, fontFamily: FONT.headline },
  title: { fontSize: 22, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT.headline },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.6 },
  error: { background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 16, textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  typeRow: { display: 'flex', gap: 10 },
  typeBtn: { flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: C.onSurfaceVariant, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  typeBtnActive: { border: 'none', outline: `1px solid ${C.primary}`, background: `${C.primary}1f`, color: C.primary },
  termsBox: { textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' },
  termsTitle: { fontSize: 13, fontWeight: 700, color: C.onSurface, margin: '0 0 8px' },
  termsList: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  termsItem: { fontSize: 12.5, color: C.onSurfaceVariant, lineHeight: 1.5 },
  consentRow: { display: 'flex', gap: 10, textAlign: 'left', fontSize: 13.5, color: C.onSurface, lineHeight: 1.5, cursor: 'pointer', fontWeight: 600 },
  next: { display: 'flex', gap: 8, textAlign: 'left', fontSize: 13, color: C.onSurfaceVariant, lineHeight: 1.55, background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 },
  button: { display: 'block', width: '100%', boxSizing: 'border-box', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none', marginTop: 4 },
  secondary: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 8 },
  linkBtn: { display: 'block', width: '100%', background: 'none', border: 'none', color: C.onSurfaceVariant, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12, textDecoration: 'underline' },
  footer: { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 20, lineHeight: 1.5 },
  footerLink: { color: C.primary, textDecoration: 'none', fontWeight: 600 },
}
