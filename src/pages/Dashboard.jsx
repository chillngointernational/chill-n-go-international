import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

export default function Dashboard() {
  const { user, member, signOut } = useAuth()
  const navigate = useNavigate()

  const memberStatus = member?.payment_status || 'pending'
  const isVerified = user?.email_confirmed_at != null
  const isPaid = memberStatus === 'active'
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
        <button onClick={handleSignOut} style={styles.signOutBtn}>Cerrar sesión</button>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.greeting}>
          Bienvenido a CNG+
        </h1>
        <p style={styles.email}>{user?.email}</p>

        {/* Status cards */}
        <div style={styles.statusGrid}>
          <div style={{ ...styles.statusCard, borderColor: isPaid ? 'rgba(29,158,117,0.3)' : 'rgba(239,159,39,0.3)' }}>
            <div style={{ ...styles.statusDot, background: isPaid ? '#1D9E75' : '#EF9F27' }} />
            <div>
              <div style={styles.statusLabel}>Membresía</div>
              <div style={{ ...styles.statusValue, color: isPaid ? '#5DCAA5' : '#FAC775' }}>
                {isPaid ? 'Activa' : 'Pago pendiente'}
              </div>
            </div>
            <button onClick={handleManageBilling} style={{ background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit', marginTop: 12, width: '100%' }}>
              {isPaid ? 'Gestionar membresía' : 'Reactivar membresía'}
            </button>
          </div>

          <div style={{ ...styles.statusCard, borderColor: isVerified ? 'rgba(29,158,117,0.3)' : 'rgba(239,159,39,0.3)' }}>
            <div style={{ ...styles.statusDot, background: isVerified ? '#1D9E75' : '#EF9F27' }} />
            <div>
              <div style={styles.statusLabel}>Verificación</div>
              <div style={{ ...styles.statusValue, color: isVerified ? '#5DCAA5' : '#FAC775' }}>
                {isVerified ? 'Verificado' : 'Pendiente'}
              </div>
            </div>
          </div>
        </div>

        {/* Chilliums balance */}
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

        {/* Referral link */}
        <div style={styles.refCard}>
          <h3 style={styles.refTitle}>Tu link de referido</h3>
          <p style={styles.refDesc}>
            Comparte este link para invitar personas a CNG+. Ganas $3.50/mes + 35% de sus compras en Chilliums.
          </p>
          {refLink ? (
            <div style={styles.refLinkBox}>
              <span style={styles.refLinkText}>{refLink}</span>
              <button
                onClick={() => navigator.clipboard.writeText(refLink)}
                style={styles.copyBtn}
              >
                Copiar
              </button>
            </div>
          ) : (
            <div style={styles.refPending}>
              Tu link se generará cuando tu membresía esté activa
            </div>
          )}
        </div>

        <Link to="/network" style={{ display: 'block', background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 600, color: 'white', textDecoration: 'none', textAlign: 'center', marginBottom: 24 }}>Ver mi red completa</Link>

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

        {/* LOBs access */}
        <div style={styles.lobsSection}>
          <h3 style={styles.lobsTitle}>Tu ecosistema</h3>
          <div style={styles.lobsGrid}>
            {[
              { name: 'Travel', icon: '✈', color: '#1D9E75', url: 'https://chillngotravel.com' },
              { name: 'Nutrition', icon: '🌿', color: '#639922', url: 'https://chillngonutrition.com' },
              { name: 'Real Estate', icon: '🏠', color: '#378ADD', url: 'https://chillngorealestate.com' },
              { name: 'Store', icon: '🛍', color: '#D85A30', url: 'https://chillngostore.com' },
              { name: 'Online', icon: '🌐', color: '#7F77DD', url: 'https://chillngoonline.com' },
              { name: 'CandyStakes', icon: '🍬', color: '#D4537E', url: 'https://candystakes.com' },
            ].map((lob) => (
              <a key={lob.name} href={lob.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.lobChip, borderColor: lob.color + '30', textDecoration: 'none' }}>
                <span style={{ fontSize: 16 }}>{lob.icon}</span>
                <span style={{ fontSize: 12, color: lob.color, fontWeight: 500 }}>{lob.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0D1117',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#e6e4dc',
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
    background: 'linear-gradient(135deg, #1D9E75, #5DCAA5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#0D1117',
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: '#e6e4dc',
    letterSpacing: 1,
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12,
    color: '#888',
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
    color: '#888',
    marginBottom: 32,
  },
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
    color: '#888',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: 600,
  },
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
    color: '#888',
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
    color: '#5DCAA5',
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
    color: '#5DCAA5',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  refPending: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
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
    color: '#f1efe8',
    marginBottom: 4,
  },
  networkLabel: {
    fontSize: 12,
    color: '#999',
  },
  networkSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
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