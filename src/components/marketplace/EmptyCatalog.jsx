import { C, FONT, Icon } from '../../stitch'

// Estado vacío on-brand para cuando un LOB/categoría aún no tiene productos.
// No inventa productos ni muestra error: invita a volver pronto.
export default function EmptyCatalog({ accent = C.primary, icon = 'storefront', title, subtitle }) {
  return (
    <div style={{
      textAlign: 'center', padding: '52px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: `${accent}14`, border: `1px solid ${accent}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={34} style={{ color: accent }} />
      </div>
      <h3 style={{ fontFamily: FONT.headline, fontSize: 17, fontWeight: 800, color: C.onSurface, margin: 0 }}>
        {title || 'Aún no hay productos aquí'}
      </h3>
      <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6, maxWidth: 290, margin: 0 }}>
        {subtitle || 'Estamos preparando el catálogo. Vuelve pronto para descubrir lo nuevo.'}
      </p>
    </div>
  )
}
