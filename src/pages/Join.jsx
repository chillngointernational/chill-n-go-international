import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Join() {
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref')
  const stepParam = searchParams.get('step')
  const emailParam = searchParams.get('email')
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [step, setStep] = useState(1) // 1=payment, 2=register, 3=verify
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [referrer, setReferrer] = useState(null)
  const [invalidRef, setInvalidRef] = useState(false)
  const [loadingRef, setLoadingRef] = useState(true)
  const [acceptedInvite, setAcceptedInvite] = useState(false)

  useEffect(() => {
    if (stepParam === 'register') {
      setStep(2)
      if (emailParam) setEmail(decodeURIComponent(emailParam))
    }
  }, [stepParam, emailParam])

  useEffect(() => {
    if (refCode) {
      fetchReferrer()
    } else {
      setLoadingRef(false)
    }
  }, [refCode])

  async function fetchReferrer() {
    try {
      const { data, error } = await supabase
        .from('cng_members')
        .select('full_name, email, ref_code, avatar_url, created_at')
        .eq('ref_code', refCode)
        .eq('payment_status', 'active')
        .single()
      if (error || !data) {
        setInvalidRef(true)
      } else {
        setReferrer(data)
      }
    } catch (e) {
      setInvalidRef(true)
    } finally {
      setLoadingRef(false)
    }
  }

  // No ref code = no access
  if (!refCode) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <h1 style={styles.title}>Acceso por invitación</h1>
          <p style={styles.subtitle}>
            Solo puedes unirte a CNG+ a través del link de un miembro activo.
            Si alguien te compartió un enlace, úsalo para acceder.
          </p>
          <Link to="/" style={styles.linkBtn}>← Volver al inicio</Link>
        </div>
      </div>
    )
  }

  if (loadingRef) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <p style={{...styles.subtitle, marginTop: 20}}>Verificando invitación...</p>
        </div>
      </div>
    )
  }

  if (invalidRef) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <h1 style={styles.title}>Link inválido</h1>
          <p style={styles.subtitle}>El código de referido no existe o la cuenta del referidor no está activa. Pide un link nuevo a quien te invitó.</p>
          <a href="/" style={{...styles.button, display:'block', textAlign:'center', textDecoration:'none', marginTop:20}}>Volver al inicio</a>
        </div>
      </div>
    )
  }

  async function handlePayment() {
    if (!email) {
      setError('Ingresa tu correo electrónico primero')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          ref_code: refCode,
          success_url: window.location.origin + '/join?step=register&ref=' + refCode + '&email=' + encodeURIComponent(email),
          cancel_url: window.location.origin + '/join?ref=' + refCode,
        }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError('Error al procesar el pago: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, refCode)
      setStep(3)
    } catch (err) {
      if (err.message.includes('already registered')) {
        setError('Este correo ya está registrado. Intenta iniciar sesión.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <Link to="/" style={styles.backLink}>← Volver al inicio</Link>

      {/* Progress steps */}
      <div style={styles.steps}>
        <div style={{ ...styles.step, ...(step >= 1 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 1 ? styles.stepDotActive : {}) }}>1</div>
          <span style={styles.stepLabel}>Pago</span>
        </div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.step, ...(step >= 2 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 2 ? styles.stepDotActive : {}) }}>2</div>
          <span style={styles.stepLabel}>Registro</span>
        </div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.step, ...(step >= 3 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 3 ? styles.stepDotActive : {}) }}>3</div>
          <span style={styles.stepLabel}>Verificar</span>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        {/* STEP 1: Invitation confirmation */}
        {step === 1 && !acceptedInvite && referrer && (
          <>
            <h1 style={styles.title}>Te han invitado a CNG+</h1>
            <p style={styles.subtitle}>Verifica que conoces a esta persona antes de continuar</p>

            <div style={{background:'rgba(127,119,221,0.08)', border:'1px solid rgba(127,119,221,0.2)', borderRadius:16, padding:24, textAlign:'center', marginBottom:24}}>
              <div style={{width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg, #7F77DD, #534AB7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'white', margin:'0 auto 12px'}}>
                {(referrer.full_name || referrer.email)[0].toUpperCase()}
              </div>
              <div style={{fontSize:18, fontWeight:600, color:'#f1efe8', marginBottom:4}}>
                {referrer.full_name || referrer.email.split('@')[0]}
              </div>
              <div style={{fontSize:13, color:'#AFA9EC', marginBottom:8}}>
                {referrer.email}
              </div>
              <div style={{fontSize:11, color:'#888', marginTop:8}}>
                Miembro desde {new Date(referrer.created_at).toLocaleDateString('es-MX', {month:'long', year:'numeric'})}
              </div>
            </div>

            <div style={{background:'rgba(239,159,39,0.06)', border:'1px solid rgba(239,159,39,0.15)', borderRadius:12, padding:16, marginBottom:24}}>
              <div style={{fontSize:13, color:'#FAC775', fontWeight:500, marginBottom:8}}>Importante</div>
              <div style={{fontSize:12, color:'#999', lineHeight:1.6}}>
                Al aceptar esta invitación, {referrer.full_name || referrer.email.split('@')[0]} será tu referidor permanente dentro del ecosistema CNG+. Esta relación no se puede cambiar después. Solo se permite una cuenta por persona.
              </div>
            </div>

            <button onClick={() => setAcceptedInvite(true)} style={styles.button}>
              Sí, acepto la invitación de {referrer.full_name || referrer.email.split('@')[0]}
            </button>

            <p style={{fontSize:12, color:'#666', textAlign:'center', marginTop:16, lineHeight:1.5}}>
              ¿No conoces a esta persona? No continúes y pide un link a alguien de tu confianza.
            </p>
          </>
        )}

        {/* STEP 1: Payment (after accepting invite) */}
        {step === 1 && acceptedInvite && (
          <>
            <div style={{...styles.refBadge, background:'rgba(29,158,117,0.1)', borderColor:'rgba(29,158,117,0.3)', color:'#5DCAA5'}}>
              Invitado por: {referrer.full_name || referrer.email.split('@')[0]}
            </div>

            <h1 style={styles.title}>Únete a CNG+</h1>
            <p style={styles.subtitle}>Membresía del ecosistema Chill N Go</p>

            <div style={styles.priceCard}>
              <div style={styles.priceName}>CNG+</div>
              <div style={styles.priceAmount}>
                <span style={styles.priceCurrency}>$</span>
                <span style={styles.priceNumber}>7</span>
                <span style={styles.pricePeriod}>/mes</span>
              </div>
              <div style={styles.priceFeatures}>
                <div style={styles.priceFeature}>50% cashback en Chilliums</div>
                <div style={styles.priceFeature}>35% de compras de referidos</div>
                <div style={styles.priceFeature}>15% de compras nivel 2</div>
                <div style={styles.priceFeature}>Acceso a todo el ecosistema</div>
                <div style={styles.priceFeature}>1 Chillium = 1 USD</div>
              </div>

              {error && <div style={{...styles.error, marginTop:16}}>{error}</div>}

              <div style={{...styles.field, marginTop:20}}>
                <label style={styles.label}>Tu correo electrónico</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} placeholder="tu@email.com" required />
              </div>

              <button onClick={handlePayment} style={{...styles.button, marginTop:16}} disabled={loading}>
                {loading ? 'Procesando...' : 'Pagar $7 USD/mes'}
              </button>

              <p style={{fontSize:11, color:'#666', textAlign:'center', marginTop:12}}>Pago seguro con Stripe. Cancela cuando quieras.</p>
            </div>
          </>
        )}

        {/* STEP 2: Register */}
        {step === 2 && (
          <>
            <div style={styles.successBadge}>Pago confirmado</div>
            <h1 style={styles.title}>Crea tu cuenta</h1>
            <p style={styles.subtitle}>Solo falta registrarte y verificar tu correo</p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleRegister} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  placeholder="Tu nombre"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Repite tu contraseña"
                  required
                />
              </div>

              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          </>
        )}

        {/* STEP 3: Verify email */}
        {step === 3 && (
          <>
            <div style={styles.verifyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#1D9E75" strokeWidth="2" />
                <path d="M16 24L22 30L34 18" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={styles.title}>Verifica tu correo</h1>
            <p style={styles.subtitle}>
              Enviamos un enlace de verificación a <strong style={{ color: '#f1efe8' }}>{email}</strong>.
              Haz clic en el enlace para activar tu cuenta.
            </p>
            <div style={styles.verifyTips}>
              <p style={styles.verifyTip}>Revisa tu bandeja de spam si no lo ves</p>
              <p style={styles.verifyTip}>El enlace expira en 24 horas</p>
            </div>
            <Link to="/login" style={{ ...styles.button, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 24 }}>
              Ir a iniciar sesión
            </Link>
          </>
        )}
      </div>

      {step === 1 && (
        <p style={styles.loginLink}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#5DCAA5', textDecoration: 'none' }}>Iniciar sesión</Link>
        </p>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0D1117',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  backLink: {
    color: '#888',
    textDecoration: 'none',
    fontSize: 13,
    marginBottom: 20,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginBottom: 28,
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    opacity: 0.4,
  },
  stepActive: {
    opacity: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
  },
  stepDotActive: {
    background: 'rgba(29,158,117,0.15)',
    border: '1px solid rgba(29,158,117,0.4)',
    color: '#5DCAA5',
  },
  stepLabel: {
    fontSize: 11,
    color: '#888',
  },
  stepLine: {
    width: 40,
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: 'linear-gradient(135deg, #1D9E75, #5DCAA5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#0D1117',
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: '#e6e4dc',
    letterSpacing: 1,
  },
  refBadge: {
    background: 'rgba(127,119,221,0.1)',
    border: '1px solid rgba(127,119,221,0.2)',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 12,
    color: '#AFA9EC',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    color: '#f1efe8',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  priceCard: {
    background: 'rgba(29,158,117,0.06)',
    border: '1px solid rgba(29,158,117,0.2)',
    borderRadius: 12,
    padding: '28px',
    textAlign: 'center',
    marginBottom: 24,
  },
  priceName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#5DCAA5',
    letterSpacing: 2,
    marginBottom: 8,
  },
  priceAmount: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 16,
  },
  priceCurrency: {
    fontSize: 18,
    color: '#f1efe8',
    fontWeight: 500,
  },
  priceNumber: {
    fontSize: 42,
    fontWeight: 700,
    color: '#f1efe8',
    lineHeight: 1,
  },
  pricePeriod: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  priceFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  priceFeature: {
    fontSize: 13,
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  successBadge: {
    background: 'rgba(29,158,117,0.1)',
    border: '1px solid rgba(29,158,117,0.3)',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 12,
    color: '#5DCAA5',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 500,
  },
  error: {
    background: 'rgba(224,49,49,0.1)',
    border: '1px solid rgba(224,49,49,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#F09595',
    marginBottom: 16,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#999',
    fontWeight: 500,
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 14,
    color: '#f1efe8',
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    background: 'linear-gradient(135deg, #1D9E75, #0F6E56)',
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  footerText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  verifyIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyTips: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 16,
  },
  verifyTip: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loginLink: {
    fontSize: 13,
    color: '#888',
    marginTop: 20,
  },
  linkBtn: {
    display: 'block',
    textAlign: 'center',
    color: '#5DCAA5',
    textDecoration: 'none',
    fontSize: 14,
    marginTop: 20,
  },
}