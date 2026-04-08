import { useState } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const PURPLE = '#b8a4ff'
const PURPLE_DIM = 'rgba(184,164,255,0.12)'
const PURPLE_BORDER = 'rgba(184,164,255,0.22)'
const SURFACE = '#0d1117'
const SURFACE_PURPLE = '#0d1020'

const CATEGORIES = ['✦ Para ti', '👕 Ropa', '⌚ Gadgets', '🏠 Hogar', '🎒 Accesorios', '✨ CNG Originals']

const PRODUCTS = [
  { id: 1, emoji: '👕', name: 'Nike Dri-FIT', sub: 'Entrenamiento · Hombre · S M L XL', price: 349, original: 520, discount: '-33%', featured: true, brand: 'NIKE' },
  { id: 2, emoji: '👕', name: 'Nike Pro Slim', sub: 'Compresión · Gym', price: 289, color: '#e7c092' },
  { id: 3, emoji: '👕', name: 'Nike Breathe', sub: 'Ligera · Running', price: 319, color: PURPLE },
  { id: 4, emoji: '👟', name: 'Nike Revolution 7', sub: 'Running · Gym · Unisex', price: 1099, cng: true, wide: true },
]

const CHAT_INIT = [
  { role: 'ai', text: 'Hola Oscar 👋 Escríbeme lo que buscas como le hablarías a un amigo — yo encuentro lo que necesitas.' }
]

export default function StoreScreen({ onBack }) {
  const [activeCategory, setActiveCategory] = useState('✦ Para ti')
  const [cart, setCart] = useState([])
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')
  const [searched, setSearched] = useState(false)

  const featured = PRODUCTS.find(p => p.featured)
  const rest = PRODUCTS.filter(p => !p.featured)

  function toggleCart(id) {
    setCart(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    const userMsg = { role: 'user', text }
    const aiMsg = { role: 'ai', text: `Perfecto 🔥 Encontré 4 opciones para "${text}". ¿Quieres filtrar por talla o color?` }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setInput('')
    setSearched(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Store Online" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => { }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛍</div>
          {cart.length > 0 && (
            <div style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, background: PURPLE, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#1a0a2e' }}>{cart.length}</div>
          )}
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark Assistant */}
        <div style={{ background: `linear-gradient(135deg, #0a0810, #100d1e)`, border: `1px solid ${PURPLE_BORDER}`, borderRadius: 20, padding: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#1a1030,#2a1850)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✦</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: PURPLE, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Compras</p>
              <p style={{ fontSize: 14, color: '#ddd8ff', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · IA CNG</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 99, background: PURPLE }} />
              <p style={{ fontSize: 10, color: PURPLE, margin: 0, fontWeight: 600 }}>activo</p>
            </div>
          </div>

          {/* Chat messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: m.role === 'ai' ? '#0d1020' : '#12101e',
                border: `1px solid ${m.role === 'ai' ? 'rgba(184,164,255,0.15)' : 'rgba(184,164,255,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#c5b8ff' : '#d8d0ff',
                lineHeight: 1.55,
                maxWidth: '86%',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>{m.text}</div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Escríbeme como le hablas a un amigo..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#ddd8ff', fontFamily: FONT.body, outline: 'none' }}
            />
            <button
              onClick={handleSend}
              style={{ width: 42, height: 42, background: PURPLE, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Icon name="send" size={18} style={{ color: '#1a0a2e' }} />
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
                border: activeCategory === cat ? 'none' : `1px solid rgba(255,255,255,0.07)`,
                outline: activeCategory === cat ? `1px solid ${PURPLE_BORDER}` : 'none',
                background: activeCategory === cat ? '#1a1a2e' : 'rgba(255,255,255,0.03)',
                color: activeCategory === cat ? PURPLE : '#445',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Results label */}
        {searched && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: '#445', margin: 0 }}>Resultados para <span style={{ color: PURPLE, fontWeight: 700 }}>"{messages.find(m => m.role === 'user')?.text}"</span></p>
            <p style={{ fontSize: 11, color: PURPLE, fontWeight: 700, margin: 0 }}>4 productos</p>
          </div>
        )}

        {/* Products */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          {/* Featured */}
          <div style={{ gridColumn: 'span 2', background: SURFACE_PURPLE, border: `1px solid ${PURPLE_BORDER}`, borderRadius: 18, padding: 16, display: 'flex', gap: 14, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, background: PURPLE, padding: '4px 14px', borderRadius: '0 18px 0 10px', fontSize: 10, color: '#1a0a2e', fontWeight: 800, letterSpacing: 1 }}>MEJOR MATCH</div>
            <div style={{ width: 74, height: 74, background: 'linear-gradient(135deg,#15102a,#1e1540)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, flexShrink: 0 }}>{featured.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#f0eeff', margin: 0, fontFamily: FONT.headline }}>{featured.name}</p>
                <span style={{ fontSize: 10, background: PURPLE_DIM, color: PURPLE, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: `1px solid ${PURPLE_BORDER}` }}>{featured.brand}</span>
              </div>
              <p style={{ fontSize: 11, color: '#445', margin: '0 0 10px' }}>{featured.sub}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: 800, color: PURPLE, fontFamily: FONT.headline }}>${featured.price}</span>
                  <span style={{ fontSize: 11, color: '#333', marginLeft: 6, textDecoration: 'line-through' }}>${featured.original}</span>
                  <span style={{ fontSize: 10, color: C.secondary, marginLeft: 6, fontWeight: 700 }}>{featured.discount}</span>
                </div>
                <button
                  onClick={() => toggleCart(featured.id)}
                  style={{ padding: '8px 16px', background: cart.includes(featured.id) ? PURPLE_DIM : PURPLE, border: cart.includes(featured.id) ? `1px solid ${PURPLE}` : 'none', borderRadius: 10, fontSize: 12, color: cart.includes(featured.id) ? PURPLE : '#1a0a2e', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}
                >{cart.includes(featured.id) ? '✓ Agregado' : '+ Carrito'}</button>
              </div>
            </div>
          </div>

          {/* Small cards */}
          {rest.filter(p => !p.wide).map(p => (
            <div key={p.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
              <div style={{ width: '100%', height: 84, background: '#0a0810', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, marginBottom: 10 }}>{p.emoji}</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#f0eeff', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
              <p style={{ fontSize: 10, color: '#445', margin: '0 0 10px' }}>{p.sub}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: p.color || PURPLE, fontFamily: FONT.headline }}>${p.price}</span>
                <button
                  onClick={() => toggleCart(p.id)}
                  style={{ width: 30, height: 30, background: cart.includes(p.id) ? PURPLE_DIM : PURPLE_DIM, border: `1px solid ${cart.includes(p.id) ? PURPLE : PURPLE_BORDER}`, borderRadius: 8, fontSize: cart.includes(p.id) ? 14 : 18, color: PURPLE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
                >{cart.includes(p.id) ? '✓' : '+'}</button>
              </div>
            </div>
          ))}

          {/* Wide card */}
          {rest.filter(p => p.wide).map(p => (
            <div key={p.id} style={{ gridColumn: 'span 2', background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 62, height: 62, background: '#0a0810', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f0eeff', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
                <p style={{ fontSize: 11, color: '#445', margin: '0 0 8px' }}>{p.sub}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: PURPLE, fontFamily: FONT.headline }}>${p.price}</span>
                    {p.cng && <span style={{ fontSize: 10, color: C.secondary, fontWeight: 700, background: 'rgba(231,192,146,0.1)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(231,192,146,0.15)' }}>CNG+ precio</span>}
                  </div>
                  <button
                    onClick={() => toggleCart(p.id)}
                    style={{ width: 30, height: 30, background: PURPLE_DIM, border: `1px solid ${cart.includes(p.id) ? PURPLE : PURPLE_BORDER}`, borderRadius: 8, fontSize: cart.includes(p.id) ? 14 : 18, color: PURPLE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
                  >{cart.includes(p.id) ? '✓' : '+'}</button>
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