import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { C, FONT, Icon, GRADIENT } from '../stitch'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      if (err.message.includes('Invalid login')) {
        setError('Correo o contraseña incorrectos')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Verifica tu correo electrónico antes de iniciar sesión')
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

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        <h1 style={styles.title}>Iniciar sesión</h1>
        <p style={styles.subtitle}>Accede a tu cuenta CNG+</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
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
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, width: '100%', paddingRight: 42 }}
                placeholder="••••••••"
                required
              />
              <Icon
                name={showPassword ? 'visibility' : 'visibility_off'}
                size={20}
                color={C.onSurfaceVariant}
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              />
            </div>
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={styles.footerText}>
          ¿No tienes cuenta? Solo puedes unirte por invitación de un miembro activo.
        </p>
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
    maxWidth: 400,
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
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    cursor: 'pointer',
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
    transition: 'opacity 0.2s',
  },
  footerText: {
    fontSize: 12,
    color: C.textFaint,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 1.5,
  },
}
