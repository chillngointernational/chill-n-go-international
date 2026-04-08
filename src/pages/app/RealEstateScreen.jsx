import { useState } from 'react'
import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const TEAL = '#68dbae'
const TEAL_DIM = 'rgba(104,219,174,0.10)'
const TEAL_BORDER = 'rgba(104,219,174,0.20)'
const SURFACE = '#0d1117'

const FILTERS = ['🏠 Todos', '💰 Venta', '📅 Renta corta', '📋 Renta larga', '⭐ CNG Exclusive']

const PROPERTIES = [
  {
    id: 1,
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    name: 'Skyline Ocean View South Beach',
    type: 'Renta corta', typeColor: TEAL,
    location: 'Miami, FL', flag: '🇺🇸',
    beds: 2, baths: 2,
    price: '$280', period: '/ noche', priceColor: TEAL,
    rating: '4.9', reviews: 48,
    tags: ['🛏 2 Rec.', '🚿 2 Baños', '🌊 Vista al mar', '🏊 Alberca'],
    exclusive: true, cngPlus: true, featured: true,
    filter: 'Renta corta',
  },
  {
    id: 2,
    img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80',
    name: 'Brickell Modern Loft',
    type: 'Renta larga', typeColor: TEAL,
    location: 'Miami · Brickell', flag: '🇺🇸',
    beds: 2, price: '$3,200', period: '/mes', priceColor: TEAL,
    filter: 'Renta larga',
  },
  {
    id: 3,
    img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80',
    name: 'Casa Lomas de Chapultepec',
    type: 'Venta', typeColor: '#e7c092',
    location: 'CDMX · Lomas', flag: '🇲🇽',
    beds: 4, price: '$4.2M', period: 'USD', priceColor: '#e7c092',
    filter: 'Venta',
  },
  {
    id: 4,
    img: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=400&q=80',
    name: 'Villa Punta Mita',
    type: 'Renta corta', typeColor: TEAL,
    location: 'Nayarit · Punta Mita', flag: '🇲🇽',
    beds: 5, price: '$850', period: '/ noche', priceColor: TEAL,
    exclusive: true, filter: 'Renta corta',
  },
  {
    id: 5,
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80',
    name: 'Penthouse Wynwood',
    type: 'Venta', typeColor: '#e7c092',
    location: 'Miami · Wynwood', flag: '🇺🇸',
    beds: 3, price: '$1.8M', period: 'USD', priceColor: '#e7c092',
    filter: 'Venta',
  },
]

const CHAT_INIT = [
  { role: 'ai', text: 'Hola Oscar 👋 Cuéntame qué buscas — ¿comprar, rentar por temporada o larga estancia? Yo encuentro la propiedad ideal para ti.' }
]

export default function RealEstateScreen({ onBack }) {
  const [activeFilter, setActiveFilter] = useState('🏠 Todos')
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')
  const [searched, setSearched] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = activeFilter === '🏠 Todos'
    ? PROPERTIES
    : activeFilter === '⭐ CNG Exclusive'
      ? PROPERTIES.filter(p => p.exclusive)
      : PROPERTIES.filter(p => p.filter === activeFilter.replace(/^.+\s/, '').trim())

  const featured = filtered.find(p => p.featured)
  const rest = filtered.filter(p => !p.featured)

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: `Excelente 🏡 Encontré propiedades para "${text}". ¿Tienes alguna preferencia de zona o presupuesto?` }
    ])
    setSearchTerm(text)
    setInput('')
    setSearched(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Real Estate" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ padding: '7px 12px', background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🇲🇽</span>
            <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>MX</span>
          </div>
          <div style={{ padding: '7px 12px', background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🇺🇸</span>
            <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>US</span>
          </div>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark */}
        <div style={{ background: 'linear-gradient(135deg, #080f0d, #0d1a14)', border: `1px solid ${TEAL_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0f2a1e,#1a3a28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="domain" size={20} style={{ color: TEAL }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asesor de Propiedades</p>
              <p style={{ fontSize: 14, color: '#c8e8d8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · CNG Real Estate</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 99, background: TEAL }} />
              <p style={{ fontSize: 10, color: TEAL, margin: 0, fontWeight: 600 }}>activo</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: '#0a1010',
                border: `1px solid ${m.role === 'ai' ? 'rgba(104,219,174,0.15)' : 'rgba(104,219,174,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#a8d8c8' : '#c8e8d8',
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
              placeholder="¿Comprar, rentar o invertir?"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${TEAL_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#c8e8d8', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: TEAL, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#0a2010' }} />
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
              border: activeFilter === f ? 'none' : `1px solid rgba(255,255,255,0.07)`,
              outline: activeFilter === f ? `1px solid ${TEAL_BORDER}` : 'none',
              background: activeFilter === f ? '#0f1a1a' : 'rgba(255,255,255,0.03)',
              color: activeFilter === f ? TEAL : '#445',
            }}>{f}</button>
          ))}
        </div>

        {/* Results label */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {searched
            ? <p style={{ fontSize: 12, color: '#445', margin: 0 }}>Resultados para <span style={{ color: TEAL, fontWeight: 700 }}>"{searchTerm}"</span></p>
            : <p style={{ fontSize: 12, color: '#445', margin: 0 }}>Portafolio <span style={{ color: TEAL, fontWeight: 700 }}>CNG · MX & US</span></p>
          }
          <p style={{ fontSize: 11, color: TEAL, fontWeight: 700, margin: 0 }}>{filtered.length} props.</p>
        </div>

        {/* Property cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Featured — hero image */}
          {featured && (
            <div style={{ background: '#0d1a14', border: `1px solid rgba(104,219,174,0.25)`, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 190 }}>
                <img src={featured.img} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d1a14 0%, rgba(13,26,20,0.4) 60%, transparent 100%)' }} />
                <div style={{ position: 'absolute', top: 10, left: 10, background: TEAL, padding: '4px 12px', borderRadius: 99, fontSize: 10, color: '#0a2010', fontWeight: 800 }}>✦ CNG EXCLUSIVE</div>
                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', padding: '5px 10px', borderRadius: 99 }}>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>📅 {featured.type}</span>
                </div>
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: 99 }}>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{featured.flag} {featured.location}</span>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#e8f5f0', margin: 0, fontFamily: FONT.headline, lineHeight: 1.2, flex: 1, marginRight: 12 }}>{featured.name}</h3>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 900, color: featured.priceColor, margin: 0, fontFamily: FONT.headline }}>{featured.price}</p>
                    <p style={{ fontSize: 10, color: '#3a6a5a', margin: 0 }}>{featured.period}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {featured.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: TEAL_DIM, color: TEAL, border: `1px solid ${TEAL_BORDER}` }}>{tag}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#3a6a5a' }}>⭐ {featured.rating} · {featured.reviews} reseñas</span>
                  {featured.cngPlus && (
                    <span style={{ fontSize: 11, background: 'rgba(231,192,146,0.1)', color: '#e7c092', padding: '3px 10px', borderRadius: 99, fontWeight: 700, border: '1px solid rgba(231,192,146,0.2)' }}>CNG+ precio especial</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, padding: 11, background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, borderRadius: 10, fontSize: 12, color: TEAL, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>Ver detalles</button>
                  <button style={{ flex: 1, padding: 11, background: TEAL, border: 'none', borderRadius: 10, fontSize: 12, color: '#0a2010', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>Reservar ahora</button>
                </div>
              </div>
            </div>
          )}

          {/* Compact cards — imagen lateral */}
          {rest.map(p => (
            <div key={p.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: 110, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(13,17,23,0.3))' }} />
                {p.exclusive && (
                  <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: 9, background: TEAL, color: '#0a2010', padding: '2px 6px', borderRadius: 99, fontWeight: 800 }}>✦ EXCL.</span>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#e8f5f0', margin: 0, fontFamily: FONT.headline, lineHeight: 1.3, flex: 1, marginRight: 8 }}>{p.name}</h3>
                  <span style={{ fontSize: 10, background: p.typeColor === TEAL ? TEAL_DIM : 'rgba(231,192,146,0.1)', color: p.typeColor, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: `1px solid ${p.typeColor === TEAL ? TEAL_BORDER : 'rgba(231,192,146,0.2)'}`, whiteSpace: 'nowrap' }}>{p.type}</span>
                </div>
                <p style={{ fontSize: 11, color: '#2a4a3a', margin: '0 0 8px' }}>{p.flag} {p.location} · {p.beds} Rec.</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: p.priceColor, fontFamily: FONT.headline }}>{p.price}</span>
                    <span style={{ fontSize: 10, color: '#2a4a3a', marginLeft: 4 }}>{p.period}</span>
                  </div>
                  <button style={{ padding: '7px 14px', background: p.typeColor === TEAL ? TEAL : 'rgba(231,192,146,0.15)', border: p.typeColor === TEAL ? 'none' : '1px solid rgba(231,192,146,0.25)', borderRadius: 9, fontSize: 11, color: p.typeColor === TEAL ? '#0a2010' : '#e7c092', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>Ver más</button>
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