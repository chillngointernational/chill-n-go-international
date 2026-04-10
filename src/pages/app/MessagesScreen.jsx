import { useState, useEffect, useCallback, useRef } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import TopBar from '../../components/TopBar'
import { StoryRing, StoryViewer, CreateStory } from './StoriesComponents'

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

      const membersToInsert = [
        { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
        ...selectedUsers.map(u => ({ conversation_id: newConv.id, user_id: u.user_id, role: 'member' }))
      ]

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

/* ══════════════════════════════════════════════════════════
   MAIN MESSAGES SCREEN — with Stories Tray
   ══════════════════════════════════════════════════════════ */
export default function MessagesScreen({ onOpenChat }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal states
  const [showMenu, setShowMenu] = useState(false)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)

  // ═══ STORIES STATE ═══
  const [storyUsers, setStoryUsers] = useState([])   // grouped by user
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [viewedStoryIds, setViewedStoryIds] = useState(new Set())
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerStartIndex, setViewerStartIndex] = useState(0)
  const [createStoryOpen, setCreateStoryOpen] = useState(false)
  const [myStories, setMyStories] = useState([])       // current user's own stories

  /* ── Fetch Stories ── */
  const fetchStories = useCallback(async () => {
    if (!user) { setStoriesLoading(false); return }
    try {
      // 1. Get all active stories
      const { data: stories, error: stErr } = await supabase
        .from('cng_stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })

      if (stErr) throw stErr
      if (!stories || stories.length === 0) {
        setStoryUsers([])
        setMyStories([])
        setStoriesLoading(false)
        return
      }

      // 2. Get which stories current user has viewed
      const storyIds = stories.map(s => s.id)
      const { data: views } = await supabase
        .from('cng_story_views')
        .select('story_id')
        .eq('viewer_id', user.id)
        .in('story_id', storyIds)

      const viewedIds = new Set((views || []).map(v => v.story_id))
      setViewedStoryIds(viewedIds)

      // 3. Get unique user_ids from stories
      const userIds = [...new Set(stories.map(s => s.user_id))]

      // 4. Fetch profiles for those users
      const { data: profiles } = await supabase
        .from('cng_members')
        .select('user_id, full_name, ref_code, avatar_url')
        .in('user_id', userIds)

      const profileMap = {}
        ; (profiles || []).forEach(p => { profileMap[p.user_id] = p })

      // 5. Group stories by user
      const grouped = {}
      stories.forEach(s => {
        if (!grouped[s.user_id]) {
          const profile = profileMap[s.user_id] || {}
          grouped[s.user_id] = {
            user_id: s.user_id,
            full_name: profile.full_name || profile.ref_code || 'User',
            ref_code: profile.ref_code,
            avatar_url: profile.avatar_url,
            stories: [],
          }
        }
        grouped[s.user_id].stories.push(s)
      })

      // 6. Separate own stories from others
      const own = grouped[user.id]?.stories || []
      setMyStories(own)

      // 7. Build array for other users, unseen first
      const otherUsers = Object.values(grouped).filter(u => u.user_id !== user.id)

      // Sort: unseen users first, then seen
      otherUsers.sort((a, b) => {
        const aAllSeen = a.stories.every(s => viewedIds.has(s.id))
        const bAllSeen = b.stories.every(s => viewedIds.has(s.id))
        if (aAllSeen === bAllSeen) return 0
        return aAllSeen ? 1 : -1
      })

      setStoryUsers(otherUsers)
    } catch (e) {
      console.error('Error fetching stories:', e)
    } finally {
      setStoriesLoading(false)
    }
  }, [user])

  useEffect(() => { fetchStories() }, [fetchStories])

  const openStoryViewer = (index) => {
    setViewerStartIndex(index)
    setViewerOpen(true)
  }

  const isUserAllSeen = (storyUser) => {
    return storyUser.stories.every(s => viewedStoryIds.has(s.id))
  }

  /* ── Fetch Conversations ── */
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

  /* ── Realtime: listen for new messages ── */
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
      <TopBar title="Messages" leftIcon="menu" />

      <div style={{ padding: '0 24px', paddingBottom: 100 }}>

        {/* ═══ STORIES / ESTADOS TRAY ═══ */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: C.secondaryDark || '#B8956A', fontWeight: 700, marginBottom: 14,
          }}>
            Estados
          </h2>

          <div style={{
            display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
            {/* Own Story Ring */}
            <StoryRing
              user={{
                full_name: 'Tu estado',
                avatar_url: null,
              }}
              size={64}
              isOwn={true}
              seen={myStories.length > 0}
              onClick={() => setCreateStoryOpen(true)}
            />

            {/* Other users' stories */}
            {storyUsers.map((su, i) => (
              <StoryRing
                key={su.user_id}
                user={su}
                size={64}
                seen={isUserAllSeen(su)}
                onClick={() => openStoryViewer(i)}
              />
            ))}

            {/* Loading placeholder */}
            {storiesLoading && (
              <div style={{
                width: 80, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 20, height: 20,
                  border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary,
                  borderRadius: 99, animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 20 }} />

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

      {/* ── FAB and Menu ── */}
      <div style={{
        position: 'fixed', bottom: 90, right: 20, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16
      }}>
        {showMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
            <div
              onClick={() => { setShowMenu(false); setShowNewGroup(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surfaceHigh, padding: '10px 16px', borderRadius: 99, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>New Group</span>
              <Icon name="groups" size={20} style={{ color: C.primary }} />
            </div>

            <div
              onClick={() => { setShowMenu(false); setShowNewMsg(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surfaceHigh, padding: '10px 16px', borderRadius: 99, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>New Chat</span>
              <Icon name="person" size={20} style={{ color: C.primary }} />
            </div>
          </div>
        )}

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

      {showMenu && (
        <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      )}

      {/* Modals */}
      <NewMessageModal open={showNewMsg} onClose={() => setShowNewMsg(false)} onSelectConversation={handleSelectConversation} user={user} />
      <NewGroupModal open={showNewGroup} onClose={() => setShowNewGroup(false)} onSelectConversation={handleSelectConversation} user={user} />

      {/* ═══ Story Viewer ═══ */}
      {viewerOpen && storyUsers.length > 0 && (
        <StoryViewer
          storyUsers={storyUsers}
          startUserIndex={viewerStartIndex}
          onClose={() => { setViewerOpen(false); fetchStories() }}
          currentUserId={user?.id}
        />
      )}

      {/* ═══ Create Story ═══ */}
      {createStoryOpen && (
        <CreateStory
          onClose={() => setCreateStoryOpen(false)}
          onPost={() => fetchStories()}
          currentUserId={user?.id}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}