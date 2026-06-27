-- C-5c: barrido de reintento. Acuña los Chilliums de órdenes 'completed' cuyo award quedó pendiente
-- (chilliums_awarded=false, por un fallo no-fatal en el release). Complemento del modo no-fatal:
-- ningún Chillium queda sin acuñar. Idempotente (rpc_award_order_chilliums guarda por chilliums_awarded).
create or replace function public.rpc_retry_pending_chilliums()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_count int := 0; v_res text; r record;
begin
  for r in
    select id from public.orders
    where status='completed' and chilliums_awarded = false
    order by created_at
  loop
    v_res := public.rpc_award_order_chilliums(r.id);
    if v_res = 'awarded' then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $function$;

revoke execute on function public.rpc_retry_pending_chilliums() from public, anon, authenticated;
grant  execute on function public.rpc_retry_pending_chilliums() to service_role;

-- Job diario (08:17 UTC), 10 min después del auto-release. Idempotente (schedule por nombre). pg_cron ya
-- habilitado en C-6d (20260627130000_c6d_auto_release_cron.sql).
select cron.schedule('cng-retry-chilliums', '17 8 * * *', 'select public.rpc_retry_pending_chilliums();');
