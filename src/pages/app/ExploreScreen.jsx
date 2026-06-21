import { useState, useEffect, useCallback } from 'react'
import { C, FONT, Icon } from '../../stitch'
import { countListingsByLob } from '../../lib/marketplace'
import TopBar from '../../components/TopBar'

// Hub de verticales (LOB). El arte representa cada vertical (no es producto).
// El badge muestra el conteo REAL de productos por LOB; si es 0 cae al subtítulo.
const CATEGORIES = [
  {
    name: 'Travel',
    sub: 'travel',
    lob: 'travel',
    color: '#1D9E75',
    border: 'rgba(29,158,117,0.25)',
    badge: null,
    subtitle: 'Explorar',
    img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=400&q=80&auto=format&fit=crop',
  },
  {
    name: 'Nutrition',
    sub: 'nutrition',
    lob: 'nutrition',
    color: '#68db82',
    border: 'rgba(104,219,130,0.25)',
    badge: null,
    subtitle: 'Explorar',
    img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&auto=format&fit=crop',
  },
  {
    name: 'Store',
    sub: 'store-local',
    lob: 'store_local',
    color: '#e7c092',
    border: 'rgba(231,192,146,0.25)',
    badge: '📍 LOCAL',
    badgeColor: 'rgba(231,192,146,0.15)',
    badgeBorder: 'rgba(231,192,146,0.3)',
    badgeText: '#e7c092',
    subtitle: 'Comercios locales',
    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80&auto=format&fit=crop',
  },
  {
    name: 'Online Store',
    sub: 'store',
    lob: 'store',
    color: '#b8a4ff',
    border: 'rgba(184,164,255,0.25)',
    badge: '✦ SPARK IA',
    badgeColor: 'rgba(184,164,255,0.15)',
    badgeBorder: 'rgba(184,164,255,0.3)',
    badgeText: '#b8a4ff',
    subtitle: 'Explorar',
    img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80&auto=format&fit=crop',
  },
  {
    name: 'Real Estate',
    sub: 'realestate',
    lob: 'real_estate',
    color: '#68dbae',
    border: 'rgba(104,219,174,0.25)',
    badge: '🇲🇽 🇺🇸',
    badgeColor: 'transparent',
    badgeBorder: 'transparent',
    badgeText: '#fff',
    subtitle: 'MX & US',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80&auto=format&fit=crop',
  },
]

export default function ExploreScreen({ onNavigate, isDesktop }) {
  const [counts, setCounts] = useState({})
  const [q, setQ] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const result = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            result[cat.lob] = await countListingsByLob(cat.lob)
          } catch { /* deja el LOB sin conteo: caerá al subtítulo */ }
        })
      )
      setCounts(result)
    } catch (e) {
      console.error('Explore error:', e?.message || e)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Chill N Go" leftIcon="menu" rightIcon="notifications" />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Search — aún no disponible; honesto en vez de un input muerto */}
        <div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#445' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Explora tu próximo vibe..."
              style={{ width: '100%', height: 48, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, paddingLeft: 44, paddingRight: 90, color: C.onSurface, fontSize: 14, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: C.primary, fontWeight: 700, background: 'rgba(104,219,174,0.12)', border: '1px solid rgba(104,219,174,0.25)', padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
          </div>
          {q.trim() && (
            <p style={{ fontSize: 12, color: C.textFaint, margin: '8px 4px 0', lineHeight: 1.5 }}>
              La búsqueda llega pronto — por ahora explora las verticales 👇
            </p>
          )}
        </div>

        {/* Label */}
        <p style={{ fontSize: 11, color: '#445', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', margin: 0 }}>Verticales</p>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
          {CATEGORIES.map(c => {
            const n = counts[c.lob]
            const label = n > 0 ? `${n} producto${n !== 1 ? 's' : ''}` : c.subtitle
            return (
              <div
                key={c.name}
                onClick={() => onNavigate(c.sub)}
                style={{ position: 'relative', height: 180, borderRadius: 20, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${c.border}` }}
              >
                {/* Image */}
                <img src={c.img} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

                {/* Gradient overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />

                {/* Color tint overlay */}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${c.color}18, transparent 60%)` }} />

                {/* Top left icon */}
                <div style={{ position: 'absolute', top: 12, left: 12, width: 32, height: 32, background: `${c.color}30`, border: `1px solid ${c.color}60`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 99, background: c.color }} />
                </div>

                {/* Top right badge */}
                {c.badge && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: c.badgeColor, border: `1px solid ${c.badgeBorder}`, padding: '3px 8px', borderRadius: 99 }}>
                    <span style={{ fontSize: 9, color: c.badgeText, fontWeight: 700 }}>{c.badge}</span>
                  </div>
                )}

                {/* Bottom info */}
                <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 5px', fontFamily: FONT.headline }}>{c.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: c.color, fontWeight: 600 }}>{label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
