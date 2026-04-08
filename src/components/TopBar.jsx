import { C, FONT, Icon, GLASS_NAV } from '../stitch'
export default function TopBar({ title, leftIcon = 'menu', rightIcon, onLeft, onRight, rightContent }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 64, ...GLASS_NAV, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginBottom: 16 }}>
      <div onClick={onLeft} style={{ cursor: 'pointer', padding: 8, borderRadius: 99, display: 'flex' }}>
        <Icon name={leftIcon} size={24} style={{ color: C.textDim }} />
      </div>
      <h1 style={{ fontFamily: FONT.headline, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.5px' }}>{title}</h1>
      {rightContent || (
        <div onClick={onRight} style={{ cursor: 'pointer', padding: 8, borderRadius: 99, display: 'flex' }}>
          <Icon name={rightIcon || 'settings'} size={24} style={{ color: C.textDim }} />
        </div>
      )}
    </header>
  )
}