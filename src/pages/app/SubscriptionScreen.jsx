import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { C, FONT, GRADIENT, Icon } from '../../stitch'

// Paso 1 del muro (orden PAGO -> VERIFICACIÓN). El usuario sin pago confirmado llega aquí. Debe
// aceptar los términos (no-reembolso, v1) ANTES de poder pagar. Al aceptar, se monta el Card
// Payment Brick de Mercado Pago: la tarjeta se tokeniza en el navegador (NUNCA toca el servidor),
// y el card_token + device_id se envían al edge cng-mp-create-subscription, que crea la suscripción
// ($140/mes) enganchada al plan con status:'authorized'. Al autorizar, el edge activa la membresía
// al instante; el poll refresca y el muro avanza al paso de identidad.

const PRICE_LABEL = '$140 MXN / mes'
const TERMS_VERSION = 'v1'
const TERMS = [
  'Mi membresía es un cargo mensual recurrente y no es reembolsable.',
  'Después de pagar, debo verificar mi identidad con mi INE para activar mi cuenta.',
  'Si no completo la verificación (por cualquier motivo), mi pago no se reembolsa y mi cuenta no se activa.',
  'Acepto el tratamiento de mis datos según el Aviso de Privacidad.',
]

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY
const AMOUNT = 140

// Carga un <script> externo una sola vez (scoped a esta pantalla; no se mete en index.html).
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing && existing.dataset.loaded === '1') return resolve()
    const el = existing || document.createElement('script')
    el.src = src
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve() })
    el.addEventListener('error', () => reject(new Error('No se pudo cargar el componente de pago.')))
    if (!existing) document.head.appendChild(el)
  })
}

export default function SubscriptionScreen() {
  const { user, member, fetchMember, signOut } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paidRef, setPaidRef] = useState('')   // preapproval_id, por si hay que dar soporte
  const [stuck, setStuck] = useState(false)     // pago hecho pero la activación no avanza
  const [brickLoading, setBrickLoading] = useState(false)
  const brickRef = useRef(null)
  const submittingRef = useRef(false)           // serializa el onSubmit del Brick (anti doble cargo)

  // Aviso temprano si falta la clave pública (variable de build determinista).
  useEffect(() => { if (!MP_PUBLIC_KEY) setError('Falta configurar el pago. Contacta a soporte.') }, [])

  // Si el pago se hizo pero tras ~40s la membresía no avanzó, mostrar referencia para soporte.
  useEffect(() => {
    if (!paid) return
    const t = setTimeout(() => setStuck(true), 40000)
    return () => clearTimeout(t)
  }, [paid])

  // Si volvió de un retorno (?sub=return), refrescar; y poll suave mientras siga pendiente.
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

  // Monta el Card Payment Brick SOLO cuando el usuario aceptó el consentimiento.
  useEffect(() => {
    if (!consent || paid) return
    if (brickRef.current) return
    if (!MP_PUBLIC_KEY) { setError('Falta configurar el pago. Contacta a soporte.'); return }
    let cancelled = false
    setBrickLoading(true)
    ;(async () => {
      try {
        // security.js -> genera window.MP_DEVICE_SESSION_ID (device_id, antifraude).
        await loadScript('https://www.mercadopago.com/v2/security.js', { view: 'checkout' })
        await loadScript('https://sdk.mercadopago.com/js/v2')
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' })
        const controller = await mp.bricks().create('cardPayment', 'cardPaymentBrick_container', {
          initialization: { amount: AMOUNT, payer: { email: user?.email || '' } },
          customization: {
            paymentMethods: { minInstallments: 1, maxInstallments: 1 },
            visual: { style: { theme: 'dark' } },
          },
          callbacks: {
            onReady: () => { if (!cancelled) setBrickLoading(false) },
            onError: (err) => { console.error('[cardPaymentBrick]', err) },
            // formData.token = card_token (un solo uso). La tarjeta NO sale de los iframes de MP.
            // onSubmit DEBE devolver una Promise: resolver = éxito (botón queda listo), RECHAZAR
            // (throw) = el Brick re-habilita su botón para reintentar tras un rechazo.
            onSubmit: async (formData) => {
              if (submittingRef.current) return // evita doble envío -> doble suscripción
              submittingRef.current = true
              let success = false
              try {
                setError('')
                // device_id (antifraude): si security.js aún no lo pobló, esperar brevemente.
                let deviceId = window.MP_DEVICE_SESSION_ID || ''
                for (let i = 0; i < 10 && !deviceId; i++) {
                  await new Promise((r) => setTimeout(r, 50))
                  deviceId = window.MP_DEVICE_SESSION_ID || ''
                }
                const { data, error: fnErr } = await supabase.functions.invoke('cng-mp-create-subscription', {
                  body: {
                    card_token: formData?.token,
                    device_id: deviceId,
                    terms_accepted: true,
                    terms_version: TERMS_VERSION,
                  },
                })
                if (fnErr) {
                  let msg = 'No se pudo procesar el pago. Intenta de nuevo.'
                  try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
                  setError(msg); throw new Error(msg)
                }
                if (data?.error) { setError(data.error); throw new Error(data.error) } // MOTIVO REAL del rechazo
                if (data?.ok) { success = true; setPaidRef(data.preapproval_id || ''); setPaid(true); refresh(); return }
                const m = 'Respuesta inesperada del servidor. Intenta de nuevo.'
                setError(m); throw new Error(m)
              } finally {
                if (!success) submittingRef.current = false // permitir reintento solo si no fue éxito
              }
            },
          },
        })
        if (cancelled) { try { controller?.unmount?.() } catch { /* noop */ } return }
        brickRef.current = controller
      } catch (e) {
        if (!cancelled) { setError(e?.message || 'No se pudo iniciar el pago.'); setBrickLoading(false) }
      }
    })()
    return () => {
      cancelled = true
      try { brickRef.current?.unmount?.() } catch { /* noop */ }
      brickRef.current = null
    }
    // Monta el Brick una sola vez al aceptar (user/refresh son estables tras el muro de auth).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, paid])

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
          <input type="checkbox" checked={consent} disabled={!MP_PUBLIC_KEY} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Acepto estos términos.</span>
        </label>

        {error && <div style={styles.error}>{error}</div>}

        {paid ? (
          <div style={styles.paidBox}>
            <Icon name="check_circle" size={22} style={{ color: C.primary }} />
            <div>
              <p style={styles.paidTitle}>¡Pago recibido!</p>
              {stuck ? (
                <p style={styles.priceNote}>
                  Tu pago se procesó{paidRef ? ` (ref: ${paidRef})` : ''}. Estamos activando tu cuenta;
                  si no avanza en unos minutos, contacta a soporte con esa referencia.
                </p>
              ) : (
                <p style={styles.priceNote}>Activando tu membresía… sigue el paso de identidad.</p>
              )}
            </div>
          </div>
        ) : consent ? (
          <div style={styles.brickWrap}>
            {brickLoading && <p style={styles.brickHint}>Cargando el formulario de pago seguro…</p>}
            {/* El Brick dibuja: tarjeta + nombre del titular + identificación (CURP/RFC) + su botón de pago */}
            <div id="cardPaymentBrick_container" />
          </div>
        ) : (
          <p style={styles.brickHint}>Acepta los términos para mostrar el formulario de pago.</p>
        )}

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
  brickWrap: { marginBottom: 16, minHeight: 40 },
  brickHint: { fontSize: 12.5, color: C.onSurfaceVariant, marginBottom: 16, textAlign: 'center' },
  paidBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    textAlign: 'left',
    padding: '14px 16px',
    borderRadius: 12,
    background: 'rgba(104,219,174,0.08)',
    border: '1px solid rgba(104,219,174,0.2)',
    marginBottom: 16,
  },
  paidTitle: { fontSize: 14, fontWeight: 800, color: C.primary, margin: '0 0 2px' },
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
