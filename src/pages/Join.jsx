import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase, supabasePublic } from '../lib/supabase'
import { C, FONT, GRADIENT } from '../stitch'

const STRIPE_PK = import.meta.env.VITE_STRIPE_PK

const REF_STORAGE_KEY = 'cng_ref_code'
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function readStoredRefCode() {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.code || !parsed.timestamp) return null
    if (Date.now() - parsed.timestamp > REF_TTL_MS) {
      localStorage.removeItem(REF_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function storeRefCode(code, referrerEmail) {
  try {
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({
      code,
      timestamp: Date.now(),
      referrer_email: referrerEmail,
    }))
  } catch {
    // localStorage disabled — ignore
  }
}

function clearStoredRefCode() {
  try {
    localStorage.removeItem(REF_STORAGE_KEY)
  } catch {
    // ignore
  }
}

function getDefaultLang() {
  const browserLang = (navigator.language || '').toLowerCase()
  return browserLang.startsWith('en') ? 'en' : 'es'
}

function mapErrorCode(data, t) {
  const code = data?.code
  switch (code) {
    case 'invalid_email': return t.enterValidEmail
    case 'active_account_exists': return t.alreadyActiveMembership
    case 'invalid_ref_code': return t.invalidLink
    case 'ref_code_required': return t.invalidLink
    case 'payment_not_completed': return t.paymentProcessing
    case 'profile_not_found': return t.paymentProcessing
    case 'registration_complete': return t.registrationComplete
    case 'no_customer': return t.invalidSession
    case 'session_id_required': return t.invalidSession
    case 'session_issue_failed': return t.paymentProcessing
    default: return data?.error || 'Error'
  }
}

const LANG = {
  es: {
    backToHome: '← Volver al inicio',
    inviteAccess: 'Acceso por invitación',
    inviteAccessDesc: 'Solo puedes unirte a CNG+ a través del link de un miembro activo. Si alguien te compartió un enlace, úsalo para acceder.',
    verifyingInvite: 'Verificando invitación...',
    invalidLink: 'Link inválido',
    invalidLinkDesc: 'El código de referido no existe o la cuenta del referidor no está activa. Pide un link nuevo a quien te invitó.',

    stepRegister: 'Invitación',
    stepPayment: 'Pago',
    stepVerify: 'Verificar',

    invitedTitle: 'Te han invitado a CNG+',
    invitedSubtitle: 'Verifica que conoces a esta persona antes de continuar',
    memberSince: 'Miembro desde',
    code: 'Código',
    importantTitle: 'Importante — Lee antes de continuar',
    acceptWarning: (name) => `Al aceptar esta invitación, ${name} será tu referidor permanente dentro del ecosistema CNG+. Esta relación no se puede cambiar después. Solo se permite una cuenta por persona.`,
    acceptBtn: (name) => `Sí, acepto la invitación de ${name}`,
    dontKnow: '¿No conoces a esta persona? No continúes y pide un link a alguien de tu confianza.',

    invitedBy: 'Invitado por:',
    startTitle: 'Empieza tu registro',
    startSubtitle: 'Ingresa tu correo para comenzar. Te pediremos tus datos antes de pagar.',
    emailLabel: 'Tu correo electrónico',
    startBtn: 'Empezar registro',
    validatingEmail: 'Validando...',
    enterEmail: 'Ingresa tu correo electrónico',
    enterValidEmail: 'Ingresa un correo válido',
    selfReferral: 'No puedes usar tu propio código de referido',
    emailAlreadyRegistered: 'Este email ya está registrado. Inicia sesión.',

    readyTitle: (name) => `¡Listo, ${name}!`,
    readySubtitle: 'Tu información quedó registrada. Ahora paga $10 para activar tu membresía.',
    perMonth: '/mes',
    firstMonthNote: 'Primer mes $10 USD (incluye activación y verificación)',
    afterFirstMonth: 'Después $7 USD/mes',
    feature1: '50% cashback en Chilliums',
    feature2: '35% de compras de referidos',
    feature3: '15% de compras nivel 2',
    feature4: 'Acceso a todo el ecosistema',
    feature5: '1 Chillium = 1 USD',
    processing: 'Procesando...',
    payBtn: 'Pagar $10 USD (primer mes)',
    stripeNote: 'Pago seguro con Stripe. Primer mes $10, después $7/mes. Cancela cuando quieras.',
    paymentError: 'Error al procesar el pago: ',
    invalidSession: 'Sesión inválida. Vuelve a iniciar el registro.',
    paymentProcessing: 'Aún estamos procesando tu pago. Intenta de nuevo en unos segundos.',
    alreadyActiveMembership: 'Este email ya tiene una membresía CNG+ activa. Inicia sesión.',
    registrationComplete: 'Tu cuenta ya está lista. Inicia sesión.',
    stripeKeyMissing: 'Servicio de pagos no configurado. Contacta soporte.',
    supportTitle: '¿Necesitas ayuda?',
    supportMessage: 'Si el problema persiste, contáctanos. Tu pago está seguro y podemos ayudarte.',
    supportButton: 'Contactar soporte',

    kycTitle: 'Verifica tu identidad',
    kycDescStart: 'Necesitamos verificar tu identidad con ',
    kycDescEnd: ' para completar tu membresía. Es un proceso rápido y seguro.',
    kycFeature1: 'Fotos de tu identificación oficial',
    kycFeature2: 'Selfie para comparar con la identificación',
    kycFeature3: 'Verificación de email (Stripe envía código)',
    kycFeature4: 'Verificación de teléfono (Stripe envía SMS)',
    kycSecurityNote: 'Tus documentos se almacenan cifrados en Stripe. ',
    kycSecurityDesc: 'Chill N Go solo recibe el resultado (verificado o fallido), nunca las imágenes.',
    kycStartBtn: 'Iniciar verificación',
    kycStartingBtn: 'Iniciando...',
    kycSubmittedTitle: '¡Documentos enviados!',
    kycSubmittedDesc: 'Stripe está validando tu información. Puede tomar unos minutos. Te notificaremos cuando esté listo.',
    kycSubmittedNote: 'Mientras tanto, ya puedes entrar a tu cuenta.',
    goToAccountBtn: 'Ir a mi cuenta CNG+',
    kycErrorTitle: 'Hubo un error',
    kycErrorDesc: 'No pudimos iniciar tu verificación. Inténtalo de nuevo.',
    retryBtn: 'Reintentar',
    kycSkipBtn: 'Completar después',
    kycStartError: 'Error iniciando verificación: ',

    alreadyHaveAccount: '¿Ya tienes cuenta? ',
    login: 'Iniciar sesión',
  },
  en: {
    backToHome: '← Back to home',
    inviteAccess: 'Invitation only',
    inviteAccessDesc: 'You can only join CNG+ through an active member\'s referral link. If someone shared a link with you, use it to sign up.',
    verifyingInvite: 'Verifying invitation...',
    invalidLink: 'Invalid link',
    invalidLinkDesc: 'The referral code doesn\'t exist or the referrer\'s account is not active. Ask for a new link from whoever invited you.',

    stepRegister: 'Invitation',
    stepPayment: 'Payment',
    stepVerify: 'Verify',

    invitedTitle: 'You\'ve been invited to CNG+',
    invitedSubtitle: 'Verify that you know this person before continuing',
    memberSince: 'Member since',
    code: 'Code',
    importantTitle: 'Important — Read before continuing',
    acceptWarning: (name) => `By accepting this invitation, ${name} will be your permanent referrer within the CNG+ ecosystem. This relationship cannot be changed later. Only one account per person is allowed.`,
    acceptBtn: (name) => `Yes, I accept the invitation from ${name}`,
    dontKnow: 'Don\'t know this person? Do not continue and ask someone you trust for a link.',

    invitedBy: 'Invited by:',
    startTitle: 'Start your registration',
    startSubtitle: 'Enter your email to begin. We\'ll collect your info before payment.',
    emailLabel: 'Your email address',
    startBtn: 'Start registration',
    validatingEmail: 'Validating...',
    enterEmail: 'Enter your email address',
    enterValidEmail: 'Enter a valid email',
    selfReferral: 'You cannot use your own referral code',
    emailAlreadyRegistered: 'This email is already registered. Please sign in.',

    readyTitle: (name) => `You're all set, ${name}!`,
    readySubtitle: 'Your info is saved. Now pay $10 to activate your membership.',
    perMonth: '/mo',
    firstMonthNote: 'First month $10 USD (includes activation and verification)',
    afterFirstMonth: 'Then $7 USD/mo',
    feature1: '50% cashback in Chilliums',
    feature2: '35% from referral purchases',
    feature3: '15% from level 2 purchases',
    feature4: 'Access to the entire ecosystem',
    feature5: '1 Chillium = 1 USD',
    processing: 'Processing...',
    payBtn: 'Pay $10 USD (first month)',
    stripeNote: 'Secure payment via Stripe. First month $10, then $7/mo. Cancel anytime.',
    paymentError: 'Error processing payment: ',
    invalidSession: 'Invalid session. Please start registration again.',
    paymentProcessing: 'We\'re still processing your payment. Please try again in a few seconds.',
    alreadyActiveMembership: 'This email already has an active CNG+ membership. Please sign in.',
    registrationComplete: 'Your account is ready. Please sign in.',
    stripeKeyMissing: 'Payment service not configured. Contact support.',
    supportTitle: 'Need help?',
    supportMessage: 'If the problem persists, contact us. Your payment is safe and we can help.',
    supportButton: 'Contact support',

    kycTitle: 'Verify your identity',
    kycDescStart: 'We need to verify your identity with ',
    kycDescEnd: ' to complete your membership. It\'s a quick and secure process.',
    kycFeature1: 'Photos of your government ID',
    kycFeature2: 'Selfie to compare with your ID',
    kycFeature3: 'Email verification (Stripe sends a code)',
    kycFeature4: 'Phone verification (Stripe sends an SMS)',
    kycSecurityNote: 'Your documents are stored encrypted by Stripe. ',
    kycSecurityDesc: 'Chill N Go only receives the result (verified or failed), never the images.',
    kycStartBtn: 'Start verification',
    kycStartingBtn: 'Starting...',
    kycSubmittedTitle: 'Documents submitted!',
    kycSubmittedDesc: 'Stripe is validating your info. It may take a few minutes. We\'ll notify you when done.',
    kycSubmittedNote: 'Meanwhile, you can already sign in to your account.',
    goToAccountBtn: 'Go to my CNG+ account',
    kycErrorTitle: 'Something went wrong',
    kycErrorDesc: 'We couldn\'t start your verification. Please try again.',
    retryBtn: 'Retry',
    kycSkipBtn: 'Complete later',
    kycStartError: 'Error starting verification: ',

    alreadyHaveAccount: 'Already have an account? ',
    login: 'Sign in',
  },
}

export default function Join() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const redirectTimerRef = useRef(null)
  const urlRefCode = searchParams.get('ref')
  const paidParam = searchParams.get('paid')
  const emailParam = searchParams.get('email')
  const sessionIdParam = searchParams.get('session_id')

  const [refCode, setRefCode] = useState(urlRefCode || null)
  const [step, setStep] = useState(1) // 1=invite, 2=email+pay, 3=kyc
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [referrer, setReferrer] = useState(null)
  const [invalidRef, setInvalidRef] = useState(false)
  const [loadingRef, setLoadingRef] = useState(true)
  const [acceptedInvite, setAcceptedInvite] = useState(false)
  const [lang, setLang] = useState(getDefaultLang)
  const [verificationStatus, setVerificationStatus] = useState(null) // null, 'pending', 'error'

  const t = LANG[lang]

  // Restore from localStorage if URL lacks ref
  useEffect(() => {
    if (!urlRefCode) {
      const stored = readStoredRefCode()
      if (stored && stored.code) {
        setRefCode(stored.code)
        setSearchParams({ ref: stored.code }, { replace: true })
      }
    }
  }, [])

  // Handle return from Stripe Checkout
  useEffect(() => {
    if (paidParam === 'true' && emailParam) {
      setEmail(decodeURIComponent(emailParam))
      setAcceptedInvite(true)
      setStep(3) // KYC
    }
  }, [paidParam, emailParam])

  // Cleanup redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  // Fetch referrer when refCode is available
  useEffect(() => {
    if (refCode) {
      fetchReferrer(refCode)
    } else {
      setLoadingRef(false)
    }
  }, [refCode])

  async function fetchReferrer(code) {
    try {
      const { data, error } = await supabasePublic
        .from('identity_profiles')
        .select('user_id, full_name, email, ref_code, avatar_url, created_at')
        .eq('ref_code', code)
        .eq('payment_status', 'active')
        .maybeSingle()
      if (error || !data) {
        setInvalidRef(true)
      } else {
        setReferrer(data)
        storeRefCode(code, data.email)
      }
    } catch (_e) {
      setInvalidRef(true)
    } finally {
      setLoadingRef(false)
    }
  }

  async function handlePayment() {
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError(t.enterEmail)
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t.enterValidEmail)
      return
    }
    if (referrer && trimmed === referrer.email.toLowerCase()) {
      setError(t.selfReferral)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          ref_code: refCode,
          success_url: window.location.origin + '/join?paid=true&ref=' + refCode + '&email=' + encodeURIComponent(trimmed),
          cancel_url: window.location.origin + '/join?ref=' + refCode,
        }),
      })
      const data = await response.json()
      if (data.error) {
        setError(mapErrorCode(data, t))
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(t.paymentError + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startIdentityVerification() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        'https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-create-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            return_url: window.location.origin + '/join?verify=complete&ref=' + refCode + '&email=' + encodeURIComponent(email),
          }),
        }
      )
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      await supabase
        .from('identity_profiles')
        .update({
          stripe_verification_session_id: data.session_id,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)

      if (!STRIPE_PK) {
        setError(t.stripeKeyMissing)
        setLoading(false)
        return
      }
      const stripe = window.Stripe(STRIPE_PK)
      const result = await stripe.verifyIdentity(data.client_secret)

      if (result.error) {
        setError(result.error.message)
        setVerificationStatus('error')
      } else {
        setVerificationStatus('pending')
        await supabase
          .from('identity_profiles')
          .update({
            identity_verification_status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
        // Registration flow complete — clean up local ref code
        clearStoredRefCode()
      }
    } catch (err) {
      setError(t.kycStartError + err.message)
      setVerificationStatus('error')
    } finally {
      setLoading(false)
    }
  }

  async function goToWelcome() {
    if (!sessionIdParam) {
      setError(t.invalidSession)
      return
    }
    setLoading(true)
    setError('')
    const RETRY_DELAYS = [500, 1500, 3000, 5000]
    try {
      let data = null
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        const r = await fetch('https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/cng-issue-welcome-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdParam }),
        })
        data = await r.json()
        if (data.hashed_token) break
        if (r.status === 404 && attempt < RETRY_DELAYS.length) {
          await new Promise(res => setTimeout(res, RETRY_DELAYS[attempt]))
          continue
        }
        setError(r.status === 404 ? t.paymentProcessing : mapErrorCode(data, t))
        if (data?.code === 'registration_complete') {
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
          redirectTimerRef.current = setTimeout(() => navigate('/login'), 3000)
        }
        return
      }
      if (!data?.hashed_token) {
        setError(t.paymentProcessing)
        return
      }
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.hashed_token,
        type: 'magiclink',
      })
      if (otpErr) {
        setError(otpErr.message)
        return
      }
      navigate('/welcome')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const dateLocale = lang === 'en' ? 'en-US' : 'es-MX'

  // No ref code = no access
  if (!refCode) {
    return (
      <div style={{ ...styles.container, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
        <div style={{ ...styles.card, ...(isMobile ? { padding: '24px 16px', maxWidth: '100%' } : {}) }}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <h1 style={styles.title}>{t.inviteAccess}</h1>
          <p style={styles.subtitle}>{t.inviteAccessDesc}</p>
          <Link to="/" style={styles.linkBtn}>{t.backToHome}</Link>
        </div>
      </div>
    )
  }

  if (loadingRef) {
    return (
      <div style={{ ...styles.container, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
        <div style={{ ...styles.card, ...(isMobile ? { padding: '24px 16px', maxWidth: '100%' } : {}) }}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <p style={{ ...styles.subtitle, marginTop: 20 }}>{t.verifyingInvite}</p>
        </div>
      </div>
    )
  }

  if (invalidRef) {
    return (
      <div style={{ ...styles.container, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
        <div style={{ ...styles.card, ...(isMobile ? { padding: '24px 16px', maxWidth: '100%' } : {}) }}>
          <div style={styles.logoRow}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoText}>CHILL N GO</span>
          </div>
          <h1 style={styles.title}>{t.invalidLink}</h1>
          <p style={styles.subtitle}>{t.invalidLinkDesc}</p>
          <a href="/" style={{ ...styles.button, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>{t.backToHome}</a>
        </div>
      </div>
    )
  }

  const referrerDisplayName = referrer?.full_name || referrer?.email?.split('@')[0]

  return (
    <div style={{ ...styles.container, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
      <Link to="/" style={styles.backLink}>{t.backToHome}</Link>

      {/* Progress steps */}
      <div style={styles.steps}>
        <div style={{ ...styles.step, ...(step >= 1 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 1 ? styles.stepDotActive : {}), ...(isMobile ? { width: 24, height: 24, fontSize: 11 } : {}) }}>1</div>
          <span style={{ ...styles.stepLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>{t.stepRegister}</span>
        </div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.step, ...(step >= 2 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 2 ? styles.stepDotActive : {}), ...(isMobile ? { width: 24, height: 24, fontSize: 11 } : {}) }}>2</div>
          <span style={{ ...styles.stepLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>{t.stepPayment}</span>
        </div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.step, ...(step >= 3 ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step >= 3 ? styles.stepDotActive : {}), ...(isMobile ? { width: 24, height: 24, fontSize: 11 } : {}) }}>3</div>
          <span style={{ ...styles.stepLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>{t.stepVerify}</span>
        </div>
      </div>

      <div style={{ ...styles.card, ...(isMobile ? { padding: '24px 16px', maxWidth: '100%' } : {}) }}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        {/* STEP 1a: Invitation confirmation */}
        {step === 1 && !acceptedInvite && referrer && (
          <>
            <h1 style={styles.title}>{t.invitedTitle}</h1>
            <p style={styles.subtitle}>{t.invitedSubtitle}</p>

            <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 16, padding: isMobile ? 16 : 24, textAlign: 'center', marginBottom: isMobile ? 16 : 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: GRADIENT.candy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', margin: '0 auto 12px' }}>
                {(referrer.full_name || referrer.email)[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                {referrer.full_name || referrer.email.split('@')[0]}
              </div>
              <div style={{ fontSize: 13, color: C.tertiary, marginBottom: 8 }}>
                {referrer.email}
              </div>
              <div style={{ fontSize: 11, color: C.onSurfaceVariant, marginTop: 8 }}>
                {t.memberSince} {new Date(referrer.created_at).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: C.onSurfaceVariant, marginTop: 6 }}>{t.code}: {referrer.ref_code}</div>
            </div>

            <div style={{ background: 'rgba(224,49,49,0.08)', border: '2px solid rgba(224,49,49,0.35)', borderRadius: 12, padding: isMobile ? 14 : 20, marginBottom: isMobile ? 16 : 24, textAlign: 'center' }}>
              <div style={{ fontSize: 15, color: C.errorBright, fontWeight: 600, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{t.importantTitle}</div>
              <div style={{ width: 40, height: 2, background: 'rgba(224,49,49,0.3)', margin: '0 auto 12px', borderRadius: 1 }}></div>
              <div style={{ fontSize: isMobile ? 12 : 14, color: C.error, lineHeight: 1.7 }}>
                {t.acceptWarning(referrerDisplayName)}
              </div>
            </div>

            <button onClick={() => { setAcceptedInvite(true); setStep(2); }} style={styles.button}>
              {t.acceptBtn(referrerDisplayName)}
            </button>

            <p style={{ fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              {t.dontKnow}
            </p>
          </>
        )}

        {/* STEP 2: Email + pay */}
        {step === 2 && (
          <>
            <div style={{ ...styles.refBadge, background: 'rgba(29,158,117,0.1)', borderColor: 'rgba(29,158,117,0.3)', color: C.primary }}>
              {t.invitedBy} {referrerDisplayName}
            </div>

            <h1 style={styles.title}>{t.startTitle}</h1>

            <div style={{ ...styles.field, marginBottom: 24 }}>
              <label style={styles.label}>{t.emailLabel}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="tu@email.com"
                autoFocus
              />
            </div>

            <div style={styles.priceCard}>
              <div style={styles.priceName}>CNG+</div>
              <div style={styles.priceAmount}>
                <span style={styles.priceCurrency}>$</span>
                <span style={styles.priceNumber}>10</span>
                <span style={styles.pricePeriod}>{t.perMonth}</span>
              </div>
              <div style={{ fontSize: 12, color: C.onSurfaceVariant, marginTop: 4, textAlign: 'center', lineHeight: 1.6 }}>{t.firstMonthNote}</div>
              <div style={{ fontSize: 12, color: C.primary, textAlign: 'center', marginBottom: 8, lineHeight: 1.6 }}>{t.afterFirstMonth}</div>
              <div style={styles.priceFeatures}>
                <div style={styles.priceFeature}>{t.feature1}</div>
                <div style={styles.priceFeature}>{t.feature2}</div>
                <div style={styles.priceFeature}>{t.feature3}</div>
                <div style={styles.priceFeature}>{t.feature4}</div>
                <div style={styles.priceFeature}>{t.feature5}</div>
              </div>

              {error && <div style={{ ...styles.error, marginTop: 16 }}>{error}</div>}

              <button onClick={handlePayment} style={{ ...styles.button, marginTop: 16 }} disabled={loading}>
                {loading ? t.processing : t.payBtn}
              </button>

              <p style={{ fontSize: 11, color: C.textFaint, textAlign: 'center', marginTop: 12 }}>{t.stripeNote}</p>
            </div>
          </>
        )}

        {/* STEP 3: KYC */}
        {step === 3 && (
          <>
            {!verificationStatus && (
              <>
                <div style={styles.verifyIcon}>
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="26" stroke={C.primary} strokeWidth="2" />
                    <path d="M28 16v4M28 36v4M16 28h4M36 28h4" stroke={C.primary} strokeWidth="2" strokeLinecap="round" />
                    <circle cx="28" cy="28" r="8" stroke={C.primary} strokeWidth="2" />
                  </svg>
                </div>
                <h1 style={styles.title}>{t.kycTitle}</h1>
                <p style={styles.subtitle}>
                  {t.kycDescStart}<strong style={{ color: C.text }}>Stripe</strong>{t.kycDescEnd}
                </p>

                <div style={styles.kycFeatures}>
                  <div style={styles.kycFeature}><span style={styles.kycFeatureIcon}>📄</span><span>{t.kycFeature1}</span></div>
                  <div style={styles.kycFeature}><span style={styles.kycFeatureIcon}>🤳</span><span>{t.kycFeature2}</span></div>
                  <div style={styles.kycFeature}><span style={styles.kycFeatureIcon}>📧</span><span>{t.kycFeature3}</span></div>
                  <div style={styles.kycFeature}><span style={styles.kycFeatureIcon}>📱</span><span>{t.kycFeature4}</span></div>
                </div>

                <div style={styles.kycNote}>
                  <strong>{t.kycSecurityNote}</strong>{t.kycSecurityDesc}
                </div>

                {error && <div style={styles.error}>{error}</div>}

                <button onClick={startIdentityVerification} style={styles.button} disabled={loading}>
                  {loading ? t.kycStartingBtn : t.kycStartBtn}
                </button>

                <Link to="/login" style={{ ...styles.btnSkip, marginTop: 12, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                  {t.kycSkipBtn}
                </Link>
              </>
            )}

            {verificationStatus === 'pending' && (
              <>
                <div style={styles.verifyIcon}>
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="26" stroke={C.primary} strokeWidth="2" />
                    <path d="M20 28L26 34L38 22" stroke={C.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 style={styles.title}>{t.kycSubmittedTitle}</h1>
                <p style={styles.subtitle}>{t.kycSubmittedDesc}</p>

                <div style={styles.kycNote}>
                  {t.kycSubmittedNote}
                </div>

                {error && (
                  <>
                    <div style={styles.error}>{error}</div>
                    <div style={styles.supportBox}>
                      <div style={styles.supportTitle}>{t.supportTitle}</div>
                      <p style={styles.supportMessage}>{t.supportMessage}</p>
                      <a href="mailto:support@chillngointernational.com" style={styles.supportButton}>
                        {t.supportButton}
                      </a>
                    </div>
                  </>
                )}

                <button onClick={goToWelcome} style={styles.button} disabled={loading}>
                  {loading ? t.processing : t.goToAccountBtn}
                </button>
              </>
            )}

            {verificationStatus === 'error' && (
              <>
                <div style={styles.verifyIcon}>
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="26" stroke={C.errorBright} strokeWidth="2" />
                    <path d="M22 22L34 34M34 22L22 34" stroke={C.errorBright} strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h1 style={styles.title}>{t.kycErrorTitle}</h1>
                <p style={styles.subtitle}>{t.kycErrorDesc}</p>

                {error && <div style={styles.error}>{error}</div>}

                <button onClick={() => { setVerificationStatus(null); setError('') }} style={styles.button}>
                  {t.retryBtn}
                </button>

                <Link to="/login" style={{ ...styles.btnSkip, marginTop: 12, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                  {t.kycSkipBtn}
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {(step === 1 || step === 2) && (
        <p style={styles.loginLink}>
          {t.alreadyHaveAccount}<Link to="/login" style={{ color: C.primary, textDecoration: 'none' }}>{t.login}</Link>
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
    padding: '40px 36px',
    width: '100%',
    maxWidth: 560,
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
    lineHeight: 1.6,
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
    width: '100%',
    boxSizing: 'border-box',
  },
  btnSkip: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '12px',
    fontSize: 13,
    color: C.onSurfaceVariant,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  verifyIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  kycFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
  },
  kycFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#ccc',
  },
  kycFeatureIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  kycNote: {
    background: 'rgba(29,158,117,0.08)',
    border: '1px solid rgba(29,158,117,0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 12,
    color: C.primary,
    marginBottom: 20,
    lineHeight: 1.5,
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
  supportBox: {
    background: 'rgba(127,119,221,0.06)',
    border: '1px solid rgba(127,119,221,0.2)',
    borderRadius: 12,
    padding: '16px',
    marginBottom: 16,
    textAlign: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    marginBottom: 6,
  },
  supportMessage: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  supportButton: {
    display: 'inline-block',
    background: 'rgba(127,119,221,0.1)',
    border: '1px solid rgba(127,119,221,0.3)',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    color: C.tertiary,
    textDecoration: 'none',
  },
}
