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
  if (status === 'sending') return <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', verticalAlign: 'middle', lineHeight: 1 }}>schedule</span>
  if (status === 'sent') return <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', verticalAlign: 'middle', lineHeight: 1 }}>done</span>
  if (status === 'delivered') return <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', verticalAlign: 'middle', lineHeight: 1 }}>done_all</span>
  if (status === 'read') return <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#53BDEB', verticalAlign: 'middle', lineHeight: 1 }}>done_all</span>
  return null
}

/* ── Story Reply Badge ── */
function StoryReplyBadge({ storyId, isMine }) {
  const [story, setStory] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!storyId) return
    supabase
      .from('cng_stories')
      .select('id, media_url, caption, media_type')
      .eq('id', storyId)
      .maybeSingle()
      .then(({ data }) => { setStory(data || null); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [storyId])

  if (!loaded) return null

  if (!story) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        padding: '6px 10px', borderRadius: 8,
        background: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(104,219,174,0.08)',
        borderLeft: '3px solid #B8956A',
      }}>
        <Icon name="auto_stories" size={14} style={{ color: '#B8956A' }} />
        <span style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : C.textDim, fontFamily: FONT.body, fontStyle: 'italic' }}>
          Estado expirado
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
      padding: '6px 10px', borderRadius: 8,
      background: isMine ? 'rgba(255,255,255,0.12)' : 'rgba(104,219,174,0.08)',
      borderLeft: '3px solid #B8956A',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, overflow: 'hidden',
        flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <img src={story.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT.headline, color: '#B8956A', marginBottom: 1 }}>
          Respondió a un estado
        </p>
        <p style={{
          fontSize: 11, fontFamily: FONT.body,
          color: isMine ? 'rgba(255,255,255,0.5)' : C.textDim,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {story.caption || (story.media_type === 'video' ? '🎬 Video' : '📷 Foto')}
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function ChatScreen({ conversationId, onBack }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])

  // --- Estados de Datos de la Conversación ---
  const [conversation, setConversation] = useState(null)
  const [membersMap, setMembersMap] = useState({})
  const [otherUser, setOtherUser] = useState(null)

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // Track pending optimistic IDs
  const pendingOptimisticRef = useRef(new Map())

  // --- Estados para "Escribiendo..." Múltiple ---
  const [typingUsers, setTypingUsers] = useState({})
  const typingTimeoutRef = useRef(null)
  const activeTypingTimeoutsRef = useRef({})
  const channelRef = useRef(null)

  // Semáforo de seguridad para Realtime
  const isRealtimeReady = useRef(false)

  // Reactions & Modals
  const [reactionPopup, setReactionPopup] = useState(null)
  const [reactionPopupAnim, setReactionPopupAnim] = useState(false)
  const [reactions, setReactions] = useState({})
  const longPressTimer = useRef(null)
  const [replyTo, setReplyTo] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [fwdSearch, setFwdSearch] = useState('')
  const [fwdMembers, setFwdMembers] = useState([])
  const [fwdLoading, setFwdLoading] = useState(false)
  const [fwdSending, setFwdSending] = useState(false)
  const messageRefs = useRef({})
  const [showStickers, setShowStickers] = useState(false)
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micSupported, setMicSupported] = useState(true)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // ─── VIEW ONCE states ─────────────────────────────────────
  const [viewOnceViewer, setViewOnceViewer] = useState(null)
  const [viewOnceCountdown, setViewOnceCountdown] = useState(0)
  const viewOnceTimerRef = useRef(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const viewOnceFileInputRef = useRef(null)
  const docFileInputRef = useRef(null)
  const [locationLoading, setLocationLoading] = useState(false)
  // ─── EDIT & DELETE states ──────────────────────────────────
  const [editingMsg, setEditingMsg] = useState(null)       // message object being edited
  const [editText, setEditText] = useState('')              // edit input text
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // message to confirm delete
  const [contextMenu, setContextMenu] = useState(null)      // { msgId, x, y } for context menu position

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) setMicSupported(false)
  }, [])

  /* ── Reactions from Supabase ────────────────────────────────── */
  const fetchReactions = useCallback(async (messageIds) => {
    if (!messageIds || messageIds.length === 0) return
    try {
      const { data } = await supabase
        .from('cng_message_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds)
      const map = {}
        ; (data || []).forEach(r => {
          if (!map[r.message_id]) map[r.message_id] = []
          map[r.message_id].push(r)
        })
      setReactions(prev => ({ ...prev, ...map }))
    } catch (e) { console.error('Fetch reactions error:', e) }
  }, [])

  const handleReact = async (msgId, emoji) => {
    if (!user) return
    closeReactionPopup()
    const existing = (reactions[msgId] || []).find(r => r.user_id === user.id)

    if (existing && existing.emoji === emoji) {
      // Remove reaction (toggle off)
      setReactions(prev => ({
        ...prev,
        [msgId]: (prev[msgId] || []).filter(r => r.id !== existing.id)
      }))
      await supabase.from('cng_message_reactions').delete().eq('id', existing.id)
    } else {
      if (existing) {
        // Remove old reaction first
        setReactions(prev => ({
          ...prev,
          [msgId]: (prev[msgId] || []).filter(r => r.id !== existing.id)
        }))
        await supabase.from('cng_message_reactions').delete().eq('id', existing.id)
      }
      // Add new reaction
      const tempReaction = { id: 'temp-' + Date.now(), message_id: msgId, user_id: user.id, emoji }
      setReactions(prev => ({
        ...prev,
        [msgId]: [...(prev[msgId] || []), tempReaction]
      }))
      const { data, error } = await supabase.from('cng_message_reactions')
        .insert({ message_id: msgId, user_id: user.id, emoji })
        .select().single()
      if (!error && data) {
        setReactions(prev => ({
          ...prev,
          [msgId]: (prev[msgId] || []).map(r => r.id === tempReaction.id ? data : r)
        }))
      }
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  /* ── Fetch messages and Group Data ─────────────────────────── */
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    }
    try {
      const { data: convData } = await supabase
        .from('cng_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      setConversation(convData)

      const { data: memberRows } = await supabase
        .from('cng_conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)

      const userIds = (memberRows || []).map(m => m.user_id)

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('cng_members')
          .select('user_id, full_name, ref_code, avatar_url')
          .in('user_id', userIds)

        const pMap = {}
        profiles?.forEach(p => pMap[p.user_id] = p)
        setMembersMap(pMap)

        if (convData?.type === 'dm' || convData?.type === 'direct') {
          const otherId = userIds.find(id => id !== user.id)
          if (otherId && pMap[otherId]) setOtherUser(pMap[otherId])
        }
      }

      const { data: msgs, error } = await supabase
        .from('cng_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(msgs || [])
      const msgIds = (msgs || []).map(m => m.id)
      if (msgIds.length > 0) fetchReactions(msgIds)

      const unreadIncoming = (msgs || []).filter(
        m => m.sender_id !== user.id && m.delivery_status !== 'read' && !m.is_deleted
      )
      if (unreadIncoming.length > 0) {
        const unreadIds = unreadIncoming.map(m => m.id)
        await supabase
          .from('cng_messages')
          .update({ delivery_status: 'read', read_at: new Date().toISOString() })
          .in('id', unreadIds)

        setMessages(prev => prev.map(m =>
          unreadIds.includes(m.id)
            ? { ...m, delivery_status: 'read', read_at: new Date().toISOString() }
            : m
        ))
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
    if (!conversationId || !user) return

    let channel = null

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      channel = supabase
        .channel('messages-' + conversationId, {
          config: { broadcast: { ack: false } },
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          const senderId = payload.payload.user_id;

          if (senderId !== user.id) {
            if (payload.payload.is_typing) {
              setTypingUsers(prev => ({ ...prev, [senderId]: payload.payload.name }))

              clearTimeout(activeTypingTimeoutsRef.current[senderId])
              activeTypingTimeoutsRef.current[senderId] = setTimeout(() => {
                setTypingUsers(prev => {
                  const newMap = { ...prev }
                  delete newMap[senderId]
                  return newMap
                })
              }, 3000)
              scrollToBottom()
            } else {
              setTypingUsers(prev => {
                const newMap = { ...prev }
                delete newMap[senderId]
                return newMap
              })
              clearTimeout(activeTypingTimeoutsRef.current[senderId])
            }
          }
        })
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
            supabase.from('cng_messages')
              .update({ delivery_status: 'read', read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then(() => { })

            supabase.from('cng_conversation_members')
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
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'cng_message_reactions',
        }, (payload) => {
          const r = payload.new
          if (r.user_id !== user.id) {
            setReactions(prev => ({
              ...prev,
              [r.message_id]: [...(prev[r.message_id] || []).filter(x => x.id !== r.id), r]
            }))
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'cng_message_reactions',
        }, (payload) => {
          const r = payload.old
          if (r.user_id !== user.id) {
            setReactions(prev => ({
              ...prev,
              [r.message_id]: (prev[r.message_id] || []).filter(x => x.id !== r.id)
            }))
          }
        })
        .subscribe((status) => {
          console.log('[Chat] Realtime status:', status)
        })

      channelRef.current = channel
    }

    setup()

    const reconnectInterval = setInterval(() => {
      const ch = channelRef.current
      if (ch && ch.state !== 'joined' && ch.state !== 'joining') {
        console.log('[Chat] Channel dropped (' + ch.state + '), reconnecting...')
        supabase.removeChannel(ch)
        channelRef.current = null
        setup()
      }
    }, 5000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const ch = channelRef.current
        if (!ch || (ch.state !== 'joined' && ch.state !== 'joining')) {
          console.log('[Chat] Tab resumed, reconnecting...')
          if (ch) supabase.removeChannel(ch)
          channelRef.current = null
          setup()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(reconnectInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (channel) supabase.removeChannel(channel)
    }
  }, [conversationId, user])

  /* ── Close popups on outside click ──────────────────────────── */
  useEffect(() => {
    if (!reactionPopup && !showStickers && !contextMenu && !showAttachMenu) return
    const handler = () => { closeReactionPopup(); setShowStickers(false); setContextMenu(null); setShowAttachMenu(false) }
    const timer = setTimeout(() => document.addEventListener('click', handler), 300)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [reactionPopup, showStickers, contextMenu])

  /* ── Manejador de "Escribiendo" ────────────────────────────── */
  const handleTextChange = (e) => {
    const val = e.target.value
    setText(val)

    if (channelRef.current && channelRef.current.state === 'joined' && user) {
      const myName = membersMap[user.id]?.full_name?.split(' ')[0] || 'Alguien'

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id, is_typing: val.length > 0, name: myName }
      }).catch(() => { })

      clearTimeout(typingTimeoutRef.current)

      if (val.length > 0) {
        typingTimeoutRef.current = setTimeout(() => {
          if (channelRef.current && channelRef.current.state === 'joined') {
            channelRef.current.send({
              type: 'broadcast',
              event: 'typing',
              payload: { user_id: user.id, is_typing: false }
            }).catch(() => { })
          }
        }, 2000)
      }
    }
  }

  /* ── Send text ──────────────────────────────────────────────── */
  const handleSend = async (content, type = 'text') => {
    const val = typeof content === 'string' ? content : text
    if (!val.trim() || !user || sending) return
    const trimmed = val.trim()
    if (type === 'text') setText('')
    const replyId = replyTo?.id || null
    setReplyTo(null)
    setSending(true)

    if (channelRef.current && channelRef.current.state === 'joined') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id, is_typing: false }
      }).catch(() => { })
      clearTimeout(typingTimeoutRef.current)
    }

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

      setMessages(prev => {
        const hasReal = prev.some(m => m.id === data.id)
        if (hasReal) {
          return prev.filter(m => m.id !== tempId)
        }
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
    setShowAttachMenu(false)
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
      const { data: newMsg, error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: urlData.publicUrl,
        message_type: msgType,
        media_url: urlData.publicUrl,
        delivery_status: 'sent',
      }).select().single()
      if (error) throw error
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      scrollToBottom()
      scrollToBottom()
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

  /* ── Send media — VIEW ONCE ─────────────────────────────────── */
  const handleViewOnceFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    setShowAttachMenu(false)
    setUploading(true)
    try {
      const path = `messages/${conversationId}/viewonce-${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('cng-media').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
      const isVideo = file.type.startsWith('video/')
      const { data: newMsg, error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: isVideo ? '🔒 Video · Ver una vez' : '🔒 Foto · Ver una vez',
        message_type: isVideo ? 'video' : 'image',
        media_url: urlData.publicUrl,
        delivery_status: 'sent',
        is_view_once: true,
      }).select().single()
      if (error) throw error
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      scrollToBottom()
    } catch (e) { console.error('View once upload error:', e) }
    finally { setUploading(false) }
  }

  const openViewOnce = async (msg) => {
    const isMine = msg.sender_id === user?.id
    if (!isMine && msg.viewed_once_at) return
    setViewOnceViewer(msg)
    setViewOnceCountdown(5)
    if (!isMine && !msg.viewed_once_at) {
      const now = new Date().toISOString()
      await supabase.from('cng_messages').update({ viewed_once_at: now }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, viewed_once_at: now } : m))
    }
    clearInterval(viewOnceTimerRef.current)
    let remaining = 5
    viewOnceTimerRef.current = setInterval(() => {
      remaining -= 1
      setViewOnceCountdown(remaining)
      if (remaining <= 0) { clearInterval(viewOnceTimerRef.current); setViewOnceViewer(null) }
    }, 1000)
  }

  const closeViewOnce = () => {
    clearInterval(viewOnceTimerRef.current)
    setViewOnceViewer(null)
    setViewOnceCountdown(0)
  }
  /* ── Send document ──────────────────────────────────────────── */
  const handleDocFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    setShowAttachMenu(false)
    setUploading(true)
    try {
      const path = `messages/${conversationId}/docs-${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('cng-media').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
      const { data: newMsg, error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: file.name,
        message_type: 'document',
        media_url: urlData.publicUrl,
        delivery_status: 'sent',
      }).select().single()
      if (error) throw error
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      scrollToBottom()
    } catch (e) { console.error('Doc upload error:', e) }
    finally { setUploading(false) }
  }

  /* ── Send location ──────────────────────────────────────────── */
  const handleSendLocation = async () => {
    if (!user || locationLoading) return
    setShowAttachMenu(false)
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        try {
          const locationData = JSON.stringify({ lat, lng })
          const { data: newMsg, error } = await supabase.from('cng_messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: locationData,
            message_type: 'location',
            delivery_status: 'sent',
          }).select().single()
          if (error) throw error
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
          scrollToBottom()
        } catch (e) { console.error('Location send error:', e) }
        finally { setLocationLoading(false) }
      },
      (err) => {
        console.error('Geolocation error:', err)
        alert('No se pudo obtener tu ubicación. Verifica los permisos.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
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
  const handleMsgPointerDown = (msgId, isMine) => {
    longPressTimer.current = setTimeout(() => {
      if (isMine) {
        // For own messages: show context menu (edit/delete)
        const el = messageRefs.current[msgId]
        if (el) {
          const rect = el.getBoundingClientRect()
          setContextMenu({ msgId, x: rect.left, y: rect.top - 8 })
        }
      } else {
        // For other's messages: show reaction popup
        openReactionPopup(msgId)
      }
    }, 500)
  }
  const handleMsgPointerUp = () => {
    clearTimeout(longPressTimer.current)
  }
  const handleContextMenuEvent = (e, msgId, isMine) => {
    e.preventDefault()
    if (isMine) {
      setContextMenu({ msgId, x: e.clientX, y: e.clientY })
    } else {
      openReactionPopup(msgId)
    }
  }

  /* ── EDIT message handlers ─────────────────────────────────── */
  const startEdit = (msg) => {
    setEditingMsg(msg)
    setEditText(msg.content)
    setContextMenu(null)
  }

  const cancelEdit = () => {
    setEditingMsg(null)
    setEditText('')
  }

  const saveEdit = async () => {
    if (!editingMsg || !editText.trim()) return
    const trimmed = editText.trim()
    if (trimmed === editingMsg.content) { cancelEdit(); return }

    const msgId = editingMsg.id
    const oldContent = editingMsg.content

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m
    ))
    cancelEdit()

    try {
      const { error } = await supabase
        .from('cng_messages')
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq('id', msgId)
      if (error) throw error
    } catch (e) {
      console.error('Edit error:', e)
      // Revert
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, content: oldContent, edited_at: null } : m
      ))
    }
  }

  /* ── DELETE message handlers ───────────────────────────────── */
  const confirmDelete = (msg) => {
    setDeleteConfirm(msg)
    setContextMenu(null)
  }

  const executeDelete = async () => {
    if (!deleteConfirm) return
    const msgId = deleteConfirm.id
    const oldMsg = { ...deleteConfirm }

    // Optimistic soft delete
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, is_deleted: true, content: '' } : m
    ))
    setDeleteConfirm(null)

    try {
      const { error } = await supabase
        .from('cng_messages')
        .update({ is_deleted: true, content: '' })
        .eq('id', msgId)
      if (error) throw error
    } catch (e) {
      console.error('Delete error:', e)
      // Revert
      setMessages(prev => prev.map(m =>
        m.id === msgId ? oldMsg : m
      ))
    }
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
          .insert({ type: 'direct' })
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

  /* ── Cálculos de Interfaz Dinámica (DM vs Grupo) ───────────── */
  const isGroup = conversation?.type === 'group'

  const displayAvatar = isGroup ? conversation?.avatar_url : otherUser?.avatar_url
  const displayName = isGroup
    ? (conversation?.name || 'Grupo de CNG')
    : (otherUser?.full_name || otherUser?.ref_code || 'Chat')

  const initial = displayName[0]?.toUpperCase() || (isGroup ? 'G' : 'C')
  const subTitle = isGroup ? `${Object.keys(membersMap).length} miembros` : 'Online'

  const typists = Object.values(typingUsers)
  let typingText = ''
  if (typists.length === 1) typingText = `${typists[0]} está escribiendo...`
  else if (typists.length === 2) typingText = `${typists[0]} y ${typists[1]} están escribiendo...`
  else if (typists.length > 2) typingText = `Varios están escribiendo...`

  /* ── Render message content ─────────────────────────────────── */
  const renderContent = (msg, isMine) => {
    // Soft-deleted message
    if (msg.is_deleted) {
      return (
        <p style={{ fontSize: 13, fontFamily: FONT.body, fontStyle: 'italic', color: 'rgba(223,226,235,0.3)', lineHeight: 1.5 }}>
          🚫 Mensaje eliminado
        </p>
      )
    }

    // ── VIEW ONCE message ──
    if (msg.is_view_once) {
      const isMyMsg = msg.sender_id === user?.id
      const wasViewed = !!msg.viewed_once_at

      if (isMyMsg) {
        return (
          <div onClick={() => openViewOnce(msg)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 160 }}>
            <div style={{ width: 40, height: 40, borderRadius: 99, background: wasViewed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: wasViewed ? '2px solid rgba(255,255,255,0.15)' : '2px solid rgba(255,255,255,0.3)' }}>
              <Icon name={wasViewed ? 'visibility_off' : 'photo_camera'} size={20} style={{ color: wasViewed ? 'rgba(255,255,255,0.4)' : '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: 600, color: wasViewed ? 'rgba(255,255,255,0.5)' : '#fff' }}>{msg.message_type === 'video' ? 'Video' : 'Foto'} · Ver una vez</p>
              <p style={{ fontSize: 11, fontFamily: FONT.body, color: wasViewed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)' }}>{wasViewed ? 'Abierto' : 'No abierto'}</p>
            </div>
          </div>
        )
      }

      if (wasViewed) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
            <div style={{ width: 40, height: 40, borderRadius: 99, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(223,226,235,0.15)' }}>
              <Icon name="visibility_off" size={20} style={{ color: 'rgba(223,226,235,0.25)' }} />
            </div>
            <p style={{ fontSize: 13, fontFamily: FONT.body, fontStyle: 'italic', color: 'rgba(223,226,235,0.35)' }}>{msg.message_type === 'video' ? 'Video' : 'Foto'} · Ya visto</p>
          </div>
        )
      }

      return (
        <div onClick={() => openViewOnce(msg)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 160 }}>
          <div style={{ width: 44, height: 44, borderRadius: 99, background: 'linear-gradient(135deg, #1D9E75, #68dbae)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(29,158,117,0.4)', animation: 'pulseGlow 2s infinite' }}>
            <Icon name={msg.message_type === 'video' ? 'videocam' : 'photo_camera'} size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontFamily: FONT.body, fontWeight: 600, color: C.text }}>{msg.message_type === 'video' ? 'Video' : 'Foto'} · Ver una vez</p>
            <p style={{ fontSize: 11, fontFamily: FONT.body, color: C.primaryBright }}>Toca para abrir</p>
          </div>
          <style>{`@keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 16px rgba(29,158,117,0.4); } 50% { box-shadow: 0 0 24px rgba(29,158,117,0.7); } }`}</style>
        </div>
      )
    }

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
    if (msg.message_type === 'document') {
      const fileName = msg.content || 'Documento'
      const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE'
      return (
        <div
          onClick={() => window.open(msg.media_url, '_blank')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 200 }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(104,219,174,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="description" size={24} style={{ color: isMine ? '#fff' : C.primary }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
            <p style={{ fontSize: 11, fontFamily: FONT.body, color: isMine ? 'rgba(255,255,255,0.5)' : C.textDim }}>{ext} · Toca para abrir</p>
          </div>
          <Icon name="download" size={20} style={{ color: isMine ? 'rgba(255,255,255,0.6)' : C.textDim, flexShrink: 0 }} />
        </div>
      )
    }
    if (msg.message_type === 'location') {
      let lat, lng
      try { const loc = JSON.parse(msg.content); lat = loc.lat; lng = loc.lng } catch { lat = 0; lng = 0 }
      const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`
      const linkUrl = `https://www.google.com/maps?q=${lat},${lng}`
      return (
        <div style={{ minWidth: 220 }}>
          <div style={{ width: '100%', height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 8, background: '#1a1a2e' }}>
            <iframe src={mapUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Location" loading="lazy" />
          </div>
          <div
            onClick={() => window.open(linkUrl, '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Icon name="location_on" size={18} style={{ color: isMine ? '#fff' : C.primary }} />
            <p style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: 600 }}>Ubicación compartida</p>
            <Icon name="open_in_new" size={14} style={{ color: isMine ? 'rgba(255,255,255,0.5)' : C.textDim, marginLeft: 'auto' }} />
          </div>
        </div>
      )
    }
    return <p style={{ fontSize: 14, fontFamily: FONT.body, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
  }

  /* ── Check if currently in edit mode ────────────────────────── */
  const isEditing = !!editingMsg

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 64, ...GLASS_NAV, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', padding: 8, borderRadius: 99, display: 'flex' }}>
          <Icon name="arrow_back" size={24} style={{ color: C.textDim }} />
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>{initial}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text }}>{displayName}</h1>
          <p style={{ fontSize: 11, color: isGroup ? C.textDim : C.primaryBright }}>{subTitle}</p>
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
            <Icon name={isGroup ? 'groups' : 'waving_hand'} size={48} style={{ color: C.textFaint, marginBottom: 16 }} />
            <p style={{ color: C.textDim, fontSize: 14, fontFamily: FONT.body }}>
              {isGroup ? `Inicia la conversación en ${displayName}!` : `Say hello to ${displayName}!`}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id
          const msgReactions = reactions[msg.id] || []
          const reactionCounts = {}
          msgReactions.forEach(r => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1 })
          const hasReactions = Object.keys(reactionCounts).length > 0
          const repliedMsg = msg.reply_to_id ? messagesMap[msg.reply_to_id] : null
          const isForwarded = (() => {
            try { return msg.metadata && JSON.parse(msg.metadata)?.forwarded } catch { return false }
          })()
          const isDeleted = msg.is_deleted

          return (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el }} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>

              {/* Etiqueta de remitente para grupos */}
              {isGroup && !isMine && !isDeleted && (
                <span style={{ fontSize: 11, color: C.primary, fontWeight: 600, marginLeft: 12, marginBottom: 2, fontFamily: FONT.headline }}>
                  {membersMap[msg.sender_id]?.full_name?.split(' ')[0] || 'Miembro'}
                </span>
              )}

              <div
                style={{ position: 'relative', maxWidth: '75%' }}
                onPointerDown={() => handleMsgPointerDown(msg.id, isMine && !isDeleted)}
                onPointerUp={handleMsgPointerUp}
                onPointerLeave={handleMsgPointerUp}
                onContextMenu={(e) => handleContextMenuEvent(e, msg.id, isMine && !isDeleted)}
              >
                <div style={{
                  padding: !isDeleted && (msg.message_type === 'image' || msg.message_type === 'video') ? 4 : '12px 16px',
                  borderRadius: 16,
                  borderBottomRightRadius: isMine ? 4 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 4,
                  background: isDeleted
                    ? 'rgba(255,255,255,0.03)'
                    : (isMine ? GRADIENT.primary : C.surfaceHigh),
                  color: isMine ? '#fff' : C.text,
                  border: isDeleted ? '1px solid rgba(241,239,232,0.06)' : 'none',
                }}>
                  {/* Story reply reference */}
                  {msg.story_id && !isDeleted && (
                    <StoryReplyBadge storyId={msg.story_id} isMine={isMine} />
                  )}
                  {/* Forwarded label */}
                  {isForwarded && !isDeleted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, opacity: 0.7 }}>
                      <Icon name="shortcut" size={12} style={{ color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim }} />
                      <span style={{ fontSize: 11, fontStyle: 'italic', color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: FONT.body }}>Forwarded</span>
                    </div>
                  )}
                  {/* Reply preview */}
                  {repliedMsg && !isDeleted && (
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
                          {repliedMsg.sender_id === user?.id ? 'You' : (membersMap[repliedMsg.sender_id]?.full_name || 'User')}
                        </p>
                        <p style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {repliedMsg.message_type === 'image' ? '📷 Photo' : repliedMsg.message_type === 'video' ? '🎬 Video' : repliedMsg.message_type === 'voice' ? '🎙️ Voice' : repliedMsg.content}
                        </p>
                      </div>
                    </div>
                  )}
                  {renderContent(msg, isMine)}
                  {!isDeleted && (
                    isMine ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4, padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>
                        {msg.edited_at && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginRight: 2 }}>editado</span>
                        )}
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{timeFormat(msg.created_at)}</span>
                        <DeliveryStatus status={msg.delivery_status || 'sent'} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>
                        {msg.edited_at && (
                          <span style={{ fontSize: 10, color: 'rgba(223,226,235,0.35)', fontStyle: 'italic', marginRight: 2 }}>editado</span>
                        )}
                        <span style={{ fontSize: 10, color: C.textFaint }}>{timeFormat(msg.created_at)}</span>
                      </div>
                    )
                  )}
                </div>

                {/* ── Context Menu (Edit/Delete) for OWN messages ─── */}
                {contextMenu && contextMenu.msgId === msg.id && isMine && !isDeleted && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...POPUP_STYLE,
                      bottom: '100%',
                      right: 0,
                      marginBottom: 8,
                      padding: 4,
                      minWidth: 160,
                      borderRadius: 12,
                    }}
                  >
                    {/* Edit option — only for text messages */}
                    {msg.message_type === 'text' && (
                      <div
                        onClick={() => startEdit(msg)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon name="edit" size={18} style={{ color: C.text }} />
                        <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Editar</span>
                      </div>
                    )}
                    {/* Reply option */}
                    <div
                      onClick={() => { handleReply(msg); setContextMenu(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="reply" size={18} style={{ color: C.text }} />
                      <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Responder</span>
                    </div>
                    {/* Forward option */}
                    <div
                      onClick={() => { handleForwardOpen(msg); setContextMenu(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="shortcut" size={18} style={{ color: C.text }} />
                      <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Reenviar</span>
                    </div>
                    {/* Separator */}
                    <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '2px 12px' }} />
                    {/* Delete option */}
                    <div
                      onClick={() => confirmDelete(msg)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="delete" size={18} style={{ color: '#ff4444' }} />
                      <span style={{ fontSize: 14, color: '#ff4444', fontFamily: FONT.body }}>Eliminar</span>
                    </div>
                  </div>
                )}

                {/* Reaction + actions popup (for OTHER people's messages) */}
                {reactionPopup === msg.id && !isMine && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...POPUP_STYLE,
                      bottom: '100%',
                      left: 0,
                      marginBottom: 8,
                      padding: 0,
                      minWidth: 220,
                      transform: reactionPopupAnim ? 'scale(1)' : 'scale(0.8)',
                      opacity: reactionPopupAnim ? 1 : 0,
                      transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                      transformOrigin: 'bottom left',
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

                {/* Reaction popup for OWN messages (shown via reaction popup, not context menu) */}
                {reactionPopup === msg.id && isMine && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...POPUP_STYLE,
                      bottom: '100%',
                      right: 0,
                      marginBottom: 8,
                      padding: 0,
                      minWidth: 220,
                      transform: reactionPopupAnim ? 'scale(1)' : 'scale(0.8)',
                      opacity: reactionPopupAnim ? 1 : 0,
                      transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                      transformOrigin: 'bottom right',
                    }}
                  >
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
                    <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '0 12px' }} />
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
                  {Object.entries(reactionCounts).map(([emoji, count]) => {
                    const myReaction = msgReactions.some(r => r.user_id === user?.id && r.emoji === emoji)
                    return (
                      <span
                        key={emoji}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 12,
                          background: myReaction ? 'rgba(104,219,174,0.15)' : C.surfaceHigh,
                          border: myReaction ? `1px solid ${C.primary}` : `1px solid ${C.outlineVariant}`,
                          borderRadius: 99,
                          padding: '2px 8px',
                          color: C.text,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleReact(msg.id, emoji)}
                      >
                        {emoji} {count > 1 && <span style={{ fontSize: 10, color: C.textDim }}>{count}</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Indicador de escribiendo (Múltiple) */}
        {typists.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', alignSelf: 'flex-start' }}>
            <p style={{ fontSize: 12, color: C.textDim, fontFamily: FONT.body, fontStyle: 'italic' }}>
              {typingText}
            </p>
            <div style={{ display: 'flex', gap: 3 }}>
              <span style={{ width: 4, height: 4, background: C.textDim, borderRadius: 99, animation: 'bounce 1.4s infinite ease-in-out both' }} />
              <span style={{ width: 4, height: 4, background: C.textDim, borderRadius: 99, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
              <span style={{ width: 4, height: 4, background: C.textDim, borderRadius: 99, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
            </div>
            <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }`}</style>
          </div>
        )}

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
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 358,
            background: 'rgba(13,17,23,0.97)',
            border: '1px solid rgba(241,239,232,0.1)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            zIndex: 300,
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
      {/* Hidden file input — View Once */}
      <input
        ref={viewOnceFileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleViewOnceFileSelect}
      />
      {/* Hidden file input — Documents */}
      <input
        ref={docFileInputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={handleDocFileSelect}
      />

      {/* ══ VIEW ONCE fullscreen viewer ═══════════════════════ */}
      {viewOnceViewer && (
        <div onClick={closeViewOnce} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 99, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="44" height="44" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="#68dbae" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 18}`} strokeDashoffset={`${2 * Math.PI * 18 * (1 - viewOnceCountdown / 5)}`} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: FONT.headline, zIndex: 1 }}>{viewOnceCountdown}</span>
            </div>
            <div onClick={(e) => { e.stopPropagation(); closeViewOnce() }} style={{ width: 40, height: 40, borderRadius: 99, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="close" size={24} style={{ color: '#fff' }} />
            </div>
          </div>
          <div style={{ position: 'absolute', top: 28, left: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="timer" size={18} style={{ color: '#68dbae' }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: FONT.body }}>Ver una vez</span>
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '75vh' }}>
            {viewOnceViewer.message_type === 'video'
              ? <video src={viewOnceViewer.media_url} autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 16 }} />
              : <img src={viewOnceViewer.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 16, objectFit: 'contain' }} />
            }
          </div>
          <p style={{ position: 'absolute', bottom: 30, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.body }}>
            {viewOnceViewer.sender_id === user?.id ? 'Tu foto' : membersMap[viewOnceViewer.sender_id]?.full_name || 'Miembro'}
          </p>
        </div>
      )}

      {/* ── Attach menu popup (normal + view once) ───────────── */}
      {showAttachMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', bottom: 80, left: 16, background: 'rgba(13,17,23,0.97)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 16, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 300, padding: 4, minWidth: 200 }}>
          <div onClick={() => { setShowAttachMenu(false); setTimeout(() => fileInputRef.current?.click(), 300) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(104,219,174,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="photo_library" size={20} style={{ color: C.primaryBright }} /></div>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>Foto o Video</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Envío normal</p></div>
          </div>
          <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
          <div onClick={() => { setShowAttachMenu(false); setTimeout(() => viewOnceFileInputRef.current?.click(), 300) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="timer" size={20} style={{ color: '#e7c092' }} /></div>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>Ver una vez</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Se autodestruye al verla</p></div>
          </div>
          <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
          <div onClick={() => docFileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(140,132,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="description" size={20} style={{ color: '#c5c0ff' }} /></div>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>Documento</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>PDF, Word, Excel, etc.</p></div>
          </div>
          <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
          <div onClick={handleSendLocation} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: locationLoading ? 'wait' : 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(255,100,100,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="location_on" size={20} style={{ color: '#ff6b6b' }} /></div>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>{locationLoading ? 'Obteniendo...' : 'Ubicación'}</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Comparte tu ubicación actual</p></div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────── */}
      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'rgba(13,17,23,0.97)',
              borderRadius: 20,
              border: '1px solid rgba(241,239,232,0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '28px 24px 20px',
              textAlign: 'center',
            }}
          >
            <Icon name="delete" size={40} style={{ color: '#ff4444', marginBottom: 12 }} />
            <h3 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>¿Eliminar mensaje?</h3>
            <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body, marginBottom: 24, lineHeight: 1.5 }}>
              Este mensaje será eliminado para todos los participantes de la conversación.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT.body,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                Cancelar
              </div>
              <div
                onClick={executeDelete}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: '#ff4444',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT.body,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e03030' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ff4444' }}
              >
                Eliminar
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && !isEditing && (
        <div style={{ padding: '8px 16px', background: 'rgba(13,17,23,0.8)', borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 36, borderRadius: 2, background: C.primary, flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.primary, fontFamily: FONT.headline }}>
              {replyTo.sender_id === user?.id ? 'You' : (membersMap[replyTo.sender_id]?.full_name || 'User')}
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

      {/* Edit bar */}
      {isEditing && (
        <div style={{ padding: '8px 16px', background: 'rgba(13,17,23,0.8)', borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 36, borderRadius: 2, background: '#B8956A', flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B8956A', fontFamily: FONT.headline }}>Editando mensaje</p>
            <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {editingMsg.content}
            </p>
          </div>
          <div onClick={cancelEdit} style={{ cursor: 'pointer', padding: 4 }}>
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
        {/* Attach — opens menu with normal + view once */}
        {!isEditing && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowAttachMenu(v => !v); setShowStickers(false) }}
            style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Icon name="attach_file" size={22} style={{ color: showAttachMenu ? C.primary : C.textDim }} />
          </div>
        )}

        {/* Stickers — hide during edit */}
        {!isEditing && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowStickers(v => !v) }}
            style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Icon name="emoji_emotions" size={22} style={{ color: showStickers ? C.primary : C.textDim }} />
          </div>
        )}

        {/* Cancel edit button */}
        {isEditing && (
          <div
            onClick={cancelEdit}
            style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}
          >
            <Icon name="close" size={22} style={{ color: C.textDim }} />
          </div>
        )}

        {/* Text input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            placeholder={isEditing ? 'Editar mensaje...' : 'Type a message...'}
            value={isEditing ? editText : text}
            onChange={isEditing ? (e) => setEditText(e.target.value) : handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (isEditing) saveEdit()
                else handleSend()
              }
              if (e.key === 'Escape' && isEditing) cancelEdit()
            }}
            style={{
              width: '100%',
              background: isEditing ? 'rgba(184,149,106,0.08)' : 'rgba(255,255,255,0.05)',
              border: isEditing ? '1px solid rgba(184,149,106,0.3)' : 'none',
              borderRadius: 24,
              padding: '12px 16px',
              color: C.text,
              fontSize: 14,
              fontFamily: FONT.body,
              outline: 'none',
            }}
          />
        </div>

        {/* Save (edit mode) / Send / Mic */}
        {isEditing ? (
          <div
            onClick={saveEdit}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: editText.trim() ? 'linear-gradient(135deg, #B8956A, #e7c092)' : C.surfaceHigh,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: editText.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <Icon name="check" size={22} style={{ color: editText.trim() ? '#fff' : C.textFaint }} />
          </div>
        ) : text.trim() ? (
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