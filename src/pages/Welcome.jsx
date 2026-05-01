import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { C, FONT, GRADIENT } from '../stitch'

function getDefaultLang() {
  const browserLang = (navigator.language || '').toLowerCase()
  return browserLang.startsWith('en') ? 'en' : 'es'
}

const LANG = {
  es: {
    stepPassword: 'Contraseña',
    stepConfirm: 'Confirmar',

    passwordTitle: 'Establece tu contraseña',
    passwordSubtitle: 'Crea una contraseña segura para acceder a tu cuenta CNG+',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    confirmPasswordLabel: 'Confirmar contraseña',
    confirmPasswordPlaceholder: 'Repite tu contraseña',
    continueBtn: 'Continuar',
    settingPassword: 'Guardando...',
    passwordRequired: 'Ingresa una contraseña',
    passwordMin: 'La contraseña debe tener al menos 8 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
    passwordError: 'Error guardando contraseña: ',

    finalTitle: 'Últimos detalles',
    finalSubtitle: 'Sube una foto (opcional) y acepta los términos para entrar',
    avatarHint: 'Toca para subir foto (opcional)',
    termsPrefix: 'Acepto los ',
    termsLink: 'términos y condiciones',
    termsSuffix: ' de CNG+',
    privacyPrefix: 'Acepto la ',
    privacyLink: 'política de privacidad',
    privacySuffix: ' y el manejo de mis datos personales',
    truthfulText: 'Confirmo que toda la información proporcionada es verídica y corresponde a mi persona. Entiendo que solo se permite una cuenta por persona.',
    finishBtn: 'Finalizar y entrar',
    finishing: 'Finalizando...',
    termsRequired: 'Debes aceptar los términos y condiciones',
    privacyRequired: 'Debes aceptar la política de privacidad',
    truthfulRequired: 'Debes confirmar la veracidad de tu información',
    finishError: 'Error al guardar: ',
    avatarUploadError: 'Error subiendo la foto: ',
    profileNotFound: 'No encontramos tu cuenta. Por favor contacta soporte.',
    sessionRequired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    avatarInvalidType: 'El archivo debe ser una imagen.',
    avatarTooLarge: 'La imagen no debe pesar más de 5 MB.',
  },
  en: {
    stepPassword: 'Password',
    stepConfirm: 'Confirm',

    passwordTitle: 'Set your password',
    passwordSubtitle: 'Create a strong password to access your CNG+ account',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Minimum 8 characters',
    confirmPasswordLabel: 'Confirm password',
    confirmPasswordPlaceholder: 'Repeat your password',
    continueBtn: 'Continue',
    settingPassword: 'Saving...',
    passwordRequired: 'Enter a password',
    passwordMin: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    passwordError: 'Error saving password: ',

    finalTitle: 'Final details',
    finalSubtitle: 'Upload a photo (optional) and accept the terms to continue',
    avatarHint: 'Tap to upload photo (optional)',
    termsPrefix: 'I accept the ',
    termsLink: 'terms and conditions',
    termsSuffix: ' of CNG+',
    privacyPrefix: 'I accept the ',
    privacyLink: 'privacy policy',
    privacySuffix: ' and the handling of my personal data',
    truthfulText: 'I confirm that all information provided is truthful and corresponds to my person. I understand that only one account per person is allowed.',
    finishBtn: 'Finish and continue',
    finishing: 'Finishing...',
    termsRequired: 'You must accept the terms and conditions',
    privacyRequired: 'You must accept the privacy policy',
    truthfulRequired: 'You must confirm the truthfulness of your information',
    finishError: 'Error saving: ',
    avatarUploadError: 'Error uploading photo: ',
    profileNotFound: 'Account not found. Please contact support.',
    sessionRequired: 'Your session expired. Please sign in again.',
    avatarInvalidType: 'File must be an image.',
    avatarTooLarge: 'Image must be smaller than 5 MB.',
  },
}

export default function Welcome() {
  const navigate = useNavigate()
  const { user, member, fetchMember } = useAuth()
  const fileInputRef = useRef(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [step, setStep] = useState('A') // 'A' = password, 'B' = legal+avatar
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [acceptedTruthful, setAcceptedTruthful] = useState(false)

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang] = useState(getDefaultLang)

  const t = LANG[lang]

  useEffect(() => {
    if (member?.registration_completed === true) {
      navigate('/app/feed', { replace: true })
    }
  }, [member, navigate])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  async function handlePasswordSubmit() {
    setError('')
    if (!password) return setError(t.passwordRequired)
    if (password.length < 8) return setError(t.passwordMin)
    if (password !== confirmPassword) return setError(t.passwordMismatch)

    setLoading(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) {
        setError(t.passwordError + updateErr.message)
        return
      }
      setStep('B')
    } catch (err) {
      setError(t.passwordError + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t.avatarInvalidType)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t.avatarTooLarge)
      return
    }
    setError('')
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  async function handleFinish() {
    setError('')
    if (!acceptedTerms) return setError(t.termsRequired)
    if (!acceptedPrivacy) return setError(t.privacyRequired)
    if (!acceptedTruthful) return setError(t.truthfulRequired)
    if (!user) {
      setError(t.sessionRequired)
      return
    }

    setLoading(true)
    try {
      let avatarUrl = null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = user.id + '/avatar-' + Date.now() + '.' + ext
        const { error: uploadErr } = await supabase.storage
          .from('cng-media')
          .upload(path, avatarFile, { contentType: avatarFile.type, upsert: true })
        if (uploadErr) {
          setError(t.avatarUploadError + uploadErr.message)
          setLoading(false)
          return
        }
        const { data: urlData } = supabase.storage.from('cng-media').getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }

      const updatePayload = {
        accepted_terms: true,
        accepted_privacy: true,
        accepted_truthful: true,
        registration_completed: true,
        updated_at: new Date().toISOString(),
      }
      if (avatarUrl) updatePayload.avatar_url = avatarUrl

      const { data: updated, error: updateErr } = await supabase
        .from('identity_profiles')
        .update(updatePayload)
        .eq('user_id', user.id)
        .select()

      if (updateErr) {
        setError(t.finishError + updateErr.message)
        setLoading(false)
        return
      }

      if (!updated || updated.length === 0) {
        setError(t.profileNotFound)
        setLoading(false)
        return
      }

      await fetchMember(user.id)
      navigate('/app/feed', { replace: true })
    } catch (err) {
      setError(t.finishError + err.message)
    } finally {
      setLoading(false)
    }
  }

  const userInitial = (user?.email || '?')[0].toUpperCase()

  return (
    <div style={{ ...styles.container, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
      <div style={styles.steps}>
        <div style={{ ...styles.step, ...styles.stepActive }}>
          <div style={{ ...styles.stepDot, ...styles.stepDotActive, ...(isMobile ? { width: 24, height: 24, fontSize: 11 } : {}) }}>
            {step === 'B' ? '✓' : '1'}
          </div>
          <span style={{ ...styles.stepLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>{t.stepPassword}</span>
        </div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.step, ...(step === 'B' ? styles.stepActive : {}) }}>
          <div style={{ ...styles.stepDot, ...(step === 'B' ? styles.stepDotActive : {}), ...(isMobile ? { width: 24, height: 24, fontSize: 11 } : {}) }}>2</div>
          <span style={{ ...styles.stepLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>{t.stepConfirm}</span>
        </div>
      </div>

      <div style={{ ...styles.card, ...(isMobile ? { padding: '24px 16px', maxWidth: '100%' } : {}) }}>
        <div style={styles.logoRow}>
          <div style={styles.logo}>C</div>
          <span style={styles.logoText}>CHILL N GO</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {step === 'A' && (
          <>
            <h1 style={styles.title}>{t.passwordTitle}</h1>
            <p style={styles.subtitle}>{t.passwordSubtitle}</p>

            <div style={styles.field}>
              <label style={styles.label}>{t.passwordLabel}</label>
              <div style={styles.passwordRow}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...styles.input, paddingRight: 44 }}
                  placeholder={t.passwordPlaceholder}
                  autoFocus
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
              <label style={styles.label}>{t.confirmPasswordLabel}</label>
              <div style={styles.passwordRow}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handlePasswordSubmit() }}
                  style={{ ...styles.input, paddingRight: 44 }}
                  placeholder={t.confirmPasswordPlaceholder}
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

            <button onClick={handlePasswordSubmit} style={{ ...styles.button, marginTop: 16 }} disabled={loading}>
              {loading ? t.settingPassword : t.continueBtn}
            </button>
          </>
        )}

        {step === 'B' && (
          <>
            <h1 style={styles.title}>{t.finalTitle}</h1>
            <p style={styles.subtitle}>{t.finalSubtitle}</p>

            <div style={styles.avatarRow}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                style={{ display: 'none' }}
              />
              <div onClick={() => fileInputRef.current?.click()} style={styles.avatarCircle}>
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={styles.avatarInitial}>{userInitial}</div>
                )}
              </div>
              <span style={styles.avatarHint}>{t.avatarHint}</span>
            </div>

            <div style={styles.legalSection}>
              <label style={styles.checkbox}>
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                <span style={{ ...styles.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>
                  {t.termsPrefix}<a href="/terms" target="_blank" rel="noreferrer" style={styles.link}>{t.termsLink}</a>{t.termsSuffix}
                </span>
              </label>

              <label style={styles.checkbox}>
                <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
                <span style={{ ...styles.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>
                  {t.privacyPrefix}<a href="/privacy" target="_blank" rel="noreferrer" style={styles.link}>{t.privacyLink}</a>{t.privacySuffix}
                </span>
              </label>

              <label style={styles.checkbox}>
                <input type="checkbox" checked={acceptedTruthful} onChange={(e) => setAcceptedTruthful(e.target.checked)} />
                <span style={{ ...styles.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>{t.truthfulText}</span>
              </label>
            </div>

            <button onClick={handleFinish} style={{ ...styles.button, marginTop: 8 }} disabled={loading}>
              {loading ? t.finishing : t.finishBtn}
            </button>
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
    marginBottom: 16,
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
    width: '100%',
    boxSizing: 'border-box',
  },
  passwordRow: {
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
  avatarRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    border: '2px solid ' + C.primary,
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)',
  },
  avatarInitial: {
    width: '100%',
    height: '100%',
    background: GRADIENT.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    fontWeight: 800,
    color: C.surface,
    fontFamily: FONT.headline,
  },
  avatarHint: {
    fontSize: 11,
    color: C.textFaint,
  },
  legalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginBottom: 20,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 1.5,
  },
  link: {
    color: C.primary,
    textDecoration: 'none',
  },
}
