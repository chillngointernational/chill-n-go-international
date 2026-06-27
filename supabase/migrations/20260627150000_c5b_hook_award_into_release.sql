-- C-5b: engancha el reparto de Chilliums dentro de rpc_release_order_payout, NO-FATAL.
-- El award solo se alcanza en el primer release (released_at era null) y solo actúa si
-- chilliums_awarded=false. Si el award falla, el bloque EXCEPTION evita revertir/atorar la
-- liberación del DINERO; queda chilliums_awarded=false y reintetable (C-5c).
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

  -- C-5: reparto de Chilliums (NO-FATAL). Un fallo NO revierte ni atora la liberación del dinero.
  begin
    perform public.rpc_award_order_chilliums(p_order_id);
  exception when others then
    raise warning '[release] award chilliums fallo para % (reintetable): %', p_order_id, sqlerrm;
  end;

  return 'released';
end $function$;
