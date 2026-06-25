import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../stitch'
import Footer from '../components/Footer'
import { useMyStore } from '../hooks/useMyStore'

/**
 * Landing pública de Chill N Go (marketing).
 *
 * Tema LOCAL claro/premium: el tema global `C` (stitch.jsx) es oscuro y lo
 * comparte toda la app, así que la landing define su propia paleta y fuentes
 * para no afectar al resto de pantallas. Reutiliza el verde de marca y el
 * componente real `Icon` (Material Symbols).
 *
 * Modelo legal (no romper): un solo nivel de referido; recompensas solo sobre
 * compras reales; Chilliums = saldo de recompensas cerrado (nunca dinero,
 * efectivo, moneda, retirable ni transferible); sin inversión ni rendimientos.
 */

// ---- Paleta local (light / premium) ----
const L = {
  bg: '#FBFAF6',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F1E9',
  ink: '#15211C',
  inkSoft: '#43514A',
  inkFaint: '#6C7A72',
  line: 'rgba(21,33,28,0.10)',
  green: '#1D9E75',
  greenDark: '#0F6E56',
  greenBright: '#26A37A',
  greenSoft: 'rgba(29,158,117,0.10)',
  gold: '#B8852A',
  goldSoft: 'rgba(184,133,42,0.12)',
  dark: '#0E2A22',
  darkText: '#EAF3EE',
  darkTextDim: 'rgba(234,243,238,0.66)',
}
const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif"
const BODY = "'Figtree', system-ui, -apple-system, sans-serif"

// ---- Contenido ----
const STEPS = [
  {
    icon: 'card_membership',
    title: 'Hazte miembro',
    desc: 'Activa CNG+ por $7 USD/mes y entra al marketplace con precios de socio en las cinco categorías.',
  },
  {
    icon: 'shopping_bag',
    title: 'Compra y vende',
    desc: 'Cada compra dentro de Chill N Go te regresa una parte en Chilliums: tu saldo de recompensas para la próxima.',
  },
  {
    icon: 'group_add',
    title: 'Invita a un amigo',
    desc: 'Gana recompensas en Chilliums solo sobre las compras reales de quien invitas. Un solo nivel, de por vida, nunca por inscribirse.',
  },
]

const LOBS = [
  { name: 'Travel', icon: 'flight_takeoff', desc: 'Hoteles, vuelos, tours y experiencias con tarifas de socio.' },
  { name: 'Nutrition', icon: 'restaurant', desc: 'Planes nutricionales, productos de bienestar y servicios de salud.' },
  { name: 'Real Estate', icon: 'home_work', desc: 'Anuncios de propiedades y servicios inmobiliarios: renta, venta y relocation.' },
  { name: 'Store', icon: 'storefront', desc: 'Tienda física y digital con productos exclusivos para miembros.' },
  { name: 'Online', icon: 'language', desc: 'Servicios digitales, cursos y herramientas para tu día a día.' },
]

const CHILLIUM_POINTS = [
  'Son saldo de recompensas para usar dentro de Chill N Go, no una moneda ni dinero en efectivo.',
  'No son retirables ni transferibles y no se cambian por dinero.',
  'Aplican como descuento hasta cierto porcentaje de cada compra; el resto se paga en dinero real.',
  'Las recompensas por referidos se ganan solo sobre compras reales de quien invitaste — nunca por inscribir gente.',
]

const MEMBERSHIP_BENEFITS = [
  'Acceso a las cinco categorías del marketplace con precios de socio.',
  'Cashback en Chilliums en cada compra que haces.',
  'Recompensas por referidos de un nivel, solo sobre compras reales.',
  'Publica y vende tus propios productos y servicios.',
  'Soporte y novedades del ecosistema.',
]

// Párrafos legales — VERBATIM. No resumir ni alterar.
const LEGAL = [
  'Sobre las recompensas (Chilliums). Los Chilliums son saldo de recompensas para usar exclusivamente dentro de Chill N Go. No son dinero de curso legal ni instrumento de pago: no son retirables, no son transferibles entre usuarios y no se redimen por efectivo. Se aplican como descuento, hasta un porcentaje máximo, sobre compras dentro de la plataforma y pueden tener vigencia y límites de acumulación.',
  'Sobre los referidos. Las recompensas por referidos se otorgan únicamente sobre compras reales realizadas por las personas que invitaste, son de un solo nivel y se financian con la comisión de Chill N Go sobre esas ventas. No se paga por reclutar, por inscribir personas ni por la cuota de membresía de nadie.',
  'Sobre los ingresos. Chill N Go es un marketplace y un programa de recompensas, no una oportunidad de inversión ni un esquema de ingresos. No prometemos ni garantizamos ganancias económicas. Las compras y ventas se liquidan en dinero real; como facilitador del marketplace, recaudamos y enteramos los impuestos que correspondan en cada país.',
  'Sobre la membresía. La membresía CNG+ es un cargo recurrente mensual que se renueva automáticamente hasta que la canceles. Puedes cancelar en cualquier momento desde tu cuenta y dejarás de pagar el siguiente periodo.',
]

// ---- Hooks ----
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function useInView(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

// ---- Componentes ----
function FadeIn({ children, delay = 0, as: Tag = 'div', style = {}, ...rest }) {
  const ref = useRef(null)
  const visible = useInView(ref)
  const reduced = usePrefersReducedMotion()
  const animStyle = reduced
    ? {}
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }
  return (
    <Tag ref={ref} style={{ ...animStyle, ...style }} {...rest}>
      {children}
    </Tag>
  )
}

function Logo({ size = 30 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: size * 0.28,
          background: `linear-gradient(135deg, ${L.green}, ${L.greenDark})`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.5, color: '#fff',
        }}
      >C</span>
      <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1, color: L.ink }}>CHILL N GO</span>
      <span style={{ fontSize: 10, color: L.inkFaint, letterSpacing: 2 }}>INTL.</span>
    </span>
  )
}

function CoinC({ size = 26 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, #E7C892, ${L.gold})`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.5, color: '#5A3E0C',
        boxShadow: 'inset 0 -2px 4px rgba(90,62,12,0.25)',
      }}
    >C</span>
  )
}

function RewardCycle() {
  const node = (icon, label, accent) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', minWidth: 92 }}>
      <span style={{
        width: 56, height: 56, borderRadius: '50%', background: L.greenSoft,
        border: `1px solid ${L.green}33`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {accent ? <CoinC size={28} /> : <Icon name={icon} size={26} style={{ color: L.greenDark }} />}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: L.ink, maxWidth: 110, lineHeight: 1.3 }}>{label}</span>
    </div>
  )
  const arrow = (
    <Icon name="arrow_forward" size={20} className="rc-arrow" style={{ color: L.green, flexShrink: 0 }} />
  )
  return (
    <div
      role="img"
      aria-label="El ciclo de recompensa: compras, ganas Chilliums y ahorras en tu próxima compra."
      style={{
        background: L.surface, border: `1px solid ${L.line}`, borderRadius: 20,
        padding: '22px 20px', boxShadow: '0 18px 40px -28px rgba(15,46,38,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="autorenew" size={16} style={{ color: L.green }} aria-hidden="true" />
        <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: L.greenDark, fontWeight: 600 }}>
          El ciclo de recompensa
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {node('shopping_bag', 'Compras', false)}
        {arrow}
        {node(null, 'Ganas Chilliums', true)}
        {arrow}
        {node('savings', 'Ahorras en la próxima', false)}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: L.green, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function CheckItem({ children, light = false }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start', lineHeight: 1.6 }}>
      <Icon name="check_circle" size={20} style={{ color: light ? L.greenBright : L.green, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <span style={{ fontSize: 15, color: light ? L.darkTextDim : L.inkSoft }}>{children}</span>
    </li>
  )
}

export default function Landing() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const sectionPad = isMobile ? '72px 20px' : '104px 24px'

  // Navegación context-aware: si el logueado ya tiene tienda, la pill apunta a "Mi Tienda".
  // (Solo navegación; lectura por RLS stores_select_own, independiente de la membresía.)
  const { store: myStore } = useMyStore()

  return (
    <div style={{ background: L.bg, color: L.ink, minHeight: '100vh', fontFamily: BODY, overflowX: 'hidden' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Figtree:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      <style>{`
        html { scroll-behavior: smooth; }
        .cng-landing a:focus-visible,
        .cng-landing button:focus-visible {
          outline: 3px solid ${L.greenDark};
          outline-offset: 3px;
          border-radius: 8px;
        }
        .cng-cta { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .cng-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -16px ${L.greenDark}; }
        .cng-card { transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        .cng-card:hover { transform: translateY(-4px); border-color: ${L.green}55; box-shadow: 0 20px 40px -30px rgba(15,46,38,0.5); }
        @keyframes cngFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .cng-landing *, .cng-landing *::before, .cng-landing *::after {
            animation: none !important;
            transition: none !important;
          }
          .cng-cta:hover, .cng-card:hover { transform: none; }
        }
      `}</style>

      <div className="cng-landing">
        {/* NAV */}
        <nav
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            padding: isMobile ? '12px 18px' : '16px 32px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(251,250,246,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${L.line}`,
          }}
        >
          <Link to="/" aria-label="Chill N Go — inicio" style={{ textDecoration: 'none' }}>
            <Logo />
          </Link>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', fontSize: 14 }}>
            {!isMobile && (
              <div style={{ display: 'flex', gap: 28 }}>
                <a href="#como-funciona" style={{ color: L.inkSoft, textDecoration: 'none' }}>Cómo funciona</a>
                <a href="#marketplace" style={{ color: L.inkSoft, textDecoration: 'none' }}>Marketplace</a>
                <a href="#chilliums" style={{ color: L.inkSoft, textDecoration: 'none' }}>Chilliums</a>
                <a href="#membresia" style={{ color: L.inkSoft, textDecoration: 'none' }}>Membresía</a>
              </div>
            )}
            <Link
              to={myStore ? '/mi-tienda' : '/vender'}
              style={{
                padding: '7px 15px', borderRadius: 50,
                background: `linear-gradient(135deg, ${L.green}, ${L.greenDark})`,
                color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
              }}
            >{myStore ? 'Mi Tienda' : 'Vender'}</Link>
            <Link to="/login" style={{ color: L.greenDark, textDecoration: 'none', fontWeight: 600 }}>Entrar</Link>
          </div>
        </nav>

        {/* HERO */}
        <header
          style={{
            position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', padding: isMobile ? '120px 20px 64px' : '168px 24px 96px',
            maxWidth: 920, margin: '0 auto',
          }}
        >
          <FadeIn>
            <SectionLabel>Chill N Go International</SectionLabel>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1 style={{
              fontFamily: DISPLAY, fontWeight: 600,
              fontSize: isMobile ? 'clamp(32px, 9vw, 44px)' : 'clamp(44px, 5.6vw, 68px)',
              lineHeight: 1.08, letterSpacing: '-0.01em', maxWidth: 760, margin: '0 0 20px', color: L.ink,
            }}>
              Compra, vende y cada compra te{' '}
              <span style={{ color: L.green, fontStyle: 'italic' }}>regresa recompensas</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p style={{ fontSize: 17, color: L.inkSoft, maxWidth: 540, lineHeight: 1.7, margin: '0 0 32px' }}>
              Un marketplace de viajes, productos, propiedades y servicios — con precios de socio
              y recompensas en Chilliums cada vez que usas la plataforma.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Link
              to="/app/explore"
              className="cng-cta"
              style={{
                display: 'inline-block', padding: '15px 30px', borderRadius: 50,
                background: `linear-gradient(135deg, ${L.green}, ${L.greenDark})`,
                color: '#fff', fontWeight: 600, fontSize: 15.5, textDecoration: 'none',
                boxShadow: '0 12px 28px -18px rgba(15,46,38,0.7)',
              }}
            >
              Explorar el marketplace
            </Link>
            <div style={{ fontSize: 13, color: L.inkFaint, marginTop: 14 }}>
              El acceso de miembros es por invitación (próximamente).
            </div>
          </FadeIn>
          <FadeIn delay={0.2} style={{ width: '100%', maxWidth: 520, marginTop: 48 }}>
            <RewardCycle />
          </FadeIn>
        </header>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" style={{ padding: sectionPad, maxWidth: 1080, margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: 52 }}>
            <SectionLabel>Cómo funciona</SectionLabel>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(28px, 4vw, 40px)', margin: 0, color: L.ink }}>
              Tres pasos, sin complicaciones
            </h2>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            {STEPS.map((step, i) => (
              <FadeIn key={step.title} delay={i * 0.08}>
                <div
                  className="cng-card"
                  style={{
                    height: '100%', background: L.surface, border: `1px solid ${L.line}`,
                    borderRadius: 18, padding: 28,
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, background: L.greenSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                  }}>
                    <Icon name={step.icon} size={26} style={{ color: L.greenDark }} aria-hidden="true" />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: L.green, marginBottom: 6 }}>
                    Paso {i + 1}
                  </div>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 21, margin: '0 0 10px', color: L.ink }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 14.5, color: L.inkSoft, lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* MARKETPLACE */}
        <section id="marketplace" style={{ padding: sectionPad, maxWidth: 1080, margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: 52 }}>
            <SectionLabel>Marketplace</SectionLabel>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 14px', color: L.ink }}>
              Cinco categorías, un solo ecosistema
            </h2>
            <p style={{ fontSize: 15, color: L.inkSoft, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
              Todo lo que compras en cualquier categoría te genera Chilliums que puedes usar en las demás.
            </p>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {LOBS.map((lob, i) => (
              <FadeIn key={lob.name} delay={i * 0.06}>
                <div
                  className="cng-card"
                  style={{
                    height: '100%', background: L.surface, border: `1px solid ${L.line}`,
                    borderRadius: 18, padding: 24, textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: L.greenSoft,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                  }}>
                    <Icon name={lob.icon} size={26} style={{ color: L.greenDark }} aria-hidden="true" />
                  </div>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, margin: '0 0 8px', color: L.ink }}>
                    {lob.name}
                  </h3>
                  <p style={{ fontSize: 13.5, color: L.inkFaint, lineHeight: 1.55, margin: 0 }}>{lob.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* CHILLIUMS (sección con contraste) */}
        <section id="chilliums" style={{ background: L.dark, color: L.darkText }}>
          <div style={{ padding: sectionPad, maxWidth: 980, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 48, alignItems: 'center' }}>
              <FadeIn>
                <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: L.greenBright, fontWeight: 600, marginBottom: 14 }}>
                  Chilliums
                </div>
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 16px', lineHeight: 1.15 }}>
                  Tu saldo de recompensas dentro de Chill N Go
                </h2>
                <p style={{ fontSize: 16, color: L.darkTextDim, lineHeight: 1.7, margin: 0 }}>
                  Ganas Chilliums con tus compras y con las compras reales de las personas que invitas.
                  Los usas como descuento en tu siguiente compra dentro de la plataforma.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
                  <CoinC size={34} />
                  <span style={{ fontSize: 14, color: L.darkTextDim }}>1 Chillium = 1 punto de recompensa</span>
                </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <div style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 20, padding: isMobile ? 24 : 30,
                }}>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, margin: '0 0 18px', color: L.darkText }}>
                    Cómo funcionan los Chilliums
                  </h3>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, padding: 0, margin: 0 }}>
                    {CHILLIUM_POINTS.map((point) => (
                      <CheckItem key={point} light>{point}</CheckItem>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* MEMBRESÍA */}
        <section id="membresia" style={{ padding: sectionPad, maxWidth: 760, margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: 36 }}>
            <SectionLabel>Membresía</SectionLabel>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(30px, 4.5vw, 44px)', margin: '0 0 8px', color: L.ink }}>
              CNG+ — <span style={{ color: L.green }}>$7 USD/mes</span>
            </h2>
            <p style={{ fontSize: 15, color: L.inkSoft, margin: 0 }}>Una sola membresía para todo el ecosistema.</p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{
              background: L.surface, border: `1px solid ${L.line}`, borderRadius: 20,
              padding: isMobile ? 26 : 34, boxShadow: '0 24px 50px -38px rgba(15,46,38,0.5)',
            }}>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, padding: 0, margin: '0 0 26px' }}>
                {MEMBERSHIP_BENEFITS.map((benefit) => (
                  <CheckItem key={benefit}>{benefit}</CheckItem>
                ))}
              </ul>
              <Link
                to="/app/explore"
                className="cng-cta"
                style={{
                  display: 'block', textAlign: 'center', padding: '15px 24px', borderRadius: 50,
                  background: `linear-gradient(135deg, ${L.green}, ${L.greenDark})`,
                  color: '#fff', fontWeight: 600, fontSize: 15.5, textDecoration: 'none',
                }}
              >
                Explorar el marketplace
              </Link>
              <div style={{ fontSize: 13, color: L.inkFaint, textAlign: 'center', marginTop: 14 }}>
                El acceso de miembros es por invitación (próximamente).
              </div>
            </div>
          </FadeIn>
        </section>

        {/* INVITACIÓN */}
        <section style={{ padding: isMobile ? '24px 20px 72px' : '24px 24px 104px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <FadeIn>
            <div style={{ fontSize: 12, color: L.inkFaint, letterSpacing: 1, marginBottom: 14 }}>ACCESO</div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(24px, 3.6vw, 34px)', margin: '0 0 14px', color: L.ink }}>
              Por ahora, por invitación
            </h2>
            <p style={{ fontSize: 15, color: L.inkSoft, lineHeight: 1.7, margin: 0 }}>
              CNG+ está creciendo poco a poco. Por ahora solo puedes unirte a través del link de un
              miembro activo. Si alguien te compartió un enlace, úsalo para acceder.
            </p>
          </FadeIn>
        </section>

        {/* FOOTER del sitio (tema claro; conserva los párrafos legales VERBATIM vía prop `legal`) */}
        <Footer variant="light" legal={LEGAL} />
      </div>
    </div>
  )
}
