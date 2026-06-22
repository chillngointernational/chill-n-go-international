-- activation_paid_first_db (sub-paso 1) — base DB para invertir el flujo a PAGO -> VERIFICACIÓN.
-- ADITIVA y reversible. NO cambia la regla de 'active' (= pagado-o-cortesía Y verificado),
-- solo expone "pagó" en el perfil, agrega un flag de cortesía (grandfather) para cuentas
-- fundador/comp, y guarda evidencia de consentimiento de pago.

-- 1) Señal de pago en el perfil (la lee el frontend para el orden pago->verificación).
ALTER TABLE public.identity_profiles
  ADD COLUMN IF NOT EXISTS membership_paid boolean NOT NULL DEFAULT false;

-- 2) Flag de cortesía (fundador/comp): cuenta como "pagado" sin suscripción. NO lo obtienen
--    usuarios nuevos (solo se siembra abajo para cuentas ya activas sin suscripción).
ALTER TABLE public.identity_profiles
  ADD COLUMN IF NOT EXISTS membership_override boolean NOT NULL DEFAULT false;

-- 3) GRANDFATHER: cuentas que HOY están 'active' pero NO tienen suscripción 'authorized'
--    (FUNDADOR y cuentas comp) -> marcarlas cortesía para que _recompute nunca las degrade.
UPDATE public.identity_profiles ip
  SET membership_override = true
  WHERE ip.membership_status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = ip.user_id AND s.status = 'authorized'
    );

-- 4) Backfill de membership_paid: pago confirmado ('authorized') O cortesía.
UPDATE public.identity_profiles ip
  SET membership_paid = membership_override OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = ip.user_id AND s.status = 'authorized'
  );

-- 5) _recompute_membership: misma regla de 'active' (pagado-o-cortesía Y verificado),
--    ahora también persiste membership_paid. Se actualiza aunque membership_status no
--    cambie (caso clave del nuevo flujo: pagó pero aún no verifica). La cortesía evita
--    degradar fundador/comp a 'pending'.
CREATE OR REPLACE FUNCTION public._recompute_membership(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_verified boolean;
  v_paid boolean;
  v_override boolean;
  v_has_cancel boolean;
  v_cur text;
  v_new text;
BEGIN
  SELECT (identity_verification_status = 'verified'), membership_status, membership_override
    INTO v_verified, v_cur, v_override
    FROM public.identity_profiles WHERE user_id = p_user_id;
  IF v_cur IS NULL THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status = 'authorized')
    INTO v_paid;
  v_paid := v_paid OR COALESCE(v_override, false);  -- cortesía cuenta como pagado

  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status IN ('cancelled','paused'))
    INTO v_has_cancel;

  IF v_paid AND v_verified THEN
    v_new := 'active';
  ELSIF v_has_cancel AND NOT v_paid THEN
    v_new := 'cancelled';
  ELSE
    v_new := 'pending';
  END IF;

  UPDATE public.identity_profiles
    SET membership_status = v_new,
        membership_paid = v_paid,
        updated_at = now()
    WHERE user_id = p_user_id
      AND (membership_status IS DISTINCT FROM v_new OR membership_paid IS DISTINCT FROM v_paid);
END;
$function$;

-- 6) CIERRE DE HUECO CRÍTICO (pre-existente): identity_profiles tenía GRANT de UPDATE a
--    nivel de TABLA para 'authenticated', y la RLS profiles_update_self solo valida
--    user_id = auth.uid() (no las columnas). Eso permitía a CUALQUIER usuario logueado,
--    desde el cliente, auto-activarse (membership_status='active'), auto-verificarse
--    (identity_verification_status='verified', sin INE ni tokens) y auto-regalarse
--    Chilliums, editando su propia fila. Restringimos el UPDATE de 'authenticated' a
--    SOLO columnas de perfil editables; lo sensible queda fuera (solo service_role lo
--    escribe vía edge functions). Único write del cliente hoy: avatar_url (ProfileScreen).
REVOKE UPDATE ON public.identity_profiles FROM authenticated;
GRANT UPDATE (
  avatar_url, bio, display_name, first_name, last_name, full_name, phone, country,
  accepted_terms, accepted_privacy
) ON public.identity_profiles TO authenticated;

-- 7) Evidencia de consentimiento de pago (no-reembolso). Solo service_role (RLS sin políticas).
CREATE TABLE IF NOT EXISTS public.payment_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  consent_text text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_consents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_consents TO service_role;
CREATE INDEX IF NOT EXISTS payment_consents_user_idx ON public.payment_consents(user_id);
