import { useState, useEffect, useCallback } from 'react'
import { C, FONT, Icon } from '../../stitch'
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

// Demo data fallback
const DEMO_ACTIVE = ['Ana', 'Marcus', 'Sofia', 'Diego', 'Luna', 'Carlos']
const DEMO_CONVOS = [
  { name: 'Lia Thomas', msg: 'Are we still hitting that yoga session...', time: '2m', unread: 3, verified: true },
  { name: 'Marcus Vane', msg: 'That cafe turned out really chill...', time: '15m', verified: true },
  { name: 'Sasha Moon', msg: 'Shared a photo', time: '1h', unread: 1, hasImage: true },
  { name: 'Devon Lane', msg: 'Sent a voice message', time: '3h', verified: true },
  { name: 'Kai Rivera', msg: 'See you tomorrow then!', time: '5h' },
  { name: 'Elena Torres', msg: 'The Obsidian project looks amazing.', time: '8h', verified: true },
]

export default function MessagesScreen({ onOpenChat, onNewMessage }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConversations = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      // Get conversations where user is a member
      const { data: memberships, error: memErr } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id, unread_count')
        .eq('user_id', user.id)

      if (memErr) throw memErr
      if (!memberships || memberships.length === 0) { setConversations([]); setLoading(false); return }

      const convIds = memberships.map(m => m.conversation_id)
      const unreadMap = {}
      memberships.forEach(m => { unreadMap[m.conversation_id] = m.unread_count })

      // Fetch conversations
      const { data: convos, error: convErr } = await supabase
        .from('cng_conversations')
        .select('*')
        .in('id', convIds)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false })

      if (convErr) throw convErr

      // For each conversation, find the other member(s)
      const { data: allMembers, error: amErr } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)

      if (amErr) throw amErr

      // Get other user IDs
      const otherUserIds = new Set()
      allMembers.forEach(m => {
        if (m.user_id !== user.id) otherUserIds.add(m.user_id)
      })

      // Fetch member names
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

      // Build conversation list
      const mapped = (convos || []).map(c => {
        const otherMemberUserId = allMembers.find(m => m.conversation_id === c.id && m.user_id !== user.id)?.user_id
        const otherMember = otherMemberUserId ? memberMap[otherMemberUserId] : null
        return {
          id: c.id,
          name: c.name || otherMember?.full_name || otherMember?.ref_code || 'Unknown',
          avatar_url: otherMember?.avatar_url,
          initial: (otherMember?.full_name || otherMember?.ref_code || 'U')[0].toUpperCase(),
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

  const handleNewMessage = async () => {
    if (!user) return
    const searchName = prompt('Enter member name to message:')
    if (!searchName) return

    // Search for member
    const { data: members } = await supabase
      .from('cng_members')
      .select('user_id, full_name, ref_code')
      .ilike('full_name', '%' + searchName + '%')
      .limit(5)

    if (!members || members.length === 0) {
      alert('No member found with that name.')
      return
    }

    const target = members[0]
    if (target.user_id === user.id) {
      alert('You cannot message yourself.')
      return
    }

    // Check if conversation already exists
    const { data: myConvs } = await supabase
      .from('cng_conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (myConvs && myConvs.length > 0) {
      const myConvIds = myConvs.map(c => c.conversation_id)
      const { data: existing } = await supabase
        .from('cng_conversation_members')
        .select('conversation_id')
        .eq('user_id', target.user_id)
        .in('conversation_id', myConvIds)

      if (existing && existing.length > 0) {
        // Open existing conversation
        if (onOpenChat) onOpenChat(existing[0].conversation_id)
        return
      }
    }

    // Create new conversation
    const { data: newConv, error: convErr } = await supabase
      .from('cng_conversations')
      .insert({ created_by: user.id, type: 'direct' })
      .select()
      .single()

    if (convErr) { console.error(convErr); return }

    // Add members
    await supabase.from('cng_conversation_members').insert([
      { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
      { conversation_id: newConv.id, user_id: target.user_id, role: 'member' },
    ])

    if (onOpenChat) onOpenChat(newConv.id)
    else fetchConversations()
  }

  const filtered = search
    ? conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : conversations

  const showDemo = !loading && conversations.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar
        title="Messages"
        leftIcon="menu"
        rightContent={
          <div onClick={handleNewMessage} style={{ cursor: 'pointer', padding: 8 }}>
            <Icon name="edit_square" size={24} style={{ color: C.primaryBright }} />
          </div>
        }
      />
      <div style={{ padding: '0 24px' }}>
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Icon name="search" size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
          <input
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: '16px 16px 16px 48px', color: C.text, fontSize: 14, fontFamily: FONT.body, outline: 'none' }}
          />
        </div>

        {/* Active now — demo or real */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, marginBottom: 16 }}>Active Now</h2>
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto' }}>
            {(showDemo ? DEMO_ACTIVE : conversations.slice(0, 6).map(c => c.name.split(' ')[0])).map((n) => (
              <div key={n} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 99, padding: 2, background: 'linear-gradient(to tr, #1D9E75, #B8956A)' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 99, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #080C14', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>{n[0]}</div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, background: C.primaryBright, borderRadius: 99, border: '2px solid #080C14' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(223,226,235,0.8)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Conversations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(showDemo ? DEMO_CONVOS : filtered).map((c, i) => (
            <div
              key={c.id || i}
              onClick={() => c.id && onOpenChat && onOpenChat(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderRadius: 16, background: c.unread ? 'rgba(24,28,34,0.4)' : 'transparent', cursor: 'pointer' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT.headline }}>{(c.initial || c.name[0])}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.onSurface }}>{c.name}</span>
                    {c.verified && (<div style={{ width: 14, height: 14, background: C.primaryBright, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={8} style={{ color: '#fff' }} /></div>)}
                  </div>
                  <span style={{ fontSize: 10, color: c.unread ? C.primaryBright : C.textFaint, fontWeight: c.unread ? 700 : 400 }}>{c.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.hasImage && <Icon name="image" size={12} style={{ color: C.textFaint }} />}
                  <p style={{ fontSize: 12, color: c.unread ? 'rgba(223,226,235,0.9)' : C.textFaint, fontWeight: c.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</p>
                </div>
              </div>
              {c.unread > 0 && (<div style={{ width: 20, height: 20, background: C.primaryBright, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.unread}</div>)}
            </div>
          ))}

          {!loading && !showDemo && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Icon name="chat_bubble_outline" size={48} style={{ color: C.textFaint, marginBottom: 16 }} />
              <p style={{ color: C.textDim, fontSize: 14, fontFamily: FONT.body }}>
                {search ? 'No conversations match your search' : 'No conversations yet'}
              </p>
              <p style={{ color: C.textFaint, fontSize: 12, fontFamily: FONT.body, marginTop: 8 }}>Tap the edit icon to start a new message</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
