import { useState, useEffect, useRef, useCallback } from 'react'
import { C, FONT, Icon, GRADIENT, GLASS_NAV } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function timeFormat(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ── Reactions localStorage helper ────────────────────────────── */
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍']

function getReactions(messageId) {
  try {
    const all = JSON.parse(localStorage.getItem('cng_reactions') || '{}')
    return all[messageId] || {}
  } catch { return {} }
}

function setReaction(messageId, userId, emoji) {
  try {
    const all = JSON.parse(localStorage.getItem('cng_reactions') || '{}')
    if (!all[messageId]) all[messageId] = {}
    if (all[messageId][userId] === emoji) {
      delete all[messageId][userId] // toggle off
    } else {
      all[messageId][userId] = emoji
    }
    if (Object.keys(all[messageId]).length === 0) delete all[messageId]
    localStorage.setItem('cng_reactions', JSON.stringify(all))
  } catch { /* noop */ }
}

function aggregateReactions(reactions) {
  const counts = {}
  Object.values(reactions).forEach(emoji => {
    counts[emoji] = (counts[emoji] || 0) + 1
  })
  return counts
}

/* ── Sticker grid ─────────────────────────────────────────────── */
const STICKER_EMOJIS = [
  '😀', '😂', '🥰', '😎', '🔥', '❤️', '👍', '👏', '🎉', '💯',
  '🤔', '😱', '💪', '🙏', '✨', '🌟', '😍', '🤩', '💀', '👀',
  '🏖️', '✈️', '🏠', '🍽️', '💰', '🎶', '🚀', '💎', '🌴', '🎊',
]

/* ── Popup shell ──────────────────────────────────────────────── */
const POPUP_STYLE = {
  position: 'absolute',
  background: C.surface,
  border: `1px solid ${C.outlineVariant}`,
  borderRadius: 16,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  zIndex: 100,
}

/* ── Voice duration formatter ─────────────────────────────────── */
function fmtDuration(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/* ── VoicePlayer component ────────────────────────────────────── */
function VoicePlayer({ url, isMine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onMeta = () => setDuration(a.duration || 0)
    const onTime = () => setCurrent(a.currentTime)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <div onClick={toggle} style={{ width: 32, height: 32, borderRadius: 99, background: isMine ? 'rgba(255,255,255,0.2)' : C.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <Icon name={playing ? 'pause' : 'play_arrow'} size={18} style={{ color: '#fff' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: isMine ? 'rgba(255,255,255,0.2)' : C.surfaceHighest, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isMine ? '#fff' : C.primary, borderRadius: 2, transition: 'width 0.1s' }} />
        </div>
        <p style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : C.textFaint, marginTop: 3 }}>
          {playing ? fmtDuration(current) : fmtDuration(duration)}
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function ChatScreen({ conversationId, onBack }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // Reactions
  const [reactionPopup, setReactionPopup] = useState(null)     // messageId
  const [, forceReactions] = useState(0)                       // trigger re-render
  const longPressTimer = useRef(null)

  // Sticker picker
  const [showStickers, setShowStickers] = useState(false)

  // Media upload
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  // Voice recording
  const [recording, setRecording] = useState(false)
  const [micSupported, setMicSupported] = useState(true)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) setMicSupported(false)
  }, [])

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  /* ── Fetch messages ─────────────────────────────────────────── */
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return
    try {
      const { data: msgs, error } = await supabase
        .from('cng_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(msgs || [])

      const { data: members } = await supabase
        .from('cng_conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)

      const otherId = members?.find(m => m.user_id !== user.id)?.user_id
      if (otherId) {
        const { data: member } = await supabase
          .from('cng_members')
          .select('full_name, ref_code, avatar_url')
          .eq('user_id', otherId)
          .single()
        if (member) setOtherUser(member)
      }

      await supabase
        .from('cng_conversation_members')
        .update({ unread_count: 0, last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)

      scrollToBottom()
    } catch (e) {
      console.error('Error fetching messages:', e)
    } finally {
      setLoading(false)
    }
  }, [conversationId, user])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  /* ── Realtime ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel('messages-' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cng_messages',
        filter: 'conversation_id=eq.' + conversationId,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        scrollToBottom()
        if (payload.new.sender_id !== user?.id) {
          supabase
            .from('cng_conversation_members')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user?.id)
            .then(() => {})
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, user])

  /* ── Close popups on outside click ──────────────────────────── */
  useEffect(() => {
    if (!reactionPopup && !showStickers) return
    const handler = () => { setReactionPopup(null); setShowStickers(false) }
    const timer = setTimeout(() => document.addEventListener('click', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [reactionPopup, showStickers])

  /* ── Send text ──────────────────────────────────────────────── */
  const handleSend = async (content, type = 'text') => {
    const val = typeof content === 'string' ? content : text
    if (!val.trim() || !user || sending) return
    const trimmed = val.trim()
    if (type === 'text') setText('')
    setSending(true)

    try {
      const { error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: trimmed,
        message_type: type,
      })
      if (error) throw error
    } catch (e) {
      console.error('Send error:', e)
      if (type === 'text') setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  /* ── Send media (image/video) ───────────────────────────────── */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    setUploading(true)

    try {
      const ext = file.name.split('.').pop()
      const path = `messages/${conversationId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage
        .from('cng-media')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('cng-media')
        .getPublicUrl(path)

      const isVideo = file.type.startsWith('video/')
      const msgType = isVideo ? 'video' : 'image'

      const { error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: urlData.publicUrl,
        message_type: msgType,
        media_url: urlData.publicUrl,
      })
      if (error) throw error
    } catch (e) {
      console.error('Upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  /* ── Voice record ───────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return // too short
        setUploading(true)
        try {
          const path = `messages/${conversationId}/voice-${Date.now()}.webm`
          const { error: upErr } = await supabase.storage
            .from('cng-media')
            .upload(path, blob, { contentType: 'audio/webm' })
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage
            .from('cng-media')
            .getPublicUrl(path)
          const { error } = await supabase.from('cng_messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: '🎙️ Voice message',
            message_type: 'voice',
            media_url: urlData.publicUrl,
          })
          if (error) throw error
        } catch (e) {
          console.error('Voice upload error:', e)
        } finally {
          setUploading(false)
        }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e) {
      console.error('Mic access denied:', e)
      setMicSupported(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  /* ── Reaction handlers ──────────────────────────────────────── */
  const handleMsgPointerDown = (msgId) => {
    longPressTimer.current = setTimeout(() => setReactionPopup(msgId), 500)
  }
  const handleMsgPointerUp = () => {
    clearTimeout(longPressTimer.current)
  }
  const handleMsgDoubleClick = (msgId) => {
    setReactionPopup(msgId)
  }
  const handleReact = (msgId, emoji) => {
    setReaction(msgId, user.id, emoji)
    setReactionPopup(null)
    forceReactions(x => x + 1)
  }

  /* ── Sticker send ───────────────────────────────────────────── */
  const sendSticker = (emoji) => {
    setShowStickers(false)
    handleSend(emoji, 'text')
  }

  const displayName = otherUser?.full_name || otherUser?.ref_code || 'Chat'
  const initial = displayName[0]?.toUpperCase() || 'C'

  /* ── Render message content ─────────────────────────────────── */
  const renderContent = (msg, isMine) => {
    const url = msg.media_url || msg.content

    if (msg.message_type === 'image') {
      return <img src={url} alt="" style={{ maxWidth: 250, width: '100%', borderRadius: 12, display: 'block' }} />
    }
    if (msg.message_type === 'video') {
      return <video src={url} controls style={{ maxWidth: 250, width: '100%', borderRadius: 12, display: 'block' }} />
    }
    if (msg.message_type === 'voice') {
      return <VoicePlayer url={url} isMine={isMine} />
    }
    return <p style={{ fontSize: 14, fontFamily: FONT.body, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 64, ...GLASS_NAV, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', padding: 8, borderRadius: 99, display: 'flex' }}>
          <Icon name="arrow_back" size={24} style={{ color: C.textDim }} />
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>{initial}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text }}>{displayName}</h1>
          <p style={{ fontSize: 11, color: C.primaryBright }}>Online</p>
        </div>
        <Icon name="more_vert" size={24} style={{ color: C.textDim }} />
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Icon name="waving_hand" size={48} style={{ color: C.textFaint, marginBottom: 16 }} />
            <p style={{ color: C.textDim, fontSize: 14, fontFamily: FONT.body }}>Say hello to {displayName}!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id
          const reactions = getReactions(msg.id)
          const counts = aggregateReactions(reactions)
          const hasReactions = Object.keys(counts).length > 0

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{ position: 'relative', maxWidth: '75%' }}
                onPointerDown={() => handleMsgPointerDown(msg.id)}
                onPointerUp={handleMsgPointerUp}
                onPointerLeave={handleMsgPointerUp}
                onDoubleClick={() => handleMsgDoubleClick(msg.id)}
              >
                <div style={{
                  padding: msg.message_type === 'image' || msg.message_type === 'video' ? 4 : '12px 16px',
                  borderRadius: 16,
                  borderBottomRightRadius: isMine ? 4 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 4,
                  background: isMine ? GRADIENT.primary : C.surfaceHigh,
                  color: isMine ? '#fff' : C.text,
                }}>
                  {renderContent(msg, isMine)}
                  <p style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : C.textFaint, marginTop: 4, textAlign: 'right', padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>{timeFormat(msg.created_at)}</p>
                </div>

                {/* Reaction popup */}
                {reactionPopup === msg.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...POPUP_STYLE,
                      bottom: '100%',
                      [isMine ? 'right' : 'left']: 0,
                      marginBottom: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    {REACTION_EMOJIS.map(em => (
                      <span
                        key={em}
                        onClick={() => handleReact(msg.id, em)}
                        style={{ fontSize: 22, cursor: 'pointer', transition: 'transform 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        {em}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Reaction pills */}
              {hasReactions && (
                <div style={{ display: 'flex', gap: 4, marginTop: 2, paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0 }}>
                  {Object.entries(counts).map(([emoji, count]) => (
                    <span
                      key={emoji}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 12,
                        background: C.surfaceHigh,
                        border: `1px solid ${C.outlineVariant}`,
                        borderRadius: 99,
                        padding: '2px 8px',
                        color: C.text,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleReact(msg.id, emoji)}
                    >
                      {emoji} {count > 1 && <span style={{ fontSize: 10, color: C.textDim }}>{count}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Upload indicator */}
      {uploading && (
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 16, border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT.body }}>Uploading...</span>
        </div>
      )}

      {/* Recording indicator */}
      {recording && (
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: C.errorBright, animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 12, color: C.errorBright, fontFamily: FONT.body }}>Recording...</span>
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </div>
      )}

      {/* Sticker picker popup */}
      {showStickers && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...POPUP_STYLE,
            position: 'absolute',
            bottom: 80,
            left: 16,
            right: 16,
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 8,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {STICKER_EMOJIS.map(em => (
            <span
              key={em}
              onClick={() => sendSticker(em)}
              style={{ fontSize: 28, textAlign: 'center', cursor: 'pointer', padding: 4, borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHigh }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {em}
            </span>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Input bar */}
      <div style={{ padding: '8px 16px 16px', ...GLASS_NAV, borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Attach */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="attach_file" size={22} style={{ color: C.textDim }} />
        </div>

        {/* Stickers */}
        <div
          onClick={(e) => { e.stopPropagation(); setShowStickers(v => !v) }}
          style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="emoji_emotions" size={22} style={{ color: showStickers ? C.primary : C.textDim }} />
        </div>

        {/* Text input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 24,
              padding: '12px 16px',
              color: C.text,
              fontSize: 14,
              fontFamily: FONT.body,
              outline: 'none',
            }}
          />
        </div>

        {/* Mic / Send */}
        {text.trim() ? (
          <div
            onClick={() => handleSend()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: GRADIENT.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <Icon name="send" size={20} style={{ color: '#fff' }} />
          </div>
        ) : micSupported ? (
          <div
            onClick={recording ? stopRecording : startRecording}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: recording ? C.errorBright : C.surfaceHigh,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <Icon name={recording ? 'stop' : 'mic'} size={20} style={{ color: recording ? '#fff' : C.textDim }} />
          </div>
        ) : (
          <div
            onClick={() => handleSend()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: C.surfaceHigh,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              flexShrink: 0,
            }}
          >
            <Icon name="send" size={20} style={{ color: C.textFaint }} />
          </div>
        )}
      </div>
    </div>
  )
}
