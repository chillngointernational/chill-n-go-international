import { C, FONT, GRADIENT, Icon } from '../stitch'

// Aviso NEUTRAL "próximamente" para acciones de compra/contacto mientras no exista el
// checkout. Sin mensaje de membresía ni de login: IGUAL para todos. (El muro "Solo para
// miembros" / MembersOnly queda para acciones realmente gateadas por membresía, p.ej. Travel.)
export default function ComingSoonNotice({ open, onClose, title, text }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={S.overlay}>
      <div onClick={(e) => e.stopPropagation()} style={S.card}>
        <div style={S.iconWrap}><Icon name="shopping_bag" size={30} style={{ color: C.primary }} /></div>
        <h2 style={S.title}>{title || 'Compra en línea — próximamente'}</h2>
        <p style={S.text}>{text || 'Estamos afinando la compra en GoShop para que sea fácil y segura. Muy pronto podrás comprar aquí.'}</p>
        <button onClick={onClose} style={S.primary}>Entendido</button>
      </div>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,12,20,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body },
  card: { width: '100%', maxWidth: 360, background: '#10141a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  iconWrap: { width: 56, height: 56, borderRadius: 99, margin: '0 auto 14px', background: 'rgba(104,219,174,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.headline, fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 8px' },
  text: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 22px' },
  primary: { display: 'block', width: '100%', boxSizing: 'border-box', background: GRADIENT.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' },
}
