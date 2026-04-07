import { useState } from 'react'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'

/* ── Unsplash images ── */
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

/* ── Destination data ── */
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
  { label: 'Playa', value: 'playa' },
  { label: 'Ciudad', value: 'ciudad' },
  { label: 'All-Inclusive', value: 'all-inclusive' },
  { label: 'Aventura', value: 'aventura' },
]

/* ── Helpers ── */
const filterList = (list, tag) => tag === 'todos' ? list : list.filter(d => d.tags.includes(tag))

/* ── Styles ── */
const s = {
  searchWrap: {
    position: 'relative',
    margin: '0 16px 8px',
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    background: C.surfaceLow,
    border: `1px solid ${C.outlineVariant}`,
    borderRadius: 14,
    padding: '14px 16px 14px 44px',
    fontSize: 14,
    fontFamily: FONT.body,
    color: C.text,
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    top: '50%',
    left: 14,
    transform: 'translateY(-50%)',
    color: C.textDim,
  },
  pillTrack: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '8px 16px 12px',
    scrollbarWidth: 'none',
  },
  sectionTitle: {
    fontFamily: FONT.headline,
    fontSize: 13,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: C.textDim,
    marginBottom: 14,
    paddingLeft: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
}

/* ── Components ── */
function Pill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 18px',
        borderRadius: 99,
        border: active ? 'none' : `1px solid ${C.outlineVariant}`,
        background: active ? GRADIENT.primary : 'transparent',
        color: active ? '#fff' : C.textDim,
        fontFamily: FONT.body,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all .25s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function HeroCard({ dest }) {
  return (
    <div style={{ position: 'relative', width: 'calc(100% - 32px)', height: 200, borderRadius: 16, overflow: 'hidden', margin: '0 16px' }}>
      <img src={dest.img} alt={dest.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)' }} />

      {/* Badge POPULAR */}
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <span style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: 2.5,
          padding: '5px 14px',
          borderRadius: 99,
          textTransform: 'uppercase',
          fontFamily: FONT.headline,
        }}>POPULAR</span>
      </div>

      {/* Rating pill */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', padding: '5px 10px', borderRadius: 99 }}>
        <Icon name="star" fill size={14} style={{ color: '#f59e0b' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: FONT.body }}>{dest.rating}</span>
      </div>

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.15, margin: 0 }}>{dest.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="location_on" fill size={14} style={{ color: C.primary }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: FONT.body }}>{dest.loc}</span>
          </div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '6px 0 0', fontFamily: FONT.headline }}>Desde <span style={{ color: C.primary }}>${dest.price}</span> <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>USD</span></p>
        </div>
        <button style={{
          background: GRADIENT.primary,
          padding: '11px 22px',
          borderRadius: 12,
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT.body,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(29,158,117,0.35)',
        }}>Me interesa</button>
      </div>
    </div>
  )
}

function DestCard({ dest }) {
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 180 }}>
      <img src={dest.img} alt={dest.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />

      {/* Rating */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', padding: '3px 8px', borderRadius: 99 }}>
        <Icon name="star" fill size={12} style={{ color: '#f59e0b' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: FONT.body }}>{dest.rating}</span>
      </div>

      {/* Info */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
        <h4 style={{ fontFamily: FONT.headline, fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>{dest.name}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <Icon name="location_on" fill size={11} style={{ color: C.primary }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: FONT.body }}>{dest.loc}</span>
        </div>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: '5px 0 0', fontFamily: FONT.headline }}>Desde <span style={{ color: C.primary }}>${dest.price}</span> <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.55 }}>USD</span></p>
      </div>
    </div>
  )
}

/* ── Main screen ── */
export default function TravelScreen({ onBack }) {
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')

  const applySearch = (list) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(d => d.name.toLowerCase().includes(q) || d.loc.toLowerCase().includes(q))
  }

  const mx = applySearch(filterList(MEXICO, filter))
  const usa = applySearch(filterList(USA, filter))

  const heroData = MEXICO[0] // Cancún

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: C.bg }}>
      <TopBar title="Travel" leftIcon="arrow_back" onLeft={onBack} />

      {/* Search bar */}
      <div style={s.searchWrap}>
        <Icon name="search" size={20} style={s.searchIcon} />
        <input
          type="text"
          placeholder="¿A dónde quieres ir?"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.searchInput}
        />
      </div>

      {/* Filter pills */}
      <div style={s.pillTrack}>
        {FILTERS.map(f => (
          <Pill key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Hero Card */}
        <HeroCard dest={heroData} />

        {/* MÉXICO section */}
        {mx.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <h3 style={s.sectionTitle}>México</h3>
            <div style={s.grid}>
              {mx.map(d => <DestCard key={d.id} dest={d} />)}
            </div>
          </div>
        )}

        {/* USA section */}
        {usa.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <h3 style={s.sectionTitle}>USA</h3>
            <div style={s.grid}>
              {usa.map(d => <DestCard key={d.id} dest={d} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {mx.length === 0 && usa.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Icon name="travel_explore" size={48} style={{ color: C.textFaint }} />
            <p style={{ color: C.textDim, fontFamily: FONT.body, fontSize: 14, marginTop: 12 }}>No se encontraron destinos</p>
          </div>
        )}
      </div>

      <BackButton onClick={onBack} />
    </div>
  )
}
