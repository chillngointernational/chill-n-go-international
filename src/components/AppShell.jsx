import { useState, useRef } from 'react'
import { C, FONT, Icon, GRADIENT, GLASS_NAV, useDesktop } from '../stitch'
import FeedScreen from '../pages/app/FeedScreen'
import ExploreScreen from '../pages/app/ExploreScreen'
import CreateScreen from '../pages/app/CreateScreen'
import MessagesScreen from '../pages/app/MessagesScreen'
import ProfileScreen from '../pages/app/ProfileScreen'
import TravelScreen from '../pages/app/TravelScreen'
import CandyStakesScreen from '../pages/app/CandyStakesScreen'
import RealEstateScreen from '../pages/app/RealEstateScreen'
import NutritionScreen from '../pages/app/NutritionScreen'
import StoreScreen from '../pages/app/StoreScreen'

const TABS = [
    { id: 'feed', icon: 'home', label: 'Feed' },
    { id: 'messages', icon: 'chat_bubble', label: 'Messages' },
    { id: 'create', icon: 'add', label: 'Create', special: true },
    { id: 'explore', icon: 'explore', label: 'Explore' },
    { id: 'profile', icon: 'person', label: 'Profile' },
]

export default function AppShell() {
    const [screen, setScreen] = useState('feed')
    const [subScreen, setSubScreen] = useState(null)
    const scrollRef = useRef(null)
    const isDesktop = useDesktop()

    const nav = (s) => {
        setSubScreen(null)
        setScreen(s)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const navSub = (s) => {
        setSubScreen(s)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const goBack = () => {
        setSubScreen(null)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const renderSub = () => {
        switch (subScreen) {
            case 'travel': return <TravelScreen onBack={goBack} />
            case 'candystakes': return <CandyStakesScreen onBack={goBack} />
            case 'realestate': return <RealEstateScreen onBack={goBack} />
            case 'nutrition': return <NutritionScreen onBack={goBack} />
            case 'store': return <StoreScreen onBack={goBack} />
            default: return null
        }
    }

    const renderScreen = () => {
        switch (screen) {
            case 'feed': return <FeedScreen />
            case 'explore': return <ExploreScreen onNavigate={navSub} isDesktop={isDesktop} />
            case 'create': return <CreateScreen />
            case 'messages': return <MessagesScreen />
            case 'profile': return <ProfileScreen />
            default: return <FeedScreen />
        }
    }

    const activeTab = subScreen ? null : screen
    const isFs = screen === 'feed' && !subScreen

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
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        height: '100%',
                        overflowY: isFs ? 'hidden' : 'auto',
                        overflowX: 'hidden',
                    }}
                >
                    {subScreen ? renderSub() : renderScreen()}
                </div>
            </div>
        )
    }

    // Mobile layout — unchanged
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
                    paddingBottom: subScreen ? 0 : 80,
                }}
            >
                {subScreen ? renderSub() : renderScreen()}
            </div>

            {!subScreen && (
                <nav style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
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
                }}>
                    {TABS.map((t) =>
                        t.special ? (
                            <div
                                key={t.id}
                                onClick={() => nav(t.id)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: -32,
                                    cursor: 'pointer',
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
                                }}
                            >
                                <Icon name={t.icon} fill={activeTab === t.id} size={24} />
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
