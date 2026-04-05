import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
const IMG_LOUNGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOcClPFLLyZ5HKX435YqgZ8BL7KzLoCPwenREchInEfnQEmromoH21sfeniPLxa4X4vxhcir0z7B7iwVXbQLdtF4unkTjRf6LL-uMvkXW-8XMhUgHXHPwVB6Dykhb4JViugQvOcOvmDOo9Xb0Gndyfsx_ByiVASluuHded6AJWqOQajNR5XA1MuIK2ZxlXKrwINhHvWXwPLUFgvGO8bqF5WHnPU96XSMJHxQGshbRwnzKeN33vg_6JRRPDPTcyYJuXM-cYZOxKMlM'
const TAGS = [
  { label: 'Travel', color: '#26A37A', text: '#68DBAE' },
  { label: 'Nutrition', color: '#B8956A', text: '#E7C092' },
  { label: 'Store', color: '#FF7F50', text: '#FF7F50' },
  { label: 'Real Estate', color: '#41379B', text: '#C5C0FF' },
  { label: 'CandyStakes', color: '#7F77DD', text: '#7F77DD' },
]
export default function CreateScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Chill N Go" leftIcon="close" rightIcon="settings" />
      <div style={{ position: 'relative', width: '100%', height: 380, overflow: 'hidden' }}>
        <img src={IMG_LOUNGE} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0D1117, transparent, transparent)', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', opacity: 0.2, pointerEvents: 'none' }}>
          {[...Array(6)].map((_, i) => (<div key={i} style={{ borderRight: i % 3 !== 2 ? '1px solid #F1EFE8' : 'none', borderBottom: i < 3 ? '1px solid #F1EFE8' : 'none' }} />))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}>
            <Icon name="photo_camera" size={30} style={{ color: '#fff' }} />
          </div>
          <p style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONT.body }}>Tap to capture</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: '16px 0', background: C.surface }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint, fontFamily: FONT.body }}>Video</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.primaryBright, fontFamily: FONT.body }}>Photo</span>
          <div style={{ width: 6, height: 6, borderRadius: 99, background: C.primaryBright, marginTop: 8 }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint, fontFamily: FONT.body }}>Story</span>
      </div>
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 24, background: C.surface }}>
        <textarea placeholder="Write a chill caption..." rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: C.text, fontSize: 14, fontFamily: FONT.body, resize: 'none', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {TAGS.map((t) => (
            <span key={t.label} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 99, background: t.color + '20', color: t.text, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, border: '1px solid ' + t.color + '30', fontFamily: FONT.body }}>{t.label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[{ icon: 'location_on', label: 'Location' }, { icon: 'sell', label: 'Products' }, { icon: 'group', label: 'People' }].map((o) => (
            <button key={o.icon} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5DCAA5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>
              <Icon name={o.icon} size={20} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{o.label}</span>
            </button>
          ))}
        </div>
        <button style={{ width: '100%', padding: 16, borderRadius: 12, background: GRADIENT.primary, color: '#fff', fontFamily: FONT.headline, fontWeight: 800, fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          POST <Icon name="arrow_forward" size={18} />
        </button>
      </div>
    </div>
  )
}
