import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
const ACTIVE = ['Ana', 'Marcus', 'Sofia', 'Diego', 'Luna', 'Carlos']
const CONVOS = [
  { name: 'Lia Thomas', msg: 'Are we still hitting that yoga session...', time: '2m', unread: 3, verified: true },
  { name: 'Marcus Vane', msg: 'That cafe turned out really chill...', time: '15m', verified: true },
  { name: 'Sasha Moon', msg: 'Shared a photo', time: '1h', unread: 1, hasImage: true },
  { name: 'Devon Lane', msg: 'Sent a voice message', time: '3h', verified: true },
  { name: 'Kai Rivera', msg: 'See you tomorrow then!', time: '5h' },
  { name: 'Elena Torres', msg: 'The Obsidian project looks amazing.', time: '8h', verified: true },
]
export default function MessagesScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Messages" leftIcon="menu" rightContent={<div style={{ cursor: 'pointer', padding: 8 }}><Icon name="edit_square" size={24} style={{ color: C.primaryBright }} /></div>} />
      <div style={{ padding: '0 24px' }}>
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Icon name="search" size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
          <input placeholder="Search conversations" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: '16px 16px 16px 48px', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, marginBottom: 16 }}>Active Now</h2>
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto' }}>
            {ACTIVE.map((n) => (
              <div key={n} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 99, padding: 2, background: 'linear-gradient(to tr, #1D9E75, #B8956A)' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 99, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #080C14', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>{n[0]}</div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, background: C.primaryBright, borderRadius: 99, border: '2px solid #080C14' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(223,226,235,0.8)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CONVOS.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderRadius: 16, background: c.unread ? 'rgba(24,28,34,0.4)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline, flexShrink: 0 }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.onSurface }}>{c.name}</span>
                    {c.verified && (<div style={{ width: 14, height: 14, background: C.primaryBright, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={8} style={{ color: '#fff' }} /></div>)}
                  </div>
                  <span style={{ fontSize: 10, color: c.unread ? C.primaryBright : C.textFaint, fontWeight: c.unread ? 700 : 400 }}>{c.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.hasImage && <Icon name="image" size={12} style={{ color: C.textFaint }} />}
                  <p style={{ fontSize: 12, color: c.unread ? 'rgba(223,226,235,0.9)' : C.textFaint, fontWeight: c.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</p>
                </div>
              </div>
              {c.unread && (<div style={{ width: 20, height: 20, background: C.primaryBright, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.unread}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
