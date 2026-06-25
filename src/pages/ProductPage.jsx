import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { listingMinPrice, formatPrice } from '../lib/marketplace'
import { C, FONT, GRADIENT, Icon } from '../stitch'
import ComingSoonNotice from '../components/ComingSoonNotice'

// Página PÚBLICA de detalle de producto (/producto/:id). Sin login ni membresía.
// SOLO muestra listings 'active': el .eq('status','active') explícito (igual que StorePage)
// evita que un draft/inactivo se filtre por URL, incluso para su propio dueño (la RLS
// listings_select_public ya lo bloquea para anónimos).
// CTA "Comprar" -> handler onBuy: HOY abre el aviso neutral "próximamente"; en la pieza de
// checkout, ese onBuy es el ÚNICO punto de enganche del flujo real (sin tocar el resto).

export default function ProductPage() {
  const { id } = useParams()
  const [state, setState] = useState('loading') // 'loading' | 'found' | 'notfound'
  const [p, setP] = useState(null)
  const [imgIdx, setImgIdx] = useState(0)
  const [comingSoon, setComingSoon] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading'); setP(null); setImgIdx(0)
    ;(async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          id, title, description, type, currency, status,
          category:categories(id, slug, name),
          store:stores(id, name, slug, status),
          listing_variants(id, name, price, stock, is_active),
          listing_images(id, url, sort_order)
        `)
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle()
      if (!alive) return
      if (error || !data) { setState('notfound'); return }
      setP(data)
      setState('found')
    })()
    return () => { alive = false }
  }, [id])

  // ÚNICO punto de enganche del checkout (siguiente pieza). Hoy -> aviso neutral.
  const onBuy = () => setComingSoon(true)

  if (state === 'loading') return <div style={S.center}>Cargando…</div>

  if (state === 'notfound') {
    return (
      <div style={S.center}>
        <div style={S.nfCard}>
          <div style={S.nfIcon}><Icon name="inventory_2" size={30} style={{ color: C.onSurfaceVariant }} /></div>
          <h1 style={S.nfTitle}>Producto no encontrado</h1>
          <p style={S.nfText}>Este producto no existe o ya no está disponible.</p>
          <Link to="/app/explore" style={S.primaryBtn}>Explorar GoShop</Link>
        </div>
      </div>
    )
  }

  const images = (p.listing_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const cover = images[imgIdx]?.url || images[0]?.url || null
  const price = listingMinPrice(p)
  const variant = (p.listing_variants || [])[0] || {}
  const stock = variant.stock ?? 0
  const inStock = stock > 0
  const isQuote = p.type === 'quote'
  const buyDisabled = !isQuote && !inStock

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <Link to="/app/explore" style={S.back}>← Volver a GoShop</Link>

        {/* Galería */}
        <div style={S.gallery}>
          <div style={S.mainImg}>
            {cover
              ? <img src={cover} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="image" size={40} style={{ color: C.textGhost }} />}
          </div>
          {images.length > 1 && (
            <div style={S.thumbs}>
              {images.map((im, i) => (
                <button key={im.id} onClick={() => setImgIdx(i)} style={{ ...S.thumb, borderColor: i === imgIdx ? C.primary : 'rgba(255,255,255,0.1)' }}>
                  <img src={im.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        {p.category?.name && <div style={S.cat}>{p.category.name}</div>}
        <h1 style={S.title}>{p.title}</h1>
        <div style={S.price}>{isQuote ? 'A cotizar' : (price != null ? formatPrice(price, p.currency) : '—')}</div>

        {/* Tienda */}
        {p.store?.slug && (
          <Link to={`/tienda/${p.store.slug}`} style={S.storeRow}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Icon name="storefront" size={16} style={{ color: C.primary, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Vendido por <b>{p.store.name}</b></span>
            </span>
            <Icon name="chevron_right" size={16} style={{ color: C.onSurfaceVariant, flexShrink: 0 }} />
          </Link>
        )}

        {/* Disponibilidad */}
        <div style={{ ...S.stock, color: inStock ? C.primary : C.errorBright }}>
          <Icon name={inStock ? 'check_circle' : 'cancel'} size={16} style={{ color: inStock ? C.primary : C.errorBright }} />
          {inStock ? 'Disponible' : 'Agotado'}
        </div>

        {/* Descripción */}
        {p.description && (
          <div style={S.descBlock}>
            <h2 style={S.descTitle}>Descripción</h2>
            <p style={S.desc}>{p.description}</p>
          </div>
        )}

        {/* CTA — onBuy es el punto de enganche del checkout (hoy: aviso "próximamente") */}
        <button
          onClick={onBuy}
          disabled={buyDisabled}
          style={{ ...S.buyBtn, opacity: buyDisabled ? 0.5 : 1, cursor: buyDisabled ? 'not-allowed' : 'pointer' }}
        >
          {isQuote ? 'Contactar' : (inStock ? 'Comprar' : 'Agotado')}
        </button>
      </div>

      <ComingSoonNotice open={comingSoon} onClose={() => setComingSoon(false)} />
    </div>
  )
}

const S = {
  center: { minHeight: '70vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body, color: C.onSurfaceVariant, fontSize: 14 },
  nfCard: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 360 },
  nfIcon: { width: 72, height: 72, borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nfTitle: { fontFamily: FONT.headline, fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
  nfText: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0 },

  wrap: { minHeight: '70vh', background: C.surface, fontFamily: FONT.body },
  inner: { maxWidth: 640, margin: '0 auto', padding: '24px 20px 64px' },
  back: { display: 'inline-block', color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, marginBottom: 18 },

  gallery: { display: 'flex', flexDirection: 'column', gap: 10 },
  mainImg: { width: '100%', aspectRatio: '1', maxHeight: 440, borderRadius: 16, overflow: 'hidden', background: '#0a0e15', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbs: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
  thumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '2px solid', background: '#0a0e15', padding: 0, cursor: 'pointer', flexShrink: 0 },

  cat: { fontSize: 11, color: C.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20 },
  title: { fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: C.text, margin: '6px 0 0', lineHeight: 1.2, wordBreak: 'break-word' },
  price: { fontSize: 26, fontWeight: 900, color: C.primary, fontFamily: FONT.headline, marginTop: 8 },

  storeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: C.onSurface, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, marginTop: 16 },

  stock: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginTop: 14 },

  descBlock: { marginTop: 22 },
  descTitle: { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, margin: '0 0 8px' },
  desc: { fontSize: 14.5, color: C.onSurface, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },

  buyBtn: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 28, background: GRADIENT.primary, border: 'none', borderRadius: 12, padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: FONT.body },
  primaryBtn: { marginTop: 6, textDecoration: 'none', background: GRADIENT.primary, borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: FONT.body },
}
