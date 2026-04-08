import { useState } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const GREEN = '#1D9E75'
const GREEN_BRIGHT = '#68dbae'
const GREEN_DIM = 'rgba(29,158,117,0.12)'
const GREEN_BORDER = 'rgba(29,158,117,0.22)'

const IMG = {
  cancun: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=600&h=400&fit=crop',
  losCabos: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&h=400&fit=crop',
  puertoVall: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop',
  tulum: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=400&fit=crop',
  cdmx: 'https://images.unsplash.com/photo-1518659526054-190340b32735?w=600&h=400&fit=crop',
  rivieraMaya: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=600&h=400&fit=crop',
  miami: 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=600&h=400&fit=crop',
  newYork: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&h=400&fit=crop',
  lasVegas: 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=600&h=400&fit=crop',
  losAngeles: 'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=600&h=400&fit=crop',
  orlando: 'https://images.unsplash.com/photo-1575089976121-8ed7b2a54265?w=600&h=400&fit=crop',
  hawaii: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=600&h=400&fit=crop',
}

const MEXICO = [
  { id: 'cancun', name: 'Cancún', loc: 'Quintana Roo, MX', rating: 4.8, price: 299, img: IMG.cancun, tags: ['playa', 'all-inclusive'] },
  { id: 'losCabos', name: 'Los Cabos', loc: 'Baja California, MX', rating: 4.7, price: 349, img: IMG.losCabos, tags: ['playa', 'all-inclusive'] },
  { id: 'puertoVall', name: 'Puerto Vallarta', loc: 'Jalisco, MX', rating: 4.6, price: 199, img: IMG.puertoVall, tags: ['aventura'] },
  { id: 'tulum', name: 'Tulum', loc: 'Quintana Roo, MX', rating: 4.9, price: 279, img: IMG.tulum, tags: ['playa', 'aventura'] },
  { id: 'cdmx', name: 'CDMX', loc: 'Ciudad de México', rating: 4.5, price: 149, img: IMG.cdmx, tags: ['ciudad'] },
  { id: 'rivieraMaya', name: 'Riviera Maya', loc: 'Quintana Roo, MX', rating: 4.8, price: 329, img: IMG.rivieraMaya, tags: ['playa', 'all-inclusive'] },
]

const USA = [
  { id: 'miami', name: 'Miami', loc: 'Florida, US', rating: 4.7, price: 399, img: IMG.miami, tags: ['playa'] },
  { id: 'newYork', name: 'New York', loc: 'New York, US', rating: 4.6, price: 449, img: IMG.newYork, tags: ['ciudad'] },
  { id: 'lasVegas', name: 'Las Vegas', loc: 'Nevada, US', rating: 4.5, price: 249, img: IMG.lasVegas, tags: ['ciudad'] },
  { id: 'losAngeles', name: 'Los Angeles', loc: 'California, US', rating: 4.4, price: 379, img: IMG.losAngeles, tags: ['ciudad'] },
  { id: 'orlando', name: 'Orlando', loc: 'Florida, US', rating: 4.6, price: 289, img: IMG.orlando, tags: ['all-inclusive'] },
  { id: 'hawaii', name: 'Hawái', loc: 'Hawái, US', rating: 4.9, price: 599, img: IMG.hawaii, tags: ['playa', 'aventura'] },
]

const FILTERS = [
  { label: 'Todos', value: 'todos' },
  { label: '🏖 Playa', value: 'playa' },
  { label: '🏙 Ciudad', value: 'ciudad' },
  { label: '🌴 All-Inclusive', value: 'all-inclusive' },
  { label: '🧗 Aventura', value: 'aventura' },
]

const CHAT_INIT = [
  { role: 'ai', text: 'Hola Oscar ✈️ Cuéntame a dónde quieres ir — puedes escribirme como le hablarías a un amigo y yo encuentro el viaje perfecto para ti.' }
]

const filterList = (list, tag) => tag === 'todos' ? list : list.filter(d => d.tags.includes(tag))

function DestCard({ dest }) {
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', height: 180 }}>
      <img src={dest.img} alt={dest.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 99 }}>
        <Icon name="star" fill size={12} style={{ color: '#f59e0b' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: FONT.body }}>{dest.rating}</span>
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
        <h4 style={{ fontFamily: FONT.headline, fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{dest.name}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <Icon name="location_on" fill size={11} style={{ color: GREEN_BRIGHT }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{dest.loc}</span>
        </div>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: '5px 0 0', fontFamily: FONT.headline }}>
          Desde <span style={{ color: GREEN_BRIGHT }}>${dest.price}</span> <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.55 }}>USD</span>
        </p>
      </div>
    </div>
  )
}

function HeroCard({ dest }) {
  return (
    <div style={{ position: 'relative', height: 200, borderRadius: 18, overflow: 'hidden', border: `1px solid ${GREEN_BORDER}` }}>
      <img src={dest.img} alt={dest.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)' }} />
      <div style={{ position: 'absolute', top: 14, left: 14 }}>
        <span style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 10, letterSpacing: 2, padding: '5px 12px', borderRadius: 99, textTransform: 'uppercase' }}>POPULAR</span>
      </div>
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.45)', padding: '5px 10px', borderRadius: 99 }}>
        <Icon name="star" fill size={14} style={{ color: '#f59e0b' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{dest.rating}</span>
      </div>
      <div style={{ position: 'absolute', bottom: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>{dest.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="location_on" fill size={13} style={{ color: GREEN_BRIGHT }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{dest.loc}</span>
          </div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '6px 0 0', fontFamily: FONT.headline }}>
            Desde <span style={{ color: GREEN_BRIGHT }}>${dest.price}</span> <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>USD</span>
          </p>
        </div>
        <button style={{ background: GRADIENT.primary, padding: '11px 20px', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT.body, whiteSpace: 'nowrap' }}>
          Me interesa
        </button>
      </div>
    </div>
  )
}

export default function TravelScreen({ onBack }) {
  const [filter, setFilter] = useState('todos')
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  const applySearch = (list) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(d => d.name.toLowerCase().includes(q) || d.loc.toLowerCase().includes(q))
  }

  const mx = applySearch(filterList(MEXICO, filter))
  const usa = applySearch(filterList(USA, filter))

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setSearch(text)
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: `Perfecto ✈️ Buscando opciones para "${text}". ¿Tienes fechas en mente o prefieres que te muestre las mejores opciones disponibles?` }
    ])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Travel" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ padding: '6px 10px', background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>🇲🇽</span>
            <span style={{ fontSize: 11, color: GREEN_BRIGHT, fontWeight: 700 }}>MX</span>
          </div>
          <div style={{ padding: '6px 10px', background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>🇺🇸</span>
            <span style={{ fontSize: 11, color: GREEN_BRIGHT, fontWeight: 700 }}>US</span>
          </div>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark Travel Assistant */}
        <div style={{ background: 'linear-gradient(135deg, #080f0d, #0d1a14)', border: `1px solid ${GREEN_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0f2a1e,#1a3a28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="flight_takeoff" size={20} style={{ color: GREEN_BRIGHT }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: GREEN_BRIGHT, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Viajes</p>
              <p style={{ fontSize: 14, color: '#c8e8d8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · CNG Travel</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 99, background: GREEN_BRIGHT }} />
              <p style={{ fontSize: 10, color: GREEN_BRIGHT, margin: 0, fontWeight: 600 }}>activo</p>
            </div>
          </div>

          {/* Chat */}
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

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="¿A dónde quieres ir?"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${GREEN_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#c8e8d8', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: GREEN_BRIGHT, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#0a2010' }} />
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
              border: filter === f.value ? 'none' : `1px solid rgba(255,255,255,0.07)`,
              outline: filter === f.value ? `1px solid ${GREEN_BORDER}` : 'none',
              background: filter === f.value ? '#0f2a1e' : 'rgba(255,255,255,0.03)',
              color: filter === f.value ? GREEN_BRIGHT : '#445',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Hero */}
        <HeroCard dest={MEXICO[0]} />

        {/* México */}
        {mx.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: '#445', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 12px' }}>México</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {mx.map(d => <DestCard key={d.id} dest={d} />)}
            </div>
          </div>
        )}

        {/* USA */}
        {usa.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: '#445', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 12px' }}>USA</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {usa.map(d => <DestCard key={d.id} dest={d} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {mx.length === 0 && usa.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Icon name="travel_explore" size={48} style={{ color: '#445' }} />
            <p style={{ color: '#445', fontFamily: FONT.body, fontSize: 14, marginTop: 12 }}>No se encontraron destinos</p>
          </div>
        )}

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}