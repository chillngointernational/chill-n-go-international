import { useState, useEffect, useCallback, useRef } from 'react'
import { C, FONT, Icon, useDesktop } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/* ── Comments Bottom Sheet ─────────────────────────────────── */
function CommentsPanel({ post, userId, onClose, onCountUpdate }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)

  const fetchComments = useCallback(async () => {
    const { data: rawComments } = await supabase
      .from('cng_post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })

    if (!rawComments || rawComments.length === 0) {
      setComments([])
      setLoading(false)
      return
    }

    const userIds = [...new Set(rawComments.map(c => c.user_id))]
    const { data: members } = await supabase
      .from('identity_profiles')
      .select('user_id, full_name, ref_code, avatar_url')
      .in('user_id', userIds)

    const memberMap = {}
      ; (members || []).forEach(m => { memberMap[m.user_id] = m })

    setComments(rawComments.map(c => ({ ...c, identity_profiles: memberMap[c.user_id] || {} })))
    setLoading(false)
  }, [post.id])

  useEffect(() => { fetchComments() }, [fetchComments])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comments.length])

  const handleSend = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText('')

    // optimistic
    const optimistic = {
      id: 'tmp-' + Date.now(),
      post_id: post.id,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      identity_profiles: { full_name: 'You', ref_code: '', avatar_url: null },
    }
    setComments(prev => [...prev, optimistic])
    onCountUpdate(post.id, 1)

    try {
      const { error } = await supabase.from('cng_post_comments').insert({ post_id: post.id, user_id: userId, content })
      if (error) throw error
      await fetchComments()
    } catch (e) {
      console.error('Comment error:', e)
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      onCountUpdate(post.id, -1)
    } finally {
      setSending(false)
    }
  }

  const fmtTime = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return 'now'
    if (diff < 3600) return Math.floor(diff / 60) + 'm'
    if (diff < 86400) return Math.floor(diff / 3600) + 'h'
    return Math.floor(diff / 86400) + 'd'
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998, animation: 'cmtFadeIn 0.25s ease' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '60vh',
        background: C.surface, borderTop: '1px solid rgba(241,239,232,0.1)',
        borderRadius: '20px 20px 0 0', zIndex: 999,
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        animation: 'cmtSlideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(241,239,232,0.08)' }}>
          <span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 16, color: C.text }}>
            Comments <span style={{ color: C.textDim, fontWeight: 500, fontSize: 13 }}>({comments.length})</span>
          </span>
          <div onClick={onClose} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 99, background: 'rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} style={{ color: C.textDim }} />
          </div>
        </div>

        {/* List */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 24, height: 24, border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : comments.length === 0 ? (
            <p style={{ textAlign: 'center', color: C.textDim, fontSize: 13, padding: 24, fontFamily: FONT.body }}>No comments yet. Be the first!</p>
          ) : comments.map(c => {
            const m = c.identity_profiles || {}
            const name = m.full_name || m.ref_code || 'Member'
            const ini = name[0]?.toUpperCase() || 'M'
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 99, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 99, background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: FONT.headline }}>{ini}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 13, color: C.text }}>{name}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{fmtTime(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(241,239,232,0.85)', lineHeight: 1.5, marginTop: 2, fontFamily: FONT.body, wordBreak: 'break-word' }}>{c.content}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid rgba(241,239,232,0.08)', background: 'rgba(8,12,20,0.4)' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Add a comment…"
            style={{ flex: 1, background: 'rgba(241,239,232,0.06)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 99, padding: '10px 16px', fontSize: 13, color: C.text, fontFamily: FONT.body, outline: 'none' }}
          />
          <div onClick={handleSend} style={{ cursor: sending ? 'default' : 'pointer', opacity: text.trim() ? 1 : 0.4, width: 36, height: 36, borderRadius: 99, background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }}>
            <Icon name="send" size={18} style={{ color: '#fff' }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cmtSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes cmtFadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  )
}

/* ── Share Toast ────────────────────────────────────────────── */
function ShareToast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(29,158,117,0.95)', color: '#fff', padding: '10px 24px',
      borderRadius: 99, fontSize: 13, fontWeight: 600, fontFamily: FONT.headline,
      zIndex: 1000, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      animation: 'toastIn 0.3s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {message}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  )
}

const IMG_YOGA = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIwGiRLs1tV1qgRsbL6OYBs_kvJUv0VVqa5yTuoQ_v52McIKorKVofaShc4btgbF_AiVV6z2nYPSH7qSTx-jLVWqHkJpM4-S_J1sfQ_H8FP8PIUaIs12RkD4FKkhQ_SI4sDWcCVAtNhN_IC5BjNC2KpKr-SS-v18LAYi3V6zh5fxIfc2wlLuv1539cNqW1HdaXqWqyUUdOSwgArigZc2D5jGFetHaFTCXuIhuQxlxU5kEL3_aOoPelrLIEPKSOFZsAK_mVopcBwX4'
const IMG_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD91KnKEH49H_3MwsjPJ7wGyM5WL5kdcevL5BoetqZIcZ1XvMyniQ83f-kAgyrLudN9Tn6ck1r9A5hhkPU80-8ZJMwQgE1oo4yAfPvbm-nogU-XkewwDF9qlIJwzEmCaygv4JiCJXrgZ-QEJpsoRuI7t38m20cZACoOoiduKLJ2yPBCdBVsL8HYj1Jo6xkSOV46_cYyZ_YvBIUTwvRzNhNKCXin4NUnMNLRz1TvG9jZ7gEOuFp2WVhS2IDFN4l1VqZnQgPGYvpVLWg'

const TAG_COLORS = {
  travel: { bg: 'rgba(104,219,174,0.2)', border: 'rgba(104,219,174,0.2)', color: '#68DBAE' },
  nutrition: { bg: 'rgba(95,68,32,0.3)', border: 'rgba(95,68,32,0.2)', color: '#E7C092' },
  store: { bg: 'rgba(255,127,80,0.2)', border: 'rgba(255,127,80,0.2)', color: '#FF7F50' },
  realestate: { bg: 'rgba(65,55,155,0.2)', border: 'rgba(65,55,155,0.3)', color: '#C5C0FF' },
  candystakes: { bg: 'rgba(127,119,221,0.2)', border: 'rgba(127,119,221,0.3)', color: '#7F77DD' },
  online: { bg: 'rgba(197,192,255,0.15)', border: 'rgba(197,192,255,0.2)', color: '#C5C0FF' },
  general: { bg: 'rgba(241,239,232,0.1)', border: 'rgba(241,239,232,0.1)', color: '#F1EFE8' },
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function DemoPost() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0, scrollSnapAlign: 'start' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src={IMG_YOGA} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(8,12,20,0.9) 0%, rgba(8,12,20,0.4) 40%, rgba(8,12,20,0) 100%)', pointerEvents: 'none' }} />
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
      </div>
    </div>
  )
}

function CaptionText({ text, maxLength = 80 }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncate = text.length > maxLength

  return (
    <p style={{ fontSize: 14, color: 'rgba(241,239,232,0.9)', lineHeight: 1.6, fontFamily: FONT.body }}>
      {needsTruncate && !expanded ? text.slice(0, maxLength) + '... ' : text + ' '}
      {needsTruncate && (
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{ color: C.textDim, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {expanded ? 'less' : 'more'}
        </span>
      )}
    </p>
  )
}

function PostCard({ post, currentUserId, onLike, onBookmark, onComment, onShare, onFollow, isMuted, onMuteToggle }) {
  const member = post.identity_profiles
  const displayName = member?.full_name || member?.ref_code || 'Member'
  const initial = displayName[0]?.toUpperCase() || 'M'
  const avatarUrl = member?.avatar_url
  const tag = TAG_COLORS[post.category] || TAG_COLORS.general

  const videoRef = useRef(null)
  const cardRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // IntersectionObserver: auto play/pause video based on viewport visibility
  useEffect(() => {
    if (post.media_type !== 'video' || !cardRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current
        if (!video) return
        if (entry.isIntersecting) {
          video.play().then(() => setIsPlaying(true)).catch(() => { })
        } else {
          video.pause()
          video.currentTime = 0
          setIsPlaying(false)
        }
      },
      { threshold: 0.7 }
    )

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [post.media_type])

  // Sync muted state from parent whenever it changes or video starts playing
  useEffect(() => {
    const video = videoRef.current
    if (!video || post.media_type !== 'video') return
    video.muted = isMuted
  }, [isMuted, isPlaying, post.media_type])

  const handleVideoTap = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => { })
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }
  return (
    <div ref={cardRef} style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0, scrollSnapAlign: 'start' }}>
      {/* Background */}
      {post.media_url ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          {post.media_type === 'video' ? (
            <>
              <video
                ref={videoRef}
                src={post.media_url}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loop
                playsInline
                muted
                onClick={handleVideoTap}
              />
              <div
                onClick={(e) => { e.stopPropagation(); onMuteToggle() }}
                style={{
                  position: 'absolute', top: 16, right: 16, zIndex: 15,
                  width: 36, height: 36, borderRadius: 99,
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name={isMuted ? 'volume_off' : 'volume_up'} size={18} style={{ color: '#fff' }} />
              </div>
            </>
          ) : (
            <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0F6E56, #0D1117)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(8,12,20,0.9) 0%, rgba(8,12,20,0.4) 40%, rgba(8,12,20,0) 100%)', pointerEvents: 'none' }} />

      {/* Top bar */}
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

      {/* Right sidebar actions */}
      <div style={{ position: 'absolute', right: 16, bottom: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, zIndex: 20 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 48, height: 48, borderRadius: 99, border: '2px solid ' + C.primary, overflow: 'hidden' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: FONT.headline }}>{initial}</div>
            )}
          </div>
          {post.identity_profiles?.user_id !== currentUserId && (
            <div
              onClick={(e) => { e.stopPropagation(); onFollow(post) }}
              style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, background: post._followed ? '#E24B4A' : 'linear-gradient(135deg, #1D9E75, #0F6E56)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0D1117', cursor: 'pointer', transition: 'background 0.2s' }}>
              <Icon name={post._followed ? 'check' : 'add'} size={12} style={{ color: '#fff' }} />
            </div>
          )}
        </div>

        {/* Like */}
        <div onClick={() => onLike(post)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <Icon name="favorite" fill={post._liked} size={28} style={{ color: post._liked ? '#E24B4A' : C.text, transition: 'color 0.2s' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatCount(post.likes_count)}</span>
        </div>

        {/* Comments */}
        <div onClick={() => onComment(post)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <Icon name="chat_bubble" fill size={28} style={{ color: C.text }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatCount(post.comments_count)}</span>
        </div>

        {/* Bookmark */}
        <div onClick={() => onBookmark(post)} style={{ cursor: 'pointer' }}>
          <Icon name="bookmark" fill={post._bookmarked} size={28} style={{ color: post._bookmarked ? C.primary : C.text, transition: 'color 0.2s' }} />
        </div>

        {/* Share */}
        <div onClick={() => onShare(post)} style={{ cursor: 'pointer' }}>
          <Icon name="share" size={28} style={{ color: C.text }} />
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', left: 16, bottom: 100, right: 80, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONT.headline, fontWeight: 800, fontSize: 16, color: C.text }}>@{member?.ref_code || displayName.toLowerCase().replace(/\s/g, '_')}</span>
        </div>
        {post.caption && (
          <CaptionText text={post.caption} />
        )}
        {post.category && post.category !== 'general' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '4px 12px', background: tag.bg, borderRadius: 99, border: '1px solid ' + tag.border, fontSize: 10, fontWeight: 700, color: tag.color, textTransform: 'uppercase', letterSpacing: 1 }}>{post.category}</span>
          </div>
        )}
        {post.location_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(241,239,232,0.8)' }}>
            <Icon name="location_on" size={16} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{post.location_name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FeedScreen() {
  const isDesktop = useDesktop()
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)
  const [commentPost, setCommentPost] = useState(null)
  const [toast, setToast] = useState(null)
  const [isMuted, setIsMuted] = useState(true)

  const fetchPosts = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const { data: postsData, error } = await supabase
        .from('cng_posts')
        .select('*, identity_profiles!cng_posts_member_id_fkey(user_id, full_name, ref_code, avatar_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      if (!postsData || postsData.length === 0) { setPosts([]); setLoading(false); return }

      // Fetch user's likes, bookmarks, and follows
      const postIds = postsData.map(p => p.id)
      const authorIds = [...new Set(postsData.map(p => p.identity_profiles?.user_id).filter(Boolean))]
      const [likesRes, bookmarksRes, followsRes] = await Promise.all([
        supabase.from('cng_post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('cng_post_bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        authorIds.length > 0
          ? supabase.from('cng_follows').select('following_id').eq('follower_id', user.id).in('following_id', authorIds)
          : { data: [] },
      ])

      const likedSet = new Set((likesRes.data || []).map(l => l.post_id))
      const bookmarkedSet = new Set((bookmarksRes.data || []).map(b => b.post_id))
      const followedSet = new Set((followsRes.data || []).map(f => f.following_id))

      setPosts(postsData.map(p => ({
        ...p,
        _liked: likedSet.has(p.id),
        _bookmarked: bookmarkedSet.has(p.id),
        _followed: followedSet.has(p.identity_profiles?.user_id),
      })))
    } catch (e) {
      console.error('Error fetching posts:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleLike = async (post) => {
    if (!user) return
    const wasLiked = post._liked
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      _liked: !wasLiked,
      likes_count: wasLiked ? Math.max(p.likes_count - 1, 0) : p.likes_count + 1,
    } : p))

    try {
      if (wasLiked) {
        const { error } = await supabase.from('cng_post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cng_post_likes').insert({ post_id: post.id, user_id: user.id })
        if (error) throw error
      }
    } catch (e) {
      console.error('Like error:', e)
      // Revert
      setPosts(prev => prev.map(p => p.id === post.id ? {
        ...p,
        _liked: wasLiked,
        likes_count: wasLiked ? p.likes_count + 1 : Math.max(p.likes_count - 1, 0),
      } : p))
    }
  }

  const handleBookmark = async (post) => {
    if (!user) return
    const wasBookmarked = post._bookmarked
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, _bookmarked: !wasBookmarked } : p))

    try {
      if (wasBookmarked) {
        const { error } = await supabase.from('cng_post_bookmarks').delete().eq('post_id', post.id).eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cng_post_bookmarks').insert({ post_id: post.id, user_id: user.id })
        if (error) throw error
      }
    } catch (e) {
      console.error('Bookmark error:', e)
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, _bookmarked: wasBookmarked } : p))
    }
  }

  const handleFollow = async (post) => {
    if (!user) return
    const authorId = post.identity_profiles?.user_id
    if (!authorId || authorId === user.id) return
    const wasFollowed = post._followed
    // Optimistic update — toggle all posts by same author
    setPosts(prev => prev.map(p =>
      p.identity_profiles?.user_id === authorId ? { ...p, _followed: !wasFollowed } : p
    ))
    try {
      if (wasFollowed) {
        const { error } = await supabase.from('cng_follows').delete().eq('follower_id', user.id).eq('following_id', authorId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cng_follows').insert({ follower_id: user.id, following_id: authorId })
        if (error) throw error
      }
    } catch (e) {
      console.error('Follow error:', e)
      // Revert
      setPosts(prev => prev.map(p =>
        p.identity_profiles?.user_id === authorId ? { ...p, _followed: wasFollowed } : p
      ))
    }
  }

  const handleComment = (post) => setCommentPost(post)

  const handleCommentCountUpdate = (postId, delta) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max((p.comments_count || 0) + delta, 0) } : p))
  }

  const handleShare = async (post) => {
    const url = `https://chillngointernational.com/post/${post.id}`
    const shareData = { title: 'Chill-N-Go', text: post.caption || 'Check this out!', url }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(url)
        setToast('Link copiado')
        setTimeout(() => setToast(null), 2000)
      }
      // increment shares_count
      supabase.from('cng_posts').update({ shares_count: (post.shares_count || 0) + 1 }).eq('id', post.id).then()
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p))
    } catch (e) {
      // user cancelled share dialog — ignore
      if (e.name !== 'AbortError') console.error('Share error:', e)
    }
  }

  if (loading) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(isDesktop ? { maxWidth: 600, margin: '0 auto' } : {}) }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // No posts — show demo
  if (posts.length === 0) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden', ...(isDesktop ? { maxWidth: 600, margin: '0 auto' } : {}) }}>
        <DemoPost />
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        ...(isDesktop ? { maxWidth: 600, margin: '0 auto' } : {}),
      }}
    >
      {posts.map((post) => (
        <div key={post.id} style={{ width: '100%', height: '100%', scrollSnapAlign: 'start', position: 'relative' }}>
          <PostCard
            post={post}
            currentUserId={user?.id}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onComment={handleComment}
            onShare={handleShare}
            onFollow={handleFollow}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(m => !m)}
          />
        </div>
      ))}

      {commentPost && (
        <CommentsPanel
          post={commentPost}
          userId={user?.id}
          onClose={() => setCommentPost(null)}
          onCountUpdate={handleCommentCountUpdate}
        />
      )}

      {toast && <ShareToast message={toast} />}
    </div>
  )
}
