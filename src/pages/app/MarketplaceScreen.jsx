import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { C, FONT, Icon } from '../../stitch'
import { LOBS, fetchCategories, fetchListings } from '../../lib/marketplace'
import ListingCard from '../../components/marketplace/ListingCard'
import EmptyCatalog from '../../components/marketplace/EmptyCatalog'
import MembersOnly from '../../components/MembersOnly'
import TopBar from '../../components/TopBar'

// GoShop — marketplace UNIFICADO estilo Amazon/Mercado Libre.
// Una sola vista: todos los listings activos mezclados (sin importar LOB),
// un buscador base por texto, y filtros opcionales por LOB y categoría.
// Acceso público (anónimos incluidos); acciones gateadas con MembersOnly;
// Travel redirige a external_url. La búsqueda IA (DeepSeek) llega en 1e.
const LOB_ORDER = ['store', 'store_local', 'nutrition', 'real_estate', 'travel']

export default function MarketplaceScreen({ isDesktop }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const lobParam = searchParams.get('lob')
  const [activeLob, setActiveLob] = useState(LOBS[lobParam] ? lobParam : 'all')
  const [activeCat, setActiveCat] = useState('all')
  const [q, setQ] = useState('')
  const [listings, setListings] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [membersOnly, setMembersOnly] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    Promise.all([fetchCategories(), fetchListings()])
      .then(([c, l]) => { if (!cancelled) { setCats(c); setListings(l) } })
      .catch((e) => { if (!cancelled) { console.error('[marketplace]', e?.message || e); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // URL -> estado: el filtro LOB vive en ?lob= (redirects de rutas viejas + links compartibles).
  // Mantiene el estado sincronizado aunque el query cambie con el componente ya montado.
  useEffect(() => {
    setActiveLob(LOBS[lobParam] ? lobParam : 'all')
    setActiveCat('all')
  }, [lobParam])

  // estado -> URL: los chips de LOB actualizan ?lob=; el efecto de arriba sincroniza el estado.
  function selectLob(lob) {
    const next = new URLSearchParams(searchParams)
    if (lob === 'all') next.delete('lob')
    else next.set('lob', lob)
    setSearchParams(next, { replace: true })
  }

  const lobCats = useMemo(
    () => (activeLob === 'all' ? [] : cats.filter((c) => c.lob === activeLob)),
    [cats, activeLob]
  )

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return listings.filter((l) => {
      if (activeLob !== 'all' && l.lob !== activeLob) return false
      if (activeCat !== 'all' && l.category?.id !== activeCat) return false
      if (needle) {
        const hay = `${l.title || ''} ${l.store?.name || ''} ${l.category?.name || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [listings, activeLob, activeCat, q])

  const columns = isDesktop ? 3 : 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="GoShop" leftIcon="menu" rightContent={<div style={{ width: 40 }} />} />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Buscador base por texto (funcional; IA en 1e) */}
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#445' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca en GoShop..."
            style={{ width: '100%', height: 48, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, paddingLeft: 44, paddingRight: 16, color: C.onSurface, fontSize: 14, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Chips de LOB (filtro opcional; default Todos) */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          <Chip label="Todos" active={activeLob === 'all'} onClick={() => selectLob('all')} />
          {LOB_ORDER.map((k) => (
            <Chip key={k} label={LOBS[k].label} active={activeLob === k} onClick={() => selectLob(k)} />
          ))}
        </div>

        {/* Chips de categoría (solo al elegir un LOB) */}
        {activeLob !== 'all' && lobCats.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <Chip label="Todas" small active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
            {lobCats.map((c) => (
              <Chip key={c.id} label={c.name} small active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
        )}

        {/* Grid unificado / loading / vacío */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '52px 0' }}>
            <div style={{ width: 26, height: 26, border: `3px solid ${C.primary}33`, borderTopColor: C.primary, borderRadius: 99, animation: 'cngspin 0.8s linear infinite' }} />
            <style>{`@keyframes cngspin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : failed ? (
          <EmptyCatalog accent={C.primary} icon="cloud_off" title="No pudimos cargar GoShop" subtitle="Revisa tu conexión e inténtalo de nuevo en un momento." />
        ) : visible.length === 0 ? (
          <EmptyCatalog
            accent={C.primary}
            icon="storefront"
            title={q.trim() ? 'Sin resultados' : 'GoShop está por abrir'}
            subtitle={q.trim()
              ? 'No encontramos productos para tu búsqueda. Prueba con otra palabra.'
              : 'Aún no hay productos publicados. Pronto los vendedores de CNG llenarán GoShop.'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
            {visible.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                accent={C.primary}
                onOpen={(item) => setMembersOnly(item?.type === 'quote' ? 'contactar' : 'comprar')}
              />
            ))}
          </div>
        )}

      </div>

      <MembersOnly open={!!membersOnly} action={membersOnly} onClose={() => setMembersOnly(null)} />
    </div>
  )
}

function Chip({ label, active, onClick, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '6px 13px' : '7px 16px', borderRadius: 99,
        fontSize: small ? 11 : 12, fontWeight: 700,
        whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: FONT.body,
        border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
        outline: active ? `1px solid ${C.primary}55` : 'none',
        background: active ? `${C.primary}1f` : 'rgba(255,255,255,0.03)',
        color: active ? C.primary : '#445',
      }}
    >{label}</button>
  )
}
