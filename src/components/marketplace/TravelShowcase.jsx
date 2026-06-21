import { C, FONT, Icon } from '../../stitch'

// Escaparate INSPIRACIONAL de viajes dentro de GoShop. NO es catálogo real:
// no hay vendedor, precio ni stock. Todas las tarjetas y el CTA canalizan al
// mismo link de nuestro socio Expedia TAAP, donde la persona reserva.
// Imágenes = gradientes on-brand + iconos (sin fotos externas / sin copyright).
export const EXPEDIA_TAAP_URL = 'https://www.expediataap.mx/TAAP-Agent?key=2be126c6-744e-4804-bfcf-584d951d8b05'

export const TRAVEL_CARDS = [
  { key: 'caribe', title: 'Escápate al Caribe', icon: 'beach_access', grad: 'linear-gradient(135deg,#0ea5a4,#0369a1)' },
  { key: 'europa', title: 'Descubre Europa', icon: 'location_city', grad: 'linear-gradient(135deg,#6366f1,#4338ca)' },
  { key: 'montana', title: 'Aventura en la montaña', icon: 'terrain', grad: 'linear-gradient(135deg,#0f766e,#14532d)' },
  { key: 'playas', title: 'Playas de ensueño', icon: 'waves', grad: 'linear-gradient(135deg,#06b6d4,#0e7490)' },
  { key: 'ciudades', title: 'Ciudades icónicas', icon: 'apartment', grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
  { key: 'todoincluido', title: 'Todo incluido', icon: 'local_bar', grad: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  { key: 'naturaleza', title: 'Naturaleza y aventura', icon: 'forest', grad: 'linear-gradient(135deg,#16a34a,#166534)' },
  { key: 'finde', title: 'Escapadas de fin de semana', icon: 'flight_takeoff', grad: 'linear-gradient(135deg,#0d9488,#155e75)' },
]

export function filterTravelCards(search) {
  const needle = (search || '').trim().toLowerCase()
  if (!needle) return TRAVEL_CARDS
  return TRAVEL_CARDS.filter((c) => c.title.toLowerCase().includes(needle))
}

export default function TravelShowcase({ cards = TRAVEL_CARDS, columns = 2 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner de honestidad: Expedia es nuestro socio + mismo correo/contraseña */}
      <div style={S.banner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={S.bannerIcon}><Icon name="flight" size={20} style={{ color: C.primary }} /></div>
          <div style={{ flex: 1 }}>
            <p style={S.kicker}>Viajes · en alianza con Expedia</p>
            <p style={S.title}>Reserva tus viajes con nuestro socio Expedia</p>
          </div>
        </div>
        <p style={S.text}>
          Crea tu cuenta para acceder a todo el catálogo de viajes. Usa el{' '}
          <strong style={{ color: C.onSurface }}>mismo correo y contraseña de Chill N Go</strong>{' '}
          al registrarte como agente.
        </p>
        <a href={EXPEDIA_TAAP_URL} target="_blank" rel="noopener noreferrer" style={S.cta}>
          Ir a Expedia <Icon name="open_in_new" size={15} style={{ verticalAlign: 'middle' }} />
        </a>
      </div>

      {/* Tarjetas inspiracionales (gradiente on-brand, todas -> Expedia) */}
      {cards.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textFaint, textAlign: 'center', padding: '16px 0' }}>
          Sin resultados para tu búsqueda.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
          {cards.map((c) => (
            <a
              key={c.key}
              href={EXPEDIA_TAAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.card, background: c.grad }}
            >
              <div style={S.cardShade} />
              <Icon name={c.icon} size={30} style={{ position: 'absolute', top: 12, left: 12, color: 'rgba(255,255,255,0.92)' }} />
              <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                <p style={S.cardTitle}>{c.title}</p>
                <span style={S.cardCta}>Ir a Expedia →</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  banner: { background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.20)', borderRadius: 16, padding: 16 },
  bannerIcon: { width: 40, height: 40, borderRadius: 12, background: 'rgba(104,219,174,0.12)', border: '1px solid rgba(104,219,174,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kicker: { fontSize: 10, color: C.primary, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' },
  title: { fontSize: 15, color: C.onSurface, fontWeight: 800, margin: 0, fontFamily: FONT.headline, lineHeight: 1.25 },
  text: { fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: '0 0 14px' },
  cta: { display: 'inline-block', background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, fontFamily: FONT.body },
  card: { textDecoration: 'none', position: 'relative', height: 150, borderRadius: 16, overflow: 'hidden', display: 'block', cursor: 'pointer' },
  cardShade: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' },
  cardTitle: { fontSize: 14, fontWeight: 800, color: '#fff', margin: '0 0 4px', fontFamily: FONT.headline, lineHeight: 1.2 },
  cardCta: { fontSize: 11, fontWeight: 700, color: '#fff', opacity: 0.9 },
}
