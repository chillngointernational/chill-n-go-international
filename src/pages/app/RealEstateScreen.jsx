import { C, FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
const IMG_GLASS = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmEdYPFfTJMTHP19jrYF0qGhw60xBvzi2as7gUGdKKr2vz3AvMyUupt0tl5WK5a87OF8_TbEu-iMJQKLT-Btnd3yvjrqEWidmScqFJU9gW0shyv1lsTdIKmzHdnCzwBxtnLImzulJyqTBlVeuoZ9aq7kPW2boixMmFBtRkV67juPkDAdy-aJIT7XyJtAQnv7lW2qmdbk6NptRki5l58AP_V3ND2YNnG3jlVo258eFNJocPCs6dIvN8QazhmvWITRzmE8n7awBwSVE'
const IMG_PENT = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0aGUlELqfjWORQGu3YOkH_cmkhbt6-MHV1WiU4l_BoqUsFldiDuxnXJZej4xzwDgVLSaYJGc6mxRLv9cKzF6QH0aceCMx3dNXO85JFyZ_bIuwPPnYfs_hfPgFUVVIO0X5QJw5iAWCZoi5nI0WSHwZr9KeZbeiSz-tttTXyvELmPcKh0al0zDbuNU6TcfKa3yTH1BgZsfe5c6ZvqNft7WNujG8DlhLIs-jGlNR_I9H-aAfUSwFSY1oSF-E0P9su_BiRxgqhUCQHkU'
export default function RealEstateScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Real Estate" leftIcon="arrow_back" onLeft={onBack} rightContent={<div style={{ display: 'flex', gap: 16 }}><Icon name="map" size={24} style={{ color: C.primaryBright }} /><Icon name="filter_list" size={24} style={{ color: C.text }} /></div>} />
      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {['All', 'Buy', 'Rent', 'Invest'].map((f, i) => (
            <button key={f} style={{ padding: '8px 24px', borderRadius: 99, background: i === 0 ? C.primaryBright : C.surfaceLow, color: i === 0 ? C.text : C.textDim, fontWeight: i === 0 ? 700 : 500, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: FONT.body }}>{f}</button>
          ))}
        </div>
        <div style={{ background: C.surfaceLow, borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ aspectRatio: '4/5', position: 'relative' }}>
            <img src={IMG_GLASS} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 16, left: 16 }}><span style={{ background: C.primaryBright, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 99, color: '#fff', textTransform: 'uppercase', letterSpacing: 3 }}>REAL ESTATE</span></div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
              <h3 style={{ fontFamily: FONT.headline, fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4 }}>Glass House Sanctuary</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(241,239,232,0.7)', fontSize: 14 }}><Icon name="location_on" size={14} /> Tulum, MX</div>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.secondaryDark, marginBottom: 16 }}>,000 <span style={{ fontSize: 12, fontWeight: 500, color: C.textFaint }}>USD</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 16, borderTop: '1px solid rgba(241,239,232,0.05)' }}>
              {[{ l: 'Bed', v: '4' }, { l: 'Bath', v: '3' }, { l: 'sqft', v: '2,400' }].map((s) => (
                <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ fontSize: 12, color: C.textFaint, marginBottom: 4 }}>{s.l}</span><span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.v}</span></div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ background: C.surfaceLow, borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ height: 200, position: 'relative' }}>
            <img src={IMG_PENT} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
              <h3 style={{ fontFamily: FONT.headline, fontSize: 20, fontWeight: 800, color: C.text }}>Penthouse Azure</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(241,239,232,0.7)', fontSize: 12 }}><Icon name="location_on" size={14} /> Miami Beach, FL</div>
            </div>
          </div>
          <div style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.secondaryDark }}>,200,000 <span style={{ fontSize: 12, fontWeight: 500, color: C.textFaint }}>USD</span></div>
            <button style={{ background: C.primaryBright, color: '#fff', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer' }}><Icon name="arrow_forward" size={20} /></button>
          </div>
        </div>
      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
