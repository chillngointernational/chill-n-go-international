-- C-6c: reembolso desde el FONDO (2 casos). SECURITY DEFINER, atómica, idempotente. Solo service_role.
-- Caso A (NO liberada): reclama el pending del vendedor -> fondo -> reembolso (neto fondo ≈ 0).
-- Caso B (YA liberada): vendedor INTACTO; reembolso del fondo; si no alcanza -> needs_admin (sin cambios).
-- Reembolso TOTAL (subtotal del pedido). El reembolso REAL en MP queda gated (no se mueve dinero real).
create or replace function public.rpc_refund_order(p_order_id uuid, p_reason text default null)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  v_status text; v_store uuid; v_subtotal numeric; v_released timestamptz; v_refunded timestamptz;
  v_refund bigint; v_owner uuid; v_acct uuid; v_pending bigint; v_available bigint; v_reserve bigint;
begin
  select status, store_id, subtotal, released_at, refunded_at
    into v_status, v_store, v_subtotal, v_released, v_refunded
  from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if v_refunded is not null or v_status in ('refunded','cancelled') then return 'duplicate'; end if;
  if v_status not in ('paid','shipped','delivered','completed','disputed') then return 'bad_status'; end if;

  v_refund := round(coalesce(v_subtotal,0) * 100)::bigint;
  if v_refund <= 0 then return 'nothing_to_refund'; end if;

  if v_released is null then
    -- ===== CASO A: NO liberada. Reclamar el pending del vendedor (la venta se anula) -> fondo -> reembolso.
    select owner_id into v_owner from public.stores where id=v_store;
    select id, pending_cents, available_cents into v_acct, v_pending, v_available
      from public.wallet_accounts where owner_id=v_owner for update;
    if not found then return 'no_wallet'; end if;
    if v_pending < v_refund then return 'wallet_anomaly'; end if; -- nunca pending negativo

    v_pending := v_pending - v_refund;
    update public.wallet_accounts set pending_cents=v_pending, updated_at=now() where id=v_acct;
    insert into public.wallet_ledger(account_id, order_id, type, pending_delta, available_delta, pending_after, available_after, description)
    values (v_acct, p_order_id, 'refund', -v_refund, 0, v_pending, v_available, 'Reclamo por devolución (orden anulada)');

    -- fondo: entra el reclamo (+) y sale el reembolso (-) -> neto ≈ 0
    update public.platform_treasury set money_reserve_cents = money_reserve_cents + v_refund, updated_at=now()
      where id=true returning money_reserve_cents into v_reserve;
    insert into public.treasury_ledger(order_id, asset, type, amount, balance_after, description)
    values (p_order_id, 'money', 'hold_reclaim', v_refund, v_reserve, 'Reclamo del pending retenido (caso A)');

    update public.platform_treasury set money_reserve_cents = money_reserve_cents - v_refund, updated_at=now()
      where id=true returning money_reserve_cents into v_reserve;
    insert into public.treasury_ledger(order_id, asset, type, amount, balance_after, description)
    values (p_order_id, 'money', 'refund_draw', -v_refund, v_reserve, 'Reembolso al comprador (caso A, neto 0)');

  else
    -- ===== CASO B: YA liberada. Vendedor INTACTO. Reembolso del fondo. Si no alcanza -> needs_admin.
    select money_reserve_cents into v_reserve from public.platform_treasury where id=true for update;
    if v_reserve < v_refund then
      return 'needs_admin'; -- atómico: aún no se escribió nada que cambie saldos
    end if;
    update public.platform_treasury set money_reserve_cents = money_reserve_cents - v_refund, updated_at=now()
      where id=true returning money_reserve_cents into v_reserve;
    insert into public.treasury_ledger(order_id, asset, type, amount, balance_after, description)
    values (p_order_id, 'money', 'refund_draw', -v_refund, v_reserve, 'Reembolso al comprador (caso B, del fondo)');
  end if;

  update public.orders set status='refunded', refunded_at=now(), refund_amount_cents=v_refund, updated_at=now()
    where id=p_order_id;
  return 'refunded';
end $function$;

revoke execute on function public.rpc_refund_order(uuid,text) from public, anon, authenticated;
grant  execute on function public.rpc_refund_order(uuid,text) to service_role;
