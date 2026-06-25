import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'
import PendingStores from '../pages/admin/PendingStores'

// AdminShell (/admin) — layout del panel de administración. CRECE: hoy una sección
// ("Tiendas por aprobar"); mañana se cuelgan más sin rehacer el shell.
//
// GUARD DE EXPERIENCIA (no de seguridad): al montar consulta cng_is_admin; si no es
// admin, redirige fuera. La SEGURIDAD REAL ya la imponen el server (la edge function
// cng-admin-store-decision + su RPC auto-gateado) y el blindaje por columnas de stores:
// aunque alguien forzara esta ruta, no podría cambiar el estado de ninguna tienda.
// La ruta ya va envuelta en ProtectedRoute (exige sesión) en App.jsx.

export default function AdminShell() {
  const { user } = useAuth()
  const [state, setState] = useState('checking') // 'checking' | 'admin' | 'denied'

  useEffect(() => {
    let alive = true
    supabase.rpc('cng_is_admin').then(({ data, error }) => {
      if (!alive) return
      setState(!error && data === true ? 'admin' : 'denied')
    })
    return () => { alive = false }
  }, [user])

  if (state === 'checking') {
    return <div style={S.center}>Verificando acceso…</div>
  }
  if (state === 'denied') {
    return <Navigate to="/app/feed" replace />
  }

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.brandIcon}><Icon name="admin_panel_settings" size={18} style={{ color: '#06140d' }} /></div>
          <span style={S.brandText}>ADMIN</span>
        </div>
        <Link to="/app/feed" style={S.exit}>Salir</Link>
      </header>

      <main style={S.main}>
        <PendingStores />
        {/* Próximas secciones del panel se agregan aquí. */}
      </main>
    </div>
  )
}

const S = {
  center: { minHeight: '100dvh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.onSurfaceVariant, fontFamily: FONT.body, fontSize: 14 },
  wrap: { minHeight: '100dvh', background: C.surface, fontFamily: FONT.body },
  header: { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: { width: 30, height: 30, borderRadius: 8, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: 2, fontFamily: FONT.headline },
  exit: { color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  main: { maxWidth: 640, margin: '0 auto', padding: '28px 20px 64px' },
}
