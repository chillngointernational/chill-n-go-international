import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { C, FONT, Icon } from '../../stitch'
import { useAuth } from '../../context/AuthContext'
import { isFullyActive } from '../../utils/memberStatus'
import { LOBS, fetchCategories, fetchListings } from '../../lib/marketplace'
import ListingCard from '../../components/marketplace/ListingCard'
import EmptyCatalog from '../../components/marketplace/EmptyCatalog'
import TravelShowcase, { filterTravelCards } from '../../components/marketplace/TravelShowcase'
import MembersOnly from '../../components/MembersOnly'
import TopBar from '../../components/TopBar'
import { useMyStore } from '../../hooks/useMyStore'
import { usePlatformConfig } from '../../hooks/usePlatformConfig'

// GoShop — marketplace UNIFICADO estilo Amazon/Mercado Libre.
// Una sola vista: todos los listings activos mezclados (sin importar LOB),
// un buscador base por texto, y filtros opcionales por LOB y categoría.
// Acceso público (anónimos incluidos); acciones gateadas con MembersOnly;
// Travel redirige a external_url. La búsqueda IA (DeepSeek) llega en 1e.
const LOB_ORDER = ['store', 'store_local', 'nutrition', 'real_estate', 'travel']

export default function MarketplaceScreen({ isDesktop }) {
  const { member } = useAuth()
  // Expedia TAAP es beneficio SOLO para miembros activos (verificados + pagados).
  const canTravel = isFullyActive(member)
  // Acceso de vendedor: si el logueado tiene tienda, mostramos "Mi Tienda" en la cabecera.
  // /app/explore NO tiene muro -> el vendedor no-miembro también lo ve. (Solo navegación.)
  const { store: myStore } = useMyStore()
  // Precio que ve el cliente = base + comisión (commission_pct de platform_config).
  const cfg = usePlatformConfig()
  const commissionPct = cfg ? Number(cfg.commission_pct) : null
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

  // Travel = escaparate fijo (Expedia), no DB. Filtra por el buscador de texto.
  const travelCards = useMemo(() => filterTravelCards(q), [q])

  const columns = isDesktop ? 3 : 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="GoShop" leftIcon="menu" rightContent={
        myStore
          ? <Link to="/mi-tienda" title="Mi Tienda" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: `${C.primary}1f`, border: `1px solid ${C.primary}55`, color: C.primary, textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: FONT.body, whiteSpace: 'nowrap' }}>
              <Icon name="storefront" size={15} style={{ color: C.primary }} />Mi Tienda
            </Link>
          : <div style={{ width: 40 }} />
      } />

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

        {/* Chips de categoría (solo al elegir un LOB; Travel es escaparate, sin categorías) */}
        {activeLob !== 'all' && activeLob !== 'travel' && lobCats.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <Chip label="Todas" small active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
            {lobCats.map((c) => (
              <Chip key={c.id} label={c.name} small active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
        )}

        {/* Contenido */}
        {activeLob === 'travel' ? (
          // Travel = escaparate inspiracional (Expedia), no depende de la DB.
          // La ACCIÓN de ir a Expedia se gatea: solo miembros activos.
          <TravelShowcase
            cards={travelCards}
            columns={columns}
            canAccess={canTravel}
            onLocked={() => setMembersOnly('reservar tus viajes con Expedia')}
          />
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '52px 0' }}>
            <div style={{ width: 26, height: 26, border: `3px solid ${C.primary}33`, borderTopColor: C.primary, borderRadius: 99, animation: 'cngspin 0.8s linear infinite' }} />
            <style>{`@keyframes cngspin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : failed ? (
          <EmptyCatalog accent={C.primary} icon="cloud_off" title="No pudimos cargar GoShop" subtitle="Revisa tu conexión e inténtalo de nuevo en un momento." />
        ) : (
          <>
            {/* Grid de productos reales (hoy vacío) */}
            {visible.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
                {visible.map((l) => (
                  <ListingCard key={l.id} listing={l} accent={C.primary} commissionPct={commissionPct} />
                ))}
              </div>
            )}

            {/* En "Todos": sección Travel (único contenido vivo hoy) */}
            {activeLob === 'all' && travelCards.length > 0 && (
              <TravelShowcase
                cards={travelCards}
                columns={columns}
                canAccess={canTravel}
                onLocked={() => setMembersOnly('reservar tus viajes con Expedia')}
              />
            )}

            {/* Estado vacío: solo cuando no hay NADA que mostrar */}
            {visible.length === 0 && !(activeLob === 'all' && travelCards.length > 0) && (
              <EmptyCatalog
                accent={C.primary}
                icon="storefront"
                title={q.trim() ? 'Sin resultados' : 'GoShop está por abrir'}
                subtitle={q.trim()
                  ? 'No encontramos productos para tu búsqueda. Prueba con otra palabra.'
                  : 'Aún no hay productos publicados. Pronto los vendedores de CNG llenarán GoShop.'}
              />
            )}
          </>
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
