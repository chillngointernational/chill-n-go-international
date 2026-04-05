import { C, Icon } from '../stitch'
export default function BackButton({ onClick }) {
  return (
    <div onClick={onClick} style={{ position: 'fixed', bottom: 24, right: 24, width: 48, height: 48, background: C.surfaceHighest, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', border: '1px solid rgba(241,239,232,0.1)' }}>
      <Icon name="arrow_back" size={20} style={{ color: C.text }} />
    </div>
  )
}
