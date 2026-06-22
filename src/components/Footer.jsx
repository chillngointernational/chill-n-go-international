import { Link } from 'react-router-dom'
import { C, FONT } from '../stitch'

// Footer del SITIO — SOLO en páginas web públicas (landing, /vender, /post, /login, /join,
// /reset-password). NUNCA en la app interna (/app/* vía AppShell): el feel tipo TikTok lo estorbaría.
// Theme-aware: 'dark' (paleta stitch, default) | 'light' (landing). Los links sin página todavía se
// renderizan como "Pronto" (NO clicables) -> jamás llevan a una ruta rota.

const SUPPORT_EMAIL = 'contact@chillngointernational.com'

const COLUMNS = [
  { title: 'Acerca de Chill N Go', links: [
    { label: 'Sobre nosotros', soon: true },
    { label: 'Cómo funciona', soon: true },
    { label: 'Preguntas frecuentes', soon: true },
  ] },
  { title: 'Vender', links: [
    { label: 'Vender en GoShop', to: '/vender' },          // FUNCIONAL
    { label: 'Cómo ser vendedor', soon: true },
    { label: 'Requisitos de vendedor', soon: true },
  ] },
  { title: 'Comprar', links: [
    { label: 'Explorar GoShop', to: '/app/explore' },       // FUNCIONAL (público para anónimos)
    { label: 'Travel', soon: true },
  ] },
  { title: 'Legal y soporte', links: [
    { label: 'Términos y condiciones', soon: true },
    { label: 'Aviso de privacidad', soon: true },
    { label: 'Contacto', href: `mailto:${SUPPORT_EMAIL}`, sub: SUPPORT_EMAIL },  // FUNCIONAL
  ] },
]

// Redes sociales: placeholders DESHABILITADOS hasta tener los links (title="Próximamente").
// Para activarlos: añadir `href` a cada uno (se renderiza como <a target="_blank"> automáticamente).
const SOCIAL = [
  { label: 'Instagram', path: 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm4.5-2.8a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z' },
  { label: 'Facebook', path: 'M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z' },
  { label: 'TikTok', path: 'M16.5 3c.4 2 1.6 3.5 3.5 3.8v2.4c-1.3 0-2.5-.4-3.5-1.1v6.4a5.4 5.4 0 11-5.4-5.4c.3 0 .6 0 .9.1v2.5a2.9 2.9 0 102 2.8V3h2z' },
]

const PALETTES = {
  dark: {
    bg: '#06090F', border: 'rgba(255,255,255,0.08)', title: C.text, link: 'rgba(241,239,232,0.62)',
    soon: 'rgba(241,239,232,0.33)', socket: 'rgba(241,239,232,0.5)', chipBg: 'rgba(255,255,255,0.06)',
    chipBorder: 'rgba(255,255,255,0.12)', chipFg: 'rgba(241,239,232,0.7)', divider: 'rgba(255,255,255,0.07)', logoText: C.text,
  },
  light: {
    bg: '#F3F1E9', border: 'rgba(21,33,28,0.10)', title: '#15211C', link: '#43514A',
    soon: '#9AA69F', socket: '#6C7A72', chipBg: 'rgba(21,33,28,0.04)',
    chipBorder: 'rgba(21,33,28,0.12)', chipFg: '#43514A', divider: 'rgba(21,33,28,0.10)', logoText: '#15211C',
  },
}

export default function Footer({ variant = 'dark', legal = null }) {
  const p = PALETTES[variant] || PALETTES.dark
  const lnk = { color: p.link, textDecoration: 'none', fontSize: 13.5, lineHeight: 1.5, display: 'inline-block' }
  return (
    <footer style={{ background: p.bg, borderTop: `1px solid ${p.border}`, fontFamily: FONT.body }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0' }}>
        {/* Columnas (4 en escritorio; se apilan en móvil vía auto-fit) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: p.title, letterSpacing: 0.5, margin: '0 0 14px', fontFamily: FONT.headline }}>{col.title}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} style={lnk}>{l.label}</Link>
                    ) : l.href ? (
                      <a href={l.href} style={lnk}>{l.label}{l.sub && <><br /><span style={{ color: p.soon, fontSize: 12.5 }}>{l.sub}</span></>}</a>
                    ) : (
                      <span title="Próximamente" style={{ color: p.soon, fontSize: 13.5, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {l.label}
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', border: `1px solid ${p.chipBorder}`, borderRadius: 4, padding: '1px 4px' }}>Pronto</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Párrafos legales (solo si se pasan, p.ej. la landing) — VERBATIM, mismo formato bold-lead */}
        {Array.isArray(legal) && legal.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '40px 0 0', paddingTop: 28, borderTop: `1px solid ${p.divider}` }}>
            {legal.map((par) => {
              const [lead, ...rest] = par.split('. ')
              return (
                <p key={lead} style={{ fontSize: 12, color: p.soon, lineHeight: 1.65, margin: 0 }}>
                  <strong style={{ color: p.link, fontWeight: 600 }}>{lead}.</strong> {rest.join('. ')}
                </p>
              )
            })}
          </div>
        )}

        {/* Socket: logo + copyright · pagos · redes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', margin: '32px 0 0', padding: '22px 0 32px', borderTop: `1px solid ${p.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#1D9E75,#0F6E56)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', fontFamily: FONT.headline }}>C</span>
              <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1.2, color: p.logoText, fontFamily: FONT.headline }}>CHILL N GO</span>
            </span>
            <span style={{ fontSize: 12, color: p.socket }}>© 2026 Chill N Go International LLC · Florida, USA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: p.socket }}>Pagos seguros · Mercado Pago</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {SOCIAL.map((s) => {
                const chip = { width: 30, height: 30, borderRadius: '50%', border: `1px solid ${p.chipBorder}`, background: p.chipBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: p.chipFg }
                const svg = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
                return s.href
                  ? <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} style={chip}>{svg}</a>
                  : <span key={s.label} title={`${s.label} · Próximamente`} aria-label={`${s.label} (próximamente)`} style={{ ...chip, cursor: 'default', opacity: 0.6 }}>{svg}</span>
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
