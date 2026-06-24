-- ESLABÓN faltante: gira sellers.status -> 'verified' cuando se cumplen los insumos.
-- Hoy SOLO para PERSONAS (individual). Las EMPRESAS quedan diseñadas pero PAUSADAS (falta RFC).
-- Idempotente, fail-closed, FOR UPDATE, y NUNCA lanza excepción (no puede tumbar al RPC que la llama).

-- ============================================================================
-- 1) RPC central (única fuente de verdad de la transición a 'verified').
-- ============================================================================
create or replace function public.rpc_finalize_seller_verification(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_seller_type text;
  v_status      text;
  v_fee_paid    boolean;
  v_terms       timestamptz;
  v_person_ok   boolean;
begin
  if p_user_id is null then
    return;
  end if;

  -- Bloquea la fila del vendedor (serializa entregas concurrentes de los webhooks).
  select seller_type, status, verification_fee_paid, accepted_seller_terms_at
    into v_seller_type, v_status, v_fee_paid, v_terms
  from public.sellers
  where user_id = p_user_id
  for update;

  -- No es vendedor (p.ej. un miembro normal que verifica identidad) -> no-op.
  if not found then
    return;
  end if;

  -- Idempotente / no pisar estados terminales ('verified' o 'rejected').
  if v_status not in ('draft', 'pending_verification') then
    return;
  end if;

  -- ===== EMPRESA: PAUSADA (falta validación de RFC) =====
  -- Documentado para ENCENDER cuando exista el RFC. La empresa girará a 'verified' si:
  --   v_fee_paid = true
  --   AND v_terms IS NOT NULL
  --   AND seller_fiscal_data.rep_legal_ine_verified = true   (rep. legal con INE)
  --   AND seller_fiscal_data.rfc_status = 'valid'            (RFC validado; aún NO se produce)
  -- Hoy se CORTOCIRCUITA: las empresas NO giran por este camino.
  if v_seller_type = 'company' then
    return;
  end if;

  -- ===== PERSONA (individual) =====
  if v_seller_type <> 'individual' then
    return;  -- fail-closed ante cualquier tipo inesperado
  end if;

  -- Insumo INE de la persona (mismo user_id; INE compartido).
  select (identity_verification_status = 'verified')
    into v_person_ok
  from public.identity_profiles
  where user_id = p_user_id;

  -- FAIL-CLOSED: gira SOLO si TODOS los insumos están presentes. Si falta uno, no hace nada.
  if coalesce(v_fee_paid, false)
     and v_terms is not null
     and coalesce(v_person_ok, false) then
    update public.sellers
       set status = 'verified', updated_at = now()
     where user_id = p_user_id;
  end if;

exception
  when others then
    -- NUNCA tumbar la transacción del RPC que nos llama: ante cualquier error, no giramos.
    return;
end;
$function$;

revoke execute on function public.rpc_finalize_seller_verification(uuid) from public, anon, authenticated;
grant  execute on function public.rpc_finalize_seller_verification(uuid) to service_role;

-- ============================================================================
-- 2) rpc_apply_seller_fee_payment: AÑADIR el PERFORM al final del camino 'approved'.
--    (idéntica al original + la llamada al eslabón; sin cambiar comportamiento previo.)
-- ============================================================================
create or replace function public.rpc_apply_seller_fee_payment(p_payment_row_id uuid, p_mp_payment_id text, p_status text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id    uuid;
  v_row_status text;
begin
  -- Localiza y BLOQUEA la fila del ciclo (serializa entregas concurrentes de MP).
  select user_id, status into v_user_id, v_row_status
  from public.seller_verification_payments
  where id = p_payment_row_id
  for update;

  if not found then
    return 'unknown_payment';   -- external_reference desconocido -> ignorar (no es nuestro)
  end if;

  -- Ya pagada: idempotente. Nunca re-aplica ni degrada un ciclo pagado.
  if v_row_status = 'paid' then
    return 'duplicate';
  end if;

  if p_status = 'approved' then
    -- 1) Auditoría: marca el pago del ciclo como pagado.
    update public.seller_verification_payments
    set status = 'paid', mp_payment_id = p_mp_payment_id, paid_at = now()
    where id = p_payment_row_id;

    -- 2) Activa el ciclo: cuota pagada + reinicia intentos (nuevo ciclo de 3).
    update public.sellers
    set verification_fee_paid = true,
        verification_attempts = 0,
        updated_at = now()
    where user_id = v_user_id;

    -- 3) ESLABÓN: intenta girar a 'verified' si ya están todos los insumos (idempotente, fail-closed).
    perform public.rpc_finalize_seller_verification(v_user_id);

    return 'paid';

  elsif p_status in ('rejected', 'cancelled') then
    -- Pago terminal negativo (solo desde 'pending'): marca fallido. NO toca sellers.
    update public.seller_verification_payments
    set status = 'failed', mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id)
    where id = p_payment_row_id;

    return 'failed';

  else
    -- pending / in_process / otros: no cambiar nada; MP volverá a notificar al aprobar.
    return 'noop';
  end if;
end;
$function$;

-- ============================================================================
-- 3) rpc_apply_identity_verification: AÑADIR el PERFORM tras verificar la persona.
--    (idéntica al original + la llamada al eslabón; no-op si el user no es seller.)
-- ============================================================================
create or replace function public.rpc_apply_identity_verification(p_event_id text, p_session_id text, p_user_id uuid, p_status text, p_result integer, p_ine boolean, p_renapo boolean, p_curp text, p_raw jsonb default null::jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
  v_verified boolean;
  v_idstatus text;
begin
  insert into public.verificamex_processed_events (id, session_id)
  values (p_event_id, p_session_id)
  on conflict (id) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then return 'duplicate'; end if;

  v_verified := (p_status = 'FINISHED' and p_result = 100 and p_ine is true and p_renapo is true);
  v_idstatus := case
    when v_verified then 'verified'
    when p_status in ('OPEN','VERIFYING') then 'processing'
    else 'failed'
  end;

  if p_session_id is not null then
    update public.identity_verifications
      set status = p_status, result = p_result, ine_status = p_ine, renapo_status = p_renapo,
          curp = coalesce(p_curp, curp), updated_at = now(),
          completed_at = case when p_status in ('FINISHED','FAILED') then now() else completed_at end
      where session_id = p_session_id;
  end if;

  if p_user_id is not null then
    update public.identity_profiles
      set identity_verification_status = v_idstatus,
          identity_verified_at = case when v_verified then now() else identity_verified_at end,
          curp = coalesce(p_curp, curp),
          updated_at = now()
      where user_id = p_user_id;
    perform public._recompute_membership(p_user_id);
    -- ESLABÓN: tras verificar la persona, intenta girar su cuenta de vendedor (no-op si no es seller).
    perform public.rpc_finalize_seller_verification(p_user_id);
  end if;

  update public.verificamex_processed_events
    set completed_at = now(),
        outcome = jsonb_build_object('status', p_status, 'verified', v_verified, 'id_status', v_idstatus)
    where id = p_event_id;

  return v_idstatus;
end;
$function$;

-- ============================================================================
-- 4) RE-ASEGURAR el cierre de seguridad de las dos funciones modificadas
--    (CREATE OR REPLACE conserva los grants, pero lo re-aplicamos como garantía).
-- ============================================================================
revoke execute on function public.rpc_apply_seller_fee_payment(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.rpc_apply_seller_fee_payment(uuid, text, text) to service_role;

revoke execute on function public.rpc_apply_identity_verification(text, text, uuid, text, integer, boolean, boolean, text, jsonb) from public, anon, authenticated;
grant  execute on function public.rpc_apply_identity_verification(text, text, uuid, text, integer, boolean, boolean, text, jsonb) to service_role;
