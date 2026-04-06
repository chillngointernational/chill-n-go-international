import { useState, useRef } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import TopBar from '../../components/TopBar'

const TAGS = [
  { label: 'Travel', value: 'travel', color: '#26A37A', text: '#68DBAE' },
  { label: 'Nutrition', value: 'nutrition', color: '#B8956A', text: '#E7C092' },
  { label: 'Store', value: 'store', color: '#FF7F50', text: '#FF7F50' },
  { label: 'Real Estate', value: 'realestate', color: '#41379B', text: '#C5C0FF' },
  { label: 'CandyStakes', value: 'candystakes', color: '#7F77DD', text: '#7F77DD' },
  { label: 'Online', value: 'online', color: '#8c84eb', text: '#C5C0FF' },
]

export default function CreateScreen({ onDone }) {
  const { user, member } = useAuth()
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState(null)
  const [location, setLocation] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const isVideo = file?.type?.startsWith('video/')

  const handlePost = async () => {
    if (!user) return
    if (!file && !caption) return
    setUploading(true)

    try {
      let mediaUrl = null
      let mediaType = 'image'

      if (file) {
        setProgress('Uploading media...')
        const ext = file.name.split('.').pop()
        const ts = Date.now()
        const path = `${user.id}/${ts}-${file.name}`
        mediaType = file.type.startsWith('video/') ? 'video' : 'image'

        const { error: uploadErr } = await supabase.storage
          .from('cng-media')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
        mediaUrl = urlData.publicUrl
      }

      setProgress('Creating post...')
      const { error: postErr } = await supabase.from('cng_posts').insert({
        user_id: user.id,
        member_id: member?.id || null,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption || null,
        category: category || 'general',
        location_name: location || null,
      })
      if (postErr) throw postErr

      // Reset
      setFile(null)
      setPreview(null)
      setCaption('')
      setCategory(null)
      setLocation('')
      setProgress('Posted!')
      setTimeout(() => {
        setProgress('')
        setUploading(false)
        if (onDone) onDone()
      }, 800)
    } catch (e) {
      console.error('Post error:', e)
      setProgress('Error: ' + (e.message || 'Failed to post'))
      setTimeout(() => { setProgress(''); setUploading(false) }, 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Chill N Go" leftIcon="close" rightIcon="settings" />

      {/* Media picker area */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{ position: 'relative', width: '100%', height: 380, overflow: 'hidden', cursor: 'pointer', background: C.surface }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {preview ? (
          <>
            {isVideo ? (
              <video src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop playsInline controls />
            ) : (
              <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0D1117, transparent, transparent)', opacity: 0.4 }} />
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 36, height: 36, borderRadius: 99, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="edit" size={18} style={{ color: '#fff' }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(29,158,117,0.1), rgba(13,17,23,0.8))' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', opacity: 0.15, pointerEvents: 'none' }}>
              {[...Array(6)].map((_, i) => (<div key={i} style={{ borderRight: i % 3 !== 2 ? '1px solid #F1EFE8' : 'none', borderBottom: i < 3 ? '1px solid #F1EFE8' : 'none' }} />))}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ width: 64, height: 64, borderRadius: 99, border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}>
                <Icon name="add_photo_alternate" size={30} style={{ color: '#fff' }} />
              </div>
              <p style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONT.body }}>Tap to select photo or video</p>
            </div>
          </>
        )}
      </div>

      {/* Media type indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: '16px 0', background: C.surface }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isVideo ? C.primaryBright : C.textFaint, fontFamily: FONT.body }}>Video</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: !isVideo ? C.primaryBright : C.textFaint, fontFamily: FONT.body }}>Photo</span>
          {!isVideo && <div style={{ width: 6, height: 6, borderRadius: 99, background: C.primaryBright, marginTop: 8 }} />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textFaint, fontFamily: FONT.body }}>Story</span>
      </div>

      {/* Caption + tags */}
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 24, background: C.surface }}>
        <textarea
          placeholder="Write a chill caption..."
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: C.text, fontSize: 14, fontFamily: FONT.body, resize: 'none', outline: 'none' }}
        />

        {/* Category tags — toggle, 1 at a time */}
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {TAGS.map((t) => {
            const active = category === t.value
            return (
              <span
                key={t.value}
                onClick={() => setCategory(active ? null : t.value)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: 99,
                  background: active ? t.color + '40' : t.color + '20',
                  color: t.text,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  border: active ? '2px solid ' + t.color : '1px solid ' + t.color + '30',
                  fontFamily: FONT.body,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.label}
              </span>
            )
          })}
        </div>

        {/* Location + actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => {
            const loc = prompt('Enter location name:')
            if (loc) setLocation(loc)
          }} style={{ display: 'flex', alignItems: 'center', gap: 8, color: location ? C.primary : '#5DCAA5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>
            <Icon name="location_on" size={20} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{location || 'Location'}</span>
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5DCAA5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>
            <Icon name="sell" size={20} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Products</span>
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5DCAA5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>
            <Icon name="group" size={20} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>People</span>
          </button>
        </div>

        {/* Post button */}
        <button
          onClick={handlePost}
          disabled={uploading || (!file && !caption)}
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            background: uploading || (!file && !caption) ? C.surfaceHigh : GRADIENT.primary,
            color: uploading || (!file && !caption) ? C.textFaint : '#fff',
            fontFamily: FONT.headline,
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 3,
            textTransform: 'uppercase',
            border: 'none',
            cursor: uploading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: uploading ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {uploading ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
              {progress}
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          ) : (
            <>POST <Icon name="arrow_forward" size={18} /></>
          )}
        </button>
      </div>
    </div>
  )
}
