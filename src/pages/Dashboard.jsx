import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { C, FONT, Icon, GRADIENT } from '../stitch'
import { formatChilliums } from '../lib/chilliums';

export default function Dashboard() {
  const { user, member, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = member?.first_name || user?.email?.split('@')[0] || ''
  const refLink = member?.ref_code
    ? `${window.location.origin}/join?ref=${member.ref_code}`
    : null

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
            {formatChilliums(member?.chilliums_balance)}
          </div>
          <div style={styles.balanceSub}>Saldo de recompensas</div>
        </div>

        {/* Referral link */}
        <div style={styles.refCard}>
          <h3 style={styles.refTitle}>Tu link de referido</h3>
          <p style={styles.refDesc}>
            Comparte este link para invitar personas a CNG+. Ganas recompensas en Chilliums sobre las compras reales de quienes invitas.
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
              Tu link de referido aparecerá aquí
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
            <div style={styles.networkSub}>Sobre sus compras</div>
          </div>
          <div style={styles.networkCard}>
            <div style={styles.networkNumber}>{formatChilliums(member?.chilliums_total_earned)}</div>
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
    gridTemplateColumns: 'repeat(2, 1fr)',
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
