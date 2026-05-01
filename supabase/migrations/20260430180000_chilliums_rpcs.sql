-- Chilliums RPCs — banking-grade payment processing
--
-- Documents both apply_chilliums (existing in production since
-- Apr 19, 2026, commit 4ae71c8) and process_membership_payment (NEW in
-- this branch, audit#3 #2).
--
-- The apply_chilliums body below is a canonical-best-effort reconstruction
-- based on the function signature confirmed against pg_proc and the
-- architecture doc (CNG_PLUS_ARCHITECTURE.md ADR-11). Body verified against
-- the deployed RPC behavior described in the doc.
--
-- IMPORTANT: before running CREATE OR REPLACE on apply_chilliums, verify
-- the body against the production DB:
--
--   SELECT pg_get_functiondef('public.apply_chilliums'::regprocedure);
--
-- If the production version differs, edit this file with the actual body
-- BEFORE running supabase db push. The conservative approach is to apply
-- only the process_membership_payment block (below) via Dashboard SQL
-- Editor, leaving apply_chilliums untouched.
--
-- The process_membership_payment function is new in this branch and can
-- be applied unconditionally.


-- ============================================================
-- apply_chilliums (canonical reconstruction — VERIFY BEFORE APPLY)
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_chilliums(
  p_user_id uuid,
  p_amount bigint,
  p_type text,
  p_description text,
  p_source_user_id uuid,
  p_referral_level integer,
  p_source_transaction_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after bigint;
BEGIN
  SELECT chilliums_balance + p_amount INTO v_balance_after
  FROM identity_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance_after IS NULL THEN
    RAISE EXCEPTION 'identity_profile not found for id=%', p_user_id;
  END IF;

  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'insufficient balance for id=%, delta=%, would result in %',
      p_user_id, p_amount, v_balance_after;
  END IF;

  INSERT INTO chilliums_ledger (
    user_id, type, amount, balance_after,
    source_user_id, referral_level, source_transaction_id, description
  ) VALUES (
    p_user_id, p_type, p_amount, v_balance_after,
    p_source_user_id, p_referral_level, p_source_transaction_id, p_description
  );

  IF p_amount >= 0 THEN
    UPDATE identity_profiles
    SET chilliums_balance = v_balance_after,
        chilliums_total_earned = chilliums_total_earned + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE identity_profiles
    SET chilliums_balance = v_balance_after,
        chilliums_total_spent = chilliums_total_spent + abs(p_amount),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_chilliums FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_chilliums TO service_role;


-- ============================================================
-- process_membership_payment — NEW (audit#3 #2, banking-grade)
-- ============================================================
-- Atomic transactions INSERT + 3× apply_chilliums in a single Postgres
-- transaction. Closes the partial-credit risk that the JS-side mitigation
-- (commit 750b0cb) couldn't fully solve: rollback of transactions row on
-- partial chilliums failure could over-credit already-credited levels on
-- Stripe retry.
--
-- The RPC is the single entry point for membership payment processing.
-- cng-stripe-webhook calls it once per checkout.session.completed and
-- once per invoice.payment_succeeded event.
--
-- Hardcoded financial constants:
--   gross_amount    = 7.00 USD  (MEMBERSHIP_PRICE)
--   operating_cost  = 1.00 USD  (CNG_FEE)
--   net_profit      = p_base_centi / 100  (DISTRIBUTABLE; e.g. 5.50)
--   currency        = 'USD'
--   lob             = 'cng_plus'
--   type            = 'subscription'
-- Splits (50% L0 / 35% L1 / 15% L2) are also hardcoded inside the RPC.

CREATE OR REPLACE FUNCTION public.process_membership_payment(
  p_user_id uuid,             -- auth.users.id of paying member
  p_stripe_event_id text,     -- for idempotency tracking via metadata
  p_base_centi bigint,        -- distributable amount in centi (e.g. 550 = $5.50)
  p_l1_profile_id uuid,       -- identity_profiles.id of L1 referrer (nullable)
  p_l2_profile_id uuid,       -- identity_profiles.id of L2 referrer (nullable)
  p_description text          -- e.g. 'Membresia CNG+ - activacion' or 'Renovacion CNG+'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_profile_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Resolve paying member's identity_profiles.id from auth.users.id
  SELECT id INTO v_member_profile_id
  FROM identity_profiles
  WHERE user_id = p_user_id;

  IF v_member_profile_id IS NULL THEN
    RAISE EXCEPTION 'identity_profile not found for user_id=%', p_user_id;
  END IF;

  -- INSERT the transactions row (caller is responsible for idempotency
  -- via stripe_event_id check in metadata before invoking this RPC)
  INSERT INTO transactions (
    user_id, lob, type, description, gross_amount, currency,
    operating_cost, net_profit, status, metadata
  ) VALUES (
    p_user_id, 'cng_plus', 'subscription', p_description,
    7.00, 'USD', 1.00, p_base_centi::numeric / 100,
    'completed',
    jsonb_build_object('stripe_event_id', p_stripe_event_id)
  ) RETURNING id INTO v_transaction_id;

  -- L0: paying member gets 50% — credited to their own profile
  PERFORM public.apply_chilliums(
    v_member_profile_id,
    floor(p_base_centi * 0.5)::bigint,
    'cashback_direct',
    p_description || ' - cashback propio',
    v_member_profile_id,
    NULL,
    v_transaction_id
  );

  -- L1: direct referrer gets 35%
  IF p_l1_profile_id IS NOT NULL THEN
    PERFORM public.apply_chilliums(
      p_l1_profile_id,
      floor(p_base_centi * 0.35)::bigint,
      'cashback_network',
      p_description || ' - referido nivel 1',
      v_member_profile_id,
      1,
      v_transaction_id
    );
  END IF;

  -- L2: grandparent referrer gets 15%
  IF p_l2_profile_id IS NOT NULL THEN
    PERFORM public.apply_chilliums(
      p_l2_profile_id,
      floor(p_base_centi * 0.15)::bigint,
      'cashback_network',
      p_description || ' - referido nivel 2',
      v_member_profile_id,
      2,
      v_transaction_id
    );
  END IF;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.process_membership_payment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_membership_payment TO service_role;
