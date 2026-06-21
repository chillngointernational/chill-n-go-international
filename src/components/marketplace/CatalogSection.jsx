import { useState, useEffect } from 'react'
import { C, FONT } from '../../stitch'
import { fetchCategoriesByLob, fetchListingsByLob } from '../../lib/marketplace'
import ListingCard from './ListingCard'
import EmptyCatalog from './EmptyCatalog'
import MembersOnly from '../MembersOnly'

// Bloque de catálogo REAL reutilizado por todas las pantallas de LOB.
// Lee categorías (pills) y listings (grid) de la base; muestra estado vacío
// on-brand cuando no hay productos. Lectura pública: anónimos incluidos.
export default function CatalogSection({
  lob,
  accent = C.primary,
  columns = 2,
  emptyIcon = 'storefront',
  emptyTitle,
  emptySubtitle,
}) {
  const [cats, setCats] = useState([])
  const [listings, setListings] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [membersOnly, setMembersOnly] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setActiveCat('all')
    Promise.all([fetchCategoriesByLob(lob), fetchListingsByLob(lob)])
      .then(([c, l]) => { if (!cancelled) { setCats(c); setListings(l) } })
      .catch((e) => { if (!cancelled) { console.error('[catalog]', lob, e?.message || e); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [lob])

  const visible = activeCat === 'all'
    ? listings
    : listings.filter((l) => l.category?.id === activeCat)

  return (
    <>
      {/* Pills de categorías reales */}
      {cats.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          <Pill label="Todos" active={activeCat === 'all'} accent={accent} onClick={() => setActiveCat('all')} />
          {cats.map((c) => (
            <Pill key={c.id} label={c.name} active={activeCat === c.id} accent={accent} onClick={() => setActiveCat(c.id)} />
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 26, height: 26, border: `3px solid ${accent}33`, borderTopColor: accent, borderRadius: 99, animation: 'cngspin 0.8s linear infinite' }} />
          <style>{`@keyframes cngspin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : failed ? (
        <EmptyCatalog accent={accent} icon="cloud_off" title="No pudimos cargar el catálogo" subtitle="Revisa tu conexión e inténtalo de nuevo en un momento." />
      ) : visible.length === 0 ? (
        <EmptyCatalog accent={accent} icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
          {visible.map((l) => (
            <ListingCard key={l.id} listing={l} accent={accent} onOpen={(item) => setMembersOnly(item?.type === 'quote' ? 'cotizar' : 'comprar')} />
          ))}
        </div>
      )}

      <MembersOnly open={!!membersOnly} action={membersOnly} onClose={() => setMembersOnly(null)} />
    </>
  )
}

function Pill({ label, active, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
        border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
        outline: active ? `1px solid ${accent}55` : 'none',
        background: active ? `${accent}1f` : 'rgba(255,255,255,0.03)',
        color: active ? accent : '#445',
      }}
    >{label}</button>
  )
}
