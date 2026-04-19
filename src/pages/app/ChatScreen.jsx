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

/* ── File size limits (matching WhatsApp) ─────────────────────── */
const SIZE_LIMITS = {
  image: 16 * 1024 * 1024,       // 16 MB
  video: 16 * 1024 * 1024,       // 16 MB
  voice: 16 * 1024 * 1024,       // 16 MB
  document: 100 * 1024 * 1024,   // 100 MB
  groupAvatar: 5 * 1024 * 1024,  //  5 MB
}

const SIZE_LIMIT_LABELS = {
  image: '16 MB',
  video: '16 MB',
  voice: '16 MB',
  document: '100 MB',
  groupAvatar: '5 MB',
}

function validateFileSize(file, type) {
  const limit = SIZE_LIMITS[type]
  if (!limit) return { ok: true }
  const size = typeof file?.size === 'number' ? file.size : 0
  if (size > limit) {
    return { ok: false, message: `Archivo demasiado grande. Máximo: ${SIZE_LIMIT_LABELS[type]}` }
  }
  return { ok: true }
}

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
  if (status === 'failed') return <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ff4444', verticalAlign: 'middle', lineHeight: 1 }}>error</span>
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

/* ── PollCard component ─────────────────────────────────── */
function PollCard({ pollId, conversationId, userId, isMine, pollsCache, setPollsCache, pollVotesCache, setPollVotesCache }) {
  const [poll, setPoll] = useState(pollsCache[pollId] || null)
  const [votes, setVotes] = useState(pollVotesCache[pollId] || [])
  const [loaded, setLoaded] = useState(!!pollsCache[pollId])

  useEffect(() => {
    if (pollsCache[pollId]) { setPoll(pollsCache[pollId]); setVotes(pollVotesCache[pollId] || []); setLoaded(true); return }
    const load = async () => {
      try {
        const { data: p } = await supabase.from('cng_polls').select('*').eq('id', pollId).single()
        const { data: v } = await supabase.from('cng_poll_votes').select('*').eq('poll_id', pollId)
        setPoll(p)
        setVotes(v || [])
        setPollsCache(prev => ({ ...prev, [pollId]: p }))
        setPollVotesCache(prev => ({ ...prev, [pollId]: v || [] }))
      } catch (e) { console.error('Poll load error:', e) }
      finally { setLoaded(true) }
    }
    load()
  }, [pollId])

  const handleVote = async (optionIndex) => {
    if (!userId || !poll) return
    const existing = votes.find(v => v.user_id === userId && v.option_index === optionIndex)
    if (existing) {
      // Toggle off
      const newVotes = votes.filter(v => v.id !== existing.id)
      setVotes(newVotes)
      setPollVotesCache(prev => ({ ...prev, [pollId]: newVotes }))
      await supabase.from('cng_poll_votes').delete().eq('id', existing.id)
    } else {
      // If not multiple choice, remove old vote first
      let newVotes = votes
      if (!poll.is_multiple_choice) {
        const oldVote = votes.find(v => v.user_id === userId)
        if (oldVote) {
          newVotes = votes.filter(v => v.id !== oldVote.id)
          await supabase.from('cng_poll_votes').delete().eq('id', oldVote.id)
        }
      }
      const tempVote = { id: 'temp-' + Date.now(), poll_id: pollId, user_id: userId, option_index: optionIndex }
      newVotes = [...newVotes, tempVote]
      setVotes(newVotes)
      setPollVotesCache(prev => ({ ...prev, [pollId]: newVotes }))
      const { data } = await supabase.from('cng_poll_votes').insert({ poll_id: pollId, user_id: userId, option_index: optionIndex }).select().single()
      if (data) {
        const updated = newVotes.map(v => v.id === tempVote.id ? data : v)
        setVotes(updated)
        setPollVotesCache(prev => ({ ...prev, [pollId]: updated }))
      }
    }
  }

  if (!loaded) return <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body }}>Cargando encuesta...</p>
  if (!poll) return <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body }}>Encuesta no disponible</p>

  const totalVotes = votes.length
  const options = poll.options || []

  return (
    <div style={{ minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon name="poll" size={16} style={{ color: '#64B5F6' }} />
        <span style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : C.textDim, fontFamily: FONT.body, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Encuesta</span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT.headline, marginBottom: 10, color: isMine ? '#fff' : C.text }}>{poll.question}</p>
      {options.map((opt, idx) => {
        const optVotes = votes.filter(v => v.option_index === idx).length
        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0
        const myVote = votes.some(v => v.user_id === userId && v.option_index === idx)
        return (
          <div
            key={idx}
            onClick={() => handleVote(idx)}
            style={{
              position: 'relative', padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', overflow: 'hidden',
              border: myVote ? '1px solid ' + C.primary : '1px solid rgba(241,239,232,0.1)',
              background: myVote ? 'rgba(104,219,174,0.1)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(104,219,174,0.08)', borderRadius: 10, transition: 'width 0.3s' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontFamily: FONT.body, color: isMine ? '#fff' : C.text }}>{opt}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: isMine ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: FONT.body }}>{pct}%</span>
            </div>
          </div>
        )
      })}
      <p style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.5)' : C.textFaint, fontFamily: FONT.body, marginTop: 4 }}>{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</p>
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

  // ─── HEADER MENU, MUTE, BLOCK, PIN, ARCHIVE, REPORT ────
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // ─── FEATURE 1: SEARCH IN CHAT ──────────────────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchIndex, setSearchIndex] = useState(0)

  // ─── FEATURE 2 & 3: GROUP INFO MODAL ────────────────────
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionText, setDescriptionText] = useState('')
  const groupAvatarInputRef = useRef(null)

  // ─── FEATURE 4: STARRED MESSAGES ────────────────────────
  const [starredSet, setStarredSet] = useState(new Set())
  const [deletedForMeSet, setDeletedForMeSet] = useState(new Set())
  const [showStarredModal, setShowStarredModal] = useState(false)

  // ─── FEATURE 6: GIF PICKER ──────────────────────────────
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)

  // ─── FEATURE 7: QUICK REPLIES ───────────────────────────
  const [inputFocused, setInputFocused] = useState(false)

  // ─── FEATURE 8: POLLS ───────────────────────────────────
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollMultiple, setPollMultiple] = useState(false)
  const [pollCreating, setPollCreating] = useState(false)
  const [pollsCache, setPollsCache] = useState({})
  const [pollVotesCache, setPollVotesCache] = useState({})

  // ─── CHILLIUMS TRANSFER ──────────────────────────────────
  const [showChilliumsModal, setShowChilliumsModal] = useState(false)
  const [chilliumsAmount, setChilliumsAmount] = useState('')
  const [chilliumsSending, setChilliumsSending] = useState(false)
  const [myChilliumsBalance, setMyChilliumsBalance] = useState(0)

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

  /* ── Feature 1: Search in chat (debounced) ────────────── */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchIndex(0); return }
    const timer = setTimeout(() => {
      const q = searchQuery.toLowerCase()
      const ids = messages
        .filter(m => !m.is_deleted && m.message_type === 'text' && m.content?.toLowerCase().includes(q))
        .map(m => m.id)
      setSearchResults(ids)
      setSearchIndex(0)
      if (ids.length > 0) scrollToMessage(ids[0])
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, messages])

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
          .from('identity_profiles')
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

      // Fetch muted/pinned/cleared_at status
      const { data: myMembership } = await supabase
        .from('cng_conversation_members')
        .select('is_muted, is_pinned, cleared_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (myMembership) {
        setIsMuted(!!myMembership.is_muted)
        setIsPinned(!!myMembership.is_pinned)
      }

      // Fetch blocked status (DMs only)
      if ((convData?.type === 'dm' || convData?.type === 'direct') && userIds.length > 0) {
        const otherId = userIds.find(id => id !== user.id)
        if (otherId) {
          const { data: blockRow } = await supabase
            .from('cng_blocked_users')
            .select('id')
            .eq('blocker_id', user.id)
            .eq('blocked_id', otherId)
            .maybeSingle()
          setIsBlocked(!!blockRow)
        }
      }

      let msgsQuery = supabase
        .from('cng_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (myMembership?.cleared_at) {
        msgsQuery = msgsQuery.gt('created_at', myMembership.cleared_at)
      }
      const { data: msgs, error } = await msgsQuery

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

  /* ── Feature 4: Fetch starred messages ─────────────────── */
  useEffect(() => {
    if (!conversationId || !user) return
    supabase
      .from('cng_starred_messages')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId)
      .then(({ data }) => {
        if (data) setStarredSet(new Set(data.map(d => d.message_id)))
      })
  }, [conversationId, user])

  /* ── Fetch messages deleted "only for me" ─────────────── */
  useEffect(() => {
    if (!conversationId || !user) return
    supabase
      .from('cng_deleted_messages')
      .select('message_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setDeletedForMeSet(new Set(data.map(d => d.message_id)))
      })
  }, [conversationId, user])

  const handleToggleStar = async (msgId) => {
    const isStarred = starredSet.has(msgId)
    // Optimistic
    setStarredSet(prev => {
      const next = new Set(prev)
      if (isStarred) next.delete(msgId)
      else next.add(msgId)
      return next
    })
    setContextMenu(null)
    closeReactionPopup()
    try {
      if (isStarred) {
        await supabase.from('cng_starred_messages').delete()
          .eq('user_id', user.id).eq('message_id', msgId)
      } else {
        await supabase.from('cng_starred_messages').insert({
          user_id: user.id, message_id: msgId, conversation_id: conversationId
        })
      }
    } catch (e) {
      console.error('Star toggle error:', e)
      // Revert
      setStarredSet(prev => {
        const next = new Set(prev)
        if (isStarred) next.add(msgId)
        else next.delete(msgId)
        return next
      })
    }
  }

  /* ── Feature 2: Group avatar upload ────────────────────── */
  const handleGroupAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user || !conversation) return
    e.target.value = ''
    const check = validateFileSize(file, 'groupAvatar')
    if (!check.ok) {
      showToast(check.message)
      return
    }
    setGroupAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `groups/${conversationId}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('cng-media').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
      const { error } = await supabase.from('cng_conversations').update({ avatar_url: urlData.publicUrl }).eq('id', conversationId)
      if (error) throw error
      setConversation(prev => ({ ...prev, avatar_url: urlData.publicUrl }))
    } catch (e) {
      console.error('Group avatar error:', e)
      showToast('Error al subir avatar. Intenta de nuevo.')
    }
    finally { setGroupAvatarUploading(false) }
  }

  /* ── Feature 3: Group description save ─────────────────── */
  const handleSaveDescription = async () => {
    if (!conversation) return
    try {
      const { error } = await supabase.from('cng_conversations')
        .update({ description: descriptionText.trim() })
        .eq('id', conversationId)
      if (error) throw error
      setConversation(prev => ({ ...prev, description: descriptionText.trim() }))
      setEditingDescription(false)
    } catch (e) { console.error('Description save error:', e) }
  }

  /* ── Feature 6: GIF fetch ──────────────────────────────── */
  useEffect(() => {
    if (!showGifPicker) return
    setGifLoading(true)
    fetch('https://api.giphy.com/v1/gifs/trending?api_key=q8Rtsy1zkVHLimn85hhF1TQPNJvIqdoH&limit=20&rating=g')
      .then(r => r.json())
      .then(d => setGifResults(d.data || []))
      .catch((err) => { console.error('GIPHY fetch error:', err); setGifResults([]) })
      .finally(() => setGifLoading(false))
  }, [showGifPicker])

  useEffect(() => {
    if (!showGifPicker || !gifSearch.trim()) return
    const timer = setTimeout(() => {
      setGifLoading(true)
      fetch(`https://api.giphy.com/v1/gifs/search?api_key=q8Rtsy1zkVHLimn85hhF1TQPNJvIqdoH&q=${encodeURIComponent(gifSearch)}&limit=20&rating=g`)
        .then(r => r.json())
        .then(d => setGifResults(d.data || []))
        .catch((err) => { console.error('GIPHY fetch error:', err); setGifResults([]) })
        .finally(() => setGifLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [gifSearch, showGifPicker])

  const sendGif = async (gif) => {
    setShowGifPicker(false)
    setGifSearch('')
    const url = gif.images?.original?.url
    if (!url || !user) return
    try {
      const { data: newMsg, error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: url,
        message_type: 'image',
        media_url: url,
        delivery_status: 'sent',
      }).select().single()
      if (error) throw error
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      scrollToBottom()
    } catch (e) { console.error('GIF send error:', e) }
  }

  /* ── Feature 8: Poll creation ──────────────────────────── */
  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || pollCreating) return
    setPollCreating(true)
    try {
      const validOptions = pollOptions.filter(o => o.trim()).map(o => o.trim())
      const { data: poll, error: pollErr } = await supabase.from('cng_polls').insert({
        conversation_id: conversationId,
        created_by: user.id,
        question: pollQuestion.trim(),
        options: validOptions,
        is_multiple_choice: pollMultiple,
      }).select().single()
      if (pollErr) throw pollErr
      const { data: newMsg, error: msgErr } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: poll.id,
        message_type: 'poll',
        delivery_status: 'sent',
      }).select().single()
      if (msgErr) throw msgErr
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      setShowPollModal(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setPollMultiple(false)
      scrollToBottom()
    } catch (e) { console.error('Poll creation error:', e) }
    finally { setPollCreating(false) }
  }

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
    if (!reactionPopup && !showStickers && !contextMenu && !showAttachMenu && !showGifPicker) return
    const handler = () => { closeReactionPopup(); setShowStickers(false); setContextMenu(null); setShowAttachMenu(false); setShowGifPicker(false) }
    const timer = setTimeout(() => document.addEventListener('click', handler), 300)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [reactionPopup, showStickers, contextMenu])

  /* ── Close header menu on outside click ──────────────────── */
  useEffect(() => {
    if (!showHeaderMenu) return
    const handler = () => setShowHeaderMenu(false)
    const timer = setTimeout(() => document.addEventListener('click', handler), 10)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [showHeaderMenu])

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
      // Keep the message visible but flagged as failed so the user can retry
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, delivery_status: 'failed' } : m
      ))
    } finally {
      setSending(false)
    }
  }

  const handleRetryMessage = async (failedMsg) => {
    if (!failedMsg || !user) return
    setMessages(prev => prev.map(m =>
      m.id === failedMsg.id ? { ...m, delivery_status: 'sending' } : m
    ))
    try {
      const row = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: failedMsg.content,
        message_type: failedMsg.message_type,
        delivery_status: 'sent',
      }
      if (failedMsg.reply_to_id) row.reply_to_id = failedMsg.reply_to_id
      if (failedMsg.media_url) row.media_url = failedMsg.media_url
      if (failedMsg.is_view_once) row.is_view_once = failedMsg.is_view_once

      const { data, error } = await supabase.from('cng_messages').insert(row).select().single()
      if (error) throw error

      setMessages(prev => {
        const hasReal = prev.some(m => m.id === data.id)
        if (hasReal) return prev.filter(m => m.id !== failedMsg.id)
        return prev.map(m => m.id === failedMsg.id ? data : m)
      })
    } catch (e) {
      console.error('Retry error:', e)
      setMessages(prev => prev.map(m =>
        m.id === failedMsg.id ? { ...m, delivery_status: 'failed' } : m
      ))
      showToast('No se pudo enviar. Verifica tu conexión.')
    }
  }

  /* ── Send media (image/video) ───────────────────────────────── */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    const isVideo = file.type.startsWith('video/')
    const check = validateFileSize(file, isVideo ? 'video' : 'image')
    if (!check.ok) {
      showToast(check.message)
      return
    }
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
      showToast('Error al subir archivo. Intenta de nuevo.')
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

        const check = validateFileSize(blob, 'voice')
        if (!check.ok) {
          showToast(check.message)
          return
        }

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
          showToast('Error al subir audio. Intenta de nuevo.')
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
    const isVideo = file.type.startsWith('video/')
    const check = validateFileSize(file, isVideo ? 'video' : 'image')
    if (!check.ok) {
      showToast(check.message)
      return
    }
    setShowAttachMenu(false)
    setUploading(true)
    try {
      const path = `messages/${conversationId}/viewonce-${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('cng-media').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
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
    } catch (e) {
      console.error('View once upload error:', e)
      showToast('Error al subir archivo. Intenta de nuevo.')
    }
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
    const check = validateFileSize(file, 'document')
    if (!check.ok) {
      showToast(check.message)
      return
    }
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
    } catch (e) {
      console.error('Doc upload error:', e)
      showToast('Error al subir archivo. Intenta de nuevo.')
    }
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

  /* ── Send Chilliums ──────────────────────────────────────────── */
  const openChilliumsModal = async () => {
    setShowAttachMenu(false)
    setChilliumsAmount('')
    setChilliumsSending(false)
    try {
      const { data } = await supabase.from('identity_profiles').select('chilliums_balance').eq('user_id', user.id).single()
      setMyChilliumsBalance(data?.chilliums_balance || 0)
    } catch { setMyChilliumsBalance(0) }
    setShowChilliumsModal(true)
  }

  const handleSendChilliums = async () => {
    const amount = Math.round(parseFloat(chilliumsAmount) * 100) / 100
    if (!amount || amount < 0.01 || !otherUser || !user) return
    setChilliumsSending(true)
    try {
      // a) Verify sender balance
      const { data: senderData } = await supabase.from('identity_profiles').select('chilliums_balance').eq('user_id', user.id).single()
      const senderBalance = senderData?.chilliums_balance || 0
      if (senderBalance < amount) { alert('Saldo insuficiente'); setChilliumsSending(false); return }

      // b) Debit sender
      const newSenderBalance = senderBalance - amount
      const { error: e1 } = await supabase.from('identity_profiles').update({ chilliums_balance: newSenderBalance }).eq('user_id', user.id)
      if (e1) throw e1

      // c) Ledger sender
      const senderName = membersMap[user.id]?.full_name || 'Usuario'
      const { error: e2 } = await supabase.from('chilliums_ledger').insert({
        user_id: user.id, amount: -amount, type: 'transfer_out',
        description: `Transferencia a ${otherUser.full_name}`,
        source_user_id: otherUser.user_id, balance_after: newSenderBalance
      })
      if (e2) throw e2

      // d) Credit recipient
      const { data: recData } = await supabase.from('identity_profiles').select('chilliums_balance').eq('user_id', otherUser.user_id).single()
      const recNewBalance = (recData?.chilliums_balance || 0) + amount
      const { data: recUpdate, error: e3 } = await supabase.from('identity_profiles').update({ chilliums_balance: recNewBalance }).eq('user_id', otherUser.user_id).select('user_id').single()
      if (e3) { console.error('Recipient balance update error:', e3); throw e3 }
      if (!recUpdate) console.error('Recipient balance update: 0 rows affected (RLS?). user_id:', otherUser.user_id)

      // e) Ledger recipient
      await supabase.from('chilliums_ledger').insert({
        user_id: otherUser.user_id, amount: amount, type: 'transfer_in',
        description: `Transferencia de ${senderName}`,
        source_user_id: user.id, balance_after: recNewBalance
      })

      // f) Send message in chat
      const msgContent = JSON.stringify({ amount, sender_name: senderName, recipient_name: otherUser.full_name })
      const tempId = 'temp-chilliums-' + Date.now()
      const optimistic = {
        id: tempId, conversation_id: conversationId, sender_id: user.id,
        content: msgContent, message_type: 'chilliums',
        created_at: new Date().toISOString(), delivery_status: 'sending',
      }
      setMessages(prev => [...prev, optimistic])
      scrollToBottom()

      const { data: msgData, error: msgErr } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId, sender_id: user.id,
        content: msgContent, message_type: 'chilliums', delivery_status: 'sent'
      }).select().single()
      if (msgErr) throw msgErr

      setMessages(prev => {
        const hasReal = prev.some(m => m.id === msgData.id)
        if (hasReal) return prev.filter(m => m.id !== tempId)
        return prev.map(m => m.id === tempId ? msgData : m)
      })

      // Refresh balance
      setMyChilliumsBalance(newSenderBalance)
      setShowChilliumsModal(false)
    } catch (e) {
      console.error('Chilliums send error:', e)
      alert('Error al enviar Chilliums: ' + (e.message || e))
    } finally {
      setChilliumsSending(false)
    }
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

  const executeDeleteForMe = async () => {
    if (!deleteConfirm) return
    const msgId = deleteConfirm.id

    // Optimistic
    setDeletedForMeSet(prev => new Set([...prev, msgId]))
    setDeleteConfirm(null)

    try {
      const { error } = await supabase
        .from('cng_deleted_messages')
        .insert({ message_id: msgId, user_id: user.id })
      if (error) throw error
    } catch (e) {
      console.error('Delete for me error:', e)
      setDeletedForMeSet(prev => {
        const next = new Set(prev)
        next.delete(msgId)
        return next
      })
      showToast('Error al eliminar')
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
        .from('identity_profiles')
        .select('user_id, full_name, ref_code, avatar_url, email')
        .neq('user_id', user.id)
        .or(`full_name.ilike.%${q}%,ref_code.ilike.%${q}%,email.ilike.%${q}%`)
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

  /* ── Toast helper ────────────────────────────────────────────── */
  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  /* ── Mute / Unmute ───────────────────────────────────────────── */
  const handleToggleMute = async () => {
    setShowHeaderMenu(false)
    const newVal = !isMuted
    setIsMuted(newVal)
    try {
      const { error } = await supabase
        .from('cng_conversation_members')
        .update({ is_muted: newVal })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
    } catch (e) {
      console.error('Mute error:', e)
      setIsMuted(!newVal)
    }
  }

  /* ── Pin / Unpin ─────────────────────────────────────────────── */
  const handleTogglePin = async () => {
    setShowHeaderMenu(false)
    const newVal = !isPinned
    setIsPinned(newVal)
    try {
      const { error } = await supabase
        .from('cng_conversation_members')
        .update({ is_pinned: newVal })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
    } catch (e) {
      console.error('Pin error:', e)
      setIsPinned(!newVal)
    }
  }

  /* ── Archive ─────────────────────────────────────────────────── */
  const handleArchive = async () => {
    setShowHeaderMenu(false)
    try {
      const { error } = await supabase
        .from('cng_conversation_members')
        .update({ is_archived: true })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
      onBack()
    } catch (e) {
      console.error('Archive error:', e)
    }
  }

  /* ── Block / Unblock ─────────────────────────────────────────── */
  const handleBlock = async () => {
    setShowBlockConfirm(false)
    const otherId = otherUser?.user_id
    if (!otherId) return
    try {
      const { error } = await supabase
        .from('cng_blocked_users')
        .insert({ blocker_id: user.id, blocked_id: otherId })
      if (error) throw error
      setIsBlocked(true)
    } catch (e) {
      console.error('Block error:', e)
    }
  }

  const handleUnblock = async () => {
    const otherId = otherUser?.user_id
    if (!otherId) return
    try {
      const { error } = await supabase
        .from('cng_blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', otherId)
      if (error) throw error
      setIsBlocked(false)
    } catch (e) {
      console.error('Unblock error:', e)
    }
  }

  /* ── Report ──────────────────────────────────────────────────── */
  const openReport = (target) => {
    setReportTarget(target)
    setReportReason('')
    setReportDetails('')
    setShowReportModal(true)
    setShowHeaderMenu(false)
    closeReactionPopup()
  }

  const handleSendReport = async () => {
    if (!reportReason || !reportTarget) return
    try {
      const row = {
        reporter_id: user.id,
        conversation_id: conversationId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      }
      if (reportTarget.userId) row.reported_user_id = reportTarget.userId
      if (reportTarget.messageId) row.message_id = reportTarget.messageId
      const { error } = await supabase.from('cng_reports').insert(row)
      if (error) throw error
      setShowReportModal(false)
      showToast('Reporte enviado. Gracias.')
    } catch (e) {
      console.error('Report error:', e)
    }
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
    // Feature 8: Poll rendering
    if (msg.message_type === 'poll') {
      return <PollCard pollId={msg.content} conversationId={conversationId} userId={user?.id} isMine={isMine} pollsCache={pollsCache} setPollsCache={setPollsCache} pollVotesCache={pollVotesCache} setPollVotesCache={setPollVotesCache} />
    }

    // ── Chilliums transfer message ──
    if (msg.message_type === 'chilliums') {
      let cData = {}
      try { cData = JSON.parse(msg.content) } catch { cData = {} }
      const cAmount = cData.amount || 0
      const cSender = cData.sender_name || ''
      const cRecipient = cData.recipient_name || ''
      return (
        <div style={{
          background: 'linear-gradient(135deg, rgba(184,149,106,0.15), rgba(231,192,146,0.08))',
          border: '1px solid rgba(184,149,106,0.25)',
          borderRadius: 16, padding: 16, textAlign: 'center', minWidth: 180,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#B8956A', display: 'block', marginBottom: 6 }}>monetization_on</span>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: FONT.headline, color: '#e7c092', margin: '4px 0' }}>{cAmount} Chilliums</p>
          <p style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.5)' : C.textDim, fontFamily: FONT.body }}>
            {isMine ? `Enviaste a ${cRecipient}` : `${cSender} te envió`}
          </p>
        </div>
      )
    }

    // Feature 5: Link preview for text messages
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const urls = msg.content?.match(urlRegex)
    const renderTextWithLinks = (text) => {
      if (!urls) return text
      const parts = text.split(urlRegex)
      return parts.map((part, i) => {
        if (urlRegex.lastIndex = 0, urlRegex.test(part)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isMine ? '#fff' : (C.primaryBright || '#68dbae'), textDecoration: 'underline' }}>{part}</a>
        }
        return part
      })
    }
    return (
      <div>
        <p style={{ fontSize: 14, fontFamily: FONT.body, lineHeight: 1.5, wordBreak: 'break-word' }}>{renderTextWithLinks(msg.content)}</p>
        {urls && urls.map((url, i) => {
          let domain = ''
          try { domain = new URL(url).hostname } catch { domain = url.substring(0, 30) }
          return (
            <div
              key={i}
              onClick={() => window.open(url, '_blank')}
              style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 12,
                border: '1px solid rgba(241,239,232,0.08)',
                padding: '10px 12px', marginTop: 8, cursor: 'pointer',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: isMine ? 'rgba(255,255,255,0.8)' : C.textDim, fontFamily: FONT.body, marginBottom: 2 }}>{domain}</p>
              <p style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.5)' : C.textFaint, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{url}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="open_in_new" size={12} style={{ color: isMine ? 'rgba(255,255,255,0.6)' : C.primaryBright }} />
                <span style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : C.primaryBright, fontFamily: FONT.body }}>Abrir enlace</span>
              </div>
            </div>
          )
        })}
      </div>
    )
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h1 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text }}>{displayName}</h1>
            {isMuted && <Icon name="notifications_off" size={14} style={{ color: C.textDim }} />}
          </div>
          <p style={{ fontSize: 11, color: isGroup ? C.textDim : C.primaryBright }}>{subTitle}</p>
        </div>
        <div onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(v => !v) }} style={{ cursor: 'pointer', padding: 8, borderRadius: 99, display: 'flex', position: 'relative' }}>
          <Icon name="more_vert" size={24} style={{ color: C.textDim }} />
        </div>
      </header>

      {/* ── Feature 1: Search bar ──────────────────────────── */}
      {showSearch && (
        <div style={{ position: 'sticky', top: 64, zIndex: 49, ...GLASS_NAV, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(241,239,232,0.08)' }}>
          <Icon name="search" size={20} style={{ color: C.textFaint, flexShrink: 0 }} />
          <input
            autoFocus
            placeholder="Buscar mensajes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none' }}
          />
          {searchResults.length > 0 && (
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body, flexShrink: 0 }}>
              {searchIndex + 1} de {searchResults.length}
            </span>
          )}
          {searchResults.length > 1 && (
            <>
              <div onClick={() => { const prev = (searchIndex - 1 + searchResults.length) % searchResults.length; setSearchIndex(prev); scrollToMessage(searchResults[prev]) }} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="keyboard_arrow_up" size={20} style={{ color: C.textDim }} />
              </div>
              <div onClick={() => { const next = (searchIndex + 1) % searchResults.length; setSearchIndex(next); scrollToMessage(searchResults[next]) }} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="keyboard_arrow_down" size={20} style={{ color: C.textDim }} />
              </div>
            </>
          )}
          <div onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }} style={{ cursor: 'pointer', padding: 4 }}>
            <Icon name="close" size={20} style={{ color: C.textDim }} />
          </div>
        </div>
      )}

      {/* ── Header dropdown menu ─────────────────────────────── */}
      {showHeaderMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...POPUP_STYLE,
            position: 'fixed',
            top: 56,
            right: 12,
            zIndex: 200,
            padding: 4,
            minWidth: 220,
          }}
        >
          {/* 1. Buscar en chat */}
          <div
            onClick={() => { setShowHeaderMenu(false); setShowSearch(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name="search" size={18} style={{ color: C.text }} />
            <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Buscar en chat</span>
          </div>
          {/* 2. Mensajes destacados */}
          <div
            onClick={() => { setShowHeaderMenu(false); setShowStarredModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name="star" size={18} style={{ color: C.text }} />
            <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Mensajes destacados</span>
          </div>
          {/* 3. Info del grupo (only groups) */}
          {isGroup && (
            <div
              onClick={() => { setShowHeaderMenu(false); setDescriptionText(conversation?.description || ''); setShowGroupInfo(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Icon name="info" size={18} style={{ color: C.text }} />
              <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Info del grupo</span>
            </div>
          )}
          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '2px 12px' }} />
          {/* 4. Silenciar / Activar */}
          <div
            onClick={handleToggleMute}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name={isMuted ? 'notifications_active' : 'notifications_off'} size={18} style={{ color: C.text }} />
            <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>{isMuted ? 'Activar notificaciones' : 'Silenciar'}</span>
          </div>
          {/* 5. Fijar / Desfijar */}
          <div
            onClick={handleTogglePin}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name="push_pin" size={18} style={{ color: C.text }} />
            <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>{isPinned ? 'Desfijar chat' : 'Fijar chat'}</span>
          </div>
          {/* 6. Archivar */}
          <div
            onClick={handleArchive}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name="archive" size={18} style={{ color: C.text }} />
            <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Archivar chat</span>
          </div>
          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '2px 12px' }} />
          {/* 7. Reportar */}
          <div
            onClick={() => {
              const targetUserId = isGroup ? null : otherUser?.user_id
              openReport({ type: 'user', userId: targetUserId })
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon name="flag" size={18} style={{ color: C.textDim }} />
            <span style={{ fontSize: 14, color: C.textDim, fontFamily: FONT.body }}>Reportar</span>
          </div>
          {/* 8. Bloquear (solo DMs) */}
          {!isGroup && otherUser && (
            <div
              onClick={() => {
                setShowHeaderMenu(false)
                if (isBlocked) handleUnblock()
                else setShowBlockConfirm(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Icon name={isBlocked ? 'check_circle' : 'block'} size={18} style={{ color: isBlocked ? C.primary : '#ff4444' }} />
              <span style={{ fontSize: 14, color: isBlocked ? C.primary : '#ff4444', fontFamily: FONT.body }}>
                {isBlocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
              </span>
            </div>
          )}
        </div>
      )}

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
          if (deletedForMeSet.has(msg.id)) return null
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
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el }} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', ...(searchResults.includes(msg.id) ? { background: 'rgba(184,149,106,0.15)', borderLeft: '3px solid #B8956A', paddingLeft: 8, borderRadius: 4 } : {}) }}>

              {/* Etiqueta de remitente para grupos */}
              {isGroup && !isMine && !isDeleted && (
                <span style={{ fontSize: 11, color: C.primary, fontWeight: 600, marginLeft: 12, marginBottom: 2, fontFamily: FONT.headline }}>
                  {membersMap[msg.sender_id]?.full_name?.split(' ')[0] || 'Miembro'}
                </span>
              )}

              <div
                style={{ position: 'relative', maxWidth: '75%' }}
                onPointerDown={() => { if (msg.delivery_status === 'failed') return; handleMsgPointerDown(msg.id, isMine && !isDeleted) }}
                onPointerUp={handleMsgPointerUp}
                onPointerLeave={handleMsgPointerUp}
                onContextMenu={(e) => { if (msg.delivery_status === 'failed') { e.preventDefault(); return } handleContextMenuEvent(e, msg.id, isMine && !isDeleted) }}
              >
                <div style={{
                  padding: !isDeleted && (msg.message_type === 'image' || msg.message_type === 'video' || msg.message_type === 'chilliums') ? 4 : '12px 16px',
                  borderRadius: 16,
                  borderBottomRightRadius: isMine ? 4 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 4,
                  background: isDeleted
                    ? 'rgba(255,255,255,0.03)'
                    : (isMine ? GRADIENT.primary : C.surfaceHigh),
                  color: isMine ? '#fff' : C.text,
                  border: isDeleted
                    ? '1px solid rgba(241,239,232,0.06)'
                    : (msg.delivery_status === 'failed' ? '1px solid #ff4444' : 'none'),
                  opacity: msg.delivery_status === 'failed' ? 0.8 : 1,
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
                        {starredSet.has(msg.id) && <Icon name="star" size={10} style={{ color: '#B8956A' }} />}
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{timeFormat(msg.created_at)}</span>
                        <DeliveryStatus status={msg.delivery_status || 'sent'} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, padding: msg.message_type === 'image' || msg.message_type === 'video' ? '0 8px 4px' : 0 }}>
                        {msg.edited_at && (
                          <span style={{ fontSize: 10, color: 'rgba(223,226,235,0.35)', fontStyle: 'italic', marginRight: 2 }}>editado</span>
                        )}
                        {starredSet.has(msg.id) && <Icon name="star" size={10} style={{ color: '#B8956A' }} />}
                        <span style={{ fontSize: 10, color: C.textFaint }}>{timeFormat(msg.created_at)}</span>
                      </div>
                    )
                  )}
                </div>

                {/* ── Retry label for failed messages ─── */}
                {isMine && msg.delivery_status === 'failed' && (
                  <div
                    onClick={(e) => { e.stopPropagation(); handleRetryMessage(msg) }}
                    style={{ marginTop: 4, textAlign: 'right', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 11, color: '#ff4444', fontFamily: FONT.body }}>
                      No enviado · Toca para reintentar
                    </span>
                  </div>
                )}

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
                    {/* Star option */}
                    <div
                      onClick={() => handleToggleStar(msg.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name={starredSet.has(msg.id) ? 'star' : 'star_border'} size={18} style={{ color: '#B8956A' }} />
                      <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>{starredSet.has(msg.id) ? 'Quitar destacado' : 'Destacar'}</span>
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
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', cursor: 'pointer', borderRadius: '0 0 0 0', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon name="reply" size={16} style={{ color: C.textDim }} />
                        <span style={{ fontSize: 13, color: C.text, fontFamily: FONT.body }}>Reply</span>
                      </div>
                      <div style={{ width: 1, background: 'rgba(241,239,232,0.08)', margin: '6px 0' }} />
                      <div
                        onClick={() => handleToggleStar(msg.id)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon name={starredSet.has(msg.id) ? 'star' : 'star_border'} size={16} style={{ color: '#B8956A' }} />
                        <span style={{ fontSize: 13, color: C.text, fontFamily: FONT.body }}>{starredSet.has(msg.id) ? 'Quitar' : 'Star'}</span>
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
                    {/* Separator + Report */}
                    <div style={{ height: 1, background: 'rgba(241,239,232,0.08)', margin: '0 12px' }} />
                    <div
                      onClick={() => openReport({ type: 'message', userId: msg.sender_id, messageId: msg.id })}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', cursor: 'pointer', borderRadius: '0 0 16px 16px', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="flag" size={16} style={{ color: C.textDim }} />
                      <span style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body }}>Reportar</span>
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

      {/* ── Feature 6: GIF Picker ──────────────────────────── */}
      {showGifPicker && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 380,
            maxHeight: 350,
            background: 'rgba(13,17,23,0.97)',
            border: '1px solid rgba(241,239,232,0.1)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 12px 8px' }}>
            <input
              autoFocus
              placeholder="Buscar GIFs..."
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
            {gifLoading && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: 20 }}>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            {!gifLoading && gifResults.map(gif => (
              <img
                key={gif.id}
                src={gif.images?.fixed_width?.url}
                alt=""
                onClick={() => sendGif(gif)}
                style={{ width: '100%', borderRadius: 8, cursor: 'pointer', display: 'block' }}
              />
            ))}
          </div>
          <p style={{ fontSize: 10, color: C.textFaint, textAlign: 'center', padding: '4px 0 8px', fontFamily: FONT.body }}>Powered by GIPHY</p>
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
          {!isGroup && (
            <>
              <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
              <div onClick={openChilliumsModal} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(184,149,106,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="monetization_on" size={20} style={{ color: '#B8956A' }} /></div>
                <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>Enviar Chilliums</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Transfiere Chilliums a este chat</p></div>
              </div>
            </>
          )}
          <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
          <div onClick={handleSendLocation} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: locationLoading ? 'wait' : 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(255,100,100,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="location_on" size={20} style={{ color: '#ff6b6b' }} /></div>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>{locationLoading ? 'Obteniendo...' : 'Ubicación'}</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Comparte tu ubicación actual</p></div>
          </div>
          {isGroup && (
            <>
              <div style={{ height: 1, background: 'rgba(241,239,232,0.06)', margin: '0 12px' }} />
              <div onClick={() => { setShowAttachMenu(false); setShowPollModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(100,181,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="poll" size={20} style={{ color: '#64B5F6' }} /></div>
                <div><p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>Crear encuesta</p><p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body }}>Pregunta con opciones</p></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Chilliums Transfer Modal ────────────────────────── */}
      {showChilliumsModal && (
        <div
          onClick={() => setShowChilliumsModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'rgba(13,17,23,0.97)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 20, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', padding: 24, width: '100%', maxWidth: 340 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#B8956A' }}>monetization_on</span>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT.headline, color: C.text, marginTop: 8 }}>Enviar Chilliums</p>
              <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body, marginTop: 4 }}>Tu balance: {myChilliumsBalance} Chilliums</p>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Cantidad"
              value={chilliumsAmount}
              onChange={(e) => setChilliumsAmount(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(241,239,232,0.1)', background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 16, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              {[5, 10, 25, 50, 100].map(v => (
                <div
                  key={v}
                  onClick={() => setChilliumsAmount(String(v))}
                  style={{ background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.3)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#B8956A', cursor: 'pointer', fontFamily: FONT.body }}
                >
                  {v}
                </div>
              ))}
            </div>
            {chilliumsAmount && parseFloat(chilliumsAmount) > myChilliumsBalance && (
              <p style={{ fontSize: 12, color: '#ff6b6b', textAlign: 'center', marginTop: 8, fontFamily: FONT.body }}>Saldo insuficiente</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowChilliumsModal(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(241,239,232,0.1)', background: 'transparent', color: C.text, fontSize: 14, fontFamily: FONT.body, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={handleSendChilliums}
                disabled={chilliumsSending || !chilliumsAmount || parseFloat(chilliumsAmount) < 0.01 || isNaN(parseFloat(chilliumsAmount)) || parseFloat(chilliumsAmount) > myChilliumsBalance}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: (chilliumsSending || !chilliumsAmount || parseFloat(chilliumsAmount) < 0.01 || parseFloat(chilliumsAmount) > myChilliumsBalance) ? 'rgba(184,149,106,0.3)' : 'linear-gradient(135deg, #B8956A, #e7c092)', color: '#fff', fontSize: 14, fontFamily: FONT.body, fontWeight: 600, cursor: (chilliumsSending || !chilliumsAmount || parseFloat(chilliumsAmount) < 0.01 || parseFloat(chilliumsAmount) > myChilliumsBalance) ? 'not-allowed' : 'pointer', opacity: (chilliumsSending || !chilliumsAmount || parseFloat(chilliumsAmount) < 0.01 || parseFloat(chilliumsAmount) > myChilliumsBalance) ? 0.5 : 1 }}
              >
                {chilliumsSending ? 'Enviando...' : `Enviar ${chilliumsAmount || 0} Chilliums`}
              </button>
            </div>
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
              {deleteConfirm.sender_id === user?.id
                ? 'Elige cómo eliminar este mensaje.'
                : 'Este mensaje se ocultará solo para ti.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deleteConfirm.sender_id === user?.id && (
                <div
                  onClick={executeDelete}
                  style={{
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
                  Eliminar para todos
                </div>
              )}
              <div
                onClick={executeDeleteForMe}
                style={{
                  padding: '12px 0',
                  borderRadius: 12,
                  background: deleteConfirm.sender_id === user?.id ? 'transparent' : '#ff4444',
                  color: deleteConfirm.sender_id === user?.id ? '#ff4444' : '#fff',
                  border: deleteConfirm.sender_id === user?.id ? '1px solid #ff4444' : 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT.body,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (deleteConfirm.sender_id === user?.id) {
                    e.currentTarget.style.background = 'rgba(255,68,68,0.1)'
                  } else {
                    e.currentTarget.style.background = '#e03030'
                  }
                }}
                onMouseLeave={(e) => {
                  if (deleteConfirm.sender_id === user?.id) {
                    e.currentTarget.style.background = 'transparent'
                  } else {
                    e.currentTarget.style.background = '#ff4444'
                  }
                }}
              >
                Eliminar para mí
              </div>
              <div
                onClick={() => setDeleteConfirm(null)}
                style={{
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
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 7: Quick replies ───────────────────────── */}
      {inputFocused && !text && !isEditing && !replyTo && (
        <div style={{
          padding: '6px 16px',
          display: 'flex', gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {['👍 OK', '¡Gracias!', 'Perfecto', '¿A qué hora?', 'Ya voy', 'Luego hablamos', 'Sí', 'No', '😂', 'Un momento'].map(chip => (
            <div
              key={chip}
              onClick={() => handleSend(chip)}
              style={{
                display: 'inline-flex', flexShrink: 0,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(241,239,232,0.1)',
                borderRadius: 99,
                padding: '6px 14px',
                fontSize: 13,
                color: C.text,
                cursor: 'pointer',
                fontFamily: FONT.body,
                whiteSpace: 'nowrap',
              }}
            >
              {chip}
            </div>
          ))}
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

      {/* Blocked banner */}
      {isBlocked && (
        <div style={{ padding: '14px 20px', background: 'rgba(255,68,68,0.06)', borderTop: '1px solid rgba(255,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="block" size={16} style={{ color: '#ff4444' }} />
          <span style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body }}>
            Has bloqueado a {displayName}.{' '}
            <span onClick={handleUnblock} style={{ color: C.primary, cursor: 'pointer', fontWeight: 600 }}>Desbloquear</span>
          </span>
        </div>
      )}

      {/* Input bar */}
      {!isBlocked && <div style={{ padding: '8px 16px 16px', ...GLASS_NAV, borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
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

        {/* GIF — hide during edit */}
        {!isEditing && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowGifPicker(v => !v); setShowStickers(false); setShowAttachMenu(false) }}
            style={{ width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT.headline, color: showGifPicker ? C.primary : C.textDim }}>GIF</span>
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
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 150)}
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
      </div>}

      {/* ── Block Confirmation Modal ─────────────────────────── */}
      {showBlockConfirm && (
        <div
          onClick={() => setShowBlockConfirm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 320,
              background: 'rgba(13,17,23,0.97)', borderRadius: 20,
              border: '1px solid rgba(241,239,232,0.1)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              padding: '28px 24px 20px', textAlign: 'center',
            }}
          >
            <Icon name="block" size={40} style={{ color: '#ff4444', marginBottom: 12 }} />
            <h3 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              ¿Bloquear a {displayName}?
            </h3>
            <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body, marginBottom: 24, lineHeight: 1.5 }}>
              No podrás recibir mensajes de esta persona.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                onClick={() => setShowBlockConfirm(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 14, fontWeight: 600, fontFamily: FONT.body, cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                Cancelar
              </div>
              <div
                onClick={handleBlock}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#ff4444', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT.body, cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e03030' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ff4444' }}
              >
                Bloquear
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ─────────────────────────────────────── */}
      {showReportModal && (
        <div
          onClick={() => setShowReportModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'rgba(13,17,23,0.97)', borderRadius: 20,
              border: '1px solid rgba(241,239,232,0.1)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              padding: '24px', maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <h3 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Reportar {reportTarget?.type === 'message' ? 'este mensaje' : displayName}
            </h3>
            <p style={{ fontSize: 12, color: C.textDim, fontFamily: FONT.body, marginBottom: 20 }}>
              Selecciona una razón para el reporte
            </p>
            {['Spam', 'Acoso', 'Contenido inapropiado', 'Suplantación de identidad', 'Otro'].map(r => (
              <div
                key={r}
                onClick={() => setReportReason(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
                  background: reportReason === r ? 'rgba(104,219,174,0.1)' : 'transparent',
                  border: reportReason === r ? `1px solid ${C.primary}` : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 99,
                  border: reportReason === r ? `5px solid ${C.primary}` : '2px solid rgba(241,239,232,0.2)',
                  background: reportReason === r ? C.primary : 'transparent',
                  flexShrink: 0, boxSizing: 'border-box',
                }} />
                <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>{r}</span>
              </div>
            ))}
            <textarea
              placeholder="Detalles adicionales (opcional)"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              style={{
                width: '100%', marginTop: 12, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(241,239,232,0.1)', borderRadius: 12,
                padding: 12, color: C.text, fontSize: 13, fontFamily: FONT.body,
                outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div
                onClick={() => setShowReportModal(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 14, fontWeight: 600, fontFamily: FONT.body, cursor: 'pointer', textAlign: 'center' }}
              >
                Cancelar
              </div>
              <div
                onClick={handleSendReport}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  background: reportReason ? GRADIENT.primary : C.surfaceHigh,
                  color: reportReason ? '#fff' : C.textFaint,
                  fontSize: 14, fontWeight: 600, fontFamily: FONT.body,
                  cursor: reportReason ? 'pointer' : 'default', textAlign: 'center',
                }}
              >
                Enviar reporte
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 2 & 3: Group Info Modal ────────────────── */}
      {showGroupInfo && isGroup && (
        <div
          onClick={() => { setShowGroupInfo(false); setEditingDescription(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 400, maxHeight: '80vh', background: 'rgba(13,17,23,0.97)', borderRadius: 20, border: '1px solid rgba(241,239,232,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text }}>Info del grupo</h2>
              <div onClick={() => { setShowGroupInfo(false); setEditingDescription(false) }} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="close" size={24} style={{ color: C.textDim }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Avatar */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <div style={{ width: 80, height: 80, borderRadius: 99, overflow: 'hidden', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {conversation?.avatar_url ? (
                      <img src={conversation.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon name="groups" size={36} style={{ color: C.textDim }} />
                    )}
                  </div>
                  {(conversation?.admin_id === user?.id) && (
                    <div
                      onClick={() => groupAvatarInputRef.current?.click()}
                      style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 99, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: groupAvatarUploading ? 'wait' : 'pointer', border: '2px solid rgba(13,17,23,0.97)' }}
                    >
                      <Icon name="photo_camera" size={14} style={{ color: '#fff' }} />
                    </div>
                  )}
                  <input ref={groupAvatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGroupAvatarSelect} />
                </div>
              </div>
              <h3 style={{ textAlign: 'center', fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{conversation?.name || 'Grupo'}</h3>
              <p style={{ textAlign: 'center', fontSize: 12, color: C.textDim, fontFamily: FONT.body, marginBottom: 16 }}>{Object.keys(membersMap).length} miembros</p>
              {/* Description */}
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(241,239,232,0.06)' }}>
                <p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Descripción</p>
                {editingDescription ? (
                  <div>
                    <textarea
                      autoFocus
                      value={descriptionText}
                      onChange={(e) => setDescriptionText(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 8, padding: 10, color: C.text, fontSize: 13, fontFamily: FONT.body, outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <div onClick={() => setEditingDescription(false)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, color: C.textDim, cursor: 'pointer', fontFamily: FONT.body }}>Cancelar</div>
                      <div onClick={handleSaveDescription} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, color: '#fff', background: GRADIENT.primary, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 600 }}>Guardar</div>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => { if (conversation?.admin_id === user?.id) { setDescriptionText(conversation?.description || ''); setEditingDescription(true) } }}
                    style={{ fontSize: 13, color: conversation?.description ? C.text : C.textFaint, fontFamily: FONT.body, fontStyle: conversation?.description ? 'normal' : 'italic', cursor: conversation?.admin_id === user?.id ? 'pointer' : 'default', lineHeight: 1.5 }}
                  >
                    {conversation?.description || 'Agregar descripción...'}
                  </p>
                )}
              </div>
              {/* Members list */}
              <p style={{ fontSize: 11, color: C.textDim, fontFamily: FONT.body, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Miembros</p>
              {Object.values(membersMap).map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>
                        {(m.full_name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.body }}>{m.full_name || m.ref_code || 'Miembro'}</span>
                  </div>
                  {conversation?.admin_id === m.user_id && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B8956A', fontFamily: FONT.headline, padding: '2px 8px', borderRadius: 99, background: 'rgba(184,149,106,0.15)', letterSpacing: 0.5 }}>Admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 4: Starred Messages Modal ──────────────── */}
      {showStarredModal && (
        <div
          onClick={() => setShowStarredModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 400, maxHeight: '70vh', background: 'rgba(13,17,23,0.97)', borderRadius: 20, border: '1px solid rgba(241,239,232,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="star" size={20} style={{ color: '#B8956A' }} />
              <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, flex: 1 }}>Mensajes destacados</h2>
              <div onClick={() => setShowStarredModal(false)} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="close" size={20} style={{ color: C.textDim }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {messages.filter(m => starredSet.has(m.id)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Icon name="star_border" size={40} style={{ color: C.textFaint, marginBottom: 12 }} />
                  <p style={{ fontSize: 13, color: C.textDim, fontFamily: FONT.body }}>No hay mensajes destacados</p>
                </div>
              )}
              {messages.filter(m => starredSet.has(m.id)).map(m => (
                <div
                  key={m.id}
                  onClick={() => { setShowStarredModal(false); setTimeout(() => scrollToMessage(m.id), 200) }}
                  style={{ display: 'flex', gap: 10, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', marginBottom: 4, transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon name="star" size={16} style={{ color: '#B8956A', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.primary, fontFamily: FONT.headline, marginBottom: 2 }}>
                      {m.sender_id === user?.id ? 'Tú' : (membersMap[m.sender_id]?.full_name || 'Usuario')}
                    </p>
                    <p style={{ fontSize: 13, color: C.text, fontFamily: FONT.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.message_type === 'image' ? '📷 Foto' : m.message_type === 'video' ? '🎬 Video' : m.message_type === 'voice' ? '🎙️ Audio' : m.content}
                    </p>
                    <span style={{ fontSize: 10, color: C.textFaint }}>{timeFormat(m.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 8: Poll Creation Modal ─────────────────── */}
      {showPollModal && (
        <div
          onClick={() => setShowPollModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 380, background: 'rgba(13,17,23,0.97)', borderRadius: 20, border: '1px solid rgba(241,239,232,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 24, maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Icon name="poll" size={22} style={{ color: '#64B5F6' }} />
              <h3 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text, flex: 1 }}>Crear encuesta</h3>
              <div onClick={() => setShowPollModal(false)} style={{ cursor: 'pointer', padding: 4 }}>
                <Icon name="close" size={20} style={{ color: C.textDim }} />
              </div>
            </div>
            <input
              placeholder="Pregunta de la encuesta"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 12, padding: '14px 16px', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  placeholder={`Opción ${i + 1}`}
                  value={opt}
                  onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next) }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(241,239,232,0.1)', borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }}
                />
                {pollOptions.length > 2 && (
                  <div onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} style={{ cursor: 'pointer', padding: 4 }}>
                    <Icon name="close" size={16} style={{ color: C.textFaint }} />
                  </div>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <div
                onClick={() => setPollOptions([...pollOptions, ''])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', cursor: 'pointer', marginBottom: 12 }}
              >
                <Icon name="add" size={16} style={{ color: C.primary }} />
                <span style={{ fontSize: 13, color: C.primary, fontFamily: FONT.body }}>Agregar opción</span>
              </div>
            )}
            <div
              onClick={() => setPollMultiple(!pollMultiple)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 16, cursor: 'pointer' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 4, border: pollMultiple ? `2px solid ${C.primary}` : '2px solid rgba(241,239,232,0.2)', background: pollMultiple ? C.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pollMultiple && <Icon name="check" size={14} style={{ color: '#fff' }} />}
              </div>
              <span style={{ fontSize: 14, color: C.text, fontFamily: FONT.body }}>Respuesta múltiple</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                onClick={() => setShowPollModal(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 14, fontWeight: 600, fontFamily: FONT.body, cursor: 'pointer', textAlign: 'center' }}
              >
                Cancelar
              </div>
              <div
                onClick={handleCreatePoll}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  background: (pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) ? GRADIENT.primary : C.surfaceHigh,
                  color: (pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) ? '#fff' : C.textFaint,
                  fontSize: 14, fontWeight: 600, fontFamily: FONT.body,
                  cursor: (pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) ? 'pointer' : 'default',
                  textAlign: 'center',
                }}
              >
                {pollCreating ? 'Creando...' : 'Crear encuesta'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: C.surfaceHigh, border: `1px solid ${C.primary}`,
          borderRadius: 12, padding: '10px 20px', zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 13, color: C.text, fontFamily: FONT.body }}>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}