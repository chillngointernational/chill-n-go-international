import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
const IMG_BAKERY = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI-5kpaIjt1KwCvgH7iWSnncL4Y-4sPboWdXYhORSmfDFl27ihdjvQ6PfKm6JNy21WIz2h4md496aw3lQlFc-6vLlwcEvrUrPdqepAKw5bp0m3jQxxkwJSf1sUxmFJLMOxJvckwiW3nuy8fogtM4FGWK3xU-rEhcx2HJgRkmCZ_YhGcPzDr9mR_ktvH667-W0qMGyfMmEkQJWnw7xbO7f06eId1X-BTbk0hlENWywaM8Chh7ftRGEFIVbcJmmUQGvoShU4-6FcJDc'
export default function CandyStakesScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="CandyStakes" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(140,132,235,0.2)', padding: '6px 16px', borderRadius: 99, border: '1px solid rgba(140,132,235,0.1)' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, color: C.tertiary, marginRight: 8 }}>Portfolio</span>
          <Icon name="account_balance_wallet" size={16} style={{ color: C.tertiary }} />
        </div>
      } />
      <div style={{ padding: '0 24px 120px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ background: C.surfaceLow, padding: 16, borderRadius: 12 }}>
            <p style={{ fontSize: 10, color: C.onSurfaceVariant, fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>Invested</p>
            <p style={{ color: C.tertiary, fontFamily: FONT.headline, fontWeight: 700, fontSize: 18 }}>,200</p>
          </div>
          <div style={{ background: C.surfaceLow, padding: 16, borderRadius: 12 }}>
            <p style={{ fontSize: 10, color: C.onSurfaceVariant, fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>Returns</p>
            <div style={{ display: 'flex', alignItems: 'center', color: C.primary }}><Icon name="trending_up" size={14} style={{ marginRight: 4 }} /><span style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 18 }}>+</span></div>
          </div>
          <div style={{ background: C.surfaceLow, padding: 16, borderRadius: 12 }}>
            <p style={{ fontSize: 10, color: C.onSurfaceVariant, fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>Active</p>
            <p style={{ color: C.onSurface, fontFamily: FONT.headline, fontWeight: 700, fontSize: 18 }}>3</p>
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: C.onSurfaceVariant, marginBottom: 4 }}>CANDY OPPORTUNITIES</h2>
          <div style={{ height: 4, width: 48, background: GRADIENT.candy, borderRadius: 99 }} />
        </div>
        <div style={{ background: C.surfaceLow, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 192 }}>
            <img src={IMG_BAKERY} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #181c22, transparent, transparent)' }} />
            <div style={{ position: 'absolute', top: 16, left: 16, background: C.tertiaryContainer, padding: '4px 12px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="military_tech" fill size={12} style={{ color: '#23127d' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: '#23127d', textTransform: 'uppercase', letterSpacing: 3 }}>CANDYSTAKES</span>
            </div>
            <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(38,163,122,0.9)', backdropFilter: 'blur(8px)', padding: '4px 12px', borderRadius: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#003121' }}>ROI 18-24%</span>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontFamily: FONT.headline, fontSize: 20, fontWeight: 700, color: C.onSurface, marginBottom: 16 }}>Artisanal Bakery Seed Round</h3>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.onSurfaceVariant }}>78% funded</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.onSurface }}>Goal ,000</span>
              </div>
              <div style={{ width: '100%', height: 6, background: C.surfaceHigh, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: '78%', height: '100%', background: GRADIENT.candy, borderRadius: 99 }} />
              </div>
            </div>
            <button style={{ width: '100%', padding: 16, background: GRADIENT.candy, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 3 }}>INVEST NOW</span>
              <Icon name="arrow_forward" size={16} style={{ color: '#fff' }} />
            </button>
          </div>
        </div>
      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
