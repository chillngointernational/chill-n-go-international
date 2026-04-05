import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
const IMG_POKE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeaEw18rzaHr3hgx9L72DUuVB2m2McdL73tSQGHHFyU3j_yxlMx6nz5VE0R58tHqNSrNoGAAgfG4I08gAD5gbCFDF0keymUPdeXdMNEXq0OwKTS6AEG9OdD56lToBTUvvKqIo-RHM-7ozX2kpdOf2mmHMoweQt-aHPlY1mUZR_EWTz573_m5yEVIXBRt097GGVCOIuLWNBAwOUMAOXl1AAvj1n_5ILpdixMCnMldpeW8YBoQoVRZyhriQXLV3lWcbsI0PqxQPJ5A4'
export default function NutritionScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Nutrition" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <button style={{ fontSize: 14, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 3, padding: '6px 16px', borderRadius: 99, border: '1px solid rgba(231,192,146,0.2)', background: 'transparent', cursor: 'pointer', fontFamily: FONT.body }}>My Plan</button>
      } />
      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ position: 'relative', height: 280, borderRadius: 16, overflow: 'hidden' }}>
          <img src={IMG_POKE} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080C14, rgba(8,12,20,0.4), transparent)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ color: C.secondary, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3 }}>Featured</span>
              <h2 style={{ fontFamily: FONT.headline, fontSize: 28, fontWeight: 800, color: C.text, marginTop: 4 }}>Zen Fuel Plan</h2>
              <p style={{ color: C.onSurfaceVariant, fontSize: 14, fontWeight: 500 }}>Holistic keto-friendly nourishment.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', borderRadius: 99, background: 'rgba(104,219,174,0.2)', color: C.primary, fontSize: 10, fontWeight: 700, border: '1px solid rgba(104,219,174,0.1)' }}>PROTEIN 40%</span>
              <span style={{ padding: '4px 12px', borderRadius: 99, background: 'rgba(231,192,146,0.2)', color: C.secondary, fontSize: 10, fontWeight: 700, border: '1px solid rgba(231,192,146,0.1)' }}>CARBS 10%</span>
              <span style={{ padding: '4px 12px', borderRadius: 99, background: 'rgba(255,127,110,0.2)', color: '#FF7F6E', fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,127,110,0.1)' }}>FAT 50%</span>
            </div>
            <button style={{ width: 'fit-content', padding: '10px 24px', background: GRADIENT.primary, borderRadius: 12, color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body }}>Start Plan <Icon name="arrow_forward" size={16} /></button>
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>POPULAR PLANS</h3>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
            {['Mediterranean Reset|14 Days', 'High Protein Builder|30 Days', 'Plant Based|21 Days'].map((p) => {
              const [name, days] = p.split('|')
              return (
                <div key={p} style={{ minWidth: 200, background: C.surfaceLow, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(61,73,67,0.1)' }}>
                  <div style={{ height: 112, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="restaurant" size={32} style={{ color: C.secondary, opacity: 0.5 }} /></div>
                  <div style={{ padding: 16 }}>
                    <h4 style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{name}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10, color: C.onSurfaceVariant }}><Icon name="schedule" size={12} /> {days}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>RECIPES FOR YOU</h3>
          {[{ name: 'Keto Avocado Power', sub: 'Breakfast - 15 mins', macros: 'P: 12g  C: 8g  F: 22g' }, { name: 'Lemon Herb Chicken', sub: 'Lunch - 25 mins', macros: 'P: 34g  C: 5g  F: 14g' }].map((r) => (
            <div key={r.name} style={{ background: C.surfaceLow, padding: 12, borderRadius: 16, display: 'flex', gap: 16, marginBottom: 12, border: '1px solid rgba(61,73,67,0.05)' }}>
              <div style={{ width: 96, height: 96, borderRadius: 12, background: C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="lunch_dining" size={32} style={{ color: C.secondary, opacity: 0.4 }} /></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0' }}>
                <div><h4 style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{r.name}</h4><p style={{ fontSize: 10, color: C.onSurfaceVariant, fontWeight: 500, marginTop: 4 }}>{r.sub}</p></div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 }}>{r.macros}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
