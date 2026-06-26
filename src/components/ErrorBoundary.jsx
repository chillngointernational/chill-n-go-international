import { Component } from 'react'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Red de seguridad global: si cualquier componente revienta en render, muestra una tarjeta amigable
// en vez de pantalla negra, y loguea el error en consola. Recuperación con recarga completa (re-monta
// el árbol limpio). Class component porque los error boundaries solo existen como clases en React.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log para diagnóstico (no se muestra al usuario).
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.icon}><Icon name="error_outline" size={30} style={{ color: C.onSurfaceVariant }} /></div>
          <h1 style={S.title}>Algo salió mal</h1>
          <p style={S.text}>Tuvimos un problema al mostrar esta pantalla. Recarga o vuelve a GoShop.</p>
          <div style={S.actions}>
            <button onClick={() => window.location.reload()} style={S.primaryBtn}>Recargar</button>
            <a href="/app/explore" style={S.ghostBtn}>Volver a GoShop</a>
          </div>
        </div>
      </div>
    )
  }
}

const S = {
  wrap: { minHeight: '100dvh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body },
  card: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 360 },
  icon: { width: 72, height: 72, borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.headline, fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
  text: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0 },
  actions: { display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  primaryBtn: { background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body },
  ghostBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 600, color: C.onSurface, textDecoration: 'none', fontFamily: FONT.body },
}
