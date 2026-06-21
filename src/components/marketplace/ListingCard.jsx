import { C, FONT, Icon } from '../../stitch'
import { listingMinPrice, listingCoverImage, formatPrice } from '../../lib/marketplace'

// Tarjeta genérica de un listing real, tematizada por accent.
// El comportamiento del botón depende de listing.type:
//  - travel -> "Ir a Expedia": abre external_url en pestaña nueva (sin gate)
//  - quote  -> "Contactar" (onOpen -> modal MembersOnly si anónimo)
//  - buy_now -> precio + "Comprar" (onOpen -> modal MembersOnly si anónimo)
// El detalle de producto y el checkout llegan en sub-pasos posteriores.
export default function ListingCard({ listing, accent = C.primary, onOpen }) {
  const img = listingCoverImage(listing)
  const price = listingMinPrice(listing)
  const priceLabel = formatPrice(price, listing.currency)
  const isTravel = listing.type === 'travel'
  const isQuote = listing.type === 'quote'

  return (
    <div style={{ background: C.surface, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 120, position: 'relative', overflow: 'hidden', background: '#0a0e15' }}>
        {img ? (
          <img src={img} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image" size={28} style={{ color: C.textGhost }} />
          </div>
        )}
        {listing.category?.name && (
          <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, color: accent, fontWeight: 700, background: 'rgba(0,0,0,0.45)', padding: '2px 8px', borderRadius: 99 }}>
            {listing.category.name}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.onSurface, margin: '0 0 2px', fontFamily: FONT.headline }}>{listing.title}</p>
          {listing.store?.name && <p style={{ fontSize: 10, color: C.textFaint, margin: 0 }}>{listing.store.name}</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: accent, fontFamily: FONT.headline }}>
            {isQuote ? 'A cotizar' : priceLabel || '—'}
          </span>

          {isTravel && listing.external_url ? (
            <a href={listing.external_url} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', padding: '7px 12px', background: accent, borderRadius: 9, fontSize: 11, color: '#06140d', fontWeight: 800, fontFamily: FONT.body }}>
              Ir a Expedia
            </a>
          ) : (
            <button onClick={() => onOpen && onOpen(listing)}
              style={{ padding: '7px 14px', background: `${accent}1f`, border: `1px solid ${accent}55`, borderRadius: 9, fontSize: 11, color: accent, fontWeight: 800, cursor: 'pointer', fontFamily: FONT.body }}>
              {isQuote ? 'Contactar' : 'Comprar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
