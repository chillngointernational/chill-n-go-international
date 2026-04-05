import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
const IMG = {
  maldives: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3FRBn4h06wm5Xlh6jPOFly8ITE9OV2s8GEqzkO_jzLmHULqHPI2KGc6HKRulfZLS7XLR4HeeGtHB5PJkHUnacSj2tBZopHQfJxTXhlb2X5AK-Lvv7ACTOViJkXRF50ucLtiV0hNm8D13kp7lWqD4Um78maGz-k_8LtZVIDcFKBIe4n4BZTUr_TV3QHPuPUZfVO2Yjb1yL45SW-t7RfXHjeDyxa8gu6ldRFW4R90GQNnEwm_hDdHoTkdWTbNbmu2ST_BuVRgoytTw',
  cancun: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkbxslH_3vXRG6_A2jmTpe8udBCZJJBUsjgak1XYJPgR2DCcevOgRABIlRXNs4RuOvy5-I4ObnQwnFpdzDBnHnfoKuGXANW1VjFvgwE2K8Cj17nIXNRuYAFTBRhqOq5r7HkS1vYDseS-WYXvZC8oTtA-BFw8giMrp8DVImo3h3SkUUW78oJyiPBzZP0_CxZmxF3nmpINke8TNSG69AHkgj9HtUXU0Lqqp9LrAvs38eocsTRuYF4Q3CfsBZt7y2YD1fTX6relf-AJk',
  tulum: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB117Gx9HKgvDKRtrE_CkL6a6WgG3CX0g0Evko0UxzloyM2896OYv11xAQHxY1fOgTBxtABeT_aLDRBCQiVqaIyS46wwh-xwYbcJl2HvLRe-Qal1WKzbSX9c2irRUtc2FB0JIbTUn-r06-1ZsHHgsaI2LH8sAGkNdCArdWIoVrz810VmlHU9EYW62RvmXuNuvlUs8fIb02OMWAxEbYLSU1fYxmgzfgL-2deCr28RZdMlcaawH2SD5yLGXCTF0JQvIJLxe7r0ETzFhM',
  cabos: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJDBjiw77XJx_-MEADv_w9ZTAG2KgbxHDRkHuNahg798hs0oY9VoX_zpddBUdHfCM4A6FaciXFsovgvTSwpqUzlAqJc2W08U7LrioL8z4KOhkrv3u26oSwwbTDObHrv9vR005hGzXqE24tMdqRxn-tkOT8cFcen2ZWgrn3jCBBp5b5eGpBILMddK2fBgkytIMLrfjN03gZ1pMJ4soJUvlt-IlWZkRnniHiWrPZ04e0j5HPtgX0H9sRqkhCNqlrMEI3dEEWwz7jhIQ',
  hotel1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-QWF35qrti3zCA7COik_xqv1QnzvAXdJ9Iw1TpMHrdFMYmBMpuFlnoEF5KCHzk7g0VhYJ2nmht-tEQaIymjs5yHeXIjsyHlN0m1cnegXzrRmyKHV5JaPeWe8qnLrAczQQWAI2PitDigpwI9RUqlQcmginluzufmcS8SoYpNYu9chBRSThsJpFkBMqs_zv0G7FOjJZ_dGS2Qdlgba5jtGu-7bKnt5-DvawLvPlkKpOe8rO_TYSth_BtpBJooN2ZBvrUkZuS7jW6gQ',
}
export default function TravelScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Travel" leftIcon="arrow_back" onLeft={onBack} rightContent={<div style={{ display: 'flex', gap: 8 }}><Icon name="tune" size={24} style={{ color: C.textDim }} /></div>} />
      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 24, overflow: 'hidden' }}>
          <img src={IMG.maldives} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)' }} />
          <div style={{ position: 'absolute', top: 24, left: 24 }}><span style={{ background: C.secondaryDark, color: C.bg, fontWeight: 700, fontSize: 10, letterSpacing: 3, padding: '4px 12px', borderRadius: 99, textTransform: 'uppercase' }}>FEATURED</span></div>
          <div style={{ position: 'absolute', bottom: 32, left: 24, right: 24 }}>
            <h2 style={{ fontFamily: FONT.headline, fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>Azure Sanctuary<br />Bungalows</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
              <div>
                <p style={{ color: C.textDim, fontSize: 14 }}>Maldives, Baa Atoll</p>
                <p style={{ color: C.text, fontWeight: 700, fontSize: 20, marginTop: 4 }}>,200<span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400 }}>/night</span></p>
              </div>
              <button style={{ background: GRADIENT.primary, padding: '12px 24px', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>Book Now</button>
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: C.text, marginBottom: 16, paddingLeft: 8 }}>Popular Destinations</h3>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
            {[{ name: 'Cancun', loc: 'Mexico', price: '', img: IMG.cancun }, { name: 'Tulum', loc: 'Mexico', price: '', img: IMG.tulum }, { name: 'Los Cabos', loc: 'Mexico', price: '', img: IMG.cabos }].map((d) => (
              <div key={d.name} style={{ minWidth: 140, background: C.surfaceLow, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ height: 96, position: 'relative' }}>
                  <img src={d.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', padding: '4px 8px', borderRadius: 8 }}><span style={{ color: C.primary, fontWeight: 700, fontSize: 12 }}>{d.price}</span></div>
                </div>
                <div style={{ padding: 12 }}>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{d.name}</p>
                  <p style={{ color: C.textFaint, fontSize: 10, marginTop: 2 }}>{d.loc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily: FONT.headline, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: C.text, marginBottom: 16, paddingLeft: 8 }}>Deals For You</h3>
          <div style={{ background: C.surfaceLow, borderRadius: 16, padding: 12, display: 'flex', gap: 16, borderLeft: '2px solid rgba(29,158,117,0.3)' }}>
            <img src={IMG.hotel1} alt="" style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>The Grand Miami</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.surfaceHigh, padding: '2px 6px', borderRadius: 4 }}><Icon name="star" fill size={12} style={{ color: C.secondaryDark }} /><span style={{ fontSize: 10, color: C.text }}>4.9</span></div>
                </div>
                <p style={{ color: C.textFaint, fontSize: 10, marginTop: 4 }}>Downtown, Miami</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: C.primaryBright, fontWeight: 900, fontSize: 18 }}><span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6, color: C.text }}>/night</span></span>
                <span style={{ background: 'rgba(29,158,117,0.1)', color: C.primaryBright, fontSize: 9, padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>30% OFF</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
