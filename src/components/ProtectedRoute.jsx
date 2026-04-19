import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { C, FONT } from '../stitch'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.onSurfaceVariant,
        fontFamily: FONT.body,
        fontSize: 14,
      }}>
        Cargando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Intermediate states (payment_pending, kyc_pending, kyc_failed, etc.)
  // are handled inside each protected page (Dashboard shows state-specific CTAs).
  return children
}
