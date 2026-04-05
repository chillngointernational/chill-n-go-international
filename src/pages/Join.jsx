import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RegistrationWizard from '../components/RegistrationWizard'
import { C, FONT, GRADIENT } from '../stitch'

export default function Join() {
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref')
  const stepParam = searchParams.get('step')
  const emailParam = searchParams.get('email')
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=payment, 2=register, 3=verify
  const [email, setEmail] = useState('')
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
              <div style={{width:64, height:64, borderRadius:'50%', background:GRADIENT.candy, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'white', margin:'0 auto 12px'}}>
                {(referrer.full_name || referrer.email)[0].toUpperCase()}
              </div>
              <div style={{fontSize:18, fontWeight:600, color:C.text, marginBottom:4}}>
                {referrer.full_name || referrer.email.split('@')[0]}
              </div>
              <div style={{fontSize:13, color:C.tertiary, marginBottom:8}}>
                {referrer.email}
              </div>
              <div style={{fontSize:11, color:C.onSurfaceVariant, marginTop:8}}>
                Miembro desde {new Date(referrer.created_at).toLocaleDateString('es-MX', {month:'long', year:'numeric'})}
              </div>
              <div style={{fontSize:12, color:C.onSurfaceVariant, marginTop:6}}>Código: {referrer.ref_code}</div>
            </div>

            <div style={{background:'rgba(224,49,49,0.08)', border:'2px solid rgba(224,49,49,0.35)', borderRadius:12, padding:20, marginBottom:24, textAlign:'center'}}>
              <div style={{fontSize:15, color:C.errorBright, fontWeight:600, marginBottom:10, letterSpacing:1, textTransform:'uppercase'}}>Importante — Lee antes de continuar</div>
              <div style={{width:40, height:2, background:'rgba(224,49,49,0.3)', margin:'0 auto 12px', borderRadius:1}}></div>
              <div style={{fontSize:14, color:C.error, lineHeight:1.7}}>
                Al aceptar esta invitación, <strong style={{color:C.error}}>{referrer.full_name || referrer.email.split('@')[0]}</strong> será tu referidor permanente dentro del ecosistema CNG+. Esta relación no se puede cambiar después. Solo se permite una cuenta por persona.
              </div>
            </div>

            <button onClick={() => setAcceptedInvite(true)} style={styles.button}>
              Sí, acepto la invitación de {referrer.full_name || referrer.email.split('@')[0]}
            </button>

            <p style={{fontSize:12, color:C.textFaint, textAlign:'center', marginTop:16, lineHeight:1.5}}>
              ¿No conoces a esta persona? No continúes y pide un link a alguien de tu confianza.
            </p>
          </>
        )}

        {/* STEP 1: Payment (after accepting invite) */}
        {step === 1 && acceptedInvite && (
          <>
            <div style={{...styles.refBadge, background:'rgba(29,158,117,0.1)', borderColor:'rgba(29,158,117,0.3)', color:C.primary}}>
              Invitado por: {referrer.full_name || referrer.email.split('@')[0]}
            </div>

            <h1 style={styles.title}>Únete a CNG+</h1>
            <p style={styles.subtitle}>Membresía del ecosistema Chill N Go</p>

            <div style={styles.priceCard}>
              <div style={styles.priceName}>CNG+</div>
              <div style={styles.priceAmount}>
                <span style={styles.priceCurrency}>$</span>
                <span style={styles.priceNumber}>10</span>
                <span style={styles.pricePeriod}>/mes</span>
              </div>
              <div style={{fontSize: 12, color: C.onSurfaceVariant, marginTop: 4, textAlign: 'center'}}>Primer mes $10 USD (incluye activación y verificación)</div>
              <div style={{fontSize: 12, color: C.primary, textAlign: 'center', marginBottom: 8}}>Después $7 USD/mes</div>
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
                {loading ? 'Procesando...' : 'Pagar $10 USD (primer mes)'}
              </button>

              <p style={{fontSize:11, color:C.textFaint, textAlign:'center', marginTop:12}}>Pago seguro con Stripe. Primer mes $10, después $7/mes. Cancela cuando quieras.</p>
            </div>
          </>
        )}

        {/* STEP 2: Register */}
        {step === 2 && (
          <>
            <div style={{...styles.refBadge, background:'rgba(29,158,117,0.1)', borderColor:'rgba(29,158,117,0.3)', color:C.primary}}>
              Invitado por: {referrer?.full_name || referrer?.email?.split('@')[0] || refCode}
            </div>

            <RegistrationWizard
              email={email}
              refCode={refCode}
              referrerName={referrer?.full_name || referrer?.email?.split('@')[0] || refCode}
              onComplete={(registeredEmail) => {
                setStep(3)
              }}
            />
          </>
        )}

        {/* STEP 3: Verify email */}
        {step === 3 && (
          <>
            <div style={styles.verifyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke={C.primaryBright} strokeWidth="2" />
                <path d="M16 24L22 30L34 18" stroke={C.primaryBright} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={styles.title}>Verifica tu correo</h1>
            <p style={styles.subtitle}>
              Enviamos un enlace de verificación a <strong style={{ color: C.text }}>{email}</strong>.
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
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: C.primary, textDecoration: 'none' }}>Iniciar sesión</Link>
        </p>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: C.surface,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: FONT.body,
  },
  backLink: {
    color: C.onSurfaceVariant,
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
    color: C.onSurfaceVariant,
  },
  stepDotActive: {
    background: 'rgba(29,158,117,0.15)',
    border: '1px solid rgba(29,158,117,0.4)',
    color: C.primary,
  },
  stepLabel: {
    fontSize: 11,
    color: C.onSurfaceVariant,
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
    background: GRADIENT.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: C.surface,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: C.text,
    letterSpacing: 1,
  },
  refBadge: {
    background: 'rgba(127,119,221,0.1)',
    border: '1px solid rgba(127,119,221,0.2)',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 12,
    color: C.tertiary,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    color: C.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: C.onSurfaceVariant,
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
    color: C.primary,
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
    color: C.text,
    fontWeight: 500,
  },
  priceNumber: {
    fontSize: 42,
    fontWeight: 700,
    color: C.text,
    lineHeight: 1,
  },
  pricePeriod: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    marginLeft: 4,
  },
  priceFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  priceFeature: {
    fontSize: 13,
    color: C.onSurfaceVariant,
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
    color: C.primary,
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
    color: C.error,
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
    color: C.onSurfaceVariant,
    fontWeight: 500,
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 14,
    color: C.text,
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    background: GRADIENT.primary,
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
    color: C.textFaint,
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
    color: C.textFaint,
    textAlign: 'center',
  },
  loginLink: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginTop: 20,
  },
  linkBtn: {
    display: 'block',
    textAlign: 'center',
    color: C.primary,
    textDecoration: 'none',
    fontSize: 14,
    marginTop: 20,
  },
}
