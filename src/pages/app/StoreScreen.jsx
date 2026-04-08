import { useState } from 'react'
import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const PURPLE = '#b8a4ff'
const PURPLE_DIM = 'rgba(184,164,255,0.12)'
const PURPLE_BORDER = 'rgba(184,164,255,0.22)'
const SURFACE = '#0d1117'
const SURFACE_PURPLE = '#0d1020'

const CATEGORIES = ['✦ Para ti', '👕 Ropa', '⌚ Gadgets', '🏠 Hogar', '🎒 Accesorios', '✨ CNG Originals']

const PRODUCTS = [
  {
    id: 1,
    img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80&auto=format&fit=crop',
    name: 'Nike Dri-FIT',
    sub: 'Entrenamiento · Hombre · S M L XL',
    price: 349, original: 520, discount: '-33%',
    featured: true, brand: 'NIKE',
    category: 'Ropa',
  },
  {
    id: 2,
    img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&q=80&auto=format&fit=crop',
    name: 'Nike Pro Slim',
    sub: 'Compresión · Gym',
    price: 289, color: '#e7c092',
    category: 'Ropa',
    catLabel: '👕 Ropa', catColor: '#e7c092',
  },
  {
    id: 3,
    img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop',
    name: 'Casio G-Shock',
    sub: 'Reloj · Lifestyle · Unisex',
    price: 1299, color: PURPLE,
    category: 'Gadgets',
    catLabel: '⌚ Gadgets', catColor: PURPLE,
  },
  {
    id: 4,
    img: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&q=80&auto=format&fit=crop',
    name: 'Nike Revolution 7',
    sub: 'Running · Gym · Unisex',
    price: 1099, cng: true,
    color: PURPLE, wide: true,
    category: 'Ropa',
    catLabel: '👟 Running', catColor: PURPLE,
  },
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
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: `Perfecto 🔥 Encontré opciones para "${text}". ¿Quieres filtrar por talla o color?` }
    ])
    setInput('')
    setSearched(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Store Online" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛍</div>
          {cart.length > 0 && (
            <div style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, background: PURPLE, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#1a0a2e' }}>{cart.length}</div>
          )}
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark */}
        <div style={{ background: 'linear-gradient(135deg, #0a0810, #100d1e)', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#1a1030,#2a1850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="auto_awesome" size={20} style={{ color: PURPLE }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: PURPLE, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Compras</p>
              <p style={{ fontSize: 14, color: '#ddd8ff', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · IA CNG</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 99, background: PURPLE }} />
              <p style={{ fontSize: 10, color: PURPLE, margin: 0, fontWeight: 600 }}>activo</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: m.role === 'ai' ? '#0d1020' : '#12101e',
                border: `1px solid ${m.role === 'ai' ? 'rgba(184,164,255,0.15)' : 'rgba(184,164,255,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#c5b8ff' : '#d8d0ff',
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
              placeholder="Escríbeme como le hablas a un amigo..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#ddd8ff', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: PURPLE, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#1a0a2e' }} />
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
              outline: activeCategory === cat ? `1px solid ${PURPLE_BORDER}` : 'none',
              background: activeCategory === cat ? '#1a1a2e' : 'rgba(255,255,255,0.03)',
              color: activeCategory === cat ? PURPLE : '#445',
            }}>{cat}</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Featured — hero image */}
          {featured && (
            <div style={{ gridColumn: 'span 2', borderRadius: 20, overflow: 'hidden', border: `1px solid ${PURPLE_BORDER}` }}>
              <div style={{ position: 'relative', height: 180 }}>
                <img src={featured.img} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080C14 0%, rgba(8,12,20,0.5) 50%, rgba(8,12,20,0.1) 100%)' }} />
                <div style={{ position: 'absolute', top: 12, left: 12, background: PURPLE, padding: '4px 12px', borderRadius: 99, fontSize: 10, color: '#1a0a2e', fontWeight: 800, letterSpacing: 1 }}>MEJOR MATCH</div>
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 99 }}>
                  <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700 }}>${featured.price} <span style={{ textDecoration: 'line-through', color: '#554466', fontSize: 10 }}>${featured.original}</span> <span style={{ color: '#e7c092', fontSize: 10 }}>{featured.discount}</span></span>
                </div>
              </div>
              <div style={{ background: SURFACE_PURPLE, padding: '14px 16px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#f0eeff', margin: 0, fontFamily: FONT.headline }}>{featured.name}</p>
                      <span style={{ fontSize: 10, background: PURPLE_DIM, color: PURPLE, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: `1px solid ${PURPLE_BORDER}` }}>{featured.brand}</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#445', margin: 0 }}>{featured.sub}</p>
                  </div>
                  <button
                    onClick={() => toggleCart(featured.id)}
                    style={{ padding: '10px 18px', background: cart.includes(featured.id) ? PURPLE_DIM : PURPLE, border: cart.includes(featured.id) ? `1px solid ${PURPLE}` : 'none', borderRadius: 12, fontSize: 12, color: cart.includes(featured.id) ? PURPLE : '#1a0a2e', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT.body }}
                  >{cart.includes(featured.id) ? '✓ Agregado' : '+ Carrito'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Small cards — con imagen */}
          {rest.filter(p => !p.wide).map(p => (
            <div key={p.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d1117 0%, transparent 60%)' }} />
                {p.catLabel && <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, color: p.catColor, fontWeight: 700, background: 'rgba(0,0,0,0.45)', padding: '2px 8px', borderRadius: 99 }}>{p.catLabel}</div>}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#f0eeff', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
                <p style={{ fontSize: 10, color: '#445', margin: '0 0 8px' }}>{p.sub}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.color || PURPLE, fontFamily: FONT.headline }}>${p.price}</span>
                  <button
                    onClick={() => toggleCart(p.id)}
                    style={{ width: 32, height: 32, background: PURPLE_DIM, border: `1px solid ${cart.includes(p.id) ? PURPLE : PURPLE_BORDER}`, borderRadius: 9, fontSize: cart.includes(p.id) ? 14 : 18, color: PURPLE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
                  >{cart.includes(p.id) ? '✓' : '+'}</button>
                </div>
              </div>
            </div>
          ))}

          {/* Wide card — imagen lateral */}
          {rest.filter(p => p.wide).map(p => (
            <div key={p.id} style={{ gridColumn: 'span 2', background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: 110, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(13,17,23,0.4))' }} />
              </div>
              <div style={{ flex: 1, padding: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f0eeff', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
                <p style={{ fontSize: 11, color: '#445', margin: '0 0 8px' }}>{p.sub}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: p.color || PURPLE, fontFamily: FONT.headline }}>${p.price}</span>
                    {p.cng && <span style={{ fontSize: 10, color: C.secondary, fontWeight: 700, background: 'rgba(231,192,146,0.1)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(231,192,146,0.15)' }}>CNG+ precio</span>}
                  </div>
                  <button
                    onClick={() => toggleCart(p.id)}
                    style={{ width: 32, height: 32, background: PURPLE_DIM, border: `1px solid ${cart.includes(p.id) ? PURPLE : PURPLE_BORDER}`, borderRadius: 9, fontSize: cart.includes(p.id) ? 14 : 18, color: PURPLE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
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