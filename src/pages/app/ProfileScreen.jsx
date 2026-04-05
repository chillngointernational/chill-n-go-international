import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
export default function ProfileScreen({ onNavigate }) {
  const { user, member, signOut } = useAuth()
  const navigate = useNavigate()
  const refLink = member?.ref_code ? window.location.origin + '/join?ref=' + member.ref_code : null
  const displayName = member?.full_name || user?.email?.split('@')[0] || 'Member'
  const initial = displayName[0].toUpperCase()
  async function handleSignOut() { await signOut(); navigate('/') }
  async function handleManageBilling() {
    try {
      const r = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_email: user.email, return_url: window.location.origin + '/app' }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
    } catch (e) { console.error(e) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 192, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(29,158,117,0.2), rgba(65,55,155,0.2))', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #10141a, transparent)' }} />
      </div>
      <div style={{ padding: '0 24px', marginTop: -64, position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 80, height: 80, borderRadius: 99, border: '4px solid ' + C.primary, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#0D1117', fontFamily: FONT.headline }}>{initial}</div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: C.primary, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #10141a' }}><Icon name="check" size={14} style={{ color: '#003827' }} /></div>
          </div>
          {member?.ref_code && (<div style={{ padding: '8px 16px', background: C.surfaceHigh, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: C.secondary, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>REF:</span><span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 14, color: C.onSurface, textTransform: 'uppercase' }}>{member.ref_code}</span></div>)}
        </div>
        <div style={{ marginTop: 16 }}>
          <h1 style={{ fontFamily: FONT.headline, fontSize: 28, fontWeight: 800, color: C.onSurface, letterSpacing: '-0.5px' }}>{displayName}</h1>
          <p style={{ color: C.onSurfaceVariant, fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>{user?.email}<span style={{ width: 4, height: 4, borderRadius: 99, background: C.outlineVariant, display: 'inline-block' }} /><span style={{ color: C.secondary, fontWeight: 600 }}>Premium Member</span></p>
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
          <div><span style={{ color: C.primary, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{member?.chilliums_balance?.toFixed(0) || '0'}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Chilliums</p></div>
          <div><span style={{ color: C.onSurface, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{member?.referrals_level1 || 0}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Referrals</p></div>
          <div><span style={{ color: C.onSurface, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{member?.referrals_level2 || 0}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Level 2</p></div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={handleManageBilling} style={{ flex: 1, height: 48, background: GRADIENT.primary, color: '#003827', borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>Manage Plan</button>
          <button onClick={() => { if (refLink) navigator.clipboard.writeText(refLink) }} style={{ width: 48, height: 48, background: C.surfaceLow, color: C.onSurface, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Icon name="share" size={20} /></button>
          <button onClick={() => onNavigate('network')} style={{ flex: 1, height: 48, border: '2px solid ' + C.secondary, color: C.secondary, borderRadius: 12, fontWeight: 700, fontSize: 14, background: 'transparent', cursor: 'pointer', fontFamily: FONT.body }}>My Network</button>
        </div>
      </div>
      <div style={{ padding: '0 24px', marginTop: 40 }}>
        <div style={{ background: 'rgba(104,219,174,0.05)', border: '1px solid rgba(104,219,174,0.1)', borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 160, height: 160, background: 'rgba(104,219,174,0.1)', borderRadius: 99, filter: 'blur(48px)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 12, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 4 }}>Current Balance</p>
                <h2 style={{ fontSize: 36, fontFamily: FONT.headline, fontWeight: 900, color: '#5DCAA5', letterSpacing: '-1px' }}>{member?.chilliums_balance?.toFixed(2) || '0.00'} <span style={{ fontSize: 14, fontWeight: 400, color: '#0F6E56' }}>CHILL</span></h2>
              </div>
              <Icon name="account_balance_wallet" size={28} style={{ color: C.primary }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '4px 12px', background: 'rgba(49,53,60,0.5)', borderRadius: 99, width: 'fit-content' }}>
              <Icon name="auto_awesome" size={14} style={{ color: C.primary }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.primary }}>1 Chillium = 1 USD</span>
            </div>
          </div>
        </div>
      </div>
      {refLink && (<div style={{ padding: '0 24px', marginTop: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, fontFamily: FONT.headline }}>Tu link de referido</h3>
          <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 12 }}>Comparte para ganar .50/mes + 35% de compras en Chilliums.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#5DCAA5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLink}</div>
            <button onClick={() => navigator.clipboard.writeText(refLink)} style={{ background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)', borderRadius: 8, padding: '10px 18px', fontSize: 12, color: '#5DCAA5', cursor: 'pointer', fontWeight: 600, fontFamily: FONT.body, whiteSpace: 'nowrap' }}>Copy</button>
          </div>
        </div>
      </div>)}
      <div style={{ padding: '0 24px', marginTop: 32, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Account', 'Privacy', 'Help & Support'].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: C.surfaceLow, borderRadius: 12, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Icon name={s === 'Account' ? 'person_outline' : s === 'Privacy' ? 'shield' : 'help_outline'} size={20} style={{ color: C.onSurfaceVariant }} /><span style={{ fontWeight: 600, fontSize: 14, color: C.onSurface }}>{s}</span></div>
            <Icon name="chevron_right" size={16} style={{ color: C.onSurfaceVariant }} />
          </div>
        ))}
        <div onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: C.surfaceLow, borderRadius: 12, cursor: 'pointer' }}>
          <Icon name="logout" size={20} style={{ color: '#E24B4A' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#E24B4A' }}>Logout</span>
        </div>
      </div>
    </div>
  )
}
