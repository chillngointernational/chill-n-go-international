import { useState } from 'react'
import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

const PURPLE = '#c5c0ff'
const PURPLE_DIM = 'rgba(197,192,255,0.10)'
const PURPLE_BORDER = 'rgba(197,192,255,0.20)'
const PURPLE_GRAD = 'linear-gradient(135deg, #8c84eb, #c5c0ff)'
const SURFACE = '#0d1117'

const FILTERS = ['✦ Todas', '🍕 Food', '🛍 Retail', '💆 Wellness', '⭐ CNG Directo']

const FRANCHISES = [
  {
    id: 1,
    img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80&auto=format&fit=crop',
    name: 'Artisanal Bakery Seed Round',
    category: 'Food & Beverage',
    categoryIcon: '🍕',
    roi: '18–24%',
    goal: '$50,000',
    funded: 78,
    investors: 23,
    daysLeft: 8,
    minInvest: '$500 USD',
    term: '24 meses',
    cngDirect: true,
    cngPlus: true,
    featured: true,
    filter: 'Food',
  },
  {
    id: 2,
    img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&q=80&auto=format&fit=crop',
    name: 'FitZone Franchise Serie A',
    category: 'Wellness',
    categoryIcon: '💆',
    roi: '22%',
    roiColor: '#68dbae',
    funded: 62,
    daysLeft: 15,
    minInvest: '$1,000',
    filter: 'Wellness',
  },
  {
    id: 3,
    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80&auto=format&fit=crop',
    name: 'Taco Urbano Expansión MX',
    category: 'Food',
    categoryIcon: '🍕',
    roi: '19%',
    roiColor: '#e7c092',
    funded: 91,
    daysLeft: 3,
    urgent: true,
    minInvest: '$500',
    filter: 'Food',
  },
  {
    id: 4,
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80&auto=format&fit=crop',
    name: 'UrbanStyle Retail Miami',
    category: 'Retail',
    categoryIcon: '🛍',
    roi: '16%',
    roiColor: PURPLE,
    funded: 45,
    daysLeft: 30,
    minInvest: '$2,000',
    filter: 'Retail',
  },
]

export default function CandyStakesScreen({ onBack }) {
  const [activeFilter, setActiveFilter] = useState('✦ Todas')

  const filtered = activeFilter === '✦ Todas'
    ? FRANCHISES
    : activeFilter === '⭐ CNG Directo'
      ? FRANCHISES.filter(f => f.cngDirect)
      : FRANCHISES.filter(f => f.filter === activeFilter.replace(/^.+\s/, ''))

  const featured = filtered.find(f => f.featured)
  const rest = filtered.filter(f => !f.featured)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="CandyStakes" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, borderRadius: 99, cursor: 'pointer' }}>
          <span style={{ fontSize: 13 }}>💼</span>
          <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700 }}>Mi Portfolio</span>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Invertido', value: '$5,200', color: PURPLE },
            { label: 'Retorno', value: '+18%', color: '#68dbae' },
            { label: 'Activas', value: '3', color: '#e8e4ff' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0d1020', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 14, padding: 14 }}>
              <p style={{ fontSize: 10, color: '#445', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: s.color, margin: 0, fontFamily: FONT.headline }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: '#e8e4ff', margin: 0 }}>Franquicias Activas</h2>
          <span style={{ fontSize: 11, color: '#445', fontWeight: 600 }}>{filtered.length} campañas</span>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
              border: activeFilter === f ? 'none' : `1px solid rgba(255,255,255,0.07)`,
              outline: activeFilter === f ? `1px solid ${PURPLE_BORDER}` : 'none',
              background: activeFilter === f ? '#1a1030' : 'rgba(255,255,255,0.03)',
              color: activeFilter === f ? PURPLE : '#445',
            }}>{f}</button>
          ))}
        </div>

        {/* Featured card */}
        {featured && (
          <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${PURPLE_BORDER}` }}>
            <div style={{ position: 'relative', height: 170 }}>
              <img src={featured.img} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080C14 0%, rgba(8,12,20,0.4) 60%, transparent 100%)' }} />
              <div style={{ position: 'absolute', top: 12, left: 12, background: PURPLE, padding: '4px 12px', borderRadius: 99, fontSize: 10, color: '#1a0a2e', fontWeight: 800 }}>✦ CNG DIRECTO</div>
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: 99 }}>
                <span style={{ fontSize: 11, color: '#68dbae', fontWeight: 700 }}>ROI {featured.roi}</span>
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
                <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.5)', color: '#e7c092', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>{featured.categoryIcon} {featured.category}</span>
              </div>
            </div>
            <div style={{ background: '#0d0f20', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#e8e4ff', margin: 0, fontFamily: FONT.headline, lineHeight: 1.2, flex: 1, marginRight: 12 }}>{featured.name}</h3>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 900, color: PURPLE, margin: 0, fontFamily: FONT.headline }}>{featured.goal}</p>
                  <p style={{ fontSize: 10, color: '#445', margin: 0 }}>meta de fondeo</p>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#8a84cc', fontWeight: 600 }}>{featured.funded}% fondeado</span>
                  <span style={{ fontSize: 11, color: '#445' }}>{featured.investors} inversores · {featured.daysLeft} días</span>
                </div>
                <div style={{ width: '100%', height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${featured.funded}%`, height: '100%', background: PURPLE_GRAD, borderRadius: 99 }} />
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: PURPLE_DIM, color: PURPLE, border: `1px solid ${PURPLE_BORDER}` }}>💰 Min. {featured.minInvest}</span>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: 'rgba(104,219,174,0.1)', color: '#68dbae', border: '1px solid rgba(104,219,174,0.2)' }}>📅 {featured.term}</span>
                {featured.cngPlus && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: 'rgba(231,192,146,0.1)', color: '#e7c092', border: '1px solid rgba(231,192,146,0.2)' }}>🏆 CNG+ exclusivo</span>}
              </div>

              <button style={{ width: '100%', padding: 13, background: PURPLE_GRAD, border: 'none', borderRadius: 12, fontSize: 13, color: '#1a0a2e', fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>
                Quiero Invertir →
              </button>
            </div>
          </div>
        )}

        {/* Compact cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rest.map(f => (
            <div key={f.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: 100, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                <img src={f.img} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(13,17,23,0.3))' }} />
              </div>
              <div style={{ flex: 1, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#e8e4ff', margin: 0, fontFamily: FONT.headline, lineHeight: 1.3, flex: 1, marginRight: 8 }}>{f.name}</h3>
                  <span style={{ fontSize: 10, background: 'rgba(104,219,174,0.1)', color: f.roiColor || '#68dbae', padding: '2px 8px', borderRadius: 99, fontWeight: 700, whiteSpace: 'nowrap', border: `1px solid ${f.roiColor ? f.roiColor + '33' : 'rgba(104,219,174,0.2)'}` }}>ROI {f.roi}</span>
                </div>
                <p style={{ fontSize: 11, color: '#445', margin: '0 0 8px' }}>{f.categoryIcon} {f.category} · Min. {f.minInvest}</p>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#6a64aa' }}>{f.funded}% fondeado</span>
                    {f.urgent
                      ? <span style={{ fontSize: 10, color: '#E24B4A', fontWeight: 700 }}>¡Últimos {f.daysLeft} días!</span>
                      : <span style={{ fontSize: 10, color: '#445' }}>{f.daysLeft} días</span>
                    }
                  </div>
                  <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${f.funded}%`, height: '100%', background: PURPLE_GRAD, borderRadius: 99 }} />
                  </div>
                </div>
                <button style={{ width: '100%', padding: 8, background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, borderRadius: 9, fontSize: 11, color: PURPLE, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>
                  Ver oportunidad
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}