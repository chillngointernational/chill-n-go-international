import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT } from '../stitch'

// Pantalla de restablecer contraseña. Se llega desde el enlace del correo de recuperación
// (supabase.auth.resetPasswordForEmail). El cliente (detectSessionInUrl) procesa el token
// y emite el evento PASSWORD_RECOVERY; aquí el usuario fija su nueva contraseña.

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // La sesión de recuperación puede establecerse antes o después del montaje.
    supabase.auth.getSession().then(({ data }) => { if (data?.session) setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password })
      if (upErr) { setError(upErr.message); return }
      setDone(true)
      // Con la sesión activa, el gate lleva al paso pendiente (verificación/pago).
      setTimeout(() => navigate('/app/feed', { replace: true }), 1200)
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        <h1 style={styles.title}>Nueva contraseña</h1>

        {done ? (
          <p style={styles.subtitle}>¡Listo! Tu contraseña se actualizó. Entrando…</p>
        ) : !ready ? (
          <>
            <p style={styles.subtitle}>
              Abre este enlace desde el correo de recuperación. Si llegaste aquí por error,
              vuelve a iniciar sesión.
            </p>
            <Link to="/login" style={styles.button}>Ir a iniciar sesión</Link>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Elige una nueva contraseña para tu cuenta.</p>
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Nueva contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={styles.input} placeholder="Repite tu contraseña" autoComplete="new-password" required />
              </div>
              <button type="submit" style={{ ...styles.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FONT.body },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' },
  logo: { width: 32, height: 32, borderRadius: 8, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.surface },
  logoText: { fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: 600, color: C.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', marginBottom: 24, lineHeight: 1.6 },
  error: { background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 20, textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 500 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  button: { display: 'block', background: GRADIENT.primary, border: 'none', borderRadius: 8, padding: '14px', fontSize: 15, fontWeight: 600, color: 'white', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none' },
}
