import { C, FONT, Icon, useDesktop } from '../../stitch'
const IMG_YOGA = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIwGiRLs1tV1qgRsbL6OYBs_kvJUv0VVqa5yTuoQ_v52McIKorKVofaShc4btgbF_AiVV6z2nYPSH7qSTx-jLVWqHkJpM4-S_J1sfQ_H8FP8PIUaIs12RkD4FKkhQ_SI4sDWcCVAtNhN_IC5BjNC2KpKr-SS-v18LAYi3V6zh5fxIfc2wlLuv1539cNqW1HdaXqWqyUUdOSwgArigZc2D5jGFetHaFTCXuIhuQxlxU5kEL3_aOoPelrLIEPKSOFZsAK_mVopcBwX4'
const IMG_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD91KnKEH49H_3MwsjPJ7wGyM5WL5kdcevL5BoetqZIcZ1XvMyniQ83f-kAgyrLudN9Tn6ck1r9A5hhkPU80-8ZJMwQgE1oo4yAfPvbm-nogU-XkewwDF9qlIJwzEmCaygv4JiCJXrgZ-QEJpsoRuI7t38m20cZACoOoiduKLJ2yPBCdBVsL8HYj1Jo6xkSOV46_cYyZ_YvBIUTwvRzNhNKCXin4NUnMNLRz1TvG9jZ7gEOuFp2WVhS2IDFN4l1VqZnQgPGYvpVLWg'
export default function FeedScreen() {
  const isDesktop = useDesktop()
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden', ...(isDesktop ? { maxWidth: 600, margin: '0 auto' } : {}) }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src={IMG_YOGA} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(8,12,20,0.9) 0%, rgba(8,12,20,0.4) 40%, rgba(8,12,20,0) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: 64, background: 'linear-gradient(180deg, rgba(8,12,20,0.8) 0%, rgba(8,12,20,0) 100%)' }}>
        <Icon name="menu" size={24} style={{ color: C.text }} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 14, color: C.textDim }}>Following</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 14, color: C.primary }}>For You</span>
            <div style={{ height: 2, width: 16, background: C.primary, borderRadius: 99, marginTop: 4 }} />
          </div>
        </div>
        <Icon name="search" size={24} style={{ color: C.text }} />
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, zIndex: 20 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 48, height: 48, borderRadius: 99, border: '2px solid ' + C.primary, overflow: 'hidden' }}>
            <img src={IMG_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0D1117' }}>
            <Icon name="add" size={12} style={{ color: '#fff' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Icon name="favorite" fill size={28} style={{ color: C.text }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>12.4K</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Icon name="chat_bubble" fill size={28} style={{ color: C.text }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>847</span>
        </div>
        <Icon name="bookmark" fill size={28} style={{ color: C.text }} />
        <Icon name="share" size={28} style={{ color: C.text }} />
      </div>
      <div style={{ position: 'absolute', left: 16, bottom: 100, right: 80, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONT.headline, fontWeight: 800, fontSize: 16, color: C.text }}>@wellness_vibes</span>
          <Icon name="verified" fill size={16} style={{ color: C.primary }} />
        </div>
        <p style={{ fontSize: 14, color: 'rgba(241,239,232,0.9)', lineHeight: 1.6, fontFamily: FONT.body }}>Start your day with intention... practicing flow in the heart of nature. Find your sanctuary.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 12px', background: 'rgba(104,219,174,0.2)', borderRadius: 99, border: '1px solid rgba(104,219,174,0.2)', fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 1 }}>Travel</span>
          <span style={{ padding: '4px 12px', background: 'rgba(95,68,32,0.3)', borderRadius: 99, border: '1px solid rgba(95,68,32,0.2)', fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>Nutrition</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(241,239,232,0.8)' }}>
          <Icon name="music_note" size={18} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Original Sound - wellness_vibes</span>
        </div>
      </div>
    </div>
  )
}
