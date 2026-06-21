import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { C, FONT, GRADIENT, Icon } from '../../stitch'

// Pantalla de activación de membresía (gating). El usuario con membership_status != 'active'
// llega aquí. Crea la suscripción en Mercado Pago (140 MXN/mes) y redirige al checkout.
// Al volver, refresca el estado (el webhook de MP activa la membresía).

const PRICE_LABEL = '$140 MXN / mes'

export default function SubscriptionScreen() {
  const { user, member, fetchMember, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

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
    setError('')
    setLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-mp-create-subscription', {
        body: { return_url: window.location.origin },
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
        <div style={styles.iconWrap}><Icon name="workspace_premium" size={40} style={{ color: C.primary }} /></div>
        <h1 style={styles.title}>Activa tu membresía</h1>
        <p style={styles.subtitle}>
          {name ? `Hola ${name}. ` : ''}Tu cuenta está creada. Activa tu membresía Chill N Go para
          acceder a la comunidad, el feed y la mensajería.
        </p>

        <div style={styles.priceBox}>
          <span style={styles.price}>{PRICE_LABEL}</span>
          <span style={styles.priceNote}>Suscripción mensual · cancela cuando quieras</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button onClick={handleSubscribe} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? 'Redirigiendo a Mercado Pago…' : 'Suscribirme con Mercado Pago'}
        </button>

        <button onClick={refresh} style={styles.secondary} disabled={refreshing}>
          {refreshing ? 'Verificando…' : 'Ya pagué · Actualizar estado'}
        </button>

        <button onClick={signOut} style={styles.signout}>Cerrar sesión</button>
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
    padding: '36px 28px',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
  },
  iconWrap: { marginBottom: 12 },
  title: { fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 24px' },
  priceBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px',
    borderRadius: 12,
    background: 'rgba(104,219,174,0.06)',
    border: '1px solid rgba(104,219,174,0.15)',
    marginBottom: 20,
  },
  price: { fontFamily: FONT.headline, fontSize: 26, fontWeight: 900, color: C.primary },
  priceNote: { fontSize: 12, color: C.onSurfaceVariant },
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
