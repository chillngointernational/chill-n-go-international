import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COUNTRIES = [
  { code: 'MX', name: 'México', phoneCode: '+52' },
  { code: 'US', name: 'Estados Unidos', phoneCode: '+1' },
  { code: 'CO', name: 'Colombia', phoneCode: '+57' },
  { code: 'AR', name: 'Argentina', phoneCode: '+54' },
  { code: 'ES', name: 'España', phoneCode: '+34' },
  { code: 'BR', name: 'Brasil', phoneCode: '+55' },
  { code: 'CL', name: 'Chile', phoneCode: '+56' },
  { code: 'PE', name: 'Perú', phoneCode: '+51' },
  { code: 'EC', name: 'Ecuador', phoneCode: '+593' },
  { code: 'GT', name: 'Guatemala', phoneCode: '+502' },
  { code: 'OTHER', name: 'Otro país', phoneCode: '' },
]

const STATES_MX = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas']
const STATES_US = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']

export default function RegistrationWizard({ email, refCode, referrerName, onComplete }) {
  const [subStep, setSubStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  // Step 6: Stripe Identity
  const [verificationStatus, setVerificationStatus] = useState(null) // null, 'pending', 'verified', 'error'
  const [verificationSessionId, setVerificationSessionId] = useState('')

  const fullName = countryOfResidence === 'MX'
    ? `${firstName} ${lastName} ${maternalLastName}`.trim()
    : `${firstName} ${lastName}`.trim()

  const states = countryOfResidence === 'MX' ? STATES_MX : countryOfResidence === 'US' ? STATES_US : []

  function validateStep() {
    setError('')
    switch (subStep) {
      case 1:
        if (!firstName || !lastName) return setError('Nombre y apellido son obligatorios')
        if (countryOfResidence === 'MX' && !maternalLastName) return setError('Apellido materno es obligatorio para residentes de México')
        if (!dob) return setError('Fecha de nacimiento es obligatoria')
        const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
        if (age < 18) return setError('Debes ser mayor de 18 años para registrarte')
        if (!nationality) return setError('Selecciona tu nacionalidad')
        if (!countryOfResidence) return setError('Selecciona tu país de residencia')
        return true
      case 2:
        if (!phone) return setError('Número de teléfono es obligatorio')
        if (phone.length < 7) return setError('Número de teléfono inválido')
        return true
      case 3:
        if (!addressStreet) return setError('Dirección es obligatoria')
        if (!addressCity) return setError('Ciudad es obligatoria')
        if (!addressState) return setError('Estado/Provincia es obligatorio')
        if (!addressZip) return setError('Código postal es obligatorio')
        return true
      case 4:
        if (!password) return setError('Contraseña es obligatoria')
        if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
        if (password !== confirmPassword) return setError('Las contraseñas no coinciden')
        return true
      case 5:
        if (!acceptedTerms) return setError('Debes aceptar los términos y condiciones')
        if (!acceptedPrivacy) return setError('Debes aceptar la política de privacidad')
        if (!acceptedTruthful) return setError('Debes confirmar que la información es verídica')
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
          setError('Este correo ya está registrado. Intenta iniciar sesión.')
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      // 2. Update cng_members with registration data (no document fields)
      const updateData = {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        maternal_last_name: maternalLastName || null,
        date_of_birth: dob,
        nationality,
        country_of_residence: countryOfResidence,
        phone,
        phone_country_code: phoneCountryCode,
        address_street: addressStreet,
        address_unit: addressUnit || null,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
        address_country: countryOfResidence,
        accepted_terms: true,
        accepted_privacy: true,
        accepted_truthful: true,
        registration_completed: true,
        identity_verification_status: 'pending',
        updated_at: new Date().toISOString(),
      }

      if (authData?.user) {
        updateData.user_id = authData.user.id
      }

      const { error: updateError } = await supabase
        .from('cng_members')
        .update(updateData)
        .eq('email', email)

      if (updateError) {
        console.error('Update error:', updateError)
      }

      // 3. Move to Stripe Identity verification step
      setSubStep(6)
    } catch (err) {
      setError('Error al crear la cuenta: ' + err.message)
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
            email: email,
            return_url: window.location.origin + '/join?step=register&ref=' + refCode + '&email=' + encodeURIComponent(email) + '&verify=complete',
          }),
        }
      )

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      // Save verification session ID
      setVerificationSessionId(data.session_id)

      // Update member record with session ID
      await supabase
        .from('cng_members')
        .update({
          stripe_verification_session_id: data.session_id,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)

      // Open Stripe Identity modal
      const stripe = window.Stripe('pk_test_51Rvx4iClWFP3vllVGpXmK95SXNw6SGUhcObbEZIIG1Sl1hlh6iszofr1Xl2FLTpXWpz6yL1Pvt9Dma1OHhv6VVE800RZSbAarS')
      const result = await stripe.verifyIdentity(data.client_secret)

      if (result.error) {
        console.error('Identity verification error:', result.error)
        setError(result.error.message)
        setVerificationStatus('error')
      } else {
        // User completed the modal (submitted documents)
        setVerificationStatus('pending')

        // Update member status
        await supabase
          .from('cng_members')
          .update({
            identity_verification_status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
      }
    } catch (err) {
      setError('Error al iniciar verificación: ' + err.message)
      setVerificationStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const SUB_STEPS = [
    { num: 1, label: 'Identidad' },
    { num: 2, label: 'Contacto' },
    { num: 3, label: 'Dirección' },
    { num: 4, label: 'Contraseña' },
    { num: 5, label: 'Confirmar' },
    { num: 6, label: 'Verificar' },
  ]

  return (
    <div>
      {/* Sub-step indicator */}
      <div style={s.subSteps}>
        {SUB_STEPS.map((ss) => (
          <div key={ss.num} style={{ ...s.subStep, opacity: subStep >= ss.num ? 1 : 0.35 }}>
            <div style={{
              ...s.subStepDot,
              background: subStep >= ss.num ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: subStep >= ss.num ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.1)',
              color: subStep >= ss.num ? '#5DCAA5' : '#888',
            }}>
              {subStep > ss.num ? '✓' : ss.num}
            </div>
            <span style={s.subStepLabel}>{ss.label}</span>
          </div>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* STEP 1: Identity */}
      {subStep === 1 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>Datos de identidad</h3>
          <p style={s.stepDesc}>
            Necesitamos tu nombre legal tal como aparece en tu identificación oficial.
            Esta información es necesaria para verificar tu identidad y proteger tu cuenta.
          </p>

          <div style={s.field}>
            <label style={s.label}>País de residencia</label>
            <select value={countryOfResidence} onChange={(e) => { setCountryOfResidence(e.target.value); const c = COUNTRIES.find(c => c.code === e.target.value); if (c) setPhoneCountryCode(c.phoneCode); }} style={s.select}>
              <option value="">Selecciona tu país</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          <div style={s.field}>
            <label style={s.label}>{countryOfResidence === 'MX' ? 'Nombre(s)' : 'First name'}</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={s.input} placeholder={countryOfResidence === 'MX' ? 'Ej: Juan Carlos' : 'Ej: John'} />
          </div>

          <div style={s.field}>
            <label style={s.label}>{countryOfResidence === 'MX' ? 'Apellido paterno' : 'Last name'}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={s.input} placeholder={countryOfResidence === 'MX' ? 'Ej: García' : 'Ej: Smith'} />
          </div>

          {countryOfResidence === 'MX' && (
            <div style={s.field}>
              <label style={s.label}>Apellido materno</label>
              <input type="text" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} style={s.input} placeholder="Ej: López" />
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Fecha de nacimiento</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={s.input} />
            <span style={s.hint}>Debes ser mayor de 18 años</span>
          </div>

          <div style={s.field}>
            <label style={s.label}>Nacionalidad</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} style={s.select}>
              <option value="">Selecciona</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          <button onClick={nextStep} style={s.btn}>Continuar</button>
        </div>
      )}

      {/* STEP 2: Contact */}
      {subStep === 2 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>Información de contacto</h3>
          <p style={s.stepDesc}>
            Tu número de teléfono será usado para comunicaciones importantes sobre tu cuenta
            y para notificaciones por WhatsApp.
          </p>

          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <input type="email" value={email} disabled style={{ ...s.input, opacity: 0.6, cursor: 'not-allowed' }} />
            <span style={s.hint}>Este es el correo con el que realizaste el pago</span>
          </div>

          <div style={s.field}>
            <label style={s.label}>Número de teléfono</label>
            <div style={s.phoneRow}>
              <select value={phoneCountryCode} onChange={(e) => setPhoneCountryCode(e.target.value)} style={{ ...s.select, width: 110, flexShrink: 0 }}>
                {COUNTRIES.filter(c => c.phoneCode).map(c => (
                  <option key={c.code} value={c.phoneCode}>{c.phoneCode} {c.code}</option>
                ))}
              </select>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} style={s.input} placeholder="10 dígitos" />
            </div>
            <span style={s.hint}>Incluye tu número sin el código de país</span>
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(1)} style={s.btnBack}>← Atrás</button>
            <button onClick={nextStep} style={s.btn}>Continuar</button>
          </div>
        </div>
      )}

      {/* STEP 3: Address */}
      {subStep === 3 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>Dirección</h3>
          <p style={s.stepDesc}>
            Tu dirección es necesaria para cumplir con regulaciones financieras. Esta información
            es confidencial y está protegida bajo nuestra política de privacidad.
          </p>

          <div style={s.field}>
            <label style={s.label}>{countryOfResidence === 'MX' ? 'Calle y número' : 'Street address'}</label>
            <input type="text" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} style={s.input} placeholder={countryOfResidence === 'MX' ? 'Ej: Av. Reforma 222' : 'Ej: 123 Main St'} />
          </div>

          <div style={s.field}>
            <label style={s.label}>{countryOfResidence === 'MX' ? 'Colonia / Interior (opcional)' : 'Apt / Suite (optional)'}</label>
            <input type="text" value={addressUnit} onChange={(e) => setAddressUnit(e.target.value)} style={s.input} placeholder={countryOfResidence === 'MX' ? 'Ej: Col. Juárez, Int. 4' : 'Ej: Apt 4B'} />
          </div>

          <div style={s.fieldRow}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Ciudad</label>
              <input type="text" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} style={s.input} placeholder={countryOfResidence === 'MX' ? 'Ej: Ciudad de México' : 'Ej: Miami'} />
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>{countryOfResidence === 'MX' ? 'Estado' : 'State'}</label>
              {states.length > 0 ? (
                <select value={addressState} onChange={(e) => setAddressState(e.target.value)} style={s.select}>
                  <option value="">Selecciona</option>
                  {states.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              ) : (
                <input type="text" value={addressState} onChange={(e) => setAddressState(e.target.value)} style={s.input} placeholder="Estado o provincia" />
              )}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>{countryOfResidence === 'MX' ? 'Código postal' : 'ZIP code'}</label>
            <input type="text" value={addressZip} onChange={(e) => setAddressZip(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))} style={{ ...s.input, maxWidth: 160 }} placeholder={countryOfResidence === 'MX' ? 'Ej: 06600' : 'Ej: 33101'} />
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(2)} style={s.btnBack}>← Atrás</button>
            <button onClick={nextStep} style={s.btn}>Continuar</button>
          </div>
        </div>
      )}

      {/* STEP 4: Password */}
      {subStep === 4 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>Crea tu contraseña</h3>
          <p style={s.stepDesc}>
            Esta contraseña te dará acceso a tu cuenta CNG+ y a todo el ecosistema de Chill N Go.
            Elige una contraseña segura que no uses en otros sitios.
          </p>

          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <div style={s.passwordRow}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...s.input, paddingRight: 44 }} placeholder="Mínimo 8 caracteres" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Confirmar contraseña</label>
            <div style={s.passwordRow}>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...s.input, paddingRight: 44 }} placeholder="Repite tu contraseña" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(3)} style={s.btnBack}>← Atrás</button>
            <button onClick={nextStep} style={s.btn}>Continuar</button>
          </div>
        </div>
      )}

      {/* STEP 5: Legal confirmation */}
      {subStep === 5 && (
        <div style={s.stepContent}>
          <h3 style={s.stepTitle}>Confirma y crea tu cuenta</h3>
          <p style={s.stepDesc}>
            Revisa tu información y acepta los términos. Después verificaremos tu identidad
            con un documento oficial a través de Stripe.
          </p>

          <div style={s.summary}>
            <div style={s.summaryRow}><span style={s.summaryLabel}>Nombre</span><span style={s.summaryValue}>{fullName}</span></div>
            <div style={s.summaryRow}><span style={s.summaryLabel}>Email</span><span style={s.summaryValue}>{email}</span></div>
            <div style={s.summaryRow}><span style={s.summaryLabel}>Teléfono</span><span style={s.summaryValue}>{phoneCountryCode} {phone}</span></div>
            <div style={s.summaryRow}><span style={s.summaryLabel}>País</span><span style={s.summaryValue}>{COUNTRIES.find(c => c.code === countryOfResidence)?.name}</span></div>
            <div style={s.summaryRow}><span style={s.summaryLabel}>Ciudad</span><span style={s.summaryValue}>{addressCity}, {addressState}</span></div>
            <div style={s.summaryRow}><span style={s.summaryLabel}>Referido por</span><span style={s.summaryValue}>{referrerName}</span></div>
          </div>

          <div style={s.legalSection}>
            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span style={s.checkLabel}>Acepto los <a href="/terms" target="_blank" style={s.link}>términos y condiciones</a> de CNG+</span>
            </label>

            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
              <span style={s.checkLabel}>Acepto la <a href="/privacy" target="_blank" style={s.link}>política de privacidad</a> y el manejo de mis datos personales</span>
            </label>

            <label style={s.checkbox}>
              <input type="checkbox" checked={acceptedTruthful} onChange={(e) => setAcceptedTruthful(e.target.checked)} />
              <span style={s.checkLabel}>Confirmo que toda la información proporcionada es verídica y corresponde a mi persona. Entiendo que solo se permite una cuenta por persona y que mi referidor ({referrerName}) es permanente.</span>
            </label>
          </div>

          <div style={s.navRow}>
            <button onClick={() => setSubStep(4)} style={s.btnBack}>← Atrás</button>
            <button onClick={handleFinalSubmit} style={s.btn} disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta y verificar identidad'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Stripe Identity Verification */}
      {subStep === 6 && (
        <div style={s.stepContent}>
          {!verificationStatus && (
            <>
              <div style={s.verifyIconWrap}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="26" stroke="#5DCAA5" strokeWidth="2" />
                  <path d="M28 16v4M28 36v4M16 28h4M36 28h4" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="28" cy="28" r="8" stroke="#5DCAA5" strokeWidth="2" />
                </svg>
              </div>
              <h3 style={s.stepTitle}>Verifica tu identidad</h3>
              <p style={s.stepDesc}>
                Tu cuenta fue creada exitosamente. Ahora necesitamos verificar tu identidad
                para proteger tu cuenta y tu dinero. Este proceso es seguro y está
                gestionado por <strong style={{ color: '#f1efe8' }}>Stripe</strong>, la plataforma
                de pagos más confiable del mundo.
              </p>

              <div style={s.verifyFeatures}>
                <div style={s.verifyFeature}>
                  <span style={s.verifyFeatureIcon}>📄</span>
                  <span>Foto de tu identificación oficial (INE, pasaporte o licencia)</span>
                </div>
                <div style={s.verifyFeature}>
                  <span style={s.verifyFeatureIcon}>🤳</span>
                  <span>Selfie en tiempo real para confirmar tu identidad</span>
                </div>
                <div style={s.verifyFeature}>
                  <span style={s.verifyFeatureIcon}>📧</span>
                  <span>Verificación de tu correo electrónico</span>
                </div>
                <div style={s.verifyFeature}>
                  <span style={s.verifyFeatureIcon}>📱</span>
                  <span>Verificación de tu número de teléfono</span>
                </div>
              </div>

              <div style={s.verifyNote}>
                <strong>Tus datos están seguros.</strong> Stripe utiliza encriptación de grado bancario.
                Chill N Go International LLC nunca almacena tus documentos — Stripe los procesa directamente.
              </div>

              <button onClick={startIdentityVerification} style={s.btn} disabled={loading}>
                {loading ? 'Iniciando verificación...' : 'Verificar mi identidad'}
              </button>

              <button
                onClick={() => onComplete(email)}
                style={{ ...s.btnSkip, marginTop: 12 }}
              >
                Verificar después (acceso limitado)
              </button>
              <p style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 6 }}>
                Sin verificación no podrás redimir Chilliums ni acceder a funciones financieras
              </p>
            </>
          )}

          {verificationStatus === 'pending' && (
            <>
              <div style={s.verifyIconWrap}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="26" stroke="#5DCAA5" strokeWidth="2" />
                  <path d="M20 28L26 34L38 22" stroke="#5DCAA5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 style={s.stepTitle}>Documentos enviados</h3>
              <p style={s.stepDesc}>
                Tu verificación está siendo procesada por Stripe. Esto puede tomar unos minutos.
                Te notificaremos por correo electrónico cuando esté lista.
              </p>

              <div style={s.verifyNote}>
                Ya puedes acceder a tu cuenta. Algunas funciones como redimir Chilliums
                estarán disponibles una vez que tu verificación sea aprobada.
              </div>

              <button onClick={() => onComplete(email)} style={s.btn}>
                Ir a mi cuenta CNG+
              </button>
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <div style={s.verifyIconWrap}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="26" stroke="#E24B4A" strokeWidth="2" />
                  <path d="M22 22L34 34M34 22L22 34" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 style={s.stepTitle}>Hubo un problema</h3>
              <p style={s.stepDesc}>
                No se pudo completar la verificación. Puedes intentarlo de nuevo
                o verificar tu identidad más tarde desde tu perfil.
              </p>

              {error && <div style={s.error}>{error}</div>}

              <button onClick={() => { setVerificationStatus(null); setError(''); }} style={s.btn}>
                Intentar de nuevo
              </button>

              <button
                onClick={() => onComplete(email)}
                style={{ ...s.btnSkip, marginTop: 12 }}
              >
                Continuar sin verificar (acceso limitado)
              </button>
            </>
          )}
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
  subStepLabel: { fontSize: 10, color: '#888' },
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
  stepContent: {},
  stepTitle: { fontSize: 18, fontWeight: 600, color: '#f1efe8', marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  fieldRow: { display: 'flex', gap: 12, marginBottom: 16 },
  label: { fontSize: 13, color: '#999', fontWeight: 500 },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 14,
    color: '#f1efe8',
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
    color: '#f1efe8',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: { fontSize: 11, color: '#666', marginTop: 4 },
  phoneRow: { display: 'flex', gap: 8 },
  navRow: { display: 'flex', gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    background: 'linear-gradient(135deg, #1D9E75, #0F6E56)',
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  btnBack: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '14px 20px',
    fontSize: 13,
    color: '#888',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSkip: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '12px',
    fontSize: 13,
    color: '#888',
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
  summaryLabel: { color: '#888' },
  summaryValue: { color: '#f1efe8', fontWeight: 500, textAlign: 'right' },
  legalSection: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 },
  checkbox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  },
  checkLabel: { fontSize: 13, color: '#999', lineHeight: 1.5 },
  link: { color: '#5DCAA5', textDecoration: 'none' },
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
    color: '#5DCAA5',
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