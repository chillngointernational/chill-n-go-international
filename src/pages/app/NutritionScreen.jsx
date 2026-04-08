import { useState } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const CATEGORIES = ['🌿 Todos', '💊 Vitaminas', '💪 Proteína', '🧠 Cognitivos', '😴 Sueño', '🦠 Gut']

const PRODUCTS = [
  { id: 1, emoji: '🐟', name: 'Omega-3 Ultra', tags: 'Corazón · Cerebro · Inflamación', price: 24, original: 38, color: '#68db82', featured: true, category: 'Vitaminas' },
  { id: 2, emoji: '🌙', name: 'Magnesio L-T', tags: 'Sueño · Músculo', price: 18, color: '#c5c0ff', category: 'Sueño' },
  { id: 3, emoji: '☀️', name: 'Vitamina D3+K2', tags: 'Huesos · Inmune', price: 21, color: '#e7c092', category: 'Vitaminas' },
  { id: 4, emoji: '🧠', name: "Lion's Mane", tags: 'Foco · Memoria', price: 32, color: '#c5c0ff', category: 'Cognitivos' },
  { id: 5, emoji: '🦠', name: 'Probiótico 50B', tags: 'Gut · Digestión', price: 27, color: '#68db82', category: 'Gut' },
  { id: 6, emoji: '💪', name: 'Whey Isolate', tags: 'Músculo · Recuperación', price: 45, color: '#e7c092', category: 'Proteína' },
]

const GREEN = '#68db82'
const GREEN_DIM = 'rgba(104,219,130,0.12)'
const GREEN_BORDER = 'rgba(104,219,130,0.22)'
const SURFACE = '#0d1117'
const SURFACE_GREEN = '#0d1f18'

export default function NutritionScreen({ onBack }) {
  const [companionOpen, setCompanionOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('🌿 Todos')
  const [stack, setStack] = useState([])

  const filtered = activeCategory === '🌿 Todos'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeCategory.replace(/^.+\s/, ''))

  const featured = filtered.find(p => p.featured)
  const rest = filtered.filter(p => !p.featured)

  function toggleStack(id) {
    setStack(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Nutrition" leftIcon="arrow_back" onLeft={onBack} rightContent={
        stack.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Mi Stack</span>
            <span style={{ width: 18, height: 18, borderRadius: 99, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a2010' }}>{stack.length}</span>
          </div>
        )
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Companion Card */}
        <div
          onClick={() => setCompanionOpen(o => !o)}
          style={{ background: `linear-gradient(135deg, ${SURFACE_GREEN}, #111a10)`, border: `1px solid ${GREEN_BORDER}`, borderRadius: 20, padding: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, background: 'rgba(104,219,130,0.06)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1a4a2e, #2d6e42)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🌿</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: GREEN, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 3px' }}>Tu Compañero</p>
              <p style={{ fontSize: 14, color: '#c8e8d0', fontWeight: 600, margin: 0, fontFamily: FONT.headline }}>Compañero Nutricional</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: 99, background: GREEN }} />
              <p style={{ fontSize: 10, color: GREEN, margin: 0, fontWeight: 600 }}>activo</p>
            </div>
          </div>

          {!companionOpen ? (
            <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, color: '#8aaf95', margin: 0, fontStyle: 'italic' }}>"Hoy es buen día para revisar tu stack..."</p>
              <Icon name="keyboard_arrow_down" size={18} style={{ color: GREEN, flexShrink: 0 }} />
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 14 }}>
                <p style={{ fontSize: 13, color: '#a8c8b0', lineHeight: 1.6, margin: '0 0 12px' }}>
                  Llevas <span style={{ color: GREEN, fontWeight: 700 }}>3 días</span> sin registrar tu Omega-3. Tu próxima tanda llega en 5 días — ¿quieres que te recuerde tomarlo con la comida?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={e => e.stopPropagation()} style={{ flex: 1, padding: 9, background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 10, fontSize: 12, color: GREEN, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>Sí, recuérdame</button>
                  <button onClick={e => e.stopPropagation()} style={{ flex: 1, padding: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#8aaf95', cursor: 'pointer', fontFamily: FONT.body }}>Hablar</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {[['6', 'racha días', GREEN], ['72%', 'adherencia', C.secondary], ['3', 'productos', '#c5c0ff']].map(([val, label, color]) => (
                  <div key={label} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: FONT.headline }}>{val}</p>
                    <p style={{ fontSize: 10, color: '#5a7a6a', margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Market Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: C.onSurface, margin: 0, letterSpacing: '-0.3px' }}>Market</h2>
          <Icon name="shopping_cart" size={22} style={{ color: '#5a7a6a' }} />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body, border: 'none',
                background: activeCategory === cat ? '#1a4a2e' : 'rgba(255,255,255,0.04)',
                color: activeCategory === cat ? GREEN : '#5a7a6a',
                outline: activeCategory === cat ? `1px solid ${GREEN_BORDER}` : '1px solid rgba(255,255,255,0.07)',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Featured Product */}
        {featured && (
          <div style={{ background: SURFACE_GREEN, border: `1px solid ${GREEN_BORDER}`, borderRadius: 18, padding: 16, display: 'flex', gap: 14, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, background: GREEN, padding: '4px 14px', borderRadius: '0 18px 0 10px', fontSize: 10, color: '#0a2010', fontWeight: 800, letterSpacing: 1 }}>RECOMENDADO</div>
            <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #1a3a28, #2a5a3a)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>{featured.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#e8f5ee', margin: '0 0 3px', fontFamily: FONT.headline }}>{featured.name}</p>
              <p style={{ fontSize: 11, color: '#5a8a6a', margin: '0 0 10px' }}>{featured.tags}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: GREEN, fontFamily: FONT.headline }}>${featured.price}</span>
                  {featured.original && <span style={{ fontSize: 11, color: '#5a7a6a', marginLeft: 6, textDecoration: 'line-through' }}>${featured.original}</span>}
                </div>
                <button
                  onClick={() => toggleStack(featured.id)}
                  style={{ padding: '7px 16px', background: stack.includes(featured.id) ? 'rgba(104,219,130,0.2)' : GREEN, border: stack.includes(featured.id) ? `1px solid ${GREEN}` : 'none', borderRadius: 10, fontSize: 12, color: stack.includes(featured.id) ? GREEN : '#0a2010', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}
                >{stack.includes(featured.id) ? '✓ En Stack' : '+ Stack'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rest.map(p => (
            <div key={p.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
              <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.04)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 10 }}>{p.emoji}</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e8f5ee', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
              <p style={{ fontSize: 10, color: '#4a6a5a', margin: '0 0 10px' }}>{p.tags}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: p.color, fontFamily: FONT.headline }}>${p.price}</span>
                <button
                  onClick={() => toggleStack(p.id)}
                  style={{ width: 30, height: 30, background: stack.includes(p.id) ? GREEN_DIM : GREEN_DIM, border: `1px solid ${stack.includes(p.id) ? GREEN : GREEN_BORDER}`, borderRadius: 8, fontSize: 14, color: GREEN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
                >{stack.includes(p.id) ? '✓' : '+'}</button>
              </div>
            </div>
          ))}
        </div>

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}