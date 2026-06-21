import { FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
import CatalogSection from '../../components/marketplace/CatalogSection'

const GREEN = '#68db82'
const GREEN_DIM = 'rgba(104,219,130,0.12)'
const GREEN_BORDER = 'rgba(104,219,130,0.22)'
const SURFACE_GREEN = '#0d1f18'

export default function NutritionScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Nutrition" leftIcon="arrow_back" onLeft={onBack} />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Compañero Nutricional — teaser (próximamente) */}
        <div style={{ background: `linear-gradient(135deg, ${SURFACE_GREEN}, #111a10)`, border: `1px solid ${GREEN_BORDER}`, borderRadius: 20, padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, background: 'rgba(104,219,130,0.06)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1a4a2e, #2d6e42)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="eco" size={22} style={{ color: GREEN }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: GREEN, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 3px' }}>Tu Compañero</p>
              <p style={{ fontSize: 14, color: '#c8e8d0', fontWeight: 600, margin: 0, fontFamily: FONT.headline }}>Compañero Nutricional</p>
            </div>
            <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
          </div>
          <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 13, color: '#8aaf95', margin: 0, lineHeight: 1.55 }}>
              Pronto llevaremos seguimiento de tu stack y te recordaremos tus tomas. Por ahora, explora el catálogo.
            </p>
          </div>
        </div>

        {/* Market */}
        <h2 style={{ fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: '#dfe2eb', margin: 0 }}>Market</h2>

        {/* Catálogo real (categorías + productos por LOB) */}
        <CatalogSection
          lob="nutrition"
          accent={GREEN}
          columns={2}
          emptyIcon="nutrition"
          emptyTitle="El market de nutrición está por abrir"
          emptySubtitle="Aún no hay suplementos publicados. Pronto encontrarás aquí lo mejor para tu salud."
        />

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
