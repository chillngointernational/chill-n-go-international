import { C, FONT, Icon, useDesktop } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
const IMG_WATCH = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9WHmzvj56aptxL9UeVlH8bkYUadboSnwlYRJpV13zmsVLvQaHrBZKC-u0nbY1oZp0uLwZz_W7hFgVVAzwKZanWNt89DSwViqSqLf3_DA-DEkky_vUVY3KI4TZpaJySXbvQNTN2P3SMf0-Tk5gCAPSV-1BWAOnMy5l7k8ywxp6Y88v4XZClrvLmtOFRfXUHvt_hb46mKORMfUEOdbwlMxxKASrObueKJFjZor3tZVtp6LwR4uZldfWZJQgE80623ITSY0NcycfZIs'
const IMG_SNEAKER = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6X-u6Hm02QAgRsNBhSa3GcC7diuX7F1GDqgjlCo2F2vANCzWPqzOpDyK0NRrJvwl7ufa89Orr_hetA_8iv3LXOU6s3rqWr-Q-2Luby5Ar9AHj_1A3bLPGgRD0aUf0mbS68Rtd3h19HURf_yIu3Czfl8v_zV3Rx96Le4Fv4xRIGpctPBRQA9jF-yO17VkwD7JEZuqIKEoz6avnz-nRaWZStjFSBwS3HFNz7rrRG7uBP7EITsCjd8KeEy1nBSgD49bVYD3Q3L9-GZk'
export default function StoreScreen({ onBack }) {
  const isDesktop = useDesktop()
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Store" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ position: 'relative', padding: 8 }}>
          <Icon name="shopping_bag" size={24} style={{ color: C.text }} />
          <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: C.primary, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#003827' }}>3</span>
        </div>
      } />
      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: C.surfaceLow, borderRadius: 12, padding: '0 16px', height: 48, border: '1px solid rgba(61,73,67,0.1)' }}>
          <Icon name="search" size={20} style={{ color: C.onSurfaceVariant, marginRight: 12 }} />
          <input placeholder="Search products..." style={{ background: 'transparent', border: 'none', color: C.onSurface, fontSize: 14, fontFamily: FONT.body, width: '100%', outline: 'none' }} />
        </div>
        <div style={{ position: 'relative', height: 192, borderRadius: 16, overflow: 'hidden' }}>
          <img src={IMG_WATCH} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
          <div style={{ position: 'absolute', bottom: 24, left: 24, zIndex: 10 }}>
            <span style={{ color: C.secondary, fontFamily: FONT.headline, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Limited Edition</span>
            <h2 style={{ fontSize: 24, fontFamily: FONT.headline, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 4 }}>The Midnight<br />Collection</h2>
            <button style={{ marginTop: 8, padding: '6px 16px', background: C.primary, color: '#003827', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>Shop Now</button>
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>CATEGORIES</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {['Apparel', 'Accessories', 'Travel Gear', 'Wellness', 'Tech'].map((c, i) => (
              <span key={c} style={{ padding: '8px 20px', borderRadius: 99, whiteSpace: 'nowrap', fontSize: 12, fontWeight: i === 0 ? 700 : 500, cursor: 'pointer', background: i === 0 ? C.primaryContainer : C.surfaceLow, color: i === 0 ? '#003121' : C.onSurfaceVariant, border: i === 0 ? 'none' : '1px solid rgba(61,73,67,0.1)' }}>{c}</span>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>TRENDING NOW</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr 1fr', gap: 16 }}>
            {[
              { name: 'Obsidian Sprint X1', price: '.00', rating: '4.8', cat: 'Footwear', img: IMG_SNEAKER },
              { name: 'Sanctuary Buds Pro', price: '.00', rating: '4.9', cat: 'Sound' },
              { name: 'Thermal Hydra Flask', price: '.00', rating: '4.7', cat: 'Lifestyle' },
              { name: 'Aura Scented Wax', price: '.00', rating: '4.6', cat: 'Wellness' },
            ].map((p) => (
              <div key={p.name} style={{ background: C.surfaceLow, borderRadius: 16, padding: 8, paddingBottom: 12 }}>
                <div style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: C.surfaceHigh, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.img ? <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="shopping_bag" size={32} style={{ color: C.secondary, opacity: 0.3 }} />}
                </div>
                <div style={{ padding: '0 4px' }}>
                  <p style={{ fontSize: 10, color: C.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{p.cat}</p>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: C.onSurface, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.primary }}>{p.price}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Icon name="star" fill size={10} style={{ color: C.secondary }} /><span style={{ fontSize: 10, color: C.onSurfaceVariant }}>{p.rating}</span></div>
                  </div>
                  <button style={{ width: '100%', padding: 10, background: 'linear-gradient(to right, ' + C.primary + ', ' + C.primaryContainer + ')', color: '#003827', fontSize: 10, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>Add to Cart</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
