import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { C, FONT, Icon, GRADIENT } from '../stitch'
import { getMemberState } from '../utils/memberStatus'

export default function Dashboard() {
  const { user, member, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const state = getMemberState(member)
  const displayName = member?.first_name || user?.email?.split('@')[0] || ''
  const refLink = member?.ref_code
    ? `${window.location.origin}/join?ref=${member.ref_code}`
    : null

  async function handleManageBilling() {
    try {
      const response = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: user.email,
          return_url: window.location.origin + '/dashboard',
        }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handlePaymentRetry() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          ref_code: '',
          success_url: window.location.origin + '/dashboard',
          cancel_url: window.location.origin + '/dashboard',
        }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError('Error al procesar el pago: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartVerification() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          return_url: window.location.origin + '/dashboard',
        }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      const stripe = window.Stripe('pk_test_51Rvx4iClWFP3vllVGpXmK95SXNw6SGUhcObbEZIIG1Sl1hlh6iszofr1Xl2FLTpXWpz6yL1Pvt9Dma1OHhv6VVE800RZSbAarS')
      const result = await stripe.verifyIdentity(data.client_secret)
      if (result.error) {
        setError(result.error.message)
      } else {
        // User submitted docs. The webhook will flip status when Stripe finishes processing.
        // Reload to pick up the new state.
        window.location.reload()
      }
    } catch (err) {
      setError('Error iniciando verificación: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div style={styles.container}>
      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <Link to="/" style={styles.navLogo}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </Link>
        </div>
        <button onClick={handleSignOut} style={styles.signOutBtn}>Cerrar sesion</button>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.greeting}>
          {displayName ? `Bienvenido, ${displayName}` : 'Bienvenido a CNG+'}
        </h1>
        <p style={styles.email}>{user?.email}</p>

        {/* Intermediate-state recovery cards */}
        {state === 'payment_pending' && (
          <div style={{ ...styles.pendingCard, borderColor: 'rgba(239,159,39,0.3)' }}>
            <div style={{ ...styles.pendingBadge, background: 'rgba(239,159,39,0.15)', color: '#FAC775' }}>
              Pago pendiente
            </div>
            <h2 style={styles.pendingTitle}>Completa tu pago para activar tu cuenta</h2>
            <p style={styles.pendingDesc}>
              Tu información está guardada, pero aún no hemos recibido el pago de $10 para activar tu membresía.
            </p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <button onClick={handlePaymentRetry} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Procesando...' : 'Completar pago — $10'}
            </button>
          </div>
        )}

        {(state === 'kyc_not_started' || state === 'kyc_pending') && (
          <div style={{ ...styles.pendingCard, borderColor: 'rgba(127,119,221,0.3)' }}>
            <div style={{ ...styles.pendingBadge, background: 'rgba(127,119,221,0.15)', color: '#A095E5' }}>
              Último paso
            </div>
            <h2 style={styles.pendingTitle}>Verifica tu identidad</h2>
            <p style={styles.pendingDesc}>
              Ya pagaste tu membresía. Solo falta verificar tu identidad con Stripe para tener acceso completo al ecosistema.
            </p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <button onClick={handleStartVerification} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Iniciando...' : 'Iniciar verificación'}
            </button>
          </div>
        )}

        {state === 'kyc_failed' && (
          <div style={{ ...styles.pendingCard, borderColor: 'rgba(224,49,49,0.35)' }}>
            <div style={{ ...styles.pendingBadge, background: 'rgba(224,49,49,0.15)', color: '#F28886' }}>
              Verificación fallida
            </div>
            <h2 style={styles.pendingTitle}>Tu verificación no se completó</h2>
            <p style={styles.pendingDesc}>
              La verificación de identidad falló.
              {member?.last_kyc_error && (
                <span style={{ display: 'block', color: C.textFaint, fontSize: 12, marginTop: 8 }}>
                  Código Stripe: {member.last_kyc_error}
                </span>
              )}
            </p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <button onClick={handleStartVerification} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Iniciando...' : 'Reintentar verificación'}
            </button>
            <p style={styles.supportLink}>
              Si no puedes verificarte, contacta{' '}
              <a href="mailto:soporte@chillngointernational.com" style={{ color: C.primary }}>
                soporte@chillngointernational.com
              </a>
            </p>
          </div>
        )}

        {/* Chilliums balance — visible in all states */}
        <div style={styles.balanceCard}>
          <div style={styles.balanceHeader}>
            <svg width="24" height="24" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
              <ellipse cx="15" cy="17" rx="12" ry="5" fill="#BA7517" opacity="0.4" />
              <ellipse cx="15" cy="13" rx="12" ry="5" fill="#EF9F27" opacity="0.6" />
              <text x="15" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#633806">C</text>
            </svg>
            <span style={styles.balanceLabel}>Chilliums</span>
          </div>
          <div style={styles.balanceAmount}>
            {member?.chilliums_balance?.toFixed(2) || '0.00'}
          </div>
          <div style={styles.balanceSub}>1 Chillium = 1 USD</div>
        </div>

        {/* Fully-active features */}
        {state === 'fully_active' && (
          <>
            {/* Status grid */}
            <div style={styles.statusGrid}>
              <div style={{ ...styles.statusCard, borderColor: 'rgba(29,158,117,0.3)' }}>
                <div style={{ ...styles.statusDot, background: C.primaryBright }} />
                <div>
                  <div style={styles.statusLabel}>Membresia</div>
                  <div style={{ ...styles.statusValue, color: C.primary }}>Activa</div>
                </div>
                <button onClick={handleManageBilling} style={styles.manageBtn}>
                  Gestionar membresia
                </button>
              </div>

              <div style={{ ...styles.statusCard, borderColor: 'rgba(29,158,117,0.3)' }}>
                <div style={{ ...styles.statusDot, background: C.primaryBright }} />
                <div>
                  <div style={styles.statusLabel}>Verificacion</div>
                  <div style={{ ...styles.statusValue, color: C.primary }}>Verificado</div>
                </div>
              </div>
            </div>

            {/* Referral link */}
            <div style={styles.refCard}>
              <h3 style={styles.refTitle}>Tu link de referido</h3>
              <p style={styles.refDesc}>
                Comparte este link para invitar personas a CNG+. Ganas $3.50/mes + 35% de sus compras en Chilliums.
              </p>
              {refLink ? (
                <div style={styles.refLinkBox}>
                  <span style={styles.refLinkText}>{refLink}</span>
                  <button onClick={() => navigator.clipboard.writeText(refLink)} style={styles.copyBtn}>
                    Copiar
                  </button>
                </div>
              ) : (
                <div style={styles.refPending}>
                  Tu link se generara cuando tu membresia este activa
                </div>
              )}
            </div>

            <Link
              to="/network"
              style={{
                display: 'block',
                background: GRADIENT.primary,
                border: 'none',
                borderRadius: 8,
                padding: '14px',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                textDecoration: 'none',
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Ver mi red completa
            </Link>

            {/* Network stats */}
            <div style={styles.networkGrid}>
              <div style={styles.networkCard}>
                <div style={styles.networkNumber}>{member?.referrals_level1 || 0}</div>
                <div style={styles.networkLabel}>Referidos directos</div>
                <div style={styles.networkSub}>Nivel 1</div>
              </div>
              <div style={styles.networkCard}>
                <div style={styles.networkNumber}>{member?.referrals_level2 || 0}</div>
                <div style={styles.networkLabel}>Red extendida</div>
                <div style={styles.networkSub}>Nivel 2</div>
              </div>
              <div style={styles.networkCard}>
                <div style={styles.networkNumber}>{member?.total_earnings?.toFixed(2) || '0.00'}</div>
                <div style={styles.networkLabel}>Ganado total</div>
                <div style={styles.networkSub}>Chilliums</div>
              </div>
            </div>

            {/* LOBs */}
            <div style={styles.lobsSection}>
              <h3 style={styles.lobsTitle}>Tu ecosistema</h3>
              <div style={styles.lobsGrid}>
                {[
                  { name: 'Travel', icon: 'flight_takeoff', color: '#1D9E75', url: 'https://chillngotravel.com' },
                  { name: 'Nutrition', icon: 'restaurant', color: '#639922', url: 'https://chillngonutrition.com' },
                  { name: 'Real Estate', icon: 'domain', color: '#378ADD', url: 'https://chillngorealestate.com' },
                  { name: 'Store', icon: 'shopping_bag', color: '#D85A30', url: 'https://chillngostore.com' },
                  { name: 'Online', icon: 'language', color: '#7F77DD', url: 'https://chillngoonline.com' },
                  { name: 'CandyStakes', icon: 'military_tech', color: '#D4537E', url: 'https://candystakes.com' },
                ].map((lob) => (
                  <a
                    key={lob.name}
                    href={lob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.lobChip, borderColor: lob.color + '30', textDecoration: 'none' }}
                  >
                    <Icon name={lob.icon} size={16} style={{ color: lob.color }} />
                    <span style={{ fontSize: 12, color: lob.color, fontWeight: 500 }}>{lob.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: C.surface,
    fontFamily: FONT.body,
    color: C.text,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  navLeft: { display: 'flex', alignItems: 'center' },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: GRADIENT.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: C.surface,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: C.text,
    letterSpacing: 1,
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12,
    color: C.onSurfaceVariant,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  content: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '40px 24px',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    marginBottom: 32,
  },

  // Intermediate-state recovery cards
  pendingCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid',
    borderRadius: 16,
    padding: '24px',
    marginBottom: 24,
  },
  pendingBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: C.text,
    marginBottom: 8,
  },
  pendingDesc: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    lineHeight: 1.5,
    marginBottom: 20,
  },
  primaryBtn: {
    background: GRADIENT.primary,
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  errorBox: {
    background: 'rgba(224,49,49,0.1)',
    border: '1px solid rgba(224,49,49,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: C.error,
    marginBottom: 16,
  },
  supportLink: {
    fontSize: 12,
    color: C.textFaint,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 1.5,
  },

  // Status cards (fully_active)
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 24,
  },
  statusCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid',
    borderRadius: 12,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: 600,
  },
  manageBtn: {
    background: GRADIENT.primary,
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 12,
    width: '100%',
  },

  // Balance
  balanceCard: {
    background: 'rgba(239,159,39,0.05)',
    border: '1px solid rgba(239,159,39,0.15)',
    borderRadius: 16,
    padding: '24px',
    textAlign: 'center',
    marginBottom: 24,
  },
  balanceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FAC775',
    fontWeight: 500,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 700,
    color: '#FAC775',
  },
  balanceSub: {
    fontSize: 12,
    color: '#854F0B',
    marginTop: 4,
  },

  // Referral (fully_active)
  refCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '24px',
    marginBottom: 24,
  },
  refTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
  },
  refDesc: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  refLinkBox: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  refLinkText: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    color: C.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyBtn: {
    background: 'rgba(29,158,117,0.15)',
    border: '1px solid rgba(29,158,117,0.3)',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 12,
    color: C.primary,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  refPending: {
    fontSize: 13,
    color: C.textFaint,
    fontStyle: 'italic',
  },

  // Network stats (fully_active)
  networkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 32,
  },
  networkCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '20px 16px',
    textAlign: 'center',
  },
  networkNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: C.text,
    marginBottom: 4,
  },
  networkLabel: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  networkSub: {
    fontSize: 11,
    color: C.textFaint,
    marginTop: 2,
  },

  // LOBs (fully_active)
  lobsSection: {
    marginBottom: 32,
  },
  lobsTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
  },
  lobsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
  },
  lobChip: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid',
    borderRadius: 10,
    padding: '14px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
}
