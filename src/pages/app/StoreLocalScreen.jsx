import { useState } from 'react'
import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const GOLD = '#e7c092'
const GOLD_DIM = 'rgba(231,192,146,0.10)'
const GOLD_BORDER = 'rgba(231,192,146,0.20)'
const SURFACE = '#0d1117'

const CATEGORIES = ['🍗 Food', '🍹 Bares', '💆 Spa & Wellness', '💪 Gym', '🛍 Tiendas', '🔧 Servicios']

const BUSINESSES = [
    {
        id: 1,
        img: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800&q=80',
        name: 'Wings Republic',
        type: 'Restaurante · Alitas & Burgers',
        address: 'Av. Presidente Masaryk 123, Polanco',
        distance: '0.8 km',
        rating: '4.8',
        open: true,
        tags: ['🍗 Alitas', '🍔 Burgers', '🍺 Cervezas'],
        featured: true,
        mapsUrl: 'https://maps.google.com/?q=Av.+Presidente+Masaryk+123+Polanco+CDMX',
        category: 'Food',
    },
    {
        id: 2,
        img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80',
        name: 'Buffalo Wild Wings',
        type: 'Restaurante · Bar',
        address: 'Antara Fashion Hall, Polanco',
        distance: '1.4 km',
        rating: '4.6',
        open: true,
        tags: ['🍗 Alitas', '🍺 Bar'],
        mapsUrl: 'https://maps.google.com/?q=Antara+Fashion+Hall+Polanco+CDMX',
        category: 'Food',
    },
    {
        id: 3,
        img: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=400&q=80',
        name: 'Wingstop',
        type: 'Restaurante',
        address: 'Polanco, CDMX',
        distance: '2.1 km',
        rating: '4.5',
        open: false,
        opensAt: 'Abre mañana a las 12:00 pm',
        tags: ['🍗 Alitas'],
        mapsUrl: 'https://maps.google.com/?q=Wingstop+Polanco+CDMX',
        category: 'Food',
    },
    {
        id: 4,
        img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
        name: 'Zen Spa Polanco',
        type: 'Spa & Bienestar',
        address: 'Emilio Castelar 95, Polanco',
        distance: '1.1 km',
        rating: '4.9',
        open: true,
        tags: ['💆 Masajes', '🧖 Faciales', '🛁 Hidro'],
        mapsUrl: 'https://maps.google.com/?q=Emilio+Castelar+95+Polanco+CDMX',
        category: 'Spa & Wellness',
    },
    {
        id: 5,
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80',
        name: 'Smart Fit Polanco',
        type: 'Gimnasio',
        address: 'Ejército Nacional 769, Polanco',
        distance: '1.8 km',
        rating: '4.4',
        open: true,
        tags: ['💪 Pesas', '🏃 Cardio', '🧘 Clases'],
        mapsUrl: 'https://maps.google.com/?q=Ejercito+Nacional+769+Polanco+CDMX',
        category: 'Gym',
    },
]

const CHAT_INIT = [
    { role: 'ai', text: 'Hola Oscar 👋 Dime qué se te antoja o qué necesitas — te encuentro el lugar perfecto cerca de ti.' }
]

export default function StoreLocalScreen({ onBack }) {
    const [activeCategory, setActiveCategory] = useState('🍗 Food')
    const [messages, setMessages] = useState(CHAT_INIT)
    const [input, setInput] = useState('')
    const [searched, setSearched] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const filtered = BUSINESSES.filter(b =>
        activeCategory === '🍗 Food'
            ? b.category === 'Food'
            : b.category === activeCategory.replace(/^.+\s/, '')
    )

    const featured = filtered.find(b => b.featured)
    const rest = filtered.filter(b => !b.featured)

    function handleSend() {
        const text = input.trim()
        if (!text) return
        setMessages(prev => [
            ...prev,
            { role: 'user', text },
            { role: 'ai', text: `¡Encontré opciones para "${text}" cerca de ti! 📍 Puedes ir directo o pedir delivery CNG. ¿Alguna preferencia de zona o tipo de lugar?` }
        ])
        setSearchTerm(text)
        setInput('')
        setSearched(true)
    }

    function openMaps(url) { window.open(url, '_blank') }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
            <TopBar title="Store Local" leftIcon="arrow_back" onLeft={onBack} rightContent={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, borderRadius: 99 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: GOLD }} />
                    <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>CDMX · Polanco</span>
                </div>
            } />

            <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Spark */}
                <div style={{ background: 'linear-gradient(135deg, #100c06, #1a1208)', border: `1px solid ${GOLD_BORDER}`, borderRadius: 20, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#2a1a08,#3a2810)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name="storefront" size={20} style={{ color: GOLD }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 10, color: GOLD, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Comercios</p>
                            <p style={{ fontSize: 14, color: '#f5ead8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · Directorio CNG</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 7, height: 7, borderRadius: 99, background: GOLD }} />
                            <p style={{ fontSize: 10, color: GOLD, margin: 0, fontWeight: 600 }}>activo</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                background: '#100e08',
                                border: `1px solid ${m.role === 'ai' ? 'rgba(231,192,146,0.15)' : 'rgba(231,192,146,0.1)'}`,
                                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                                padding: '10px 14px', fontSize: 13,
                                color: m.role === 'ai' ? '#e0c88a' : '#f0e4c0',
                                lineHeight: 1.55, maxWidth: '86%',
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            }}>{m.text}</div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="¿Qué se te antoja o necesitas?"
                            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#f5ead8', fontFamily: FONT.body, outline: 'none' }}
                        />
                        <button onClick={handleSend} style={{ width: 42, height: 42, background: GOLD, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name="send" size={18} style={{ color: '#1a0e00' }} />
                        </button>
                    </div>
                </div>

                {/* Category pills */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                            padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                            whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
                            border: activeCategory === cat ? 'none' : `1px solid rgba(255,255,255,0.07)`,
                            outline: activeCategory === cat ? `1px solid ${GOLD_BORDER}` : 'none',
                            background: activeCategory === cat ? '#1e1510' : 'rgba(255,255,255,0.03)',
                            color: activeCategory === cat ? GOLD : '#445',
                        }}>{cat}</button>
                    ))}
                </div>

                {/* Results label */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {searched
                        ? <p style={{ fontSize: 12, color: '#445', margin: 0 }}>Resultados para <span style={{ color: GOLD, fontWeight: 700 }}>"{searchTerm}"</span></p>
                        : <p style={{ fontSize: 12, color: '#445', margin: 0 }}>Cerca de ti · <span style={{ color: GOLD, fontWeight: 700 }}>Polanco, CDMX</span></p>
                    }
                    <p style={{ fontSize: 11, color: GOLD, fontWeight: 700, margin: 0 }}>{filtered.length} lugares</p>
                </div>

                {/* Business cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Featured — hero image */}
                    {featured && (
                        <div style={{ background: '#0d1008', border: `1px solid rgba(231,192,146,0.25)`, borderRadius: 18, overflow: 'hidden' }}>
                            <div style={{ position: 'relative', height: 160 }}>
                                <img src={featured.img} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d1008 0%, rgba(13,16,8,0.4) 60%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', top: 10, left: 10, background: GOLD, padding: '4px 12px', borderRadius: 99, fontSize: 10, color: '#1a0e00', fontWeight: 800 }}>MÁS CERCA · {featured.distance}</div>
                                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 99, fontSize: 11, color: '#fff', fontWeight: 700 }}>⭐ {featured.rating}</div>
                            </div>
                            <div style={{ padding: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f5ead8', margin: 0, fontFamily: FONT.headline }}>{featured.name}</h3>
                                    <span style={{ fontSize: 10, background: 'rgba(29,158,117,0.15)', color: '#68dbae', padding: '3px 8px', borderRadius: 99, fontWeight: 700, border: '1px solid rgba(29,158,117,0.2)', whiteSpace: 'nowrap' }}>Abierto</span>
                                </div>
                                <p style={{ fontSize: 12, color: '#665840', margin: '0 0 3px' }}>{featured.type}</p>
                                <p style={{ fontSize: 11, color: '#445', margin: '0 0 12px' }}>{featured.address}</p>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                                    {featured.tags.map(tag => (
                                        <span key={tag} style={{ fontSize: 11, background: GOLD_DIM, color: GOLD, padding: '4px 10px', borderRadius: 99, border: `1px solid ${GOLD_BORDER}` }}>{tag}</span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button style={{ flex: 1, padding: 11, background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, fontSize: 12, color: GOLD, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>
                                        🛵 Delivery <span style={{ fontSize: 10, opacity: 0.6 }}>· Próximamente</span>
                                    </button>
                                    <button onClick={() => openMaps(featured.mapsUrl)} style={{ flex: 1, padding: 11, background: GOLD, border: 'none', borderRadius: 10, fontSize: 12, color: '#1a0e00', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>
                                        📍 Ir al lugar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Compact cards — imagen lateral */}
                    {rest.map(b => (
                        <div key={b.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: 100, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                                <img src={b.img} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(13,17,23,0.3))' }} />
                            </div>
                            <div style={{ flex: 1, padding: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f5ead8', margin: 0, fontFamily: FONT.headline }}>{b.name}</h3>
                                    {b.open
                                        ? <span style={{ fontSize: 10, background: 'rgba(29,158,117,0.12)', color: '#68dbae', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Abierto</span>
                                        : <span style={{ fontSize: 10, background: 'rgba(226,75,74,0.12)', color: '#E24B4A', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Cerrado</span>
                                    }
                                </div>
                                <p style={{ fontSize: 11, color: '#445', margin: '0 0 2px' }}>{b.type} · {b.distance} · ⭐ {b.rating}</p>
                                <p style={{ fontSize: 11, color: '#445', margin: '0 0 10px' }}>{b.open ? b.address : b.opensAt}</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button style={{ flex: 1, padding: 8, background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, fontSize: 11, color: b.open ? GOLD : '#445', fontWeight: 700, cursor: b.open ? 'pointer' : 'not-allowed', opacity: b.open ? 1 : 0.4, fontFamily: FONT.body }}>
                                        🛵 <span style={{ fontSize: 9, opacity: 0.6 }}>Próx.</span>
                                    </button>
                                    <button onClick={() => openMaps(b.mapsUrl)} style={{ flex: 1, padding: 8, background: GOLD, border: 'none', borderRadius: 10, fontSize: 11, color: '#1a0e00', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>
                                        📍 Ir al lugar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                </div>
            </div>
            <BackButton onClick={onBack} />
        </div>
    )
}