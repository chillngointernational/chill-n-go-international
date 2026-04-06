import { useState, useEffect, useCallback } from 'react'
import { C, FONT, Icon } from '../../stitch'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'

const IMG = {
  beach: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8-1aMHRCfKTcwjQKPT-T-m1NLImFWm57GT9pH871jx_D5ifIdQgyYVirqyhU9ZV1kJhkP6MtfkP2w2_O_fbx8tg7BFLV1FKrriRvA_k4ZzkLaWzrE7dNay55T9UzN8nrZUq7VZfKDZuxjn8zPwoRsEW0I5DG89CB6qRVYfeOBPI8JOFxIFe_i47pcsn8CCxvpkbQ8m90E0JgGuAdTa_G8Bq3T6fMILeQRMRA4-rCMr7fyObB4GEwGMBneQhDRnU2QUSDmaNa4ZmE',
  food: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUDSeSECuSv0Tm6EQ-Rys12_vT1y6GPGCIBT2XMmF1OBS9IFEVxmYrqX2aWPQPlbrR00Zsk9344KzOanTl1xIdfI6t5zuZLgRUzOxOiKaQ7fZRFWVk_U0OpFDb4jTX-BQRyWo0mIf-z1UlyZVu7beZ14IE58iVOcfod3gkbXEDMQYxZoY32gpxj6zQgf56HbaLVPLkRlAYTIBjqmkzAupjv1GzBTsiA_mJNat2GJBAniblPwX25YzFSvyWFIjgZ0ybmx-qpUPcRDk',
  accessories: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAv3QpK2Mni6gtGv5wZ6oXnhAq6QNvcg7DCGo2njAL8wEDS3UbPx9ogh9kK7WFiNKko8m86jqI1obipcx3zIleINfJ6KacLGvMT8mXI-rhqOze3nzHdBRBhp-9MNhkqlegw92noYb6ezPy7FkQ8cDEHM8_s4xB65S1IExcKJk0y2ENoYa1HBZI-vXj3wB2zH4IImuVee2RffMf_ZmxnW6inJTe_wYM5Oie64Kcs6dIg2Ie4xlk2n-ckngKvpYksp6nQd6cOUoLFRFM',
  gadgets: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCN0-zwYLlAOHYq3MMQVxoU36yblok4Np58Ihno6c9Y5V2DNCNmVP9z-Rw557uiwRNK1h8XZzi6cZPJsM8IV3GN2O9EVB4ixKIQsst_Omwry0jB2x3yD1Gy5LtXMNjN-b1-lroUk-KZA0Z3NbXvv92Huf8buNYsEiblGifJamEdy-goGoZePf3B0ZZgEr37jBFfR0oYDkl0SyzqY44RpBpn0Ff4ij0M6_pkFMl7KWirYCHzjiXzjF7FRtGiZZIiW6211WtJILiP7X8',
  mansion: 'https://lh3.googleusercontent.com/aida-public/AB6AXuACIRt7dDFvbYpzFqCAByOePEcbEaIT0VYpWpc68CweGLaqmkNZehwuLDc3TVhr8mlo_3-RFLhXVFc6tL5dySGsufyuXLHtaAiLtmvWSNgEAEGuGAIHM6i_7xXPI2lP6vu_scE7eysQTnZmbIVXTxYdKbARkCKAFnyG0Lj4uhI0YTXDpEbRGdutJSOQhgAe4z-gmzp8YcPQnWtuQiX82IvvZ7EBgwdVlAKU975Iw7PoMQW7lHzgbUzhSlChxeSwFETIWwYijgE2iC0',
  bakery: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI-5kpaIjt1KwCvgH7iWSnncL4Y-4sPboWdXYhORSmfDFl27ihdjvQ6PfKm6JNy21WIz2h4md496aw3lQlFc-6vLlwcEvrUrPdqepAKw5bp0m3jQxxkwJSf1sUxmFJLMOxJvckwiW3nuy8fogtM4FGWK3xU-rEhcx2HJgRkmCZ_YhGcPzDr9mR_ktvH667-W0qMGyfMmEkQJWnw7xbO7f06eId1X-BTbk0hlENWywaM8Chh7ftRGEFIVbcJmmUQGvoShU4-6FcJDc',
  gala: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUu8uFV5cQyuCmcnsH8Sxs4zmH0qTLF-3y3E3UDifDbpgJ0eW63pUQEhXfQcpOrG0oFISWxilk7CltiX0-f68z7c055WPtasJd_12TnZXUg2JmQJo2vo1Zi9ER0PEDbB7pREwGz3gXQhgvTh02MVs_3GQt2wPnEcEemePc82uk7zVtub4PqOKISQ7us4_keZ1vk8IjOD70rncQygtJtu7so5uNoztqTQ2SLXRvapIT3T8YAP48az6GaNSjD93LvwOS3GPX3LSo5ZM',
}

const CATEGORIES = [
  { name: 'Travel', icon: 'flight_takeoff', color: '#1D9E75', img: IMG.beach, sub: 'travel', value: 'travel' },
  { name: 'Nutrition', icon: 'restaurant', color: '#e7c092', img: IMG.food, sub: 'nutrition', value: 'nutrition' },
  { name: 'Store', icon: 'shopping_bag', color: '#FF7F50', img: IMG.accessories, sub: 'store', value: 'store' },
  { name: 'Online Store', icon: 'devices', color: '#c5c0ff', img: IMG.gadgets, sub: 'store', value: 'online' },
  { name: 'Real Estate', icon: 'domain', color: '#68dbae', img: IMG.mansion, sub: 'realestate', value: 'realestate' },
  { name: 'CandyStakes', icon: 'military_tech', color: '#8c84eb', img: IMG.bakery, sub: 'candystakes', value: 'candystakes' },
]

export default function ExploreScreen({ onNavigate, isDesktop }) {
  const [categoryCounts, setCategoryCounts] = useState({})
  const [trending, setTrending] = useState([])
  const [loadingTrending, setLoadingTrending] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Fetch counts per category
      const counts = {}
      const countPromises = CATEGORIES.map(async (cat) => {
        const { count, error } = await supabase
          .from('cng_posts')
          .select('id', { count: 'exact', head: true })
          .eq('category', cat.value)
          .eq('is_active', true)
        if (!error) counts[cat.value] = count || 0
      })
      await Promise.all(countPromises)
      setCategoryCounts(counts)

      // Fetch trending posts (most likes in last 48h)
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data: trendingPosts, error: tErr } = await supabase
        .from('cng_posts')
        .select('*, cng_members!cng_posts_member_id_fkey(full_name, ref_code)')
        .eq('is_active', true)
        .gte('created_at', since)
        .order('likes_count', { ascending: false })
        .limit(5)

      if (!tErr) setTrending(trendingPosts || [])
    } catch (e) {
      console.error('Explore error:', e)
    } finally {
      setLoadingTrending(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Chill N Go" leftIcon="menu" rightIcon="notifications" />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} />
          <input placeholder="Explore your next vibe..." style={{ width: '100%', height: 56, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, paddingLeft: 48, paddingRight: 16, color: C.onSurface, fontSize: 14, fontFamily: FONT.body, outline: 'none' }} />
        </div>

        {/* Category grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
          {CATEGORIES.map((c) => (
            <div key={c.name} onClick={() => onNavigate(c.sub)} style={{ position: 'relative', height: 192, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
              <img src={c.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
              <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                <Icon name={c.icon} fill size={24} style={{ color: c.color, marginBottom: 4 }} />
                <h3 style={{ fontFamily: FONT.headline, fontWeight: 700, color: C.text }}>{c.name}</h3>
                {categoryCounts[c.value] !== undefined && (
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, fontFamily: FONT.body }}>
                    {categoryCounts[c.value]} post{categoryCounts[c.value] !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Trending */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONT.headline, fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: 3 }}>Trending Now</h2>
            <span style={{ color: C.secondaryDark, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>VIEW ALL</span>
          </div>
          <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 16 }}>
            {loadingTrending ? (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: 40 }}>
                <div style={{ width: 24, height: 24, border: '2px solid rgba(104,219,174,0.3)', borderTopColor: C.primary, borderRadius: 99, animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : trending.length > 0 ? (
              trending.map((post) => (
                <div key={post.id} style={{ flexShrink: 0, width: 288, background: C.surfaceLow, borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ height: 160, position: 'relative', background: C.surfaceHigh }}>
                    {post.media_url ? (
                      <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(29,158,117,0.3), rgba(13,17,23,0.8))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="article" size={40} style={{ color: C.textFaint }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '4px 12px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="favorite" fill size={12} style={{ color: '#E24B4A' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{post.likes_count}</span>
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ color: C.secondary, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3 }}>{post.category}</p>
                    <h4 style={{ fontFamily: FONT.headline, fontWeight: 700, color: C.onSurface, fontSize: 16, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || 'Untitled post'}</h4>
                    <p style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>by {post.cng_members?.full_name || post.cng_members?.ref_code || 'Member'}</p>
                  </div>
                </div>
              ))
            ) : (
              // Fallback demo
              <div style={{ flexShrink: 0, width: 288, background: C.surfaceLow, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ height: 160, position: 'relative' }}>
                  <img src={IMG.gala} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '4px 12px', borderRadius: 99, fontSize: 10, fontWeight: 700, color: C.secondary }}>PREMIUM</div>
                </div>
                <div style={{ padding: 20 }}>
                  <p style={{ color: C.secondary, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3 }}>Experiences</p>
                  <h4 style={{ fontFamily: FONT.headline, fontWeight: 700, color: C.onSurface, fontSize: 16, marginTop: 8 }}>Obsidian Night: Private Concierge Gala</h4>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
