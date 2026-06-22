import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { C, FONT, GRADIENT, Icon } from '../../stitch'

// Paso 1 del muro (nuevo orden PAGO -> VERIFICACIÓN). El usuario sin pago confirmado llega
// aquí. Debe aceptar los términos (no-reembolso, v1) ANTES de poder pagar. Al pagar, crea la
// suscripción MP (140 MXN/mes) enviando terms_accepted. Al volver, refresca (el webhook activa
// membership_paid; luego sigue el paso de identidad).

const PRICE_LABEL = '$140 MXN / mes'
const TERMS_VERSION = 'v1'
const TERMS = [
  'Mi membresía es un cargo mensual recurrente y no es reembolsable.',
  'Después de pagar, debo verificar mi identidad con mi INE para activar mi cuenta.',
  'Si no completo la verificación (por cualquier motivo), mi pago no se reembolsa y mi cuenta no se activa.',
  'Acepto el tratamiento de mis datos según el Aviso de Privacidad.',
]

export default function SubscriptionScreen() {
  const { user, member, fetchMember, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)

  // Si volvió del checkout (?sub=return), refrescar; y poll suave mientras siga pendiente.
  const refresh = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try { await fetchMember(user.id) } finally { setRefreshing(false) }
  }, [user, fetchMember])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sub') === 'return') refresh()
    const interval = setInterval(refresh, 6000)
    return () => clearInterval(interval)
  }, [refresh])

  async function handleSubscribe() {
    if (!consent) { setError('Debes aceptar los términos para continuar.'); return }
    setError('')
    setLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-mp-create-subscription', {
        body: { return_url: window.location.origin, terms_accepted: true, terms_version: TERMS_VERSION },
      })
      if (fnErr) {
        let msg = 'No se pudo iniciar la suscripción. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
        setError(msg)
        return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.init_point) {
        window.location.href = data.init_point
        return
      }
      setError('Respuesta inesperada del servidor.')
    } catch (e) {
      setError(e?.message || 'Error al iniciar la suscripción.')
    } finally {
      setLoading(false)
    }
  }

  const name = member?.full_name || member?.display_name || ''

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.stepRow}>
          <span style={styles.stepActive}>1 · Pago</span>
          <span style={styles.stepDim}>2 · Identidad</span>
        </div>

        <div style={styles.iconWrap}><Icon name="workspace_premium" size={40} style={{ color: C.primary }} /></div>
        <h1 style={styles.title}>Activa tu membresía</h1>
        <p style={styles.subtitle}>
          {name ? `Hola ${name}. ` : ''}Tu cuenta está creada. Primero activas tu membresía Chill N Go;
          después verificas tu identidad con tu INE para completar la activación.
        </p>

        <div style={styles.priceBox}>
          <span style={styles.price}>{PRICE_LABEL}</span>
          <span style={styles.priceNote}>Suscripción mensual · cancela cuando quieras</span>
        </div>

        {/* Términos obligatorios (no-reembolso) — v1 */}
        <div style={styles.termsBox}>
          <p style={styles.termsTitle}>Antes de pagar, acepto que:</p>
          <ul style={styles.termsList}>
            {TERMS.map((t, i) => <li key={i} style={styles.termsItem}>{t}</li>)}
          </ul>
        </div>
        <label style={styles.consentRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Acepto estos términos.</span>
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleSubscribe}
          style={{ ...styles.button, opacity: (loading || !consent) ? 0.5 : 1 }}
          disabled={loading || !consent}
        >
          {loading ? 'Redirigiendo a Mercado Pago…' : 'Suscribirme con Mercado Pago'}
        </button>

        <button onClick={refresh} style={styles.secondary} disabled={refreshing}>
          {refreshing ? 'Verificando…' : 'Ya pagué · Actualizar estado'}
        </button>

        <button onClick={signOut} style={styles.signout}>Cerrar sesión</button>
        <Link to="/vender" style={{ ...styles.signout, display: 'block', marginTop: 12 }}>
          ¿Solo quieres vender en GoShop? Ve a tu panel de vendedor →
        </Link>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: C.bg,
    fontFamily: FONT.body,
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
  },
  stepRow: { display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  stepActive: { color: C.primary },
  stepDim: { color: C.textFaint },
  iconWrap: { marginBottom: 12 },
  title: { fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 20px' },
  priceBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px',
    borderRadius: 12,
    background: 'rgba(104,219,174,0.06)',
    border: '1px solid rgba(104,219,174,0.15)',
    marginBottom: 18,
  },
  price: { fontFamily: FONT.headline, fontSize: 26, fontWeight: 900, color: C.primary },
  priceNote: { fontSize: 12, color: C.onSurfaceVariant },
  termsBox: {
    textAlign: 'left',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 12,
  },
  termsTitle: { fontSize: 13, fontWeight: 700, color: C.onSurface, margin: '0 0 8px' },
  termsList: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  termsItem: { fontSize: 12.5, color: C.onSurfaceVariant, lineHeight: 1.5 },
  consentRow: { display: 'flex', gap: 10, textAlign: 'left', fontSize: 13.5, color: C.onSurface, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer', fontWeight: 600 },
  error: {
    background: 'rgba(224,49,49,0.1)',
    border: '1px solid rgba(224,49,49,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: C.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    background: GRADIENT.primary,
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 12,
  },
  secondary: {
    width: '100%',
    background: 'transparent',
    border: '1px solid ' + C.outlineVariant,
    borderRadius: 10,
    padding: '12px',
    fontSize: 14,
    fontWeight: 600,
    color: C.onSurface,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 16,
  },
  signout: {
    background: 'none',
    border: 'none',
    color: C.onSurfaceVariant,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
}
