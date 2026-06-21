-- verificamex_identity — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- Verificación de identidad (Verificamex, flujo HOSPEDADO VerificationSession).
-- Activación: identidad verificada ANTES del pago; membership_status='active' SOLO si
-- identity_verification_status='verified' Y suscripción autorizada.
-- PRIVACIDAD: guardamos solo resultado + CURP + datos mínimos. NUNCA imágenes (INE/selfie).
-- Idempotente.

-- 1) Columnas de verificación en identity_profiles
ALTER TABLE public.identity_profiles
  ADD COLUMN IF NOT EXISTS identity_verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS curp text;

-- Grandfather: cuentas YA activas (FUNDADOR, etc.) quedan 'verified' para no degradarlas.
UPDATE public.identity_profiles
  SET identity_verification_status = 'verified'
  WHERE membership_status = 'active' AND identity_verification_status <> 'verified';

-- 2) Auditoría de verificaciones (un row por sesión). RLS: el usuario lee lo suyo.
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.identity_profiles(user_id) ON DELETE CASCADE,
  provider      text NOT NULL DEFAULT 'verificamex',
  session_id    text UNIQUE,
  status        text NOT NULL DEFAULT 'OPEN',
  result        integer,
  ine_status    boolean,
  renapo_status boolean,
  curp          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id ON public.identity_verifications(user_id);

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS identity_verifications_select_own ON public.identity_verifications;
CREATE POLICY identity_verifications_select_own ON public.identity_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sin policies de escritura: solo service_role (edge functions) escribe.

-- 3) Idempotencia del webhook de Verificamex
CREATE TABLE IF NOT EXISTS public.verificamex_processed_events (
  id           text PRIMARY KEY,   -- session_id:status
  session_id   text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome      jsonb
);
ALTER TABLE public.verificamex_processed_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role.

-- 4) Grants
GRANT SELECT ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
GRANT ALL ON public.verificamex_processed_events TO service_role;

-- 5) Recalcular membresía: 'active' SOLO si verificado Y pagado (suscripción autorizada).
--    Solo lo invocan los webhooks (MP / Verificamex) para el usuario en flujo.
--    No se ejecuta para cuentas que no entran a esos flujos (FUNDADOR no se toca).
CREATE OR REPLACE FUNCTION public._recompute_membership(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean;
  v_paid boolean;
  v_has_cancel boolean;
  v_cur text;
  v_new text;
BEGIN
  SELECT (identity_verification_status = 'verified'), membership_status
    INTO v_verified, v_cur
    FROM public.identity_profiles WHERE user_id = p_user_id;
  IF v_cur IS NULL THEN RETURN; END IF;  -- sin perfil

  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status = 'authorized')
    INTO v_paid;
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status IN ('cancelled','paused'))
    INTO v_has_cancel;

  IF v_paid AND v_verified THEN
    v_new := 'active';
  ELSIF v_has_cancel AND NOT v_paid THEN
    v_new := 'cancelled';
  ELSE
    v_new := 'pending';
  END IF;

  IF v_new <> v_cur THEN
    UPDATE public.identity_profiles SET membership_status = v_new, updated_at = now() WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 6) Aplicar resultado de Verificamex (atómico + idempotente)
CREATE OR REPLACE FUNCTION public.rpc_apply_identity_verification(
  p_event_id   text,
  p_session_id text,
  p_user_id    uuid,
  p_status     text,
  p_result     integer,
  p_ine        boolean,
  p_renapo     boolean,
  p_curp       text,
  p_raw        jsonb DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_verified boolean;
  v_idstatus text;
BEGIN
  INSERT INTO public.verificamex_processed_events (id, session_id)
  VALUES (p_event_id, p_session_id)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RETURN 'duplicate'; END IF;

  v_verified := (p_status = 'FINISHED' AND p_result = 100 AND p_ine IS TRUE AND p_renapo IS TRUE);
  v_idstatus := CASE
    WHEN v_verified THEN 'verified'
    WHEN p_status IN ('OPEN','VERIFYING') THEN 'processing'
    ELSE 'failed'
  END;

  IF p_session_id IS NOT NULL THEN
    UPDATE public.identity_verifications
      SET status = p_status, result = p_result, ine_status = p_ine, renapo_status = p_renapo,
          curp = COALESCE(p_curp, curp), updated_at = now(),
          completed_at = CASE WHEN p_status IN ('FINISHED','FAILED') THEN now() ELSE completed_at END
      WHERE session_id = p_session_id;
  END IF;

  IF p_user_id IS NOT NULL THEN
    UPDATE public.identity_profiles
      SET identity_verification_status = v_idstatus,
          identity_verified_at = CASE WHEN v_verified THEN now() ELSE identity_verified_at END,
          curp = COALESCE(p_curp, curp),
          updated_at = now()
      WHERE user_id = p_user_id;
    PERFORM public._recompute_membership(p_user_id);
  END IF;

  UPDATE public.verificamex_processed_events
    SET completed_at = now(),
        outcome = jsonb_build_object('status', p_status, 'verified', v_verified, 'id_status', v_idstatus)
    WHERE id = p_event_id;

  RETURN v_idstatus;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_identity_verification(text,text,uuid,text,integer,boolean,boolean,text,jsonb) TO service_role;

-- 7) Actualizar el RPC de MP: el pago YA NO activa solo; ahora delega en _recompute_membership
--    (que exige verificación + pago). Misma firma -> reemplazo limpio.
CREATE OR REPLACE FUNCTION public.rpc_apply_mp_subscription_event(
  p_event_id       text,
  p_topic          text,
  p_preapproval_id text,
  p_user_id        uuid,
  p_status         text,
  p_raw            jsonb DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.mp_processed_events (id, topic, preapproval_id)
  VALUES (p_event_id, p_topic, p_preapproval_id)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RETURN 'duplicate'; END IF;

  IF p_preapproval_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, mp_preapproval_id, status, updated_at)
    VALUES (p_user_id, p_preapproval_id, p_status, now())
    ON CONFLICT (mp_preapproval_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = now();
  END IF;

  -- Activación combinada: verificado + pagado. No activa por pago solo.
  IF p_user_id IS NOT NULL THEN
    PERFORM public._recompute_membership(p_user_id);
  END IF;

  UPDATE public.mp_processed_events
    SET completed_at = now(), outcome = jsonb_build_object('status', 'ok', 'mp_status', p_status)
    WHERE id = p_event_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_mp_subscription_event(text,text,text,uuid,text,jsonb) TO service_role;
