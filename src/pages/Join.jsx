import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT } from '../stitch'

// Alta SOLO por invitación (link de referido reutilizable: /join?ref=CODE).
// El registro público de Supabase Auth está APAGADO: NO se usa supabase.auth.signUp.
// Las cuentas se crean en la edge function de administrador `cng-accept-invitation`.

async function callInvite(action, payload) {
  const { data, error } = await supabase.functions.invoke('cng-accept-invitation', {
    body: { action, ...payload },
  })
  if (error) {
    let msg = 'No se pudo conectar con el servidor. Intenta de nuevo.'
    let code = null
    try {
      const b = await error.context?.json?.()
      if (b?.error) msg = b.error
      if (b?.code) code = b.code
    } catch { /* sin cuerpo legible */ }
    return { ok: false, error: msg, code }
  }
  if (data?.error) return { ok: false, error: data.error, code: data.code || null }
  return { ok: true, data }
}

export default function Join() {
  const [searchParams] = useSearchParams()
  const refCode = (searchParams.get('ref') || '').trim()
  const navigate = useNavigate()
  const { signIn, user, loading: authLoading } = useAuth()

  // 'loading' | 'valid' | 'invalid' (incluye sin código)
  const [status, setStatus] = useState('loading')
  const [inviterName, setInviterName] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accountExists, setAccountExists] = useState(false)

  // Si ya hay sesión, no tiene sentido "crear cuenta": retomar en la app (el gate lleva al paso pendiente).
  useEffect(() => {
    if (!authLoading && user) navigate('/app/feed', { replace: true })
  }, [authLoading, user, navigate])

  useEffect(() => {
    let cancelled = false
    async function validate() {
      if (!refCode) { setStatus('invalid'); return }
      const res = await callInvite('validate', { ref_code: refCode })
      if (cancelled) return
      if (res.ok && res.data?.valid) {
        setInviterName(res.data.inviter_name || '')
        setStatus('valid')
      } else {
        setStatus('invalid')
      }
    }
    validate()
    return () => { cancelled = true }
  }, [refCode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) { setError('Ingresa tu nombre completo.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Ingresa un correo válido.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setSubmitting(true)
    try {
      const res = await callInvite('accept', {
        ref_code: refCode,
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      })
      if (!res.ok) {
        // Cuenta a medias: el correo ya existe -> ofrecer retomar por login, sin error rojo.
        if (res.code === 'account_exists') { setAccountExists(true); return }
        setError(res.error)
        return
      }

      // Cuenta creada (email ya confirmado): iniciar sesión y entrar a la app.
      await signIn(email.trim(), password)
      navigate('/app/feed')
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión tras crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.container}>
      <Link to="/" style={styles.backLink}>← Volver al inicio</Link>

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        {status === 'loading' && (
          <p style={styles.subtitle}>Validando tu invitación…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 style={styles.title}>Necesitas una invitación</h1>
            <p style={styles.subtitle}>
              Solo puedes unirte con el enlace de invitación de un miembro activo de Chill N Go.
              Pídele su enlace personal para crear tu cuenta.
            </p>
            <Link to="/login" style={styles.button}>Ya tengo cuenta · Iniciar sesión</Link>
            <Link to="/app/explore" style={styles.linkBtn}>Explorar el marketplace</Link>
          </>
        )}

        {status === 'valid' && accountExists && (
          <>
            <h1 style={styles.title}>Ya empezaste tu registro</h1>
            <p style={styles.subtitle}>
              Ya existe una cuenta con <b>{email}</b>. No necesitas crear otra — inicia sesión
              para continuar donde te quedaste (verificación o pago).
            </p>
            <Link to={`/login?email=${encodeURIComponent(email)}`} style={styles.button}>Iniciar sesión y continuar</Link>
            <button type="button" onClick={() => setAccountExists(false)} style={{ ...styles.linkBtn, background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>Usar otro correo</button>
          </>
        )}

        {status === 'valid' && !accountExists && (
          <>
            <h1 style={styles.title}>Crea tu cuenta</h1>
            <p style={styles.subtitle}>
              Te invitó: <span style={styles.inviter}>{inviterName}</span>
            </p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={styles.input}
                  placeholder="Tu nombre y apellido"
                  autoComplete="name"
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
                  autoComplete="email"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Contraseña</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...styles.input, width: '100%', paddingRight: 44 }}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.onSurfaceVariant} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.onSurfaceVariant} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirmar contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={styles.input}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button type="submit" style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>

            <p style={styles.footerText}>
              ¿Ya tienes cuenta? <Link to="/login" style={styles.footerLink}>Inicia sesión</Link>
            </p>
          </>
        )}
      </div>
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
    marginBottom: 24,
    alignSelf: 'center',
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: GRADIENT.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: C.surface,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 15,
    color: C.text,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: C.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 1.6,
  },
  inviter: {
    color: C.primary,
    fontWeight: 700,
  },
  error: {
    background: 'rgba(224,49,49,0.1)',
    border: '1px solid rgba(224,49,49,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: C.error,
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  passwordWrapper: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    padding: 0,
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
    transition: 'border-color 0.2s',
  },
  button: {
    display: 'block',
    background: GRADIENT.primary,
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
    textAlign: 'center',
    textDecoration: 'none',
    transition: 'opacity 0.2s',
  },
  linkBtn: {
    display: 'block',
    color: C.primary,
    textDecoration: 'none',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 12,
    color: C.textFaint,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 1.5,
  },
  footerLink: {
    color: C.primary,
    textDecoration: 'none',
    fontWeight: 600,
  },
}
