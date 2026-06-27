-- C-6d: auto-liberación diaria. Libera órdenes elegibles llamando a rpc_release_order_payout por cada una.
-- Elegible = released_at NULL + status in (shipped,delivered) + COALESCE(delivered_at,shipped_at)+hold_days < now().
-- Puente: usa delivered_at (tracking Envia/E-6) si existe; si no, shipped_at. Idempotente y coexiste con
-- buyer-confirm (cada release se guarda por released_at; el segundo intento devuelve 'duplicate').
create or replace function public.rpc_auto_release_due()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_hold int; v_count int := 0; v_res text; r record;
begin
  select coalesce(hold_days, 7) into v_hold from public.platform_config where id=true;
  for r in
    select id from public.orders
    where released_at is null
      and status in ('shipped','delivered')                 -- excluye disputed/refunded/completed/cancelled
      and coalesce(delivered_at, shipped_at) is not null
      and coalesce(delivered_at, shipped_at) + make_interval(days => v_hold) < now()
    order by created_at
  loop
    v_res := public.rpc_release_order_payout(r.id);
    if v_res = 'released' then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $function$;

revoke execute on function public.rpc_auto_release_due() from public, anon, authenticated;
grant  execute on function public.rpc_auto_release_due() to service_role;

-- Habilitar pg_cron y programar la auto-liberación diaria (08:07 UTC). Idempotente (schedule por nombre).
create extension if not exists pg_cron;
select cron.schedule('cng-auto-release-payouts', '7 8 * * *', 'select public.rpc_auto_release_due();');
