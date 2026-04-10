import { useState, useEffect, useRef, useCallback } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/* ═══════════════════════════════════════════════════════
   CHILL N GO — ESTADOS / STORIES COMPONENTS
   ═══════════════════════════════════════════════════════ */

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return mins + 'm'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h'
    const days = Math.floor(hrs / 24)
    return days + 'd'
}

/* ── Progress Bar Segment ── */
const ProgressSegment = ({ active, completed, progress }) => (
    <div style={{
        flex: 1, height: 3, borderRadius: 99,
        background: 'rgba(255,255,255,0.2)', overflow: 'hidden',
    }}>
        <div style={{
            height: '100%', borderRadius: 99,
            background: completed ? '#fff' : active ? '#fff' : 'transparent',
            width: completed ? '100%' : active ? `${progress}%` : '0%',
            transition: active ? 'none' : 'width 0.3s ease',
        }} />
    </div>
)

/* ══════════════════════════════════════════════════
   STORY RING — Avatar with gradient ring
   ══════════════════════════════════════════════════ */
export function StoryRing({ user, size = 64, seen = false, onClick, isOwn = false }) {
    const ringGrad = seen
        ? 'rgba(255,255,255,0.15)'
        : `linear-gradient(135deg, ${C.primaryBright}, ${C.secondaryBright || '#e7c092'})`

    return (
        <div onClick={onClick} style={{
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6, flexShrink: 0, width: size + 16,
        }}>
            <div style={{ position: 'relative' }}>
                <div style={{
                    width: size + 6, height: size + 6, borderRadius: 99, padding: 3,
                    background: ringGrad,
                }}>
                    <div style={{
                        width: size, height: size, borderRadius: 99, overflow: 'hidden',
                        border: `2px solid ${C.bg}`,
                    }}>
                        {isOwn ? (
                            <div style={{
                                width: '100%', height: '100%', background: C.surfaceHigh,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Icon name="add" size={28} style={{ color: C.primaryBright }} />
                            </div>
                        ) : user.avatar_url ? (
                            <img src={user.avatar_url} alt="" style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                            }} />
                        ) : (
                            <div style={{
                                width: '100%', height: '100%', background: C.surfaceHigh,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 20, fontWeight: 700, color: C.text, fontFamily: FONT.headline,
                            }}>
                                {(user.full_name || user.ref_code || 'U')[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>

                {isOwn && (
                    <div style={{
                        position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
                        borderRadius: 99, background: GRADIENT.primary, border: `2px solid ${C.bg}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon name="add" size={14} style={{ color: '#fff' }} />
                    </div>
                )}
            </div>

            <span style={{
                fontSize: 11, fontWeight: 500,
                color: seen ? C.textFaint : C.textMuted,
                fontFamily: FONT.body, maxWidth: size + 16, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
            }}>
                {isOwn ? 'Tu estado' : (user.full_name || user.ref_code || '').split(' ')[0]}
            </span>
        </div>
    )
}

/* ══════════════════════════════════════════════════
   STORY VIEWER — Full screen experience
   ══════════════════════════════════════════════════ */
export function StoryViewer({ storyUsers, startUserIndex, onClose, currentUserId }) {
    const [userIndex, setUserIndex] = useState(startUserIndex)
    const [storyIndex, setStoryIndex] = useState(0)
    const [progress, setProgress] = useState(0)
    const [paused, setPaused] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [showOptions, setShowOptions] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [swipeX, setSwipeX] = useState(0)
    const [swiping, setSwiping] = useState(false)
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)
    const timerRef = useRef(null)
    const STORY_DURATION = 5000

    const currentStoryUser = storyUsers[userIndex]
    const currentStory = currentStoryUser?.stories?.[storyIndex]

    // Register view
    useEffect(() => {
        if (!currentStory || !currentUserId) return
        if (currentStoryUser.user_id === currentUserId) return // don't count own views
        supabase
            .from('cng_story_views')
            .upsert(
                { story_id: currentStory.id, viewer_id: currentUserId },
                { onConflict: 'story_id,viewer_id' }
            )
            .then(() => { })
            .catch(() => { })
    }, [currentStory?.id, currentUserId, currentStoryUser?.user_id])

    // Timer
    useEffect(() => {
        if (paused || !imageLoaded) return
        const startTime = Date.now() - (progress / 100) * STORY_DURATION
        const tick = () => {
            const elapsed = Date.now() - startTime
            const pct = Math.min((elapsed / STORY_DURATION) * 100, 100)
            setProgress(pct)
            if (pct >= 100) { goNext(); return }
            timerRef.current = requestAnimationFrame(tick)
        }
        timerRef.current = requestAnimationFrame(tick)
        return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current) }
    }, [storyIndex, userIndex, paused, imageLoaded])

    const goNext = useCallback(() => {
        if (!currentStoryUser) { onClose(); return }
        if (storyIndex < currentStoryUser.stories.length - 1) {
            setStoryIndex(i => i + 1)
            setProgress(0)
            setImageLoaded(false)
        } else if (userIndex < storyUsers.length - 1) {
            setUserIndex(i => i + 1)
            setStoryIndex(0)
            setProgress(0)
            setImageLoaded(false)
        } else {
            onClose()
        }
    }, [storyIndex, userIndex, currentStoryUser, storyUsers.length, onClose])

    const goPrev = useCallback(() => {
        if (storyIndex > 0) {
            setStoryIndex(i => i - 1)
            setProgress(0)
            setImageLoaded(false)
        } else if (userIndex > 0) {
            setUserIndex(i => i - 1)
            const prevUser = storyUsers[userIndex - 1]
            setStoryIndex(prevUser.stories.length - 1)
            setProgress(0)
            setImageLoaded(false)
        }
    }, [storyIndex, userIndex, storyUsers])

    const handleTap = (e) => {
        if (showOptions) { setShowOptions(false); return }
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const third = rect.width / 3
        if (x < third) goPrev()
        else if (x > third * 2) goNext()
    }

    // Swipe
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        setPaused(true)
    }
    const handleTouchMove = (e) => {
        const dx = e.touches[0].clientX - touchStartX.current
        const dy = e.touches[0].clientY - touchStartY.current
        if (Math.abs(dx) > Math.abs(dy)) {
            setSwiping(true)
            setSwipeX(dx * 0.4)
        }
    }
    const handleTouchEnd = () => {
        setPaused(false)
        if (swiping) {
            if (swipeX < -60 && userIndex < storyUsers.length - 1) {
                setUserIndex(i => i + 1); setStoryIndex(0); setProgress(0); setImageLoaded(false)
            } else if (swipeX > 60 && userIndex > 0) {
                setUserIndex(i => i - 1)
                const prev = storyUsers[userIndex - 1]
                setStoryIndex(prev.stories.length - 1); setProgress(0); setImageLoaded(false)
            }
        }
        setSwiping(false)
        setSwipeX(0)
    }

    const handleSendReply = async () => {
        if (!replyText.trim() || !currentStory) return
        try {
            await supabase.from('cng_story_replies').insert({
                story_id: currentStory.id,
                sender_id: currentUserId,
                content: replyText.trim(),
            })
            setReplyText('')
        } catch (e) {
            console.error('Error sending story reply:', e)
        }
    }

    const handleLike = async () => {
        if (!currentStory || !currentUserId) return
        try {
            await supabase.from('cng_story_reactions').upsert(
                { story_id: currentStory.id, user_id: currentUserId, reaction: 'like' },
                { onConflict: 'story_id,user_id' }
            )
        } catch (e) {
            console.error('Error liking story:', e)
        }
    }

    if (!currentStory || !currentStoryUser) return null

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
            display: 'flex', flexDirection: 'column',
            transform: swiping ? `translateX(${swipeX}px)` : 'none',
            transition: swiping ? 'none' : 'transform 0.3s ease',
        }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background Image */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <img
                    key={currentStory.id}
                    src={currentStory.media_url}
                    alt=""
                    onLoad={() => setImageLoaded(true)}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s',
                    }}
                />
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 200,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                }} />
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 260,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                }} />
            </div>

            {/* Tap zones */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex' }}
                onClick={handleTap}
                onPointerDown={() => setPaused(true)}
                onPointerUp={() => setPaused(false)}
            >
                <div style={{ flex: 1 }} />
                <div style={{ flex: 1 }} />
                <div style={{ flex: 1 }} />
            </div>

            {/* Progress Bars */}
            <div style={{
                position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20,
                display: 'flex', gap: 4,
            }}>
                {currentStoryUser.stories.map((_, i) => (
                    <ProgressSegment
                        key={i}
                        active={i === storyIndex}
                        completed={i < storyIndex}
                        progress={i === storyIndex ? progress : 0}
                    />
                ))}
            </div>

            {/* Header */}
            <div style={{
                position: 'absolute', top: 28, left: 0, right: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 99, overflow: 'hidden',
                    border: `2px solid ${C.primaryBright}`, flexShrink: 0,
                }}>
                    {currentStoryUser.avatar_url ? (
                        <img src={currentStoryUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{
                            width: '100%', height: '100%', background: C.surfaceHigh,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: FONT.headline,
                        }}>
                            {(currentStoryUser.full_name || 'U')[0].toUpperCase()}
                        </div>
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                            fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: FONT.headline,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {currentStoryUser.full_name || currentStoryUser.ref_code}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.body }}>
                            {timeAgo(currentStory.created_at)}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ cursor: 'pointer', padding: 4, zIndex: 25 }}
                        onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions) }}>
                        <Icon name="more_horiz" size={24} style={{ color: 'rgba(255,255,255,0.8)' }} />
                    </div>
                    <div style={{ cursor: 'pointer', padding: 4, zIndex: 25 }}
                        onClick={(e) => { e.stopPropagation(); onClose() }}>
                        <Icon name="close" size={24} style={{ color: 'rgba(255,255,255,0.8)' }} />
                    </div>
                </div>
            </div>

            {/* Caption + stats */}
            <div style={{
                position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 15,
                padding: '0 20px',
            }}>
                {currentStory.caption && (
                    <p style={{
                        fontSize: 15, fontWeight: 500, color: '#fff', fontFamily: FONT.body,
                        textShadow: '0 1px 8px rgba(0,0,0,0.6)', lineHeight: 1.5, marginBottom: 8,
                    }}>
                        {currentStory.caption}
                    </p>
                )}
                <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.body, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="visibility" size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        {currentStory.views_count || 0}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.body, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="favorite" size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        {currentStory.likes_count || 0}
                    </span>
                </div>
            </div>

            {/* Reply Input */}
            {currentStoryUser.user_id !== currentUserId && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
                    position: 'absolute', bottom: 32, left: 0, right: 0, zIndex: 20,
                }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: '10px 16px',
                        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                    }}>
                        <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Enviar respuesta..."
                            style={{
                                flex: 1, background: 'none', border: 'none', outline: 'none',
                                color: '#fff', fontSize: 14, fontFamily: FONT.body,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={() => setPaused(true)}
                            onBlur={() => setPaused(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply() }}
                        />
                    </div>
                    <div style={{ cursor: 'pointer', padding: 4, zIndex: 25 }}
                        onClick={(e) => { e.stopPropagation(); handleSendReply() }}>
                        <Icon name="send" size={24} style={{ color: C.primaryBright }} />
                    </div>
                    <div style={{ cursor: 'pointer', padding: 4, zIndex: 25 }}
                        onClick={(e) => { e.stopPropagation(); handleLike() }}>
                        <Icon name="favorite" size={24} style={{ color: '#fff' }} />
                    </div>
                </div>
            )}

            {/* Options Sheet */}
            {showOptions && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
                    background: C.surface, borderRadius: '20px 20px 0 0',
                    padding: '20px 16px 40px',
                }} onClick={(e) => e.stopPropagation()}>
                    <div style={{
                        width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)',
                        margin: '0 auto 20px',
                    }} />
                    {[
                        { icon: 'bookmark', label: 'Guardar estado', color: C.text },
                        { icon: 'share', label: 'Compartir', color: C.text },
                        { icon: 'link', label: 'Copiar enlace', color: C.text },
                        { icon: 'volume_off', label: 'Silenciar estados', color: C.textMuted },
                        { icon: 'block', label: 'Reportar', color: '#E5484D' },
                    ].map((opt, i) => (
                        <div key={i} onClick={() => setShowOptions(false)} style={{
                            display: 'flex', alignItems: 'center', gap: 16, padding: '14px 8px',
                            cursor: 'pointer', borderRadius: 12,
                        }}
                            onPointerEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Icon name={opt.icon} size={22} style={{ color: opt.color }} />
                            <span style={{ fontSize: 15, color: opt.color, fontFamily: FONT.body, fontWeight: 500 }}>
                                {opt.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ══════════════════════════════════════════════════
   CREATE STORY — Camera/Upload Screen
   ══════════════════════════════════════════════════ */
export function CreateStory({ onClose, onPost, currentUserId }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [caption, setCaption] = useState('')
    const [category, setCategory] = useState(null)
    const [step, setStep] = useState('capture') // capture | preview
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    const categories = [
        { id: 'travel', label: 'Travel', color: C.primary },
        { id: 'nutrition', label: 'Nutrition', color: '#E09F3E' },
        { id: 'store', label: 'Store', color: '#E5484D' },
        { id: 'realestate', label: 'Real Estate', color: '#3B82F6' },
        { id: 'candystakes', label: 'CandyStakes', color: C.tertiary || '#8c84eb' },
    ]

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setSelectedFile(file)
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setStep('preview')
    }

    const handlePublish = async () => {
        if (!selectedFile || !currentUserId || uploading) return
        setUploading(true)
        try {
            const ext = selectedFile.name.split('.').pop() || 'jpg'
            const path = `stories/${currentUserId}/${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage
                .from('cng-media')
                .upload(path, selectedFile, { cacheControl: '86400', upsert: false })
            if (upErr) throw upErr

            const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
            const media_url = urlData.publicUrl

            const isVideo = selectedFile.type.startsWith('video')
            const { error: insertErr } = await supabase.from('cng_stories').insert({
                user_id: currentUserId,
                media_url,
                media_type: isVideo ? 'video' : 'image',
                caption: caption.trim() || null,
                category,
            })
            if (insertErr) throw insertErr

            onPost?.()
            onClose()
        } catch (e) {
            console.error('Error publishing story:', e)
            alert('Error al publicar estado: ' + e.message)
        } finally {
            setUploading(false)
        }
    }

    // Preview step
    if (step === 'preview' && previewUrl) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999, background: C.bg,
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 16px 12px', flexShrink: 0,
                }}>
                    <div style={{ cursor: 'pointer', padding: 4 }} onClick={() => { setStep('capture'); setPreviewUrl(null); setSelectedFile(null) }}>
                        <Icon name="arrow_back" size={24} style={{ color: C.text }} />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>Tu Estado</span>
                    <div style={{ width: 32 }} />
                </div>

                <div style={{
                    flex: 1, margin: '0 16px', borderRadius: 20, overflow: 'hidden',
                    position: 'relative', minHeight: 0,
                }}>
                    <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    }}>
                        <input
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Escribe algo sobre tu estado..."
                            style={{
                                width: '100%', background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 12, padding: '12px 16px', color: '#fff',
                                fontSize: 14, fontFamily: FONT.body, outline: 'none',
                                backdropFilter: 'blur(10px)', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Category Tags */}
                <div style={{ padding: 16, flexShrink: 0 }}>
                    <p style={{
                        fontSize: 11, color: C.textFaint, fontFamily: FONT.body, marginBottom: 10,
                        textTransform: 'uppercase', letterSpacing: 1,
                    }}>
                        Categoría
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => setCategory(category === cat.id ? null : cat.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: 99, cursor: 'pointer',
                                    fontSize: 13, fontFamily: FONT.body, fontWeight: 600,
                                    transition: 'all 0.2s',
                                    background: category === cat.id ? cat.color : 'transparent',
                                    color: category === cat.id ? '#fff' : C.textMuted,
                                    border: `1px solid ${category === cat.id ? cat.color : 'rgba(255,255,255,0.1)'}`,
                                }}
                            >
                                {cat.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Publish Button */}
                <div style={{ padding: '8px 16px 32px', flexShrink: 0 }}>
                    <div
                        onClick={handlePublish}
                        style={{
                            width: '100%', padding: 16, borderRadius: 14, textAlign: 'center',
                            background: uploading ? C.surfaceHigh : GRADIENT.primary,
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: FONT.headline,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: uploading ? 0.6 : 1,
                        }}
                    >
                        {uploading ? (
                            <>
                                <div style={{
                                    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff', borderRadius: 99, animation: 'spin 0.8s linear infinite',
                                }} />
                                Publicando...
                            </>
                        ) : (
                            <>
                                <Icon name="bolt" size={20} style={{ color: '#fff' }} />
                                PUBLICAR ESTADO
                            </>
                        )}
                    </div>
                </div>

                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    // Capture step
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: C.bg,
            display: 'flex', flexDirection: 'column',
        }}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 16, flexShrink: 0,
            }}>
                <div style={{ cursor: 'pointer', padding: 4 }} onClick={onClose}>
                    <Icon name="close" size={24} style={{ color: C.text }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>Crear Estado</span>
                <div style={{ width: 32 }} />
            </div>

            {/* Camera Preview Area */}
            <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                    margin: '0 16px', borderRadius: 20, overflow: 'hidden',
                    background: C.surfaceHigh, aspectRatio: '9/14',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 16, cursor: 'pointer',
                    border: '1px dashed rgba(255,255,255,0.1)',
                }}
            >
                <div style={{
                    width: 72, height: 72, borderRadius: 99, background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon name="photo_camera" size={36} style={{ color: C.textFaint }} />
                </div>
                <p style={{ fontSize: 14, color: C.textFaint, fontFamily: FONT.body }}>
                    Toca para seleccionar foto o video
                </p>
                <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                    {['photo_camera', 'videocam', 'auto_stories'].map((ic, i) => (
                        <div key={i} style={{
                            width: 48, height: 48, borderRadius: 99,
                            background: i === 0 ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: i === 0 ? `1px solid ${C.primary}` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <Icon name={ic} size={22} style={{ color: i === 0 ? C.primaryBright : C.textFaint }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Hint text */}
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: C.textFaint, fontFamily: FONT.body }}>
                    Los estados desaparecen después de 24 horas
                </p>
            </div>
        </div>
    )
}