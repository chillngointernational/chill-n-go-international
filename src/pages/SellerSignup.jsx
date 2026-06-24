import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Registro PÚBLICO de vendedor (/vender). Vender NO requiere membresía ni invitación.
// Crea cuenta + perfil (membership 'pending') + sellers ('draft') vía cng-seller-signup.
// Vive FUERA del muro de membresía.
//
// 1c-5 — Onboarding tras el registro: (1) pagar la CUOTA (pago único MP, no reembolsable) ->
// (2) verificar identidad (INE, llama cng-create-seller-verification) -> (3) RFC "próximamente".
// La pata INE se deriva de identity_profiles.identity_verification_status (sirve también para el
// rep legal de empresa). ANTIQUEMA: la verificación solo se inicia con el botón explícito; el
// retorno (?idv=return) solo re-llama la función cuando la persona YA está verificada (0 tokens).

const TERMS_VERSION = 'v1'
const SELLER_TERMS = [
  'La verificación de vendedor tiene una cuota: $249 MXN (persona física) o $499 MXN (empresa).',
  'La cuota cubre hasta 3 intentos de verificación; si se agotan, se requiere una nueva cuota.',
  'Como vendedor, soy responsable de cumplir con mis obligaciones fiscales.',
  'Me comprometo a entregar los productos que venda.',
  '(Texto preliminar de vendedor, sujeto a revisión legal.)',
]

const MAX_ATTEMPTS = 3
const SUPPORT_EMAIL = 'contact@chillngointernational.com'
// Texto canónico del consentimiento de la cuota. DEBE coincidir con cng-mp-create-seller-fee ('seller_fee_v1').
const FEE_CONSENT_TEXT = 'La cuota de verificación cubre un ciclo de verificación de identidad (hasta 3 intentos) y NO es reembolsable, aun si la verificación no se completa.'

export default function SellerSignup() {
  const { user, loading: authLoading, signIn, member, fetchMember } = useAuth()

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
  // onboarding (cuota + verificación)
  const [feeConsent, setFeeConsent] = useState(false)
  const [paying, setPaying] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [lockCode, setLockCode] = useState(null)
  const advancedRef = useRef(false)               // avanza la pata INE una sola vez por carga

  const loadSeller = useCallback(async (silent = false) => {
    if (!user) { setSeller(null); setChecking(false); return }
    if (!silent) setChecking(true)
    const { data } = await supabase
      .from('sellers')
      .select('id, status, seller_type, verification_fee_paid, verification_attempts')
      .eq('user_id', user.id)
      .maybeSingle()
    setSeller(data || null)
    if (!silent) setChecking(false)
  }, [user])

  useEffect(() => { if (!authLoading) loadSeller() }, [authLoading, loadSeller])

  // Refresco silencioso (no parpadea "Cargando…"): relee seller + member (identidad).
  const refreshAll = useCallback(async () => {
    if (!user) return
    await Promise.all([loadSeller(true), fetchMember(user.id)])
  }, [user, loadSeller, fetchMember])

  // ANTIQUEMA: avanza la pata INE del vendedor SOLO cuando la PERSONA ya está verificada
  // (el backend toma la ruta de REÚSO = 0 tokens). Nunca crea sesión aquí.
  const advanceIneLegIfVerified = useCallback(async () => {
    if (advancedRef.current || !user) return
    if (member?.identity_verification_status !== 'verified') return
    advancedRef.current = true
    try { await supabase.functions.invoke('cng-create-seller-verification', { body: {} }) } catch { /* noop */ }
    await refreshAll()
  }, [user, member?.identity_verification_status, refreshAll])

  // Al volver de pago (?fee=return) o verificación (?idv=return): refrescar de inmediato.
  useEffect(() => {
    if (!seller?.id) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('fee') === 'return' || params.get('idv') === 'return') refreshAll()
  }, [seller?.id, refreshAll])

  // Mientras el onboarding no esté verificado, sondear estado cada 6s (solo lecturas).
  useEffect(() => {
    if (!seller?.id || seller?.status === 'verified') return
    const id = setInterval(refreshAll, 6000)
    return () => clearInterval(id)
  }, [seller?.id, seller?.status, refreshAll])

  // Cuando la persona quede verificada, marcar la pata INE del vendedor (0 tokens).
  useEffect(() => { advanceIneLegIfVerified() }, [advanceIneLegIfVerified])

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

  // ---- Onboarding: pagar cuota / verificar identidad ----
  async function handlePayFee() {
    setError(''); setLockCode(null); setPaying(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-mp-create-seller-fee', {
        body: { fee_consent_accepted: true },
      })
      if (fnErr) {
        let msg = 'No se pudo iniciar el pago. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error; if (b?.code) setLockCode(b.code) } catch { /* sin cuerpo */ }
        setError(msg); return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.init_point) { window.location.href = data.init_point; return }
      setError('Respuesta inesperada del servidor.')
    } catch (e) {
      setError(e?.message || 'Error al iniciar el pago.')
    } finally { setPaying(false) }
  }

  async function handleVerifyIdentity() {
    setError(''); setLockCode(null); setVerifying(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-create-seller-verification', { body: {} })
      if (fnErr) {
        let msg = 'No se pudo iniciar la verificación. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error; if (b?.code) setLockCode(b.code) } catch { /* sin cuerpo */ }
        setError(msg); return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.ine_verified || data?.reused) { await refreshAll(); return } // ya verificado: 0 tokens
      if (data?.form_url) { window.location.href = data.form_url; return }
      setError('Respuesta inesperada del servidor.')
    } catch (e) {
      setError(e?.message || 'Error al iniciar la verificación.')
    } finally { setVerifying(false) }
  }

  const typeLabel = (t) => t === 'company' ? 'Empresa' : 'Persona física'
  const statusLabel = (s) => ({ draft: 'Borrador', pending_verification: 'En verificación', verified: 'Verificado', rejected: 'Rechazado' }[s] || s)

  // Estados derivados del onboarding
  const feePaid = !!seller?.verification_fee_paid
  const ineStatus = member?.identity_verification_status || 'unverified'
  const ineVerified = ineStatus === 'verified'
  const ineProcessing = ineStatus === 'processing'
  const sellerVerified = seller?.status === 'verified'
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - (seller?.verification_attempts || 0))
  const attemptsBlocked = lockCode === 'attempts_exhausted'
  const feeLabel = seller?.seller_type === 'company' ? '$499 MXN' : '$249 MXN'
  const isCompany = seller?.seller_type === 'company'
  // EMPRESA PAUSADA: hizo cuota + INE del representante, pero su verificación está en pausa
  // porque falta la validación de RFC (aún no construida). No debe quedar como "pendiente" mudo.
  const companyPausedAwaitingRfc = isCompany && feePaid && ineVerified && !sellerVerified

  return (
    <div style={S.wrap}>
      <Link to="/" style={S.back}>← Volver al inicio</Link>
      <div style={S.card}>
        <div style={S.logoRow}><div style={S.logo}><Icon name="storefront" size={18} style={{ color: '#06140d' }} /></div><span style={S.logoText}>VENDER EN GOSHOP</span></div>

        {(authLoading || checking) ? (
          <p style={S.subtitle}>Cargando…</p>
        ) : seller ? (
          // ---- Onboarding del vendedor: cuota -> identidad -> RFC ----
          <>
            <h1 style={S.title}>Verificación de vendedor</h1>
            <p style={S.subtitle}>
              Tipo: <b style={{ color: C.primary }}>{typeLabel(seller.seller_type)}</b> · Estado: <b style={{ color: C.primary }}>{statusLabel(seller.status)}</b>
            </p>

            {sellerVerified ? (
              <>
                <div style={S.successBox}>
                  <Icon name="verified" size={20} style={{ color: C.primary, flexShrink: 0 }} />
                  <span>¡Listo! Tu cuenta de vendedor está <b>verificada</b>. Ya puedes vender en GoShop.</span>
                </div>
                <Link to="/mi-tienda" style={S.button}>Crear / administrar mi tienda</Link>
              </>
            ) : (
              <>
                {error && <div style={S.error}>{error}</div>}

                {companyPausedAwaitingRfc && (
                  <div style={S.pausedBox}>
                    <Icon name="schedule" size={20} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 1 }} />
                    <span>
                      <b>Verificación de empresa disponible pronto.</b> Tu identidad e INE del representante legal ya quedaron verificadas; falta la <b>validación de RFC</b>, que habilitaremos muy pronto. Te avisaremos en cuanto puedas completar la verificación de tu empresa.
                    </span>
                  </div>
                )}

                {/* Paso 1 — Cuota */}
                <div style={S.step}>
                  <div style={S.stepHead}>
                    <span style={S.stepNum(feePaid)}>{feePaid ? '✓' : '1'}</span>
                    <span style={S.stepName}>Pagar la cuota de verificación</span>
                    <span style={S.stepBadge(feePaid)}>{feePaid ? 'Pagada' : feeLabel}</span>
                  </div>
                  {!feePaid && (
                    <div style={S.stepBody}>
                      <p style={S.stepText}>Pago único. {FEE_CONSENT_TEXT}</p>
                      <label style={S.consentRow}>
                        <input type="checkbox" checked={feeConsent} onChange={(e) => setFeeConsent(e.target.checked)} style={{ marginTop: 3 }} />
                        <span>Acepto que la cuota <b>no es reembolsable</b>.</span>
                      </label>
                      <button onClick={handlePayFee} disabled={paying || !feeConsent} style={{ ...S.button, opacity: (paying || !feeConsent) ? 0.5 : 1 }}>
                        {paying ? 'Abriendo el pago…' : `Pagar cuota (${feeLabel})`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Paso 2 — Identidad (INE) */}
                <div style={S.step}>
                  <div style={S.stepHead}>
                    <span style={S.stepNum(ineVerified)}>{ineVerified ? '✓' : '2'}</span>
                    <span style={S.stepName}>Verificar tu identidad (INE)</span>
                    <span style={S.stepBadge(ineVerified)}>
                      {ineVerified ? 'Verificada' : (feePaid ? (ineProcessing ? 'En proceso' : 'Pendiente') : 'Bloqueado')}
                    </span>
                  </div>
                  {feePaid && !ineVerified && (
                    <div style={S.stepBody}>
                      <div style={S.privacy}>
                        <Icon name="lock" size={16} style={{ color: C.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
                        <span><b>Privacidad:</b> la captura de tu INE y selfie ocurre en <b>Verificamex</b>. Chill N Go <b>NO almacena</b> tus fotos; solo el resultado.</span>
                      </div>
                      {ineProcessing && <p style={S.stepText}>Tu verificación está en proceso. En cuanto se confirme, este paso se marcará completado.</p>}
                      {attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && <p style={S.stepText}>Te quedan <b>{attemptsLeft}</b> intento(s) en este ciclo.</p>}
                      {attemptsBlocked ? (
                        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ ...S.button, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                          Escríbenos: {SUPPORT_EMAIL}
                        </a>
                      ) : (
                        <>
                          <button onClick={handleVerifyIdentity} disabled={verifying} style={{ ...S.button, opacity: verifying ? 0.5 : 1 }}>
                            {verifying ? 'Abriendo verificación…' : (ineProcessing ? 'Reanudar verificación' : 'Verificar mi identidad')}
                          </button>
                          <button onClick={refreshAll} style={S.secondaryBtn}>Ya verifiqué · Actualizar estado</button>
                        </>
                      )}
                    </div>
                  )}
                  {!feePaid && <div style={S.stepBody}><p style={S.stepLocked}>Disponible después de pagar la cuota.</p></div>}
                </div>

                {/* Paso 3 — RFC (próximamente) */}
                <div style={S.step}>
                  <div style={S.stepHead}>
                    <span style={S.stepNum(false)}>3</span>
                    <span style={S.stepName}>Datos fiscales (RFC)</span>
                    <span style={S.stepBadge(false)}>Próximamente</span>
                  </div>
                  <div style={S.stepBody}>
                    <p style={S.stepLocked}>La validación de RFC se habilitará muy pronto. No es necesaria para iniciar la verificación de identidad.</p>
                  </div>
                </div>
              </>
            )}

            <Link to="/" style={S.secondary}>Volver al inicio</Link>
          </>
        ) : doneNew ? (
          <>
            <h1 style={S.title}>¡Listo! Cuenta de vendedor creada</h1>
            <p style={S.subtitle}>Preparando tu panel de vendedor…</p>
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
  // onboarding (pasos)
  step: { textAlign: 'left', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  stepHead: { display: 'flex', alignItems: 'center', gap: 10 },
  stepNum: (done) => ({ width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, background: done ? C.primary : 'rgba(255,255,255,0.08)', color: done ? '#06140d' : C.onSurfaceVariant }),
  stepName: { flex: 1, fontSize: 14, fontWeight: 700, color: C.text },
  stepBadge: (done) => ({ fontSize: 11.5, fontWeight: 700, color: done ? C.primary : C.onSurfaceVariant, background: done ? 'rgba(104,219,174,0.12)' : 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }),
  stepBody: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  stepText: { fontSize: 13, color: C.onSurfaceVariant, lineHeight: 1.55, margin: 0 },
  stepLocked: { fontSize: 12.5, color: C.textFaint, lineHeight: 1.5, margin: 0 },
  privacy: { display: 'flex', gap: 8, fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' },
  successBox: { display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', fontSize: 13.5, color: C.onSurface, background: 'rgba(104,219,174,0.08)', border: '1px solid rgba(104,219,174,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, lineHeight: 1.5 },
  pausedBox: { display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: 13.5, color: C.onSurface, background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, lineHeight: 1.5 },
  secondaryBtn: { width: '100%', background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  next: { display: 'flex', gap: 8, textAlign: 'left', fontSize: 13, color: C.onSurfaceVariant, lineHeight: 1.55, background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 },
  button: { display: 'block', width: '100%', boxSizing: 'border-box', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none', marginTop: 4 },
  secondary: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 8 },
  linkBtn: { display: 'block', width: '100%', background: 'none', border: 'none', color: C.onSurfaceVariant, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12, textDecoration: 'underline' },
  footer: { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 20, lineHeight: 1.5 },
  footerLink: { color: C.primary, textDecoration: 'none', fontWeight: 600 },
}
