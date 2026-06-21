-- mp_subscriptions — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- Cobro de membresía con Mercado Pago (preapproval / suscripción). SOLO cobro + activación.
-- NO reparte Chilliums (los Chilliums son exclusivos de compras del marketplace).
-- Gating: identity_profiles.membership_status pasa de 'pending' a 'active' al pagar.
-- Idempotente.

-- 1) Suscripciones (estado MP por usuario)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.identity_profiles(user_id) ON DELETE CASCADE,
  mp_preapproval_id  text UNIQUE,
  status             text NOT NULL DEFAULT 'pending',
  amount_cents       integer NOT NULL DEFAULT 14000,   -- 140.00 MXN
  currency           text NOT NULL DEFAULT 'MXN',
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sin policies de escritura: solo el service_role (edge functions) escribe.

-- 2) Idempotencia de notificaciones de MP
CREATE TABLE IF NOT EXISTS public.mp_processed_events (
  id            text PRIMARY KEY,        -- id de la notificación de MP
  topic         text,
  preapproval_id text,
  received_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  outcome       jsonb
);
ALTER TABLE public.mp_processed_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role (bypassa RLS) accede.

-- 3) Grants (las tablas nuevas no heredan automáticamente; otorgo explícito)
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.mp_processed_events TO service_role;

-- 4) RPC atómico e idempotente: aplica un evento de MP en una sola transacción
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
  v_membership text;
BEGIN
  -- Idempotencia: si esta notificación ya se procesó, salir sin efectos.
  INSERT INTO public.mp_processed_events (id, topic, preapproval_id)
  VALUES (p_event_id, p_topic, p_preapproval_id)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN 'duplicate';
  END IF;

  -- Mapear estado MP -> membership_status (pending u otros: no cambiar la membresía)
  v_membership := CASE
    WHEN p_status = 'authorized' THEN 'active'
    WHEN p_status IN ('cancelled', 'paused') THEN 'cancelled'
    ELSE NULL
  END;

  -- Upsert de la suscripción
  IF p_preapproval_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, mp_preapproval_id, status, updated_at)
    VALUES (p_user_id, p_preapproval_id, p_status, now())
    ON CONFLICT (mp_preapproval_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = now();
  END IF;

  -- Aplicar gating en identity_profiles
  IF v_membership IS NOT NULL AND p_user_id IS NOT NULL THEN
    UPDATE public.identity_profiles
    SET membership_status = v_membership, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  UPDATE public.mp_processed_events
  SET completed_at = now(),
      outcome = jsonb_build_object('status', 'ok', 'mp_status', p_status, 'membership', v_membership)
  WHERE id = p_event_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_mp_subscription_event(text,text,text,uuid,text,jsonb) TO service_role;
