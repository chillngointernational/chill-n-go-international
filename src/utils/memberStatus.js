// Helpers to derive the member's registration state from an identity_profiles row.
// A member is only "fully_active" when all three gates pass:
//   - payment_status === 'active'  (set by cng-stripe-webhook on payment)
//   - identity_verification_status === 'verified'  (set by cng-identity-webhook on KYC pass)
//   - registration_completed === true  (set by cng-identity-webhook on KYC pass)
// Anything else is an intermediate state that the Dashboard surfaces with a recovery CTA.

export function isFullyActive(member) {
  return (
    member?.payment_status === 'active' &&
    member?.identity_verification_status === 'verified' &&
    member?.registration_completed === true
  )
}

export function isPaymentPending(member) {
  return member?.payment_status !== 'active'
}

export function isKycPending(member) {
  return (
    member?.identity_verification_status === 'pending' ||
    member?.identity_verification_status === 'processing'
  )
}

export function isKycFailed(member) {
  return member?.identity_verification_status === 'failed'
}

export function getMemberState(member) {
  if (!member) return 'payment_pending'
  if (member.payment_status !== 'active') return 'payment_pending'
  if (
    member.identity_verification_status === 'verified' &&
    member.registration_completed === true
  ) {
    return 'fully_active'
  }
  if (member.identity_verification_status === 'failed') return 'kyc_failed'
  if (
    member.identity_verification_status === 'pending' ||
    member.identity_verification_status === 'processing'
  ) {
    return 'kyc_pending'
  }
  return 'kyc_not_started'
}
