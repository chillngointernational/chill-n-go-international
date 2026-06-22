-- 1c-5 — RPC atómico e idempotente para aplicar el pago de la CUOTA de verificación de vendedor.
-- ADITIVA. NO toca la membresía (subscriptions, mp_processed_events, rpc_apply_mp_subscription_event).
-- La tabla seller_verification_payments y las columnas sellers.verification_fee_paid /
-- verification_attempts YA existen (1c-1). Aquí solo se agrega la función.
--
-- Lo llama el webhook dedicado (cng-mp-seller-fee-webhook) DESPUÉS de validar HMAC y de
-- confirmar contra GET /v1/payments/{id} que el pago está 'approved' y que el monto/usuario
-- coinciden. La idempotencia es a nivel de fila (el ciclo): el flip de flags ocurre EXACTAMENTE
-- una vez aunque MP reentregue la notificación.

CREATE OR REPLACE FUNCTION public.rpc_apply_seller_fee_payment(
  p_payment_row_id uuid,    -- external_reference = seller_verification_payments.id (el ciclo)
  p_mp_payment_id  text,    -- id real del pago en MP (auditoría)
  p_status         text     -- estado MP normalizado: 'approved' | 'rejected' | 'cancelled' | otro
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_row_status text;
BEGIN
  -- Localiza y BLOQUEA la fila del ciclo (serializa entregas concurrentes de MP).
  SELECT user_id, status INTO v_user_id, v_row_status
  FROM public.seller_verification_payments
  WHERE id = p_payment_row_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'unknown_payment';   -- external_reference desconocido -> ignorar (no es nuestro)
  END IF;

  -- Ya pagada: idempotente. Nunca re-aplica ni degrada un ciclo pagado.
  IF v_row_status = 'paid' THEN
    RETURN 'duplicate';
  END IF;

  IF p_status = 'approved' THEN
    -- 1) Auditoría: marca el pago del ciclo como pagado.
    UPDATE public.seller_verification_payments
    SET status = 'paid', mp_payment_id = p_mp_payment_id, paid_at = now()
    WHERE id = p_payment_row_id;

    -- 2) Activa el ciclo: cuota pagada + reinicia intentos (nuevo ciclo de 3).
    UPDATE public.sellers
    SET verification_fee_paid = true,
        verification_attempts = 0,
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN 'paid';

  ELSIF p_status IN ('rejected', 'cancelled') THEN
    -- Pago terminal negativo (solo desde 'pending'): marca fallido. NO toca sellers.
    UPDATE public.seller_verification_payments
    SET status = 'failed', mp_payment_id = COALESCE(p_mp_payment_id, mp_payment_id)
    WHERE id = p_payment_row_id;

    RETURN 'failed';

  ELSE
    -- pending / in_process / otros: no cambiar nada; MP volverá a notificar al aprobar.
    RETURN 'noop';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_seller_fee_payment(uuid, text, text) TO service_role;
