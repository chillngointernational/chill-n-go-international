import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { C, FONT, GRADIENT, Icon } from '../stitch'
import MembersOnly from '../components/MembersOnly'

// Página PÚBLICA de un post individual (link compartido). Visible para anónimos, sin login.
// Solo lee datos públicos: cng_posts (activo) + autor desde public_profiles. Acciones -> modal.

export default function PostScreen() {
  const { id } = useParams()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [author, setAuthor] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ok | notfound
  const [membersOnly, setMembersOnly] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) { setStatus('notfound'); return }
      const { data: p } = await supabase
        .from('cng_posts')
        .select('id, user_id, media_url, media_type, thumbnail_url, caption, likes_count, comments_count')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()
      if (cancelled) return
      if (!p) { setStatus('notfound'); return }
      setPost(p)
      const { data: a } = await supabase
        .from('public_profiles')
        .select('full_name, display_name, avatar_url, ref_code')
        .eq('user_id', p.user_id)
        .maybeSingle()
      if (cancelled) return
      setAuthor(a || null)
      setStatus('ok')
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: 'Chill N Go', text: post?.caption || '¡Mira esto!', url })
      else await navigator.clipboard.writeText(url)
    } catch { /* cancelado */ }
  }

  if (status === 'loading') {
    return (
      <div style={{ ...styles.wrap, alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.spinner} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Post inexistente o inactivo -> a la landing (nunca pantalla negra).
  if (status === 'notfound') return <Navigate to="/" replace />

  const name = author?.full_name || author?.display_name || author?.ref_code || 'Miembro'
  const initial = (name[0] || 'M').toUpperCase()
  const isVideo = post.media_type === 'video'

  return (
    <div style={styles.wrap}>
      <header style={styles.topbar}>
        <Link to="/" style={styles.brand}>CHILL N GO</Link>
        {user
          ? <Link to="/app/feed" style={styles.topLink}>Abrir app</Link>
          : <Link to="/login" style={styles.topLink}>Iniciar sesión</Link>}
      </header>

      <main style={styles.main}>
        <div style={styles.mediaBox}>
          {post.media_url ? (
            isVideo ? (
              <video src={post.media_url} poster={post.thumbnail_url || undefined} controls playsInline style={styles.media} />
            ) : (
              <img src={post.media_url} alt={post.caption || 'Post'} style={styles.media} />
            )
          ) : (
            <div style={styles.noMedia}><Icon name="image" size={40} style={{ color: C.textFaint }} /></div>
          )}
        </div>

        <div style={styles.authorRow}>
          <div style={styles.avatar}>
            {author?.avatar_url
              ? <img src={author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={styles.avatarInitial}>{initial}</span>}
          </div>
          <div>
            <div style={styles.authorName}>{name}</div>
            {author?.ref_code && <div style={styles.authorRef}>@{author.ref_code}</div>}
          </div>
        </div>

        {post.caption && <p style={styles.caption}>{post.caption}</p>}

        <div style={styles.actions}>
          <button style={styles.action} onClick={() => setMembersOnly('dar like')}>
            <Icon name="favorite" size={22} /><span>{post.likes_count || 0}</span>
          </button>
          <button style={styles.action} onClick={() => setMembersOnly('comentar')}>
            <Icon name="chat_bubble" size={22} /><span>{post.comments_count || 0}</span>
          </button>
          <button style={styles.action} onClick={() => setMembersOnly('seguir')}>
            <Icon name="person_add" size={22} /><span>Seguir</span>
          </button>
          <button style={styles.action} onClick={handleShare}>
            <Icon name="share" size={22} /><span>Compartir</span>
          </button>
        </div>

        <div style={styles.cta}>
          <div style={styles.ctaTitle}>Chill N Go es una comunidad por invitación</div>
          <p style={styles.ctaText}>Únete para dar like, comentar, seguir y comprar. ¿Ya eres miembro? Inicia sesión.</p>
          <Link to="/login" style={styles.ctaPrimary}>Iniciar sesión</Link>
          <Link to="/app/feed" style={styles.ctaSecondary}>Ver más en el feed →</Link>
        </div>
      </main>

      <MembersOnly open={!!membersOnly} action={membersOnly} onClose={() => setMembersOnly(null)} />
    </div>
  )
}

const styles = {
  wrap: { minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: FONT.body, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  spinner: { width: 32, height: 32, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  brand: { fontFamily: FONT.headline, fontWeight: 900, fontSize: 15, letterSpacing: 2, color: C.text, textDecoration: 'none' },
  topLink: { color: C.primary, fontSize: 13, fontWeight: 700, textDecoration: 'none' },
  main: { width: '100%', maxWidth: 480, margin: '0 auto', padding: '16px 16px 48px' },
  mediaBox: { width: '100%', background: '#000', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', maxHeight: '68vh', objectFit: 'contain', display: 'block' },
  noMedia: { width: '100%', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  authorRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 },
  avatar: { width: 44, height: 44, borderRadius: 99, overflow: 'hidden', border: '2px solid ' + C.primary, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitial: { fontFamily: FONT.headline, fontWeight: 800, color: '#0D1117', fontSize: 18 },
  authorName: { fontWeight: 700, fontSize: 15, color: C.onSurface },
  authorRef: { fontSize: 12, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  caption: { fontSize: 15, color: 'rgba(241,239,232,0.9)', lineHeight: 1.6, marginTop: 14 },
  actions: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  action: { display: 'flex', alignItems: 'center', gap: 6, background: C.surfaceHigh || 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '9px 14px', color: C.onSurface, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cta: { marginTop: 28, padding: 20, borderRadius: 16, background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.18)', textAlign: 'center' },
  ctaTitle: { fontFamily: FONT.headline, fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 8 },
  ctaText: { fontSize: 13.5, color: C.onSurfaceVariant, lineHeight: 1.6, marginBottom: 16 },
  ctaPrimary: { display: 'block', background: GRADIENT.primary, color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, marginBottom: 10 },
  ctaSecondary: { display: 'block', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600 },
}
