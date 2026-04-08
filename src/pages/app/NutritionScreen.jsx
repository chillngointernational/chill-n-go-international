import { useState } from 'react'
import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const GREEN = '#68db82'
const GREEN_DIM = 'rgba(104,219,130,0.12)'
const GREEN_BORDER = 'rgba(104,219,130,0.22)'
const SURFACE = '#0d1117'
const SURFACE_GREEN = '#0d1f18'

const CATEGORIES = ['🌿 Todos', '💊 Vitaminas', '💪 Proteína', '🧠 Cognitivos', '😴 Sueño', '🦠 Gut']

const PRODUCTS = [
  {
    id: 1,
    img: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&q=80',
    name: 'Omega-3 Ultra',
    tags: 'Corazón · Cerebro · Inflamación',
    price: 24, original: 38,
    color: GREEN,
    featured: true,
    category: 'Vitaminas',
    badges: ['EPA 1200mg', 'DHA 800mg'],
    catLabel: '🐟 Omega',
    catColor: GREEN,
  },
  {
    id: 2,
    img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
    name: 'Magnesio L-T',
    tags: 'Sueño · Músculo',
    price: 18,
    color: '#c5c0ff',
    category: 'Sueño',
    catLabel: '😴 Sueño',
    catColor: '#c5c0ff',
  },
  {
    id: 3,
    img: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&q=80',
    name: 'Vitamina D3+K2',
    tags: 'Huesos · Inmune',
    price: 21,
    color: '#e7c092',
    category: 'Vitaminas',
    catLabel: '☀️ Vitaminas',
    catColor: '#e7c092',
  },
  {
    id: 4,
    img: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&q=80',
    name: "Lion's Mane",
    tags: 'Foco · Memoria',
    price: 32,
    color: '#c5c0ff',
    category: 'Cognitivos',
    catLabel: '🧠 Cognitivos',
    catColor: '#c5c0ff',
  },
  {
    id: 5,
    img: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&q=80',
    name: 'Probiótico 50B',
    tags: 'Gut · Digestión',
    price: 27,
    color: GREEN,
    category: 'Gut',
    catLabel: '🦠 Gut',
    catColor: GREEN,
  },
  {
    id: 6,
    img: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&q=80',
    name: 'Whey Isolate',
    tags: 'Músculo · Recuperación',
    price: 45,
    color: '#e7c092',
    category: 'Proteína',
    catLabel: '💪 Proteína',
    catColor: '#e7c092',
  },
]

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
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1a4a2e, #2d6e42)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="eco" size={22} style={{ color: GREEN }} />
            </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: C.onSurface, margin: 0 }}>Market</h2>
          <span style={{ fontSize: 11, color: '#3a6a5a', fontWeight: 600 }}>{filtered.length} productos</span>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body, border: 'none',
                background: activeCategory === cat ? '#1a4a2e' : 'rgba(255,255,255,0.04)',
                color: activeCategory === cat ? GREEN : '#5a7a6a',
                outline: activeCategory === cat ? `1px solid ${GREEN_BORDER}` : '1px solid rgba(255,255,255,0.07)',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Featured Product */}
        {featured && (
          <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${GREEN_BORDER}` }}>
            <div style={{ position: 'relative', height: 180 }}>
              <img src={featured.img} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080C14 0%, rgba(8,12,20,0.5) 50%, rgba(8,12,20,0.1) 100%)' }} />
              <div style={{ position: 'absolute', top: 12, left: 12, background: GREEN, padding: '4px 12px', borderRadius: 99, fontSize: 10, color: '#0a2010', fontWeight: 800, letterSpacing: 1 }}>RECOMENDADO</div>
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 99 }}>
                <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>${featured.price} <span style={{ textDecoration: 'line-through', color: '#3a6a5a', fontSize: 10 }}>${featured.original}</span></span>
              </div>
            </div>
            <div style={{ background: SURFACE_GREEN, padding: '14px 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#e8f5ee', margin: '0 0 3px', fontFamily: FONT.headline }}>{featured.name}</p>
                  <p style={{ fontSize: 11, color: '#3a6a5a', margin: '0 0 10px' }}>{featured.tags}</p>
                  {featured.badges && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {featured.badges.map(b => (
                        <span key={b} style={{ fontSize: 10, background: GREEN_DIM, color: GREEN, padding: '3px 10px', borderRadius: 99, border: `1px solid ${GREEN_BORDER}` }}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleStack(featured.id)}
                  style={{ padding: '10px 18px', background: stack.includes(featured.id) ? GREEN_DIM : GREEN, border: stack.includes(featured.id) ? `1px solid ${GREEN}` : 'none', borderRadius: 12, fontSize: 12, color: stack.includes(featured.id) ? GREEN : '#0a2010', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT.body }}
                >{stack.includes(featured.id) ? '✓ En Stack' : '+ Stack'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {rest.map(p => (
            <div key={p.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d1117 0%, transparent 60%)' }} />
                <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, color: p.catColor, fontWeight: 700, background: 'rgba(0,0,0,0.45)', padding: '2px 8px', borderRadius: 99 }}>{p.catLabel}</div>
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#e8f5ee', margin: '0 0 2px', fontFamily: FONT.headline }}>{p.name}</p>
                <p style={{ fontSize: 10, color: '#445', margin: '0 0 8px' }}>{p.tags}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: p.color, fontFamily: FONT.headline }}>${p.price}</span>
                  <button
                    onClick={() => toggleStack(p.id)}
                    style={{ width: 32, height: 32, background: GREEN_DIM, border: `1px solid ${stack.includes(p.id) ? GREEN : GREEN_BORDER}`, borderRadius: 9, fontSize: stack.includes(p.id) ? 14 : 18, color: GREEN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: FONT.body }}
                  >{stack.includes(p.id) ? '✓' : '+'}</button>
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