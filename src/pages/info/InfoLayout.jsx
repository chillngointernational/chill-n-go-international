import { Link } from 'react-router-dom'
import { C, FONT, GRADIENT } from '../../stitch'

// Scaffold de las PÁGINAS INFORMATIVAS públicas (tema oscuro, on-brand). Se montan bajo PublicLayout
// (footer del sitio abajo). Ancho de lectura cómodo + jerarquía de títulos clara. Primitivas
// reutilizables (Section, P, Lead, List, Steps, Callout, CTA) para mantener consistencia entre páginas.

const M = {
  page: { minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: FONT.body },
  topbar: {
    position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', background: 'rgba(8,12,20,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' },
  brandMark: { width: 28, height: 28, borderRadius: 7, background: GRADIENT.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', fontFamily: FONT.headline },
  brandText: { fontWeight: 800, fontSize: 13, letterSpacing: 1.4, color: C.text, fontFamily: FONT.headline },
  back: { color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  main: { maxWidth: 720, margin: '0 auto', padding: '48px 24px 72px' },
  kicker: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.primary, fontWeight: 700, marginBottom: 14 },
  title: { fontFamily: FONT.headline, fontWeight: 800, fontSize: 'clamp(30px, 5vw, 44px)', lineHeight: 1.12, margin: '0 0 14px', color: C.text },
  subtitle: { fontSize: 'clamp(16px, 2.2vw, 19px)', color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0, fontWeight: 500 },
  divider: { height: 1, background: 'rgba(255,255,255,0.08)', border: 'none', margin: '32px 0' },
}

export default function InfoLayout({ kicker = 'Chill N Go International', title, subtitle, children }) {
  return (
    <div style={M.page}>
      <header style={M.topbar}>
        <Link to="/" style={M.brand} aria-label="Chill N Go — inicio">
          <span aria-hidden="true" style={M.brandMark}>C</span>
          <span style={M.brandText}>CHILL N GO</span>
        </Link>
        <Link to="/" style={M.back}>← Inicio</Link>
      </header>
      <main style={M.main}>
        {kicker && <div style={M.kicker}>{kicker}</div>}
        {title && <h1 style={M.title}>{title}</h1>}
        {subtitle && <p style={M.subtitle}>{subtitle}</p>}
        <hr style={M.divider} />
        {children}
      </main>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section style={{ margin: '0 0 36px' }}>
      {title && <h2 style={{ fontFamily: FONT.headline, fontWeight: 700, fontSize: 'clamp(20px, 3vw, 26px)', color: C.text, margin: '0 0 14px', lineHeight: 1.25 }}>{title}</h2>}
      {children}
    </section>
  )
}

export function Lead({ children }) {
  return <p style={{ fontSize: 17, color: C.onSurface, lineHeight: 1.72, margin: '0 0 18px' }}>{children}</p>
}

export function P({ children }) {
  return <p style={{ fontSize: 16, color: C.onSurfaceVariant, lineHeight: 1.75, margin: '0 0 16px' }}>{children}</p>
}

// items: array de strings (viñeta simple) o { title, desc } (título en negrita + descripción).
export function List({ items }) {
  return (
    <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ color: C.primary, fontWeight: 800, lineHeight: 1.7, flexShrink: 0 }}>•</span>
          <span style={{ fontSize: 15.5, color: C.onSurfaceVariant, lineHeight: 1.7 }}>
            {typeof it === 'string' ? it : <><strong style={{ color: C.text, fontWeight: 700 }}>{it.title}</strong> {it.desc}</>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// items: array de { title, desc } — pasos numerados.
export function Steps({ items }) {
  return (
    <ol style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(104,219,174,0.12)', border: '1px solid rgba(104,219,174,0.3)', color: C.primary, fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT.headline }}>{i + 1}</span>
          <div>
            {it.title && <div style={{ fontSize: 16.5, fontWeight: 700, color: C.text, margin: '3px 0 6px' }}>{it.title}</div>}
            <div style={{ fontSize: 15.5, color: C.onSurfaceVariant, lineHeight: 1.72 }}>{it.desc}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Aviso destacado (p.ej. "versión preliminar" en páginas legales). Estilo dorado + itálica.
export function Notice({ children }) {
  return (
    <div style={{ background: 'rgba(231,192,146,0.07)', border: '1px solid rgba(231,192,146,0.28)', borderRadius: 12, padding: '14px 16px', margin: '0 0 28px', fontSize: 13.5, color: C.secondary, lineHeight: 1.6, fontStyle: 'italic' }}>
      {children}
    </div>
  )
}

export function Callout({ title, children }) {
  return (
    <div style={{ background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.18)', borderRadius: 14, padding: '20px 22px', margin: '8px 0 24px' }}>
      {title && <div style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 8px', fontFamily: FONT.headline }}>{title}</div>}
      <div style={{ fontSize: 15.5, color: C.onSurfaceVariant, lineHeight: 1.72 }}>{children}</div>
    </div>
  )
}

export function CTA({ to, children }) {
  return (
    <div style={{ margin: '8px 0 0' }}>
      <Link to={to} style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 50, background: GRADIENT.primary, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>{children}</Link>
    </div>
  )
}
