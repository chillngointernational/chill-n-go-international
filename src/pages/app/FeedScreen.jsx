import { useState, useEffect, useCallback, useRef } from 'react'
import { C, FONT, Icon, useDesktop } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

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

function PostCard({ post, currentUserId, onLike, onBookmark }) {
  const member = post.cng_members
  const displayName = member?.full_name || member?.ref_code || 'Member'
  const initial = displayName[0]?.toUpperCase() || 'M'
  const avatarUrl = member?.avatar_url
  const tag = TAG_COLORS[post.category] || TAG_COLORS.general

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0, scrollSnapAlign: 'start' }}>
      {/* Background */}
      {post.media_url ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          {post.media_type === 'video' ? (
            <video src={post.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop playsInline />
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
          <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0D1117' }}>
            <Icon name="add" size={12} style={{ color: '#fff' }} />
          </div>
        </div>

        {/* Like */}
        <div onClick={() => onLike(post)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <Icon name="favorite" fill={post._liked} size={28} style={{ color: post._liked ? '#E24B4A' : C.text, transition: 'color 0.2s' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatCount(post.likes_count)}</span>
        </div>

        {/* Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Icon name="chat_bubble" fill size={28} style={{ color: C.text }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatCount(post.comments_count)}</span>
        </div>

        {/* Bookmark */}
        <div onClick={() => onBookmark(post)} style={{ cursor: 'pointer' }}>
          <Icon name="bookmark" fill={post._bookmarked} size={28} style={{ color: post._bookmarked ? C.primary : C.text, transition: 'color 0.2s' }} />
        </div>

        <Icon name="share" size={28} style={{ color: C.text }} />
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', left: 16, bottom: 100, right: 80, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONT.headline, fontWeight: 800, fontSize: 16, color: C.text }}>@{member?.ref_code || displayName.toLowerCase().replace(/\s/g, '_')}</span>
        </div>
        {post.caption && (
          <p style={{ fontSize: 14, color: 'rgba(241,239,232,0.9)', lineHeight: 1.6, fontFamily: FONT.body }}>{post.caption}</p>
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

  const fetchPosts = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const { data: postsData, error } = await supabase
        .from('cng_posts')
        .select('*, cng_members!cng_posts_member_id_fkey(full_name, ref_code, avatar_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      if (!postsData || postsData.length === 0) { setPosts([]); setLoading(false); return }

      // Fetch user's likes and bookmarks
      const postIds = postsData.map(p => p.id)
      const [likesRes, bookmarksRes] = await Promise.all([
        supabase.from('cng_post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('cng_post_bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      ])

      const likedSet = new Set((likesRes.data || []).map(l => l.post_id))
      const bookmarkedSet = new Set((bookmarksRes.data || []).map(b => b.post_id))

      setPosts(postsData.map(p => ({
        ...p,
        _liked: likedSet.has(p.id),
        _bookmarked: bookmarkedSet.has(p.id),
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
          />
        </div>
      ))}
    </div>
  )
}
