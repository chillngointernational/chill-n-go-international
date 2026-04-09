import { useState, useEffect, useCallback, useRef } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import TopBar from '../../components/TopBar'

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

/* ── New Message Search Modal (Direct Message) ── */
function NewMessageModal({ open, onClose, onSelectConversation, user }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim() || !user) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase
          .from('cng_members')
          .select('user_id, full_name, ref_code, avatar_url')
          .neq('user_id', user.id)
          .ilike('full_name', '%' + query.trim() + '%')
          .limit(10)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, user])

  const handleSelect = async (target) => {
    if (creating) return
    setCreating(true)
    try {
      const { data: myConvs } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (myConvs && myConvs.length > 0) {
        const myConvIds = myConvs.map(c => c.conversation_id)
        const { data: theirConvs } = await supabase
          .from('cng_conversation_members')
          .select('conversation_id')
          .eq('user_id', target.user_id)
          .in('conversation_id', myConvIds)

        if (theirConvs && theirConvs.length > 0) {
          for (const tc of theirConvs) {
            const { data: conv } = await supabase
              .from('cng_conversations')
              .select('id, type, is_active')
              .eq('id', tc.conversation_id)
              .eq('type', 'direct')
              .eq('is_active', true)
              .maybeSingle()
            if (conv) {
              onClose()
              onSelectConversation(conv.id)
              return
            }
          }
        }
      }

      const { data: newConv, error: convErr } = await supabase
        .from('cng_conversations')
        .insert({ created_by: user.id, type: 'direct' })
        .select()
        .single()
      if (convErr) throw convErr

      const { error: membErr } = await supabase.from('cng_conversation_members').insert([
        { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
        { conversation_id: newConv.id, user_id: target.user_id, role: 'member' },
      ])
      if (membErr) throw membErr

      onClose()
      onSelectConversation(newConv.id)
    } catch (e) {
      console.error('[NewMessage] Error creating conversation:', e)
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%', maxWidth: 400, maxHeight: '70vh',
          background: C.surface, borderRadius: 20,
          border: '1px solid rgba(241,239,232,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text }}>New Chat</h2>
          <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}>
            <Icon name="close" size={24} style={{ color: C.textDim }} />
          </div>
        </div>

        <div style={{ padding: '16px 20px', position: 'relative' }}>
          <Icon name="search" size={20} style={{ position: 'absolute', left: 36, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
          <input
            ref={inputRef}
            placeholder="Search user..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(241,239,232,0.1)', borderRadius: 12,
              padding: '14px 14px 14px 44px', color: C.text,
              fontSize: 14, fontFamily: FONT.body, outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {searching && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 24, height: 24, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!searching && query.trim() && results.length === 0 && (
            <p style={{ textAlign: 'center', padding: 24, color: C.textFaint, fontSize: 13, fontFamily: FONT.body }}>No members found</p>
          )}

          {results.map((m) => (
            <div
              key={m.user_id}
              onClick={() => handleSelect(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 12px', borderRadius: 14, cursor: 'pointer',
                opacity: creating ? 0.5 : 1,
                background: 'transparent', transition: 'background 0.15s',
              }}
              onPointerEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onPointerLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>
                    {(m.full_name || m.ref_code || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.full_name || m.ref_code}</p>
                {m.full_name && m.ref_code && <p style={{ fontSize: 11, color: C.textFaint }}>@{m.ref_code}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── New Group Creation Modal ── */
function NewGroupModal({ open, onClose, onSelectConversation, user }) {
  const [groupName, setGroupName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setGroupName('')
      setQuery('')
      setResults([])
      setSelectedUsers([])
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim() || !user) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase
          .from('cng_members')
          .select('user_id, full_name, ref_code, avatar_url')
          .neq('user_id', user.id)
          .ilike('full_name', '%' + query.trim() + '%')
          .limit(15)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, user])

  const toggleUser = (u) => {
    if (selectedUsers.find(x => x.user_id === u.user_id)) {
      setSelectedUsers(selectedUsers.filter(x => x.user_id !== u.user_id))
    } else {
      setSelectedUsers([...selectedUsers, u])
    }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0 || creating) return
    setCreating(true)
    try {
      // 1. Crear el registro de la conversación tipo grupo
      const { data: newConv, error: convErr } = await supabase
        .from('cng_conversations')
        .insert({
          created_by: user.id,
          type: 'group',
          name: groupName.trim(),
          admin_id: user.id
        })
        .select()
        .single()
      if (convErr) throw convErr

      // 2. Preparar el array de miembros a insertar (El creador + los seleccionados)
      const membersToInsert = [
        { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
        ...selectedUsers.map(u => ({ conversation_id: newConv.id, user_id: u.user_id, role: 'member' }))
      ]

      // 3. Insertar todos los miembros de un jalón
      const { error: membErr } = await supabase.from('cng_conversation_members').insert(membersToInsert)
      if (membErr) throw membErr

      onClose()
      onSelectConversation(newConv.id)
    } catch (e) {
      console.error('[NewGroup] Error creating group:', e)
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%', maxWidth: 400, height: '75vh',
          background: C.surface, borderRadius: 20,
          border: '1px solid rgba(241,239,232,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 700, color: C.text }}>New Group</h2>
            <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}>
              <Icon name="close" size={24} style={{ color: C.textDim }} />
            </div>
          </div>

          <input
            ref={inputRef}
            placeholder="Group Subject"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: 'none', borderRadius: 12, borderBottom: `2px solid ${C.primary}`,
              padding: '12px 14px', color: C.text,
              fontSize: 16, fontFamily: FONT.body, outline: 'none',
              marginBottom: 16
            }}
          />

          {/* Selected Users horizontally */}
          {selectedUsers.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {selectedUsers.map(u => (
                <div key={u.user_id} onClick={() => toggleUser(u)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(29,158,117,0.2)',
                  padding: '4px 8px 4px 4px', borderRadius: 99, flexShrink: 0, border: `1px solid ${C.primary}`, cursor: 'pointer'
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 99, overflow: 'hidden', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>
                    {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.full_name || 'U')[0]}
                  </div>
                  <span style={{ fontSize: 12, color: C.text, fontFamily: FONT.body }}>{u.full_name?.split(' ')[0]}</span>
                  <Icon name="close" size={14} style={{ color: C.primary }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
            <input
              placeholder="Search members to add..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(241,239,232,0.1)', borderRadius: 12,
                padding: '10px 14px 10px 40px', color: C.text,
                fontSize: 14, fontFamily: FONT.body, outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {searching && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 24, height: 24, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!searching && query.trim() && results.length === 0 && (
            <p style={{ textAlign: 'center', padding: 24, color: C.textFaint, fontSize: 13, fontFamily: FONT.body }}>No members found</p>
          )}

          {results.map((m) => {
            const isSelected = selectedUsers.some(x => x.user_id === m.user_id)
            return (
              <div
                key={m.user_id}
                onClick={() => toggleUser(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px', borderRadius: 14, cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 99, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT.headline }}>
                      {(m.full_name || m.ref_code || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  {isSelected && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(29,158,117,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={20} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.full_name || m.ref_code}</p>
                  {m.full_name && m.ref_code && <p style={{ fontSize: 11, color: C.textFaint }}>@{m.ref_code}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Create Button */}
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: (!groupName.trim() || selectedUsers.length === 0) ? C.surfaceHigh : GRADIENT.primary,
              color: (!groupName.trim() || selectedUsers.length === 0) ? C.textFaint : '#fff',
              fontSize: 16, fontWeight: 700, fontFamily: FONT.headline, cursor: (!groupName.trim() || selectedUsers.length === 0 || creating) ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
            }}
          >
            {creating ? 'Creating...' : `Create Group (${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Messages Screen ── */
export default function MessagesScreen({ onOpenChat }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // States for Modals and Menus
  const [showMenu, setShowMenu] = useState(false)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const { data: memberships, error: memErr } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id, unread_count')
        .eq('user_id', user.id)

      if (memErr) throw memErr
      if (!memberships || memberships.length === 0) { setConversations([]); setLoading(false); return }

      const convIds = memberships.map(m => m.conversation_id)
      const unreadMap = {}
      memberships.forEach(m => { unreadMap[m.conversation_id] = m.unread_count })

      const { data: convos, error: convErr } = await supabase
        .from('cng_conversations')
        .select('*')
        .in('id', convIds)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (convErr) throw convErr

      const { data: allMembers, error: amErr } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)

      if (amErr) throw amErr

      const otherUserIds = new Set()
      allMembers.forEach(m => {
        if (m.user_id !== user.id) otherUserIds.add(m.user_id)
      })

      let memberMap = {}
      if (otherUserIds.size > 0) {
        const { data: members } = await supabase
          .from('cng_members')
          .select('user_id, full_name, ref_code, avatar_url')
          .in('user_id', [...otherUserIds])
        if (members) {
          members.forEach(m => { memberMap[m.user_id] = m })
        }
      }

      const mapped = (convos || []).map(c => {
        const otherMemberUserId = allMembers.find(m => m.conversation_id === c.id && m.user_id !== user.id)?.user_id
        const otherMember = otherMemberUserId ? memberMap[otherMemberUserId] : null

        const isGroup = c.type === 'group'
        const finalName = isGroup ? c.name : (otherMember?.full_name || otherMember?.ref_code || 'Unknown')

        return {
          id: c.id,
          type: c.type,
          name: finalName,
          avatar_url: isGroup ? c.avatar_url : otherMember?.avatar_url,
          initial: finalName ? finalName[0].toUpperCase() : 'U',
          msg: c.last_message_preview || 'No messages yet',
          time: c.last_message_at ? timeAgo(c.last_message_at) : '',
          unread: unreadMap[c.id] || 0,
          other_user_id: otherMemberUserId,
        }
      })

      setConversations(mapped)
    } catch (e) {
      console.error('Error fetching conversations:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  /* ── Realtime: listen for new messages to update list ────────── */
  useEffect(() => {
    if (!user) return

    let channel = null

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      channel = supabase
        .channel('messages-list-updates')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'cng_messages',
        }, (payload) => {
          const newMsg = payload.new
          const isOwn = newMsg.sender_id === user.id

          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === newMsg.conversation_id)
            if (idx === -1) {
              fetchConversations()
              return prev
            }

            const updated = [...prev]
            const conv = { ...updated[idx] }

            if (newMsg.message_type === 'image') conv.msg = '📷 Photo'
            else if (newMsg.message_type === 'video') conv.msg = '🎬 Video'
            else if (newMsg.message_type === 'voice') conv.msg = '🎙️ Voice message'
            else conv.msg = newMsg.content?.substring(0, 100) || ''

            conv.time = 'now'

            if (!isOwn) {
              conv.unread = (conv.unread || 0) + 1
            }

            updated[idx] = conv
            updated.splice(idx, 1)
            updated.unshift(conv)

            return updated
          })
        })
        .subscribe()
    }

    setup()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [user, fetchConversations])

  // Refresh when closing modals
  useEffect(() => {
    if (!showNewMsg && !showNewGroup) fetchConversations()
  }, [showNewMsg, showNewGroup, fetchConversations])

  const handleSelectConversation = (convId) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, unread: 0 } : c
    ))
    if (onOpenChat) onOpenChat(convId)
  }

  const filtered = search
    ? conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : conversations

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <TopBar
        title="Messages"
        leftIcon="menu"
      // rightContent removed as requested
      />
      <div style={{ padding: '0 24px', paddingBottom: 100 }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Icon name="search" size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
          <input
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: '16px 16px 16px 48px', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Active Now */}
        {!loading && conversations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, marginBottom: 16 }}>Active Now</h2>
            <div style={{ display: 'flex', gap: 20, overflowX: 'auto' }}>
              {conversations.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 99, padding: 2, background: 'linear-gradient(to tr, #1D9E75, #B8956A)' }}>
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 99, objectFit: 'cover', border: '2px solid #080C14' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', borderRadius: 99, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #080C14', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>{c.initial}</div>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, background: C.primaryBright, borderRadius: 99, border: '2px solid #080C14' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(223,226,235,0.8)' }}>{c.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Conversations list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => handleSelectConversation(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderRadius: 16, background: c.unread ? 'rgba(24,28,34,0.4)' : 'transparent', cursor: 'pointer' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>
                    {c.type === 'group' ? <Icon name="groups" size={24} style={{ color: C.textDim }} /> : c.initial}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: c.unread ? 800 : 700, color: C.onSurface }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: c.unread ? C.primaryBright : C.textFaint, fontWeight: c.unread ? 700 : 400 }}>{c.time}</span>
                </div>
                <p style={{ fontSize: 12, color: c.unread ? 'rgba(223,226,235,0.9)' : C.textFaint, fontWeight: c.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{c.msg}</p>
              </div>
              {c.unread > 0 && (
                <div style={{
                  minWidth: 22, height: 22, padding: '0 6px',
                  background: GRADIENT.primary, borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(29,158,117,0.4)',
                }}>
                  {c.unread}
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {!loading && conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Icon name="chat_bubble_outline" size={56} style={{ color: C.textFaint, marginBottom: 16 }} />
              <p style={{ color: C.textDim, fontSize: 16, fontFamily: FONT.headline, fontWeight: 700, marginBottom: 8 }}>No conversations yet</p>
              <p style={{ color: C.textFaint, fontSize: 13, fontFamily: FONT.body, marginBottom: 24 }}>Start a conversation with someone in the community</p>
              <div
                onClick={() => setShowMenu(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 28px', borderRadius: 99,
                  background: GRADIENT.primary, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(29,158,117,0.3)',
                }}
              >
                <Icon name="add" size={18} style={{ color: '#fff' }} />
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FONT.body }}>Start Chat</span>
              </div>
            </div>
          )}

          {/* Search no results */}
          {!loading && conversations.length > 0 && filtered.length === 0 && search && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Icon name="search_off" size={48} style={{ color: C.textFaint, marginBottom: 16 }} />
              <p style={{ color: C.textDim, fontSize: 14, fontFamily: FONT.body }}>No conversations match "{search}"</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Floating Action Button (FAB) and Menu --- */}
      <div style={{
        position: 'fixed', bottom: 90, right: 20, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16
      }}>

        {/* Menu Options */}
        {showMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
            <div
              onClick={() => { setShowMenu(false); setShowNewGroup(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surfaceHigh, padding: '10px 16px', borderRadius: 99, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>New Group</span>
              <Icon name="groups" size={20} style={{ color: C.primary }} />
            </div>

            <div
              onClick={() => { setShowMenu(false); setShowNewMsg(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surfaceHigh, padding: '10px 16px', borderRadius: 99, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>New Chat</span>
              <Icon name="person" size={20} style={{ color: C.primary }} />
            </div>
          </div>
        )}

        {/* FAB Button */}
        <div
          onClick={() => setShowMenu(!showMenu)}
          style={{
            width: 56, height: 56, borderRadius: 99, background: GRADIENT.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(29,158,117,0.4)', cursor: 'pointer',
            transition: 'transform 0.2s', transform: showMenu ? 'rotate(45deg)' : 'rotate(0deg)'
          }}
        >
          <Icon name="add" size={28} style={{ color: '#fff' }} />
        </div>
      </div>

      {/* Background overlay to close menu when clicking outside */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 90 }}
        />
      )}

      {/* Modals */}
      <NewMessageModal
        open={showNewMsg}
        onClose={() => setShowNewMsg(false)}
        onSelectConversation={handleSelectConversation}
        user={user}
      />

      <NewGroupModal
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onSelectConversation={handleSelectConversation}
        user={user}
      />

    </div>
  )
}