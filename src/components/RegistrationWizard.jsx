import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT } from '../stitch'

const COUNTRIES = [
  { code: 'MX', name_es: 'México', name_en: 'Mexico', phoneCode: '+52' },
  { code: 'US', name_es: 'Estados Unidos', name_en: 'United States', phoneCode: '+1' },
  { code: 'CA', name_es: 'Canadá', name_en: 'Canada', phoneCode: '+1' },
  { code: 'GB', name_es: 'Reino Unido', name_en: 'United Kingdom', phoneCode: '+44' },
  { code: 'AU', name_es: 'Australia', name_en: 'Australia', phoneCode: '+61' },
  { code: 'CO', name_es: 'Colombia', name_en: 'Colombia', phoneCode: '+57' },
  { code: 'AR', name_es: 'Argentina', name_en: 'Argentina', phoneCode: '+54' },
  { code: 'ES', name_es: 'España', name_en: 'Spain', phoneCode: '+34' },
  { code: 'BR', name_es: 'Brasil', name_en: 'Brazil', phoneCode: '+55' },
  { code: 'CL', name_es: 'Chile', name_en: 'Chile', phoneCode: '+56' },
  { code: 'PE', name_es: 'Perú', name_en: 'Peru', phoneCode: '+51' },
  { code: 'EC', name_es: 'Ecuador', name_en: 'Ecuador', phoneCode: '+593' },
  { code: 'GT', name_es: 'Guatemala', name_en: 'Guatemala', phoneCode: '+502' },
  { code: 'OTHER', name_es: 'Otro país', name_en: 'Other country', phoneCode: '' },
]

const EN_COUNTRIES = new Set(['US', 'CA', 'GB', 'AU', 'NZ', 'IE'])

const STATES_MX = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas']
const STATES_US = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']

const LANG = {
  es: {
    // Sub-step labels
    stepIdentity: 'Identidad',
    stepContact: 'Contacto',
    stepAddress: 'Dirección',
    stepPassword: 'Contraseña',
    stepConfirm: 'Confirmar',
    stepVerify: 'Verificar',

    // Step 1: Identity
    identityTitle: 'Datos de identidad',
    identityDesc: 'Necesitamos tu nombre legal tal como aparece en tu identificación oficial. Esta información es necesaria para verificar tu identidad y proteger tu cuenta.',
    countryLabel: 'País de residencia',
    selectCountry: 'Selecciona tu país',
    firstName: 'Nombre(s)',
    firstNamePlaceholder: 'Ej: Juan Carlos',
    lastName: 'Apellido paterno',
    lastNamePlaceholder: 'Ej: García',
    maternalLastName: 'Apellido materno',
    maternalLastNamePlaceholder: 'Ej: López',
    dob: 'Fecha de nacimiento',
    dobHint: 'Debes ser mayor de 18 años',
    nationalityLabel: 'Nacionalidad',
    selectOption: 'Selecciona',
    continueBtn: 'Continuar',
    backBtn: '← Atrás',

    // Step 2: Contact
    contactTitle: 'Información de contacto',
    contactDesc: 'Tu número de teléfono será usado para comunicaciones importantes sobre tu cuenta y para notificaciones por WhatsApp.',
    emailLabel: 'Correo electrónico',
    emailHint: 'Este es el correo con el que realizaste el pago',
    phoneLabel: 'Número de teléfono',
    phonePlaceholder: '10 dígitos',
    phoneHint: 'Incluye tu número sin el código de país',

    // Step 3: Address
    addressTitle: 'Dirección',
    addressDesc: 'Tu dirección es necesaria para cumplir con regulaciones financieras. Esta información es confidencial y está protegida bajo nuestra política de privacidad.',
    streetLabel: 'Calle y número',
    streetPlaceholder: 'Ej: Av. Reforma 222',
    unitLabel: 'Colonia / Interior (opcional)',
    unitPlaceholder: 'Ej: Col. Juárez, Int. 4',
    cityLabel: 'Ciudad',
    cityPlaceholder: 'Ej: Ciudad de México',
    stateLabel: 'Estado',
    statePlaceholder: 'Estado o provincia',
    zipLabel: 'Código postal',
    zipPlaceholder: 'Ej: 06600',

    // Step 4: Password
    passwordTitle: 'Crea tu contraseña',
    passwordDesc: 'Esta contraseña te dará acceso a tu cuenta CNG+ y a todo el ecosistema de Chill N Go. Elige una contraseña segura que no uses en otros sitios.',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    confirmPasswordLabel: 'Confirmar contraseña',
    confirmPasswordPlaceholder: 'Repite tu contraseña',

    // Step 5: Legal
    confirmTitle: 'Confirma y crea tu cuenta',
    confirmDesc: 'Revisa tu información y acepta los términos. Después verificaremos tu identidad con un documento oficial a través de Stripe.',
    summaryName: 'Nombre',
    summaryEmail: 'Email',
    summaryPhone: 'Teléfono',
    summaryCountry: 'País',
    summaryCity: 'Ciudad',
    summaryReferredBy: 'Referido por',
    termsPrefix: 'Acepto los ',
    termsLink: 'términos y condiciones',
    termsSuffix: ' de CNG+',
    privacyPrefix: 'Acepto la ',
    privacyLink: 'política de privacidad',
    privacySuffix: ' y el manejo de mis datos personales',
    truthfulText: (name) => `Confirmo que toda la información proporcionada es verídica y corresponde a mi persona. Entiendo que solo se permite una cuenta por persona y que mi referidor (${name}) es permanente.`,
    createAccountBtn: 'Crear cuenta y verificar identidad',
    creatingAccount: 'Creando cuenta...',

    // Step 6: Verify
    verifyTitle: 'Verifica tu identidad',
    verifyDescStart: 'Tu cuenta fue creada exitosamente. Ahora necesitamos verificar tu identidad para proteger tu cuenta y tu dinero. Este proceso es seguro y está gestionado por ',
    verifyDescEnd: ', la plataforma de pagos más confiable del mundo.',
    verifyFeature1: 'Foto de tu identificación oficial (INE, pasaporte o licencia)',
    verifyFeature2: 'Selfie en tiempo real para confirmar tu identidad',
    verifyFeature3: 'Verificación de tu correo electrónico',
    verifyFeature4: 'Verificación de tu número de teléfono',
    verifySecurityNote: 'Tus datos están seguros.',
    verifySecurityDesc: ' Stripe utiliza encriptación de grado bancario. Chill N Go International LLC nunca almacena tus documentos — Stripe los procesa directamente.',
    verifyBtn: 'Verificar mi identidad',
    verifyingBtn: 'Iniciando verificación...',
    verifyLaterBtn: 'Verificar después (acceso limitado)',
    verifyLaterNote: 'Sin verificación no podrás redimir Chilliums ni acceder a funciones financieras',

    docsSentTitle: 'Documentos enviados',
    docsSentDesc: 'Tu verificación está siendo procesada por Stripe. Esto puede tomar unos minutos. Te notificaremos por correo electrónico cuando esté lista.',
    docsSentNote: 'Ya puedes acceder a tu cuenta. Algunas funciones como redimir Chilliums estarán disponibles una vez que tu verificación sea aprobada.',
    goToAccountBtn: 'Ir a mi cuenta CNG+',

    errorTitle: 'Hubo un problema',
    errorDesc: 'No se pudo completar la verificación. Puedes intentarlo de nuevo o verificar tu identidad más tarde desde tu perfil.',
    retryBtn: 'Intentar de nuevo',
    continueWithoutVerify: 'Continuar sin verificar (acceso limitado)',

    // Validation
    nameRequired: 'Nombre y apellido son obligatorios',
    maternalRequired: 'Apellido materno es obligatorio para residentes de México',
    dobRequired: 'Fecha de nacimiento es obligatoria',
    ageRequired: 'Debes ser mayor de 18 años para registrarte',
    nationalityRequired: 'Selecciona tu nacionalidad',
    countryRequired: 'Selecciona tu país de residencia',
    phoneRequired: 'Número de teléfono es obligatorio',
    phoneInvalid: 'Número de teléfono inválido',
    addressRequired: 'Dirección es obligatoria',
    cityRequired: 'Ciudad es obligatoria',
    stateRequired: 'Estado/Provincia es obligatorio',
    zipRequired: 'Código postal es obligatorio',
    passwordRequired: 'Contraseña es obligatoria',
    passwordMin: 'La contraseña debe tener al menos 8 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
    termsRequired: 'Debes aceptar los términos y condiciones',
    privacyRequired: 'Debes aceptar la política de privacidad',
    truthfulRequired: 'Debes confirmar que la información es verídica',
    emailAlreadyRegistered: 'Este correo ya está registrado. Intenta iniciar sesión.',
    accountCreateError: 'Error al crear la cuenta: ',
    verifyStartError: 'Error al iniciar verificación: ',
  },
  en: {
    stepIdentity: 'Identity',
    stepContact: 'Contact',
    stepAddress: 'Address',
    stepPassword: 'Password',
    stepConfirm: 'Confirm',
    stepVerify: 'Verify',

    identityTitle: 'Identity information',
    identityDesc: 'We need your legal name as it appears on your official ID. This information is required to verify your identity and protect your account.',
    countryLabel: 'Country of residence',
    selectCountry: 'Select your country',
    firstName: 'First name',
    firstNamePlaceholder: 'E.g. John',
    lastName: 'Last name',
    lastNamePlaceholder: 'E.g. Smith',
    maternalLastName: 'Maternal last name',
    maternalLastNamePlaceholder: 'E.g. López',
    dob: 'Date of birth',
    dobHint: 'You must be at least 18 years old',
    nationalityLabel: 'Nationality',
    selectOption: 'Select',
    continueBtn: 'Continue',
    backBtn: '← Back',

    contactTitle: 'Contact information',
    contactDesc: 'Your phone number will be used for important account communications and WhatsApp notifications.',
    emailLabel: 'Email address',
    emailHint: 'This is the email you used for payment',
    phoneLabel: 'Phone number',
    phonePlaceholder: '10 digits',
    phoneHint: 'Enter your number without the country code',

    addressTitle: 'Address',
    addressDesc: 'Your address is required to comply with financial regulations. This information is confidential and protected under our privacy policy.',
    streetLabel: 'Street address',
    streetPlaceholder: 'E.g. 123 Main St',
    unitLabel: 'Apt / Suite (optional)',
    unitPlaceholder: 'E.g. Apt 4B',
    cityLabel: 'City',
    cityPlaceholder: 'E.g. Miami',
    stateLabel: 'State',
    statePlaceholder: 'State or province',
    zipLabel: 'ZIP code',
    zipPlaceholder: 'E.g. 33101',

    passwordTitle: 'Create your password',
    passwordDesc: 'This password will give you access to your CNG+ account and the entire Chill N Go ecosystem. Choose a strong password you don\'t use on other sites.',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Minimum 8 characters',
    confirmPasswordLabel: 'Confirm password',
    confirmPasswordPlaceholder: 'Repeat your password',

    confirmTitle: 'Confirm and create your account',
    confirmDesc: 'Review your information and accept the terms. We will then verify your identity with an official document through Stripe.',
    summaryName: 'Name',
    summaryEmail: 'Email',
    summaryPhone: 'Phone',
    summaryCountry: 'Country',
    summaryCity: 'City',
    summaryReferredBy: 'Referred by',
    termsPrefix: 'I accept the ',
    termsLink: 'terms and conditions',
    termsSuffix: ' of CNG+',
    privacyPrefix: 'I accept the ',
    privacyLink: 'privacy policy',
    privacySuffix: ' and the handling of my personal data',
    truthfulText: (name) => `I confirm that all information provided is truthful and corresponds to my person. I understand that only one account per person is allowed and that my referrer (${name}) is permanent.`,
    createAccountBtn: 'Create account and verify identity',
    creatingAccount: 'Creating account...',

    verifyTitle: 'Verify your identity',
    verifyDescStart: 'Your account was created successfully. Now we need to verify your identity to protect your account and your money. This process is secure and managed by ',
    verifyDescEnd: ', the most trusted payment platform in the world.',
    verifyFeature1: 'Photo of your official ID (passport, driver\'s license, or national ID)',
    verifyFeature2: 'Real-time selfie to confirm your identity',
    verifyFeature3: 'Email address verification',
    verifyFeature4: 'Phone number verification',
    verifySecurityNote: 'Your data is secure.',
    verifySecurityDesc: ' Stripe uses bank-grade encryption. Chill N Go International LLC never stores your documents — Stripe processes them directly.',
    verifyBtn: 'Verify my identity',
    verifyingBtn: 'Starting verification...',
    verifyLaterBtn: 'Verify later (limited access)',
    verifyLaterNote: 'Without verification you won\'t be able to redeem Chilliums or access financial features',

    docsSentTitle: 'Documents submitted',
    docsSentDesc: 'Your verification is being processed by Stripe. This may take a few minutes. We\'ll notify you by email when it\'s ready.',
    docsSentNote: 'You can now access your account. Some features like redeeming Chilliums will be available once your verification is approved.',
    goToAccountBtn: 'Go to my CNG+ account',

    errorTitle: 'There was a problem',
    errorDesc: 'Verification could not be completed. You can try again or verify your identity later from your profile.',
    retryBtn: 'Try again',
    continueWithoutVerify: 'Continue without verifying (limited access)',

    nameRequired: 'First name and last name are required',
    maternalRequired: 'Maternal last name is required for Mexico residents',
    dobRequired: 'Date of birth is required',
    ageRequired: 'You must be at least 18 years old to register',
    nationalityRequired: 'Select your nationality',
    countryRequired: 'Select your country of residence',
    phoneRequired: 'Phone number is required',
    phoneInvalid: 'Invalid phone number',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    stateRequired: 'State/Province is required',
    zipRequired: 'ZIP code is required',
    passwordRequired: 'Password is required',
    passwordMin: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    termsRequired: 'You must accept the terms and conditions',
    privacyRequired: 'You must accept the privacy policy',
    truthfulRequired: 'You must confirm that the information is truthful',
    emailAlreadyRegistered: 'This email is already registered. Try signing in.',
    accountCreateError: 'Error creating account: ',
    verifyStartError: 'Error starting verification: ',
  },
}

export default function RegistrationWizard({ email, refCode, referrerName, referrerUserId, onWizardComplete, onLangChange }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [subStep, setSubStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState('es')

  // Step 1: Identity
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [maternalLastName, setMaternalLastName] = useState('')
  const [dob, setDob] = useState('')
  const [nationality, setNationality] = useState('')
  const [countryOfResidence, setCountryOfResidence] = useState('')

  // Step 2: Contact
  const [phoneCountryCode, setPhoneCountryCode] = useState('+52')
  const [phone, setPhone] = useState('')

  // Step 3: Address
  const [addressStreet, setAddressStreet] = useState('')
  const [addressUnit, setAddressUnit] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressZip, setAddressZip] = useState('')

  // Step 4: Password
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 5: Legal
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [acceptedTruthful, setAcceptedTruthful] = useState(false)

  // Language detection based on country
  useEffect(() => {
    const newLang = EN_COUNTRIES.has(countryOfResidence) ? 'en' : 'es'
    setLang(newLang)
    if (onLangChange) onLangChange(newLang)
  }, [countryOfResidence])

  const t = LANG[lang]
  const cName = (c) => c[lang === 'en' ? 'name_en' : 'name_es']

  const fullName = countryOfResidence === 'MX'
    ? `${firstName} ${lastName} ${maternalLastName}`.trim()
    : `${firstName} ${lastName}`.trim()

  const states = countryOfResidence === 'MX' ? STATES_MX : countryOfResidence === 'US' ? STATES_US : []

  function validateStep() {
    setError('')
    switch (subStep) {
      case 1:
        if (!firstName || !lastName) return setError(t.nameRequired)
        if (countryOfResidence === 'MX' && !maternalLastName) return setError(t.maternalRequired)
        if (!dob) return setError(t.dobRequired)
        const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
        if (age < 18) return setError(t.ageRequired)
        if (!nationality) return setError(t.nationalityRequired)
        if (!countryOfResidence) return setError(t.countryRequired)
        return true
      case 2:
        if (!phone) return setError(t.phoneRequired)
        if (phone.length < 7) return setError(t.phoneInvalid)
        return true
      case 3:
        if (!addressStreet) return setError(t.addressRequired)
        if (!addressCity) return setError(t.cityRequired)
        if (!addressState) return setError(t.stateRequired)
        if (!addressZip) return setError(t.zipRequired)
        return true
      case 4:
        if (!password) return setError(t.passwordRequired)
        if (password.length < 8) return setError(t.passwordMin)
        if (password !== confirmPassword) return setError(t.passwordMismatch)
        return true
      case 5:
        if (!acceptedTerms) return setError(t.termsRequired)
        if (!acceptedPrivacy) return setError(t.privacyRequired)
        if (!acceptedTruthful) return setError(t.truthfulRequired)
        return true
      default:
        return true
    }
  }

  function nextStep() {
    if (validateStep() === true) {
      setSubStep(subStep + 1)
      setError('')
    }
  }

  async function handleFinalSubmit() {
    if (validateStep() !== true) return

    setLoading(true)
    setError('')

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { ref_code: refCode },
          emailRedirectTo: window.location.origin + '/login'
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError(t.emailAlreadyRegistered)
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      // 2. Generate own ref_code and upsert identity_profile with complete data
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let myRefCode = 'CNG-'
      for (let i = 0; i < 6; i++) {
        myRefCode += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      const profileData = {
        user_id: authData?.user?.id || null,
        email,
        first_name: firstName,
        last_name: lastName,
        maternal_last_name: maternalLastName || null,
        full_name: fullName,
        date_of_birth: dob,
        phone,
        phone_country_code: phoneCountryCode,
        nationality,
        country_of_residence: countryOfResidence,
        address_street: addressStreet,
        address_unit: addressUnit || null,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
        address_country: countryOfResidence,
        accepted_terms: true,
        accepted_privacy: true,
        accepted_truthful: true,
        ref_code: myRefCode,
        referred_by: referrerUserId || null,
        payment_status: 'pending',
        registration_completed: false,
        account_type: 'member',
        updated_at: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from('identity_profiles')
        .upsert(profileData, { onConflict: 'email' })

      if (upsertError) {
        setError(t.accountCreateError + upsertError.message)
        setLoading(false)
        return
      }

      // 3. Notify parent to advance to payment step
      if (onWizardComplete) {
        onWizardComplete({ email, fullName })
      }
    } catch (err) {
      setError(t.accountCreateError + err.message)
    } finally {
      setLoading(false)
    }
  }

  const SUB_STEPS = [
    { num: 1, label: t.stepIdentity },
    { num: 2, label: t.stepContact },
    { num: 3, label: t.stepAddress },
    { num: 4, label: t.stepPassword },
    { num: 5, label: t.stepConfirm },
  ]

  return (
    <div>
      {/* Sub-step indicator */}
      <div style={s.subSteps}>
        {SUB_STEPS.map((ss) => (
          <div key={ss.num} style={{ ...s.subStep, opacity: subStep >= ss.num ? 1 : 0.35 }}>
            <div style={{
              ...s.subStepDot,
              ...(isMobile ? { width: 22, height: 22, fontSize: 9 } : {}),
              background: subStep >= ss.num ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: subStep >= ss.num ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.1)',
              color: subStep >= ss.num ? C.primary : C.onSurfaceVariant,
            }}>
              {subStep > ss.num ? '✓' : ss.num}
            </div>
            <span style={{ ...s.subStepLabel, ...(isMobile ? { fontSize: 8 } : {}) }}>{ss.label}</span>
          </div>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* STEP 1: Identity */}
      {subStep === 1 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>{t.identityTitle}</h3>
          <p style={s.stepDesc}>{t.identityDesc}</p>

          <div style={s.field}>
            <label style={s.label}>{t.countryLabel}</label>
            <select value={countryOfResidence} onChange={(e) => { setCountryOfResidence(e.target.value); const c = COUNTRIES.find(c => c.code === e.target.value); if (c) setPhoneCountryCode(c.phoneCode); }} style={s.select}>
              <option value="">{t.selectCountry}</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{cName(c)}</option>)}
            </select>
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.firstName}</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={s.input} placeholder={t.firstNamePlaceholder} />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.lastName}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={s.input} placeholder={t.lastNamePlaceholder} />
          </div>

          {countryOfResidence === 'MX' && (
            <div style={s.field}>
              <label style={s.label}>{t.maternalLastName}</label>
              <input type="text" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} style={s.input} placeholder={t.maternalLastNamePlaceholder} />
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>{t.dob}</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={s.input} />
            <span style={s.hint}>{t.dobHint}</span>
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.nationalityLabel}</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} style={s.select}>
              <option value="">{t.selectOption}</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{cName(c)}</option>)}
            </select>
          </div>

          <button onClick={nextStep} style={s.btn}>{t.continueBtn}</button>
        </div>
      )}

      {/* STEP 2: Contact */}
      {subStep === 2 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>{t.contactTitle}</h3>
          <p style={s.stepDesc}>{t.contactDesc}</p>

          <div style={s.field}>
            <label style={s.label}>{t.emailLabel}</label>
            <input type="email" value={email} disabled style={{ ...s.input, opacity: 0.6, cursor: 'not-allowed' }} />
            <span style={s.hint}>{t.emailHint}</span>
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.phoneLabel}</label>
            <div style={s.phoneRow}>
              <select value={phoneCountryCode} onChange={(e) => setPhoneCountryCode(e.target.value)} style={{ ...s.select, width: 110, flexShrink: 0 }}>
                {COUNTRIES.filter(c => c.phoneCode).map(c => (
                  <option key={c.code} value={c.phoneCode}>{c.phoneCode} {c.code}</option>
                ))}
              </select>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} style={s.input} placeholder={t.phonePlaceholder} />
            </div>
            <span style={s.hint}>{t.phoneHint}</span>
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(1)} style={s.btnBack}>{t.backBtn}</button>
            <button onClick={nextStep} style={s.btn}>{t.continueBtn}</button>
          </div>
        </div>
      )}

      {/* STEP 3: Address */}
      {subStep === 3 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>{t.addressTitle}</h3>
          <p style={s.stepDesc}>{t.addressDesc}</p>

          <div style={s.field}>
            <label style={s.label}>{t.streetLabel}</label>
            <input type="text" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} style={s.input} placeholder={t.streetPlaceholder} />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.unitLabel}</label>
            <input type="text" value={addressUnit} onChange={(e) => setAddressUnit(e.target.value)} style={s.input} placeholder={t.unitPlaceholder} />
          </div>

          <div style={s.fieldRow}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>{t.cityLabel}</label>
              <input type="text" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} style={s.input} placeholder={t.cityPlaceholder} />
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>{t.stateLabel}</label>
              {states.length > 0 ? (
                <select value={addressState} onChange={(e) => setAddressState(e.target.value)} style={s.select}>
                  <option value="">{t.selectOption}</option>
                  {states.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              ) : (
                <input type="text" value={addressState} onChange={(e) => setAddressState(e.target.value)} style={s.input} placeholder={t.statePlaceholder} />
              )}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>{t.zipLabel}</label>
            <input type="text" value={addressZip} onChange={(e) => setAddressZip(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))} style={{ ...s.input, maxWidth: 160 }} placeholder={t.zipPlaceholder} />
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(2)} style={s.btnBack}>{t.backBtn}</button>
            <button onClick={nextStep} style={s.btn}>{t.continueBtn}</button>
          </div>
        </div>
      )}

      {/* STEP 4: Password */}
      {subStep === 4 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>{t.passwordTitle}</h3>
          <p style={s.stepDesc}>{t.passwordDesc}</p>

          <div style={s.field}>
            <label style={s.label}>{t.passwordLabel}</label>
            <div style={s.passwordRow}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...s.input, paddingRight: 44 }} placeholder={t.passwordPlaceholder} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
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

          <div style={s.field}>
            <label style={s.label}>{t.confirmPasswordLabel}</label>
            <div style={s.passwordRow}>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...s.input, paddingRight: 44 }} placeholder={t.confirmPasswordPlaceholder} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
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

          <div style={s.navRow}>
            <button onClick={() => setSubStep(3)} style={s.btnBack}>{t.backBtn}</button>
            <button onClick={nextStep} style={s.btn}>{t.continueBtn}</button>
          </div>
        </div>
      )}

      {/* STEP 5: Legal confirmation */}
      {subStep === 5 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>{t.confirmTitle}</h3>
          <p style={s.stepDesc}>{t.confirmDesc}</p>

          <div style={{ ...s.summary, ...(isMobile ? { padding: 12 } : {}) }}>
            {[
              [t.summaryName, fullName],
              [t.summaryEmail, email],
              [t.summaryPhone, `${phoneCountryCode} ${phone}`],
              [t.summaryCountry, COUNTRIES.find(c => c.code === countryOfResidence)?.[lang === 'en' ? 'name_en' : 'name_es']],
              [t.summaryCity, `${addressCity}, ${addressState}`],
              [t.summaryReferredBy, referrerName],
            ].map(([label, value]) => (
              <div key={label} style={{ ...s.summaryRow, ...(isMobile ? { fontSize: 11 } : {}) }}>
                <span style={s.summaryLabel}>{label}</span>
                <span style={s.summaryValue}>{value}</span>
              </div>
            ))}
          </div>

          <div style={s.legalSection}>
            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span style={{ ...s.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>{t.termsPrefix}<a href="/terms" target="_blank" style={s.link}>{t.termsLink}</a>{t.termsSuffix}</span>
            </label>

            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
              <span style={{ ...s.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>{t.privacyPrefix}<a href="/privacy" target="_blank" style={s.link}>{t.privacyLink}</a>{t.privacySuffix}</span>
            </label>

            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedTruthful} onChange={(e) => setAcceptedTruthful(e.target.checked)} />
              <span style={{ ...s.checkLabel, ...(isMobile ? { fontSize: 11 } : {}) }}>{t.truthfulText(referrerName)}</span>
            </label>
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(4)} style={s.btnBack}>{t.backBtn}</button>
            <button onClick={handleFinalSubmit} style={s.btn} disabled={loading}>
              {loading ? t.creatingAccount : t.createAccountBtn}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const s = {
  subSteps: {
    display: 'flex',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 24,
  },
  subStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  subStepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
  },
  subStepLabel: { fontSize: 10, color: C.onSurfaceVariant },
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
  stepContent: {},
  stepTitle: { fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.6, marginBottom: 20, textAlign: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  fieldRow: { display: 'flex', gap: 12, marginBottom: 16 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 500 },
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
  select: {
    background: '#161B22',
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
  hint: { fontSize: 11, color: C.textFaint, marginTop: 4 },
  phoneRow: { display: 'flex', gap: 8 },
  navRow: { display: 'flex', gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    background: GRADIENT.primary,
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  btnBack: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '14px 20px',
    fontSize: 13,
    color: C.onSurfaceVariant,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
    textAlign: 'center',
  },
  summary: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 13,
  },
  summaryLabel: { color: C.onSurfaceVariant },
  summaryValue: { color: C.text, fontWeight: 500, textAlign: 'right' },
  legalSection: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 },
  checkbox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  },
  checkLabel: { fontSize: 13, color: C.onSurfaceVariant, lineHeight: 1.5 },
  link: { color: C.primary, textDecoration: 'none' },
  verifyIconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
  },
  verifyFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#ccc',
  },
  verifyFeatureIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  verifyNote: {
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
}
