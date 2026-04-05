import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT } from '../stitch'

export default function ProtectedRoute({ children }) {
  const { user, member, loading } = useAuth()

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

  const isVerified = user.email_confirmed_at != null
  const isPaid = member?.payment_status === 'active'

  if (!isPaid || !isVerified) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.body,
        padding: 24,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: '40px 36px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginBottom:24}}>
            <div style={{width:32,height:32,borderRadius:8,background:GRADIENT.primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:C.surface}}>C</div>
            <span style={{fontWeight:700,fontSize:15,color:C.text,letterSpacing:1}}>CHILL N GO</span>
          </div>

          <h2 style={{fontSize:20,fontWeight:600,color:C.text,marginBottom:12}}>Acceso restringido</h2>

          {!isPaid && (
            <div style={{background:'rgba(239,159,39,0.08)',border:'1px solid rgba(239,159,39,0.2)',borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:500,color:'#FAC775',marginBottom:4}}>Membresía inactiva</div>
              <div style={{fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5}}>Tu membresía no está activa. Necesitas pagar para acceder al ecosistema CNG+.</div>
            </div>
          )}

          {isPaid && !isVerified && (
            <div style={{background:'rgba(239,159,39,0.08)',border:'1px solid rgba(239,159,39,0.2)',borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:500,color:'#FAC775',marginBottom:4}}>Verificación pendiente</div>
              <div style={{fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5}}>Revisa tu correo electrónico y haz clic en el enlace de verificación que te enviamos.</div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:20}}>
            {!isPaid && (
              <a href={member?.referred_by_code ? '/join?ref=' + member.referred_by_code : '/join'} style={{
                display:'block',background:GRADIENT.primary,border:'none',borderRadius:8,padding:'14px',fontSize:14,fontWeight:600,color:'white',textDecoration:'none',textAlign:'center',
              }}>Activar membresía</a>
            )}
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} style={{
              background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'12px',fontSize:13,color:C.onSurfaceVariant,cursor:'pointer',fontFamily:'inherit',
            }}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
