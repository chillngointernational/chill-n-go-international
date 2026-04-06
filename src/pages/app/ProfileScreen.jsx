import { useState, useEffect, useRef, useCallback } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfileScreen({ onNavigate }) {
  const { user, member, signOut, fetchMember } = useAuth()
  const navigate = useNavigate()
  const avatarRef = useRef(null)
  const [postCount, setPostCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [userPosts, setUserPosts] = useState([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const refLink = member?.ref_code ? window.location.origin + '/join?ref=' + member.ref_code : null
  const displayName = member?.full_name || user?.email?.split('@')[0] || 'Member'
  const initial = displayName[0].toUpperCase()
  const avatarUrl = member?.avatar_url

  const fetchStats = useCallback(async () => {
    if (!user) return
    try {
      const [postsRes, followersRes, followingRes, userPostsRes] = await Promise.all([
        supabase.from('cng_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('cng_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('cng_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
        supabase.from('cng_posts').select('id, media_url, thumbnail_url, media_type, caption').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(12),
      ])
      setPostCount(postsRes.count || 0)
      setFollowersCount(followersRes.count || 0)
      setFollowingCount(followingRes.count || 0)
      console.log('[Profile] user posts:', userPostsRes.data?.map(p => ({ id: p.id, media_url: p.media_url, media_type: p.media_type, thumbnail_url: p.thumbnail_url })))
      setUserPosts(userPostsRes.data || [])
    } catch (e) {
      console.error('Error fetching profile stats:', e)
    }
  }, [user])

  useEffect(() => { fetchStats() }, [fetchStats])

  async function handleSignOut() { await signOut(); navigate('/') }

  async function handleManageBilling() {
    try {
      const r = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_email: user.email, return_url: window.location.origin + '/app' }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
    } catch (e) { console.error(e) }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const path = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadErr } = await supabase.storage.from('cng-media').upload(path, file, { contentType: file.type, upsert: true })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
      const newUrl = urlData.publicUrl

      const { error: updateErr } = await supabase.from('cng_members').update({ avatar_url: newUrl }).eq('user_id', user.id)
      if (updateErr) throw updateErr

      // Refresh member data
      await fetchMember(user.id)
    } catch (err) {
      console.error('Avatar upload error:', err)
    } finally {
      setUploadingAvatar(false)
    }
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
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            <div
              onClick={() => avatarRef.current?.click()}
              style={{ width: 80, height: 80, borderRadius: 99, border: '4px solid ' + C.primary, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#0D1117', fontFamily: FONT.headline }}>{initial}</div>
              )}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: C.primary, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #10141a' }}><Icon name="photo_camera" size={12} style={{ color: '#003827' }} /></div>
          </div>
          {member?.ref_code && (<div style={{ padding: '8px 16px', background: C.surfaceHigh, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: C.secondary, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>REF:</span><span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 14, color: C.onSurface, textTransform: 'uppercase' }}>{member.ref_code}</span></div>)}
        </div>
        <div style={{ marginTop: 16 }}>
          <h1 style={{ fontFamily: FONT.headline, fontSize: 28, fontWeight: 800, color: C.onSurface, letterSpacing: '-0.5px' }}>{displayName}</h1>
          <p style={{ color: C.onSurfaceVariant, fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>{user?.email}<span style={{ width: 4, height: 4, borderRadius: 99, background: C.outlineVariant, display: 'inline-block' }} /><span style={{ color: C.secondary, fontWeight: 600 }}>Premium Member</span></p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
          <div><span style={{ color: C.onSurface, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{postCount}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Posts</p></div>
          <div><span style={{ color: C.onSurface, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{followersCount}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Followers</p></div>
          <div><span style={{ color: C.onSurface, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{followingCount}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Following</p></div>
          <div><span style={{ color: C.primary, fontFamily: FONT.headline, fontSize: 20, fontWeight: 900 }}>{member?.chilliums_balance?.toFixed(0) || '0'}</span><p style={{ fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}>Chilliums</p></div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={handleManageBilling} style={{ flex: 1, height: 48, background: GRADIENT.primary, color: '#003827', borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>Manage Plan</button>
          <button onClick={() => { if (refLink) navigator.clipboard.writeText(refLink) }} style={{ width: 48, height: 48, background: C.surfaceLow, color: C.onSurface, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Icon name="share" size={20} /></button>
          <button onClick={() => onNavigate('network')} style={{ flex: 1, height: 48, border: '2px solid ' + C.secondary, color: C.secondary, borderRadius: 12, fontWeight: 700, fontSize: 14, background: 'transparent', cursor: 'pointer', fontFamily: FONT.body }}>My Network</button>
        </div>
      </div>

      {/* Chilliums balance card */}
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

      {/* Referral link */}
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

      {/* User's posts grid */}
      {userPosts.length > 0 && (
        <div style={{ padding: '0 24px', marginTop: 32 }}>
          <h2 style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, marginBottom: 16 }}>My Posts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, borderRadius: 12, overflow: 'hidden' }}>
            {userPosts.map((p) => (
              <div key={p.id} style={{ position: 'relative', paddingBottom: '100%', background: C.surfaceHigh, overflow: 'hidden' }}>
                {p.media_url ? (
                  p.media_type === 'video' ? (
                    <>
                      <video src={p.media_url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                      <div style={{ position: 'absolute', top: 8, right: 8 }}><Icon name="videocam" size={16} style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} /></div>
                    </>
                  ) : (
                    <img src={p.media_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="text_fields" size={24} style={{ color: C.textFaint }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
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
