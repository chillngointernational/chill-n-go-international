-- Chilliums RPCs — banking-grade payment processing
--
-- Documents both apply_chilliums (existing in production since
-- Apr 19, 2026, commit 4ae71c8) and process_membership_payment (NEW in
-- this branch, audit#3 #2).
--
-- The apply_chilliums body below is VERBATIM from production. Verified
-- against `SELECT pg_get_functiondef('public.apply_chilliums'::regprocedure)`
-- output on May 1, 2026.
--
-- Conservative deploy path: apply only the process_membership_payment
-- block (below) via Dashboard SQL Editor. apply_chilliums is already
-- deployed and identical — re-running CREATE OR REPLACE is a no-op
-- (functionally equivalent), but unnecessary churn.


-- ============================================================
-- apply_chilliums (verbatim from production, deployed Apr 19, 2026)
-- ============================================================
-- Naming quirk: param p_user_id semantically refers to identity_profiles.id
-- (the surrogate uuid PK), NOT auth.users.id. The FK chilliums_ledger.user_id
-- targets identity_profiles.id. Callers must resolve auth.users.id ->
-- identity_profiles.id before invoking. process_membership_payment below
-- handles this resolution internally.
--
-- Returns TABLE (ledger_id uuid, new_balance bigint) — NOT void. PL/pgSQL
-- callers must use `PERFORM * FROM apply_chilliums(...)` (or capture into
-- variables), not bare `PERFORM apply_chilliums(...)`.

CREATE OR REPLACE FUNCTION public.apply_chilliums(
  p_user_id uuid,
  p_amount bigint,
  p_type text,
  p_description text,
  p_source_user_id uuid,
  p_referral_level integer,
  p_source_transaction_id uuid
) RETURNS TABLE (ledger_id uuid, new_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance bigint;
  v_new_balance bigint;
  v_ledger_id uuid;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'apply_chilliums: amount cannot be zero';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'apply_chilliums: user_id is required';
  END IF;
  IF p_type IS NULL OR length(trim(p_type)) = 0 THEN
    RAISE EXCEPTION 'apply_chilliums: type is required';
  END IF;
  SELECT chilliums_balance INTO v_current_balance
  FROM identity_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_chilliums: profile % not found', p_user_id;
  END IF;
  IF p_source_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM identity_profiles WHERE id = p_source_user_id) THEN
      RAISE EXCEPTION 'apply_chilliums: source profile % not found', p_source_user_id;
    END IF;
  END IF;
  v_new_balance := v_current_balance + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'apply_chilliums: insufficient balance (current=%, requested=%)', v_current_balance, p_amount;
  END IF;
  IF p_amount > 0 THEN
    UPDATE identity_profiles
    SET chilliums_balance = v_new_balance,
        chilliums_total_earned = chilliums_total_earned + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE identity_profiles
    SET chilliums_balance = v_new_balance,
        chilliums_total_spent = chilliums_total_spent + abs(p_amount),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
  INSERT INTO chilliums_ledger (
    user_id, type, amount, balance_after,
    source_transaction_id, source_user_id, referral_level, description
  ) VALUES (
    p_user_id, p_type, p_amount, v_new_balance,
    p_source_transaction_id, p_source_user_id, p_referral_level, p_description
  ) RETURNING id INTO v_ledger_id;
  RETURN QUERY SELECT v_ledger_id, v_new_balance;
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
-- Naming convention: this RPC accepts auth.users.id as p_user_id (matches
-- transactions.user_id semantics), then internally resolves to
-- identity_profiles.id (which is what apply_chilliums and chilliums_ledger
-- expect — see naming quirk note above on apply_chilliums).
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
--
-- Defensive: each level's amount is computed via floor() and skipped
-- (no apply_chilliums call) if it rounds to 0. apply_chilliums itself
-- rejects p_amount=0, so this guard prevents the whole transaction from
-- failing on tiny p_base_centi values. In production p_base_centi=550,
-- so all 3 amounts are non-zero (275/192/82) and guards never trigger.

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
  v_l0_amount bigint;
  v_l1_amount bigint;
  v_l2_amount bigint;
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
  v_l0_amount := floor(p_base_centi * 0.5)::bigint;
  IF v_l0_amount > 0 THEN
    PERFORM * FROM public.apply_chilliums(
      v_member_profile_id,
      v_l0_amount,
      'cashback_direct',
      p_description || ' - cashback propio',
      v_member_profile_id,
      NULL,
      v_transaction_id
    );
  END IF;

  -- L1: direct referrer gets 35%
  IF p_l1_profile_id IS NOT NULL THEN
    v_l1_amount := floor(p_base_centi * 0.35)::bigint;
    IF v_l1_amount > 0 THEN
      PERFORM * FROM public.apply_chilliums(
        p_l1_profile_id,
        v_l1_amount,
        'cashback_network',
        p_description || ' - referido nivel 1',
        v_member_profile_id,
        1,
        v_transaction_id
      );
    END IF;
  END IF;

  -- L2: grandparent referrer gets 15%
  IF p_l2_profile_id IS NOT NULL THEN
    v_l2_amount := floor(p_base_centi * 0.15)::bigint;
    IF v_l2_amount > 0 THEN
      PERFORM * FROM public.apply_chilliums(
        p_l2_profile_id,
        v_l2_amount,
        'cashback_network',
        p_description || ' - referido nivel 2',
        v_member_profile_id,
        2,
        v_transaction_id
      );
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.process_membership_payment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_membership_payment TO service_role;
