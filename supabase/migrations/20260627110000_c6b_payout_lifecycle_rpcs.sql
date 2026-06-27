-- C-6b: RPCs de envío/entrega/confirmación/liberación. SECURITY DEFINER, atómicas, idempotentes.
-- Reusa wallet_accounts/wallet_ledger (C-4) + platform_treasury/treasury_ledger (C-6a). Solo service_role.
-- NO enciende retiro real al banco. p_actor_id = identity_profiles.id (seller=stores.owner_id, buyer=orders.buyer_id).

-- 1) VENDEDOR marca enviado: paid -> shipped, guarda tracking (coalesce: null no borra).
create or replace function public.rpc_mark_shipped(
  p_order_id uuid, p_actor_id uuid,
  p_tracking_number text default null, p_tracking_carrier text default null,
  p_tracking_url text default null, p_shipping_label_url text default null
) returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_status text; v_store uuid; v_owner uuid;
begin
  select status, store_id into v_status, v_store from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  select owner_id into v_owner from public.stores where id=v_store;
  if p_actor_id is null or v_owner is distinct from p_actor_id then return 'forbidden'; end if;
  if v_status='shipped' then return 'already_shipped'; end if;
  if v_status<>'paid' then return 'bad_status'; end if;
  update public.orders set status='shipped', shipped_at=now(),
     tracking_number   = coalesce(p_tracking_number, tracking_number),
     tracking_carrier  = coalesce(p_tracking_carrier, tracking_carrier),
     tracking_url      = coalesce(p_tracking_url, tracking_url),
     shipping_label_url= coalesce(p_shipping_label_url, shipping_label_url),
     updated_at=now()
   where id=p_order_id;
  return 'shipped';
end $function$;

-- 2) Puente/admin/futuro webhook Envia: shipped -> delivered. (sin actor: el edge es admin/webhook)
create or replace function public.rpc_mark_delivered(p_order_id uuid)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_status text;
begin
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if v_status='delivered' then return 'already_delivered'; end if;
  if v_status<>'shipped' then return 'bad_status'; end if;
  update public.orders set status='delivered', delivered_at=now(), updated_at=now() where id=p_order_id;
  return 'delivered';
end $function$;

-- 3) NÚCLEO idempotente: pending->available del vendedor + wallet_ledger 'release' + colchón al tesoro + completed.
create or replace function public.rpc_release_order_payout(p_order_id uuid)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  v_status text; v_store uuid; v_fee numeric; v_released timestamptz;
  v_owner uuid; v_acct uuid; v_pending bigint; v_available bigint; v_held bigint;
  v_cushion_pct numeric; v_commission_cents bigint; v_cushion bigint; v_reserve bigint;
begin
  select status, store_id, platform_fee, released_at
    into v_status, v_store, v_fee, v_released
  from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if v_released is not null or v_status in ('completed','refunded','cancelled') then return 'duplicate'; end if;
  if v_status not in ('shipped','delivered') then return 'bad_status'; end if;

  -- Retenido de ESTE pedido (neto: sale_hold menos refunds previos).
  select coalesce(sum(pending_delta),0) into v_held from public.wallet_ledger where order_id=p_order_id;
  if v_held <= 0 then return 'nothing_to_release'; end if;

  select owner_id into v_owner from public.stores where id=v_store;
  select id, pending_cents, available_cents into v_acct, v_pending, v_available
    from public.wallet_accounts where owner_id=v_owner for update;
  if not found then return 'no_wallet'; end if;
  if v_held > v_pending then return 'wallet_anomaly'; end if; -- nunca pending negativo

  v_pending := v_pending - v_held;
  v_available := v_available + v_held;
  update public.wallet_accounts set pending_cents=v_pending, available_cents=v_available, updated_at=now() where id=v_acct;
  insert into public.wallet_ledger(account_id, order_id, type, pending_delta, available_delta, pending_after, available_after, description)
  values (v_acct, p_order_id, 'release', -v_held, v_held, v_pending, v_available, 'Liberación al vendedor');

  -- Colchón de dinero (de la comisión; default 0 = nada).
  select money_cushion_pct into v_cushion_pct from public.platform_config where id=true;
  v_commission_cents := round(coalesce(v_fee,0) * 100)::bigint;
  v_cushion := round(v_commission_cents * coalesce(v_cushion_pct,0) / 100.0)::bigint;
  if v_cushion > 0 then
    update public.platform_treasury set money_reserve_cents = money_reserve_cents + v_cushion, updated_at=now()
      where id=true returning money_reserve_cents into v_reserve;
    insert into public.treasury_ledger(order_id, asset, type, amount, balance_after, description)
    values (p_order_id, 'money', 'cushion_accrual', v_cushion, v_reserve, 'Colchón de comisión al liberar');
  end if;

  update public.orders set status='completed', released_at=now(), updated_at=now() where id=p_order_id;
  return 'released';
end $function$;

-- 4) COMPRADOR confirma -> release inmediato.
create or replace function public.rpc_buyer_confirm_receipt(p_order_id uuid, p_actor_id uuid)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_status text; v_buyer uuid; v_res text;
begin
  select status, buyer_id into v_status, v_buyer from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if p_actor_id is null or v_buyer is distinct from p_actor_id then return 'forbidden'; end if;
  if v_status in ('completed','refunded','cancelled') then return 'duplicate'; end if;
  if v_status not in ('shipped','delivered') then return 'bad_status'; end if;
  update public.orders set buyer_confirmed_at=now(), updated_at=now() where id=p_order_id;
  select public.rpc_release_order_payout(p_order_id) into v_res;
  return v_res;
end $function$;

-- Permisos: solo service_role (los edges autenticados las invocan).
revoke execute on function public.rpc_mark_shipped(uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.rpc_mark_delivered(uuid) from public, anon, authenticated;
revoke execute on function public.rpc_release_order_payout(uuid) from public, anon, authenticated;
revoke execute on function public.rpc_buyer_confirm_receipt(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rpc_mark_shipped(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.rpc_mark_delivered(uuid) to service_role;
grant execute on function public.rpc_release_order_payout(uuid) to service_role;
grant execute on function public.rpc_buyer_confirm_receipt(uuid,uuid) to service_role;
