import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'
import ListingCard from '../components/marketplace/ListingCard'
import EmptyCatalog from '../components/marketplace/EmptyCatalog'

// Página PÚBLICA de tienda (/tienda/:slug). Sin login ni membresía.
// SOLO muestra tiendas 'active': el filtro .eq('status','active') es explícito a propósito
// (RLS stores_select_public ya bloquea no-active para anónimos; el .eq también evita que el
//  DUEÑO logueado vea su propia tienda pending por esta URL — sin preview, por decisión).
// Slug inexistente o tienda no aprobada -> "tienda no encontrada" (nunca filtra una pending).
// Branding básico: logo + nombre + descripción (brand_config queda para después).
// Productos: listings activos de la tienda (hoy puede ser [] -> estado vacío on-brand).

export default function StorePage() {
  const { slug } = useParams()
  const [state, setState] = useState('loading') // 'loading' | 'found' | 'notfound'
  const [store, setStore] = useState(null)
  const [listings, setListings] = useState([])

  useEffect(() => {
    let alive = true
    setState('loading'); setStore(null); setListings([])

    ;(async () => {
      const { data: st, error } = await supabase
        .from('stores')
        .select('id, name, slug, description, logo_url')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()
      if (!alive) return
      if (error || !st) { setState('notfound'); return }
      setStore(st)

      // Productos activos de ESTA tienda (lectura pública por RLS). Hoy DealNorte = [].
      const { data: ls } = await supabase
        .from('listings')
        .select(`
          id, title, description, type, lob, currency, external_url, status, created_at,
          category:categories(id, slug, name),
          store:stores(id, name, slug, status),
          listing_variants(id, name, price, stock, is_active),
          listing_images(id, url, sort_order)
        `)
        .eq('store_id', st.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (!alive) return
      setListings(ls || [])
      setState('found')
    })()

    return () => { alive = false }
  }, [slug])

  if (state === 'loading') {
    return <div style={S.center}>Cargando…</div>
  }

  if (state === 'notfound') {
    return (
      <div style={S.center}>
        <div style={S.notFoundCard}>
          <div style={S.nfIcon}><Icon name="storefront" size={30} style={{ color: C.onSurfaceVariant }} /></div>
          <h1 style={S.nfTitle}>Tienda no encontrada</h1>
          <p style={S.nfText}>Esta tienda no existe o todavía no está publicada.</p>
          <Link to="/app/explore" style={S.nfBtn}>Explorar GoShop</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        {/* Fachada */}
        <header style={S.facade}>
          <div style={S.logo}>
            {store.logo_url
              ? <img src={store.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="storefront" size={34} style={{ color: '#06140d' }} />}
          </div>
          <h1 style={S.name}>{store.name}</h1>
          {store.description && <p style={S.desc}>{store.description}</p>}
        </header>

        {/* Productos */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Productos</h2>
          {listings.length === 0 ? (
            <EmptyCatalog
              icon="inventory_2"
              title="Esta tienda aún no tiene productos"
              subtitle="El vendedor está preparando su catálogo. Vuelve pronto para descubrir lo nuevo."
            />
          ) : (
            <div style={S.grid}>
              {/* El detalle de producto y el checkout (con gate de miembros) llegan en un sub-paso posterior. */}
              {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const S = {
  center: { minHeight: '70vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body, color: C.onSurfaceVariant, fontSize: 14 },
  notFoundCard: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 360 },
  nfIcon: { width: 72, height: 72, borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nfTitle: { fontFamily: FONT.headline, fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
  nfText: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0 },
  nfBtn: { marginTop: 6, textDecoration: 'none', background: GRADIENT.primary, borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: FONT.body },

  wrap: { minHeight: '70vh', background: C.surface, fontFamily: FONT.body },
  inner: { maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' },
  facade: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.06)' },
  logo: { width: 88, height: 88, borderRadius: 22, overflow: 'hidden', background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontFamily: FONT.headline, fontSize: 28, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px', wordBreak: 'break-word' },
  desc: { fontSize: 14.5, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0, maxWidth: 520, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },

  section: { marginTop: 32 },
  sectionTitle: { fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, margin: '0 0 18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 },
}
