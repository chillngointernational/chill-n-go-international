import { useState, useRef, useCallback } from 'react'
import { C, FONT, Icon, GRADIENT, useDesktop } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const TAGS = [
  { label: 'Travel', value: 'travel', color: '#26A37A', text: '#68DBAE' },
  { label: 'Nutrition', value: 'nutrition', color: '#B8956A', text: '#E7C092' },
  { label: 'Store', value: 'store', color: '#FF7F50', text: '#FF7F50' },
  { label: 'Real Estate', value: 'realestate', color: '#41379B', text: '#C5C0FF' },
  { label: 'CandyStakes', value: 'candystakes', color: '#7F77DD', text: '#7F77DD' },
  { label: 'Online', value: 'online', color: '#8c84eb', text: '#C5C0FF' },
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_VIDEO_DURATION = 180 // 3 minutes

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read video metadata'))
    }
    video.src = url
  })
}

const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
}

export default function CreateScreen({ onDone }) {
  const { user, member } = useAuth()
  const desktop = useDesktop()
  const cameraPhotoRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const galleryRef = useRef(null)

  // step: 'select' | 'camera' | 'details'
  const [step, setStep] = useState('select')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState(null)
  const [location, setLocation] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const isVideo = file?.type?.startsWith('video/')

  const reset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setCaption('')
    setCategory(null)
    setLocation('')
    setError('')
    setStep('select')
  }, [preview])

  const handleFileSelect = useCallback(async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = '' // allow re-selecting same file
    setError('')

    // Size check
    if (f.size > MAX_FILE_SIZE) {
      setError(`El archivo supera 50MB (${(f.size / 1024 / 1024).toFixed(1)}MB). Selecciona uno más pequeño.`)
      return
    }

    // Video duration check
    if (f.type.startsWith('video/')) {
      try {
        const duration = await getVideoDuration(f)
        if (duration > MAX_VIDEO_DURATION) {
          setError(`El video no puede superar 3 minutos. Tu video dura ${formatDuration(duration)}. Por favor selecciona un video más corto.`)
          return
        }
      } catch {
        // If we can't read metadata, allow it through — server will catch issues
      }
    }

    if (preview) URL.revokeObjectURL(preview)
    const url = URL.createObjectURL(f)
    setFile(f)
    setPreview(url)
    setStep('details')
  }, [preview])

  const handlePost = async () => {
    if (!user || !file) return
    setUploading(true)
    setProgress('Subiendo media...')

    try {
      const path = `${user.id}/${Date.now()}-${file.name}`
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

      const { error: uploadErr } = await supabase.storage
        .from('cng-media')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)

      setProgress('Creando post...')
      const { error: postErr } = await supabase.from('cng_posts').insert({
        user_id: user.id,
        member_id: member?.id || null,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        caption: caption || null,
        category: category || 'general',
        location_name: location || null,
      })
      if (postErr) throw postErr

      setProgress('Publicado!')
      setTimeout(() => {
        setUploading(false)
        setProgress('')
        if (onDone) onDone()
      }, 800)
    } catch (e) {
      console.error('Post error:', e)
      setProgress('')
      setError('Error: ' + (e.message || 'No se pudo publicar'))
      setUploading(false)
    }
  }

  // ── Close button (always visible) ──
  const closeBtn = (
    <button
      onClick={() => { reset(); if (onDone) onDone() }}
      style={{
        position: 'absolute', top: 16, left: 16, zIndex: 20,
        width: 40, height: 40, borderRadius: 99,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#fff',
      }}
    >
      <Icon name="close" size={22} />
    </button>
  )

  // ── Hidden file inputs ──
  const fileInputs = (
    <>
      <input
        ref={cameraPhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraVideoRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </>
  )

  // ━━━━━━━━━━━━━━ STEP 1: SELECTOR ━━━━━━━━━━━━━━
  if (step === 'select') {
    return (
      <div style={{
        position: 'relative', minHeight: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: C.surface, padding: 24,
        ...(desktop ? { height: '100dvh' } : {}),
      }}>
        {closeBtn}
        {fileInputs}

        {/* Title */}
        <h2 style={{
          fontFamily: FONT.headline, fontWeight: 800, fontSize: 22,
          color: C.text, letterSpacing: 1, textTransform: 'uppercase',
          marginBottom: 8, textAlign: 'center',
        }}>
          Crear Post
        </h2>
        <p style={{
          fontFamily: FONT.body, fontSize: 13, color: C.textDim,
          marginBottom: 36, textAlign: 'center',
        }}>
          Elige cómo quieres agregar tu contenido
        </p>

        {/* Cards container */}
        <div style={{
          display: 'flex',
          flexDirection: desktop ? 'row' : 'column',
          gap: 16, width: '100%',
          maxWidth: desktop ? 520 : 360,
        }}>
          {/* Camera card */}
          <div
            onClick={() => setStep('camera')}
            style={{
              ...glassCard,
              flex: 1, padding: '40px 24px',
              backgroundImage: 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(15,110,86,0.03))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(29,158,117,0.12)'
              e.currentTarget.style.borderColor = 'rgba(29,158,117,0.3)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.backgroundImage = 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(15,110,86,0.03))'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: 99,
              background: 'rgba(29,158,117,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="photo_camera" size={36} style={{ color: C.primary }} />
            </div>
            <span style={{
              fontFamily: FONT.headline, fontWeight: 700, fontSize: 16,
              color: C.text, letterSpacing: 0.5,
            }}>
              Cámara
            </span>
            <span style={{
              fontFamily: FONT.body, fontSize: 12, color: C.textDim, textAlign: 'center',
            }}>
              Tomar foto o grabar video
            </span>
          </div>

          {/* Gallery card */}
          <div
            onClick={() => galleryRef.current?.click()}
            style={{
              ...glassCard,
              flex: 1, padding: '40px 24px',
              backgroundImage: 'linear-gradient(135deg, rgba(140,132,235,0.08), rgba(65,55,155,0.03))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(140,132,235,0.12)'
              e.currentTarget.style.borderColor = 'rgba(140,132,235,0.3)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.backgroundImage = 'linear-gradient(135deg, rgba(140,132,235,0.08), rgba(65,55,155,0.03))'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: 99,
              background: 'rgba(140,132,235,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="photo_library" size={36} style={{ color: C.tertiary }} />
            </div>
            <span style={{
              fontFamily: FONT.headline, fontWeight: 700, fontSize: 16,
              color: C.text, letterSpacing: 0.5,
            }}>
              Galería
            </span>
            <span style={{
              fontFamily: FONT.body, fontSize: 12, color: C.textDim, textAlign: 'center',
            }}>
              Seleccionar de tu dispositivo
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 24, padding: '12px 20px', borderRadius: 12,
            background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.25)',
            color: C.error, fontSize: 13, fontFamily: FONT.body,
            maxWidth: desktop ? 520 : 360, width: '100%', textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    )
  }

  // ━━━━━━━━━━━━━━ STEP 1b: CAMERA SUB-OPTIONS ━━━━━━━━━━━━━━
  if (step === 'camera') {
    return (
      <div style={{
        position: 'relative', minHeight: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: C.surface, padding: 24,
        ...(desktop ? { height: '100dvh' } : {}),
      }}>
        {closeBtn}
        {fileInputs}

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 99,
          background: 'rgba(29,158,117,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Icon name="photo_camera" size={36} style={{ color: C.primary }} />
        </div>

        <h2 style={{
          fontFamily: FONT.headline, fontWeight: 800, fontSize: 20,
          color: C.text, letterSpacing: 1, textTransform: 'uppercase',
          marginBottom: 8, textAlign: 'center',
        }}>
          Cámara
        </h2>
        <p style={{
          fontFamily: FONT.body, fontSize: 13, color: C.textDim,
          marginBottom: 32, textAlign: 'center',
        }}>
          ¿Qué quieres capturar?
        </p>

        {/* Pill buttons */}
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {/* Foto pill */}
          <button
            onClick={() => cameraPhotoRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 99,
              background: 'rgba(29,158,117,0.12)',
              border: '1px solid rgba(29,158,117,0.3)',
              color: C.primary, fontSize: 14, fontWeight: 700,
              fontFamily: FONT.headline, cursor: 'pointer',
              transition: 'all 0.2s', letterSpacing: 0.5,
            }}
          >
            <Icon name="photo_camera" size={20} />
            Foto
          </button>

          {/* Video pill */}
          <button
            onClick={() => cameraVideoRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 99,
              background: 'rgba(140,132,235,0.12)',
              border: '1px solid rgba(140,132,235,0.3)',
              color: C.tertiary, fontSize: 14, fontWeight: 700,
              fontFamily: FONT.headline, cursor: 'pointer',
              transition: 'all 0.2s', letterSpacing: 0.5,
            }}
          >
            <Icon name="videocam" size={20} />
            Video
          </button>
        </div>

        {/* Back button */}
        <button
          onClick={() => setStep('select')}
          style={{
            marginTop: 32, display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 99,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: C.textDim, fontSize: 13, fontWeight: 600,
            fontFamily: FONT.body, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Icon name="arrow_back" size={16} />
          Atrás
        </button>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 24, padding: '12px 20px', borderRadius: 12,
            background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.25)',
            color: C.error, fontSize: 13, fontFamily: FONT.body,
            maxWidth: desktop ? 520 : 360, width: '100%', textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    )
  }

  // ━━━━━━━━━━━━━━ STEP 2: DETAILS ━━━━━━━━━━━━━━
  return (
    <div style={{
      position: 'relative', minHeight: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: C.surface, overflowY: 'auto',
      ...(desktop ? { height: '100dvh' } : {}),
    }}>
      {closeBtn}
      {fileInputs}

      {/* Step 4 container */}
      <div style={{
        width: '100%', maxWidth: 600,
        margin: '0 auto', padding: 24,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Preview area */}
        <div style={{
          position: 'relative', width: '100%',
          borderRadius: 16, overflow: 'hidden',
          background: '#000',
        }}>
          {isVideo ? (
            <video
              src={preview}
              controls
              playsInline
              style={{
                width: '100%',
                maxHeight: desktop ? 400 : 300,
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
            />
          ) : (
            <img
              src={preview}
              alt=""
              style={{
                width: '100%',
                maxHeight: desktop ? 400 : 300,
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
            />
          )}

          {/* Change button */}
          <button
            onClick={reset}
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 20,
              padding: '8px 16px', borderRadius: 99,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FONT.body,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="swap_horiz" size={16} />
            Cambiar
          </button>
        </div>

        {/* Details form */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
        {/* Caption */}
        <textarea
          placeholder="Escribe un caption..."
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14,
            padding: 16, color: C.text, fontSize: 14, fontFamily: FONT.body,
            resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(29,158,117,0.4)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
        />

        {/* Category tags */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {TAGS.map((t) => {
            const active = category === t.value
            return (
              <span
                key={t.value}
                onClick={() => setCategory(active ? null : t.value)}
                style={{
                  padding: '8px 16px', borderRadius: 99,
                  background: active ? t.color + '40' : t.color + '18',
                  color: t.text, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 2,
                  border: active ? '2px solid ' + t.color : '1px solid ' + t.color + '30',
                  fontFamily: FONT.body, cursor: 'pointer', transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                {t.label}
              </span>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {/* Location */}
          <button
            onClick={() => {
              const loc = prompt('Nombre del lugar:')
              if (loc) setLocation(loc)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 12,
              background: location ? 'rgba(29,158,117,0.12)' : 'rgba(255,255,255,0.04)',
              border: location ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: location ? C.primary : C.textDim,
              fontSize: 12, fontWeight: 600, fontFamily: FONT.body, cursor: 'pointer',
            }}
          >
            <Icon name="location_on" size={18} />
            {location || 'Location'}
          </button>

          {/* People — disabled */}
          <button
            disabled
            title="Próximamente"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              color: C.textGhost, fontSize: 12, fontWeight: 600,
              fontFamily: FONT.body, cursor: 'not-allowed', opacity: 0.5,
            }}
          >
            <Icon name="group" size={18} />
            People
          </button>

          {/* Products — disabled */}
          <button
            disabled
            title="Próximamente"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              color: C.textGhost, fontSize: 12, fontWeight: 600,
              fontFamily: FONT.body, cursor: 'not-allowed', opacity: 0.5,
            }}
          >
            <Icon name="sell" size={18} />
            Products
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 20px', borderRadius: 12,
            background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.25)',
            color: C.error, fontSize: 13, fontFamily: FONT.body, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* POST button */}
        <button
          onClick={handlePost}
          disabled={uploading || !file}
          style={{
            width: '100%', padding: 16, borderRadius: 14,
            background: uploading || !file ? C.surfaceHigh : GRADIENT.primary,
            color: uploading || !file ? C.textFaint : '#fff',
            fontFamily: FONT.headline, fontWeight: 800, fontSize: 15,
            letterSpacing: 3, textTransform: 'uppercase',
            border: 'none', cursor: uploading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: uploading ? 0.7 : 1, transition: 'all 0.2s',
          }}
        >
          {uploading ? (
            <>
              <div style={{
                width: 18, height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: 99,
                animation: 'cng-spin 0.8s linear infinite',
              }} />
              {progress}
              <style>{`@keyframes cng-spin { to { transform: rotate(360deg) } }`}</style>
            </>
          ) : (
            <>POST <Icon name="arrow_forward" size={18} /></>
          )}
        </button>
        </div>
      </div>
    </div>
  )
}
