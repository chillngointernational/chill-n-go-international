import { useState, useEffect, useRef, useCallback } from 'react'
import { C, FONT, Icon, GRADIENT, GLASS_NAV } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function timeFormat(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatScreen({ conversationId, onBack }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return
    try {
      // Get messages
      const { data: msgs, error } = await supabase
        .from('cng_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(msgs || [])

      // Get other user info
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

      // Mark as read
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

  // Realtime subscription
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
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
        // Mark as read if it's from the other user
        if (payload.new.sender_id !== user?.id) {
          supabase
            .from('cng_conversation_members')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user?.id)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, user])

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return
    const content = text.trim()
    setText('')
    setSending(true)

    try {
      const { error } = await supabase.from('cng_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: 'text',
      })
      if (error) throw error
    } catch (e) {
      console.error('Send error:', e)
      setText(content) // restore
    } finally {
      setSending(false)
    }
  }

  const displayName = otherUser?.full_name || otherUser?.ref_code || 'Chat'
  const initial = displayName[0]?.toUpperCase() || 'C'

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
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: 16,
                borderBottomRightRadius: isMine ? 4 : 16,
                borderBottomLeftRadius: isMine ? 16 : 4,
                background: isMine ? GRADIENT.primary : C.surfaceHigh,
                color: isMine ? '#fff' : C.text,
              }}>
                <p style={{ fontSize: 14, fontFamily: FONT.body, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
                <p style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : C.textFaint, marginTop: 4, textAlign: 'right' }}>{timeFormat(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 16px 16px', ...GLASS_NAV, borderTop: '1px solid rgba(241,239,232,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="add" size={24} style={{ color: C.textDim, cursor: 'pointer', flexShrink: 0 }} />
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
        <div
          onClick={handleSend}
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: text.trim() ? GRADIENT.primary : C.surfaceHigh,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          <Icon name="send" size={20} style={{ color: text.trim() ? '#fff' : C.textFaint }} />
        </div>
      </div>
    </div>
  )
}
