// Estado de membresía. El acceso de miembro se ACTIVA al pagar la suscripción
// (Mercado Pago, 140 MXN/mes). El alta por invitación crea el perfil con
// membership_status='pending'; el webhook de MP lo pasa a 'active' al primer pago.
// Mientras no esté 'active', el usuario ve la pantalla de suscripción.
//
// Los Chilliums NO se reparten por la membresía (son exclusivos de compras del marketplace).

export function isFullyActive(member) {
  return member?.membership_status === 'active'
}

export function isIdentityVerified(member) {
  return member?.identity_verification_status === 'verified'
}

// Paso actual del muro de activación: primero VERIFICAR identidad, luego PAGAR.
export function getActivationStep(member) {
  if (isFullyActive(member)) return 'done'
  if (!isIdentityVerified(member)) return 'verify'
  return 'pay'
}

export function getMemberState(member) {
  if (!member) return 'no_profile'
  if (member.membership_status === 'active') return 'active'
  if (!isIdentityVerified(member)) return 'pending_verification'
  return 'pending_payment'
}
