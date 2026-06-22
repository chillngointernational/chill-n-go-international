import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getActivationStep } from '../../utils/memberStatus'
import { C, FONT, GRADIENT, Icon } from '../../stitch'
import SubscriptionScreen from './SubscriptionScreen'

// Muro de activación. Orden: (1) verificar identidad con Verificamex, (2) pagar la membresía.
// La cuenta pasa a 'active' solo cuando AMBOS pasos están completos (lo decide el backend).

function VerifyStep() {
  const { user, member, fetchMember, signOut } = useAuth()
  const [consent, setConsent] = useState(false)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lockCode, setLockCode] = useState(null)

  const idStatus = member?.identity_verification_status || 'unverified'

  const refresh = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try { await fetchMember(user.id) } finally { setRefreshing(false) }
  }, [user, fetchMember])

  // Al volver del widget (?idv=return) y mientras esté en proceso, refrescar el estado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('idv') === 'return') refresh()
    const interval = setInterval(refresh, 6000)
    return () => clearInterval(interval)
  }, [refresh])

  async function handleVerify() {
    setError('')
    setLockCode(null)
    setLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-create-identity-verification', {
        body: { return_url: window.location.origin, phone_number: phone },
      })
      if (fnErr) {
        let msg = 'No se pudo iniciar la verificación. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error; if (b?.code) setLockCode(b.code) } catch { /* sin cuerpo */ }
        setError(msg)
        return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.form_url) { window.location.href = data.form_url; return }
      setError('Respuesta inesperada del servidor.')
    } catch (e) {
      setError(e?.message || 'Error al iniciar la verificación.')
    } finally {
      setLoading(false)
    }
  }

  const failed = idStatus === 'failed'
  const processing = idStatus === 'processing'
  // Estados sin salida por candado del backend: no invitar reintentos fútiles.
  const blocked = lockCode === 'attempts_exhausted' || lockCode === 'already_verified'

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.stepRow}>
          <span style={styles.stepDim}>1 · Pago</span>
          <span style={styles.stepActive}>2 · Identidad</span>
        </div>
        <div style={styles.iconWrap}><Icon name="badge" size={40} style={{ color: C.primary }} /></div>
        <h1 style={styles.title}>Verifica tu identidad</h1>

        {processing ? (
          <p style={styles.subtitle}>Tu verificación está en proceso. En cuanto Verificamex confirme el resultado, podrás continuar.</p>
        ) : failed ? (
          <p style={{ ...styles.subtitle, color: C.error }}>No pudimos verificar tu identidad. Revisa que tu INE esté vigente y vuelve a intentarlo.</p>
        ) : (
          <p style={styles.subtitle}>
            Para activar tu membresía validamos tu identidad: subes tu <b>INE</b> y te tomas una <b>selfie con prueba de vida</b>.
            Se valida contra la <b>Lista Nominal del INE</b> y tu <b>CURP ante RENAPO</b>.
          </p>
        )}

        <div style={styles.privacy}>
          <Icon name="lock" size={16} style={{ color: C.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
          <span>
            <b>Aviso de privacidad:</b> la captura de tu INE y selfie ocurre en <b>Verificamex</b> (proveedor de identidad).
            Chill N Go <b>NO almacena</b> tus fotos; solo guardamos el <b>resultado</b> de la verificación y datos mínimos
            (CURP y nombre). Al continuar, autorizas esta validación de identidad.
          </span>
        </div>

        <div style={styles.deviceHint}>
          Puedes verificar desde tu <b>computadora o tu celular</b>. Si la cámara de la compu no
          funciona, la pantalla de verificación muestra un <b>código QR</b> para continuar en tu teléfono.
        </div>

        <div style={styles.phoneField}>
          <label style={styles.phoneLabel}>¿Prefieres hacerlo en tu celular? (opcional)</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp · 10 dígitos"
            style={styles.input}
          />
          <span style={styles.phoneHelp}>Si lo llenas, te enviamos el link de verificación por WhatsApp.</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Siempre permitimos iniciar/reanudar/reintentar: nadie queda encerrado en 'processing'. */}
        <label style={styles.consentRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>He leído y acepto el aviso de privacidad y autorizo la verificación de mi identidad.</span>
        </label>

        {blocked ? (
          // Candado del backend (límite de intentos / ya verificado): sin botón de reintento;
          // mostramos contacto de soporte para no dejar al usuario en un callejón sin salida.
          <a href="mailto:contact@chillngointernational.com" style={{ ...styles.button, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Escríbenos: contact@chillngointernational.com
          </a>
        ) : (
          <>
            <button
              onClick={handleVerify}
              style={{ ...styles.button, opacity: (loading || !consent) ? 0.5 : 1 }}
              disabled={loading || !consent}
            >
              {loading ? 'Abriendo verificación…' : (processing ? 'Reanudar verificación' : (failed ? 'Reintentar verificación' : 'Verificar mi identidad'))}
            </button>

            <button onClick={refresh} style={styles.secondary} disabled={refreshing}>
              {refreshing ? 'Verificando…' : 'Ya verifiqué · Actualizar estado'}
            </button>
          </>
        )}

        <button onClick={signOut} style={styles.signout}>Cerrar sesión</button>
      </div>
    </div>
  )
}

export default function ActivateScreen() {
  const { member } = useAuth()
  const step = getActivationStep(member)
  // Paso 2 (pago) reutiliza la pantalla de suscripción ya existente.
  if (step === 'pay') return <SubscriptionScreen />
  return <VerifyStep />
}

const styles = {
  wrap: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: C.bg, fontFamily: FONT.body },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 440, textAlign: 'center' },
  stepRow: { display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  stepActive: { color: C.primary },
  stepDim: { color: C.textFaint },
  iconWrap: { marginBottom: 10 },
  title: { fontFamily: FONT.headline, fontSize: 23, fontWeight: 800, color: C.text, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 16px' },
  privacy: { display: 'flex', gap: 8, textAlign: 'left', fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 },
  deviceHint: { textAlign: 'left', fontSize: 12.5, color: C.onSurfaceVariant, lineHeight: 1.5, marginBottom: 14 },
  phoneField: { display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left', marginBottom: 16 },
  phoneLabel: { fontSize: 13, color: C.onSurface, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  phoneHelp: { fontSize: 11.5, color: C.textFaint },
  error: { background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14, textAlign: 'center' },
  consentRow: { display: 'flex', gap: 10, textAlign: 'left', fontSize: 13, color: C.onSurface, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' },
  button: { width: '100%', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 },
  secondary: { width: '100%', background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 },
  signout: { background: 'none', border: 'none', color: C.onSurfaceVariant, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' },
}
