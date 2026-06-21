import { Link } from 'react-router-dom'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Modal "solo para miembros" para acciones bloqueadas a anónimos (like, comentar, seguir, comprar).
// El alta es por invitación (ref_code): NO ofrece registro libre, solo iniciar sesión.
export default function MembersOnly({ open, onClose, action }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()} style={styles.card}>
        <div style={styles.iconWrap}><Icon name="lock" size={30} style={{ color: C.primary }} /></div>
        <h2 style={styles.title}>Solo para miembros</h2>
        <p style={styles.text}>
          {action ? `Para ${action} necesitas ser miembro de Chill N Go. ` : 'Esta acción es solo para miembros de Chill N Go. '}
          Inicia sesión, o únete con la invitación de un miembro activo.
        </p>
        <Link to="/login" style={styles.primary}>Iniciar sesión</Link>
        <button onClick={onClose} style={styles.secondary}>Seguir explorando</button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(8,12,20,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    fontFamily: FONT.body,
  },
  card: {
    width: '100%', maxWidth: 360, background: '#10141a',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 24px',
    textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 99, margin: '0 auto 14px',
    background: 'rgba(104,219,174,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: FONT.headline, fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 8px' },
  text: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 22px' },
  primary: {
    display: 'block', background: GRADIENT.primary, color: '#fff', textDecoration: 'none',
    borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', marginBottom: 10,
  },
  secondary: {
    width: '100%', background: 'transparent', border: 'none', color: C.onSurfaceVariant,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '6px',
  },
}
