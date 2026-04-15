import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { C, FONT, Icon, GRADIENT, GLASS_NAV, useDesktop } from '../stitch'
import FeedScreen from '../pages/app/FeedScreen'
import ExploreScreen from '../pages/app/ExploreScreen'
import CreateScreen from '../pages/app/CreateScreen'
import MessagesScreen from '../pages/app/MessagesScreen'
import ProfileScreen from '../pages/app/ProfileScreen'
import ChatScreen from '../pages/app/ChatScreen'
import TravelScreen from '../pages/app/TravelScreen'
import CandyStakesScreen from '../pages/app/CandyStakesScreen'
import RealEstateScreen from '../pages/app/RealEstateScreen'
import NutritionScreen from '../pages/app/NutritionScreen'
import StoreScreen from '../pages/app/StoreScreen'
import StoreLocalScreen from '../pages/app/StoreLocalScreen'
import NetworkScreen from '../pages/app/NetworkScreen'

const TABS = [
    { id: 'feed', icon: 'home', label: 'Feed' },
    { id: 'messages', icon: 'chat_bubble', label: 'Messages' },
    { id: 'create', icon: 'add', label: 'Create', special: true },
    { id: 'explore', icon: 'explore', label: 'Explore' },
    { id: 'profile', icon: 'person', label: 'Profile' },
]

const MAIN_SCREENS = ['feed', 'explore', 'create', 'messages', 'profile']
const SUB_SCREENS = ['travel', 'candystakes', 'realestate', 'nutrition', 'store', 'store-local', 'network']
export default function AppShell() {
    const location = useLocation()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const isDesktop = useDesktop()
    const { user } = useAuth()
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (!user) return
        const fetchUnread = async () => {
            const { data } = await supabase
                .from('cng_conversation_members')
                .select('unread_count')
                .eq('user_id', user.id)
                .gt('unread_count', 0)
            const total = (data || []).reduce((sum, r) => sum + (r.unread_count || 0), 0)
            setUnreadCount(total)
        }
        fetchUnread()
        const interval = setInterval(fetchUnread, 5000)
        return () => clearInterval(interval)
    }, [user])

    // Parse current screen from URL
    const pathParts = location.pathname.replace('/app/', '').replace('/app', '').split('/')
    const currentScreen = pathParts[0] || 'feed'
    const chatConversationId = currentScreen === 'chat' ? pathParts[1] : null

    const isSubScreen = SUB_SCREENS.includes(currentScreen)
    const isChat = !!chatConversationId
    const activeTab = (!isSubScreen && !isChat) ? currentScreen : null
    const isFs = currentScreen === 'feed' && !isSubScreen && !isChat
    const showNav = !isSubScreen && !isChat

    const nav = (screen) => {
        navigate('/app/' + screen)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const navSub = (screen) => {
        navigate('/app/' + screen)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const goBack = () => {
        navigate(-1)
    }

    const openChat = (conversationId) => {
        navigate('/app/chat/' + conversationId)
    }

    const renderContent = () => {
        if (isChat) {
            return <ChatScreen conversationId={chatConversationId} onBack={goBack} />
        }
        switch (currentScreen) {
            case 'feed': return <FeedScreen />
            case 'explore': return <ExploreScreen onNavigate={navSub} isDesktop={isDesktop} />
            case 'create': return <CreateScreen onDone={() => nav('feed')} />
            case 'messages': return <MessagesScreen onOpenChat={openChat} />
            case 'profile': return <ProfileScreen onNavigate={navSub} />
            case 'travel': return <TravelScreen onBack={goBack} />
            case 'candystakes': return <CandyStakesScreen onBack={goBack} />
            case 'realestate': return <RealEstateScreen onBack={goBack} />
            case 'nutrition': return <NutritionScreen onBack={goBack} />
            case 'store': return <StoreScreen onBack={goBack} />
            case 'store-local': return <StoreLocalScreen onBack={goBack} />
            case 'network': return <NetworkScreen onBack={goBack} isDesktop={isDesktop} />
            default: return <FeedScreen />
        }
    }

    if (isDesktop) {
        return (
            <div style={{
                width: '100%',
                height: '100dvh',
                background: C.bg,
                overflow: 'hidden',
                fontFamily: FONT.body,
                color: C.text,
                display: 'flex',
            }}>
                {/* Desktop sidebar */}
                <nav style={{
                    width: 240,
                    flexShrink: 0,
                    height: '100%',
                    ...GLASS_NAV,
                    borderRight: '1px solid rgba(241,239,232,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '32px 0',
                    zIndex: 100,
                }}>
                    <div style={{
                        padding: '0 28px 40px',
                        fontFamily: FONT.headline,
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: 4,
                        textTransform: 'uppercase',
                        background: 'linear-gradient(135deg, #68dbae, #1D9E75)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        CHILL N GO
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
                        {TABS.map((t) => {
                            const isActive = activeTab === t.id
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => nav(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 16,
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        cursor: 'pointer',
                                        background: isActive ? 'rgba(29,158,117,0.15)' : 'transparent',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {t.special ? (
                                        <div style={{
                                            width: 32,
                                            height: 32,
                                            background: GRADIENT.primary,
                                            borderRadius: 8,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Icon name="add" size={20} style={{ color: '#fff' }} />
                                        </div>
                                    ) : (
                                        <Icon
                                            name={t.icon}
                                            fill={isActive}
                                            size={24}
                                            style={{ color: isActive ? C.primaryBright : C.textFaint }}
                                        />
                                    )}
                                    <span style={{
                                        fontFamily: FONT.body,
                                        fontSize: 14,
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? C.primaryBright : C.textDim,
                                        letterSpacing: 1,
                                    }}>
                                        {t.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </nav>

                {/* Desktop main content */}
                <div ref={scrollRef} style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    overflowY: isFs ? 'hidden' : 'auto',
                    overflowX: 'hidden',
                    paddingTop: isFs ? 0 : 8,
                }}>
                    {renderContent()}
                </div>
            </div>
        )
    }

    // Mobile layout
    return (
        <div style={{
            width: '100%',
            maxWidth: 390,
            margin: '0 auto',
            height: '100dvh',
            minHeight: 844,
            background: C.bg,
            overflow: 'hidden',
            fontFamily: FONT.body,
            position: 'relative',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)',
            color: C.text,
        }}>
            <div
                ref={scrollRef}
                style={{
                    height: '100%',
                    overflowY: isFs ? 'hidden' : 'auto',
                    overflowX: 'hidden',
                    paddingBottom: showNav ? 96 : 0,
                }}
            >
                {renderContent()}
            </div>

            {showNav && (
                <nav style={{
                    position: 'fixed',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%) translateZ(0)',
                    width: '100%',
                    maxWidth: 390,
                    height: 80,
                    ...GLASS_NAV,
                    borderTop: '1px solid rgba(241,239,232,0.1)',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    padding: '0 16px',
                    zIndex: 100,
                    borderRadius: '24px 24px 0 0',
                    boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
                    willChange: 'transform',
                    WebkitBackfaceVisibility: 'hidden',
                }}>
                    {TABS.map((t) =>
                        t.special ? (
                            <div
                                key={t.id}
                                role="button"
                                tabIndex={-1}
                                onClick={() => nav(t.id)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: -32,
                                    cursor: 'pointer',
                                    WebkitTapHighlightColor: 'transparent',
                                    userSelect: 'none',
                                }}
                            >
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    background: GRADIENT.primary,
                                    borderRadius: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 20px rgba(29,158,117,0.3)',
                                    border: '4px solid #0D1117',
                                }}>
                                    <Icon name="add" size={28} style={{ color: '#fff' }} />
                                </div>
                                <span style={{
                                    fontSize: 10,
                                    color: C.textFaint,
                                    marginTop: 8,
                                    letterSpacing: 2,
                                    textTransform: 'uppercase',
                                    fontFamily: FONT.body,
                                }}>
                                    Create
                                </span>
                            </div>
                        ) : (
                            <div
                                key={t.id}
                                role="button"
                                tabIndex={-1}
                                onClick={() => nav(t.id)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    color: activeTab === t.id ? C.primaryBright : C.textFaint,
                                    cursor: 'pointer',
                                    transform: activeTab === t.id ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'all 0.2s',
                                    fontWeight: activeTab === t.id ? 700 : 400,
                                    WebkitTapHighlightColor: 'transparent',
                                    userSelect: 'none',
                                }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <Icon name={t.icon} fill={activeTab === t.id} size={24} />
                                    {t.id === 'messages' && unreadCount > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: -4,
                                            right: -8,
                                            minWidth: 16,
                                            height: 16,
                                            borderRadius: 99,
                                            background: '#ff4444',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 4px',
                                            border: '2px solid #0D1117',
                                        }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: FONT.body }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: 10,
                                    letterSpacing: 2,
                                    textTransform: 'uppercase',
                                    marginTop: 4,
                                    fontFamily: FONT.body,
                                }}>
                                    {t.label}
                                </span>
                            </div>
                        )
                    )}
                </nav>
            )}
        </div>
    )
}