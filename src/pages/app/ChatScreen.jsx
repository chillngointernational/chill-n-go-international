import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  background: 'rgba(13,17,23,0.95)',
  border: '1px solid rgba(241,239,232,0.1)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  zIndex: 100,
}

/* ── Voice duration formatter ─────────────────────────────────── */
function fmtDuration(s) {
  if (!s || !isFinite(s) || isNaN(s)) return '0:00'
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
    else {
      a.play().then(() => setPlaying(true)).catch(err => {
        console.error('Voice: playback error', err)
        setPlaying(false)
      })
    }
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

/* ── Delivery Status icon ─────────────────────────────────────── */
const DeliveryStatus = ({ status }) => {
  if (status === 'sending') return (
    <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', verticalAlign: 'middle', lineHeight: 1 }}>schedule</span>
  )
  if (status === 'sent') return (
    <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', verticalAlign: 'middle', lineHeight: 1 }}>done</span>
  )
  if (status === 'delivered') return (
    <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', verticalAlign: 'middle', lineHeight: 1 }}>done_all</span>
  )
  if (status === 'read') return (
    <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#53BDEB', verticalAlign: 'middle', lineHeight: 1 }}>done_all</span>
  )
  return null
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

  // Track pending optimistic IDs so realtime can dedup
  const pendingOptimisticRef = useRef(new Map()) // tempId -> true, then tempId -> realId after insert

  // Reactions
  const [reactionPopup, setReactionPopup] = useState(null)
  const [reactionPopupAnim, setReactionPopupAnim] = useState(false)
  const [, forceReactions] = useState(0)
  const longPressTimer = useRef(null)

  // Reply
  const [replyTo, setReplyTo] = useState(null)

  // Forward modal
  const [forwardMsg, setForwardMsg] = useState(null)
  const [fwdSearch, setFwdSearch] = useState('')
  const [fwdMembers, setFwdMembers] = useState([])
  const [fwdLoading, setFwdLoading] = useState(false)
  const [fwdSending, setFwdSending] = useState(false)

  // Message refs for scroll-to-reply
  const messageRefs = useRef({})

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
    // Ensure Supabase realtime has the current auth token
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    }
    try {
      const { data: msgs, error } = await supabase
        .from('cng_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(msgs || [])

      // Mark incoming messages as read (single call, only if needed)
      const unreadIncoming = (msgs || []).filter(
        m => m.sender_id !== user.id && m.delivery_status !== 'read'
      )
      if (unreadIncoming.length > 0) {
        const unreadIds = unreadIncoming.map(m => m.id)
        await supabase
          .from('cng_messages')
          .update({ delivery_status: 'read', read_at: new Date().toISOString() })
          .in('id', unreadIds)

        // Update local state immediately so UI shows read status
        setMessages(prev => prev.map(m =>
          unreadIds.includes(m.id)
            ? { ...m, delivery_status: 'read', read_at: new Date().toISOString() }
            : m
        ))
      }

      // Fetch other user info
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

      // Reset unread counter for current user
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
    if (!conversationId || !user) return

    let channel = null

    const setup = async () => {
      // Ensure realtime has the current auth token for RLS
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      channel = supabase
        .channel('messages-' + conversationId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'cng_messages',
          filter: 'conversation_id=eq.' + conversationId,
        }, (payload) => {
          const newMsg = payload.new
          const isOwnRealtimeEcho = newMsg.sender_id === user.id

          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev

            if (isOwnRealtimeEcho) {
              const optimisticIdx = prev.findIndex(m =>
                typeof m.id === 'string' &&
                m.id.startsWith('temp-') &&
                m.sender_id === newMsg.sender_id &&
                m.content === newMsg.content
              )
              if (optimisticIdx !== -1) {
                const updated = [...prev]
                updated[optimisticIdx] = newMsg
                return updated
              }
              return prev
            }

            return [...prev, newMsg]
          })

          scrollToBottom()

          if (!isOwnRealtimeEcho) {
            supabase
              .from('cng_messages')
              .update({ delivery_status: 'read', read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then(({ error }) => {
                if (error) console.error('mark-read error:', error)
              })

            supabase
              .from('cng_conversation_members')
              .update({ unread_count: 0, last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', user.id)
              .then(() => { })
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'cng_messages',
          filter: 'conversation_id=eq.' + conversationId,
        }, (payload) => {
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id
              ? { ...m, ...payload.new }
              : m
          ))
        })
        .subscribe()
    }

    setup()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [conversationId, user])

  /* ── Close popups on outside click ──────────────────────────── */
  useEffect(() => {
    if (!reactionPopup && !showStickers) return
    const handler = () => { closeReactionPopup(); setShowStickers(false) }
    const timer = setTimeout(() => document.addEventListener('click', handler), 300)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [reactionPopup, showStickers])

  /* ── Send text ──────────────────────────────────────────────── */
  const handleSend = async (content, type = 'text') => {
    const val = typeof content === 'string' ? content : text
    if (!val.trim() || !user || sending) return
    const trimmed = val.trim()
    if (type === 'text') setText('')
    const replyId = replyTo?.id || null
    setReplyTo(null)
    setSending(true)

    // Optimistic message
    const tempId = 'temp-' + Date.now()
    const optimistic = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed,
      message_type: type,
      reply_to_id: replyId,
      created_at: new Date().toISOString(),
      delivery_status: 'sending',
    }
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()

    try {
      const row = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: trimmed,
        message_type: type,
        delivery_status: 'sent',
      }
      if (replyId) row.reply_to_id = replyId
      const { data, error } = await supabase.from('cng_messages').insert(row).select().single()
      if (error) throw error

      // Replace optimistic with real message from DB
      setMessages(prev => {
        // Check if realtime already replaced the optimistic
        const hasReal = prev.some(m => m.id === data.id)
        if (hasReal) {
          // Realtime beat us — just remove the optimistic if still there
          return prev.filter(m => m.id !== tempId)
        }
        // Normal case — swap optimistic for real
        return prev.map(m => m.id === tempId ? data : m)
      })
    } catch (e) {
      console.error('Send error:', e)
      setMessages(prev => prev.filter(m => m.id !== tempId))
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
        delivery_status: 'sent',
      })
      if (error) throw error
    } catch (e) {
      console.error('Upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  /* ── Voice record ───────────────────────────────────────────── */
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ]
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t
    }
    return undefined
  }

  const getExtForMime = (mime) => {
    if (!mime) return 'webm'
    if (mime.includes('mp4')) return 'mp4'
    if (mime.includes('ogg')) return 'ogg'
    return 'webm'
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : undefined
      const mr = new MediaRecorder(stream, options)
      const activeMime = mr.mimeType

      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blobType = activeMime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })

        if (blob.size < 500) return

        setUploading(true)
        try {
          const ext = getExtForMime(blobType)
          const path = `messages/${conversationId}/voice-${Date.now()}.${ext}`

          const { error: upErr } = await supabase.storage
            .from('cng-media')
            .upload(path, blob, { contentType: blobType })
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
            delivery_status: 'sent',
          })
          if (error) throw error
        } catch (e) {
          console.error('Voice upload error:', e)
        } finally {
          setUploading(false)
        }
      }

      mr.onerror = (e) => {
        console.error('Voice: MediaRecorder error', e.error)
      }

      mr.start(1000)
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e) {
      console.error('Voice: mic access denied or error:', e)
      setMicSupported(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    setRecording(false)
  }

  /* ── Reaction popup helpers ──────────────────────────────────── */
  const openReactionPopup = (msgId) => {
    setReactionPopup(msgId)
    requestAnimationFrame(() => setReactionPopupAnim(true))
  }
  const closeReactionPopup = () => {
    setReactionPopupAnim(false)
    setTimeout(() => setReactionPopup(null), 150)
  }

  /* ── Reaction handlers ──────────────────────────────────────── */
  const handleMsgPointerDown = (msgId) => {
    longPressTimer.current = setTimeout(() => openReactionPopup(msgId), 500)
  }
  const handleMsgPointerUp = () => {
    clearTimeout(longPressTimer.current)
  }
  const handleReact = (msgId, emoji) => {
    setReaction(msgId, user.id, emoji)
    closeReactionPopup()
    forceReactions(x => x + 1)
  }

  /* ── Reply handler ─────────────────────────────────────────── */
  const handleReply = (msg) => {
    setReplyTo(msg)
    closeReactionPopup()
  }

  /* ── Forward handler ───────────────────────────────────────── */
  const handleForwardOpen = (msg) => {
    setForwardMsg(msg)
    setFwdSearch('')
    setFwdMembers([])
    closeReactionPopup()
  }

  const searchForwardMembers = useCallback(async (q) => {
    setFwdSearch(q)
    if (!q.trim()) { setFwdMembers([]); return }
    setFwdLoading(true)
    try {
      const { data } = await supabase
        .from('cng_members')
        .select('user_id, full_name, ref_code, avatar_url')
        .neq('user_id', user.id)
        .or(`full_name.ilike.%${q}%,ref_code.ilike.%${q}%`)
        .limit(15)
      setFwdMembers(data || [])
    } catch { setFwdMembers([]) }
    finally { setFwdLoading(false) }
  }, [user])

  const handleForwardTo = async (member) => {
    if (!forwardMsg || fwdSending) return
    setFwdSending(true)
    try {
      const { data: myConvs } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      const myConvIds = (myConvs || []).map(c => c.conversation_id)

      let targetConvId = null
      if (myConvIds.length > 0) {
        const { data: theirConvs } = await supabase
          .from('cng_conversation_members')
          .select('conversation_id')
          .eq('user_id', member.user_id)
          .in('conversation_id', myConvIds)
        targetConvId = theirConvs?.[0]?.conversation_id || null
      }

      if (!targetConvId) {
        const { data: conv, error: convErr } = await supabase
          .from('cng_conversations')
          .insert({ type: 'dm' })
          .select()
          .single()
        if (convErr) throw convErr
        targetConvId = conv.id
        await supabase.from('cng_conversation_members').insert([
          { conversation_id: targetConvId, user_id: user.id },
          { conversation_id: targetConvId, user_id: member.user_id },
        ])
      }

      const row = {
        conversation_id: targetConvId,
        sender_id: user.id,
        content: forwardMsg.content,
        message_type: forwardMsg.message_type,
        metadata: JSON.stringify({ forwarded: true }),
        delivery_status: 'sent',
      }
      if (forwardMsg.media_url) row.media_url = forwardMsg.media_url
      const { error } = await supabase.from('cng_messages').insert(row)
      if (error) throw error

      setForwardMsg(null)
    } catch (e) {
      console.error('Forward error:', e)
    } finally {
      setFwdSending(false)
    }
  }

  /* ── Scroll to replied message ─────────────────────────────── */
  const scrollToMessage = (msgId) => {
    const el = messageRefs.current[msgId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.transition = 'background 0.3s'
      el.style.background = 'rgba(104,219,174,0.15)'
      setTimeout(() => { el.style.background = 'transparent' }, 1500)
    }
  }

  /* ── Messages map for reply lookup ─────────────────────────── */
  const messagesMap = useMemo(() => {
    const map = {}
    messages.forEach(m => { map[m.id] = m })
    return map
  }, [messages])

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
          const repliedMsg = msg.reply_to_id ? messagesMap[msg.reply_to_id] : null
          const isForwarded = (() => {
            try { return msg.metadata && JSON.parse(msg.metadata)?.forwarded } catch { return false }
          })()

          return (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el }} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{ position: 'relative', maxWidth: '75%' }}
                onPointerDown={() => handleMsgPointerDown(msg.id)}
                onPointerUp={handleMsgPointerUp}
                onPointerLeave={handleMsgPointerUp}
                onContextMenu={(e) => { e.preventDefault(); openReactionPopup(msg.id) }}
              >
                <div style={{
                  padding: msg.message_type === 'image' || msg.message_type === 'video' ? 4 : '12px 16px',
                  borderRadius: 16,
                  borderBottomRightRadius: isMine ? 4 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 4,
                  background: isMine ? GRADIENT.primary : C.surfaceHigh,
                  color: isMine ? '#fff' : C.text,
                }}>
                  {/* Forwarded label */}
                  {isForwarded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, opacity: 0.7 }}>
                      <Icon name="shortcut" size={12} style={{ color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim }} />
                      <span style={{ fontSize: 11, fontStyle: 'italic', color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: FONT.body }}>Forwarded</span>
                    </div>
                  )}
                  {/* Reply preview */}
                  {repliedMsg && (
                    <div
                      onClick={(e) => { e.stopPropagation(); scrollToMessage(repliedMsg.id) }}
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 8,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: isMine ? 'rgba(255,255,255,0.12)' : 'rgba(104,219,174,0.08)',
                        borderLeft: `3px solid ${C.primary}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: C.primary, fontFamily: FONT.headline, marginBottom: 2 }}>
                          {repliedMsg.sender_id === user?.id ? 'You' : (otherUser?.full_name || 'User')}
                        </p>
                        <p style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {repliedMsg.message_type === 'image' ? '📷 Photo' : repliedMsg.message_type === 'video' ? '🎬 Video' : repliedMsg.message_type === 'voice' ? '🎙️ Voice' : repliedMsg.content}
                        </p>
                      </div>
                    </div>
                  )}
                  {renderContent(msg, isMine)}
                  {isMine ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4, padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{timeFormat(msg.created_at)}</span>
                      <DeliveryStatus status={msg.delivery_status || 'sent'} />
                    </div>
                  ) : (
                    <p style={{ fontSize: 10, color: C.textFaint, marginTop: 4, textAlign: 'left', padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>{timeFormat(msg.created_at)}</p>
                  )}
                </div>

                {/* Reaction + actions popup */}
                {reactionPopup === msg.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...POPUP_STYLE,
                      bottom: '100%',
                      [isMine ? 'right' : 'left']: 0,
                      marginBottom: 8,
                      padding: 0,
                      minWidth: 220,
                      transform: reactionPopupAnim ? 'scale(1)' : 'scale(0.8)',
                      opacity: reactionPopupAnim ? 1 : 0,
                      transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                      transformOrigin: isMine ? 'bottom right' : 'bottom left',
                    }}
                  >
                    {/* Emoji row */}
                    <div style={{ display: 'flex', gap: 6, padding: '10px 14px 8px', justifyContent: 'center' }}>
                      {REACTION_EMOJIS.map(em => (
                        <span
                          key={em}
                          onClick={() => handleReact(msg.id, em)}
                          style={{ fontSize: 24, cursor: 'pointer', transition: 'transform 0.15s', padding: '2px 4px', borderRadius: 8 }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.35)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent' }}
                        >
                          {em}
                        </span>
                      ))}
                    </div>
                    {/* Separator */}
                    <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '0 12px' }} />
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 0 }}>
                      <div
                        onClick={() => handleReply(msg)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', cursor: 'pointer', borderRadius: '0 0 0 16px', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon name="reply" size={16} style={{ color: C.textDim }} />
                        <span style={{ fontSize: 13, color: C.text, fontFamily: FONT.body }}>Reply</span>
                      </div>
                      <div style={{ width: 1, background: 'rgba(241,239,232,0.08)', margin: '6px 0' }} />
                      <div
                        onClick={() => handleForwardOpen(msg)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', cursor: 'pointer', borderRadius: '0 0 16px 0', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon name="shortcut" size={16} style={{ color: C.textDim }} />
                        <span style={{ fontSize: 13, color: C.text, fontFamily: FONT.body }}>Forward</span>
                      </div>
                    </div>
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

      {/* Reply bar */}
      {replyTo && (
        <div style={{ padding: '8px 16px', background: 'rgba(13,17,23,0.8)', borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 36, borderRadius: 2, background: C.primary, flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.primary, fontFamily: FONT.headline }}>
              {replyTo.sender_id === user?.id ? 'You' : (otherUser?.full_name || 'User')}
            </p>
            <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.message_type === 'image' ? '📷 Photo' : replyTo.message_type === 'video' ? '🎬 Video' : replyTo.message_type === 'voice' ? '🎙️ Voice' : replyTo.content}
            </p>
          </div>
          <div onClick={() => setReplyTo(null)} style={{ cursor: 'pointer', padding: 4 }}>
            <Icon name="close" size={18} style={{ color: C.textDim }} />
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <div
          onClick={() => setForwardMsg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, maxHeight: '70vh', background: 'rgba(13,17,23,0.97)', borderRadius: 20, border: '1px solid rgba(241,239,232,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="shortcut" size={20} style={{ color: C.primary }} />
              <h2 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }}>Forward to...</h2>
              <div onClick={() => setForwardMsg(null)} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="close" size={20} style={{ color: C.textDim }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <input
                autoFocus
                placeholder="Search members..."
                value={fwdSearch}
                onChange={(e) => searchForwardMembers(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {fwdLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
              {!fwdLoading && fwdSearch && fwdMembers.length === 0 && (
                <p style={{ textAlign: 'center', padding: 20, color: C.textDim, fontSize: 13, fontFamily: FONT.body }}>No members found</p>
              )}
              {fwdMembers.map(m => (
                <div
                  key={m.user_id}
                  onClick={() => handleForwardTo(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: fwdSending ? 'wait' : 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>
                        {(m.full_name || m.ref_code || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>{m.full_name || m.ref_code}</p>
                    {m.ref_code && m.full_name && <p style={{ fontSize: 12, color: C.textDim }}>@{m.ref_code}</p>}
                  </div>
                  <Icon name="send" size={18} style={{ color: C.primary }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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