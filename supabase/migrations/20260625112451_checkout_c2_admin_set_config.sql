-- Checkout C-2: RPC admin-gateado para editar platform_config. SOLO config (sin dinero).
--
-- platform_config no tiene policy/grant de escritura (C-1) -> el cliente no la toca.
-- Este RPC SECURITY DEFINER (corre como owner, puede UPDATE) se AUTO-GATEA con cng_is_admin
-- (patrón de rpc_admin_decide_store): un no-admin recibe excepción, sin tocar nada.
-- Valida rangos (defensa en profundidad; el CHECK de la tabla es el respaldo).
--
-- OJO checkout_live: es el kill-switch del DINERO REAL. Ponerlo en true ACTIVA el cobro real
-- (cuando existan C-3/C-4) y requiere la luz verde de contador/abogado. El RPC permite
-- moverlo (panel "forzar"), pero hoy no fluye dinero porque el checkout aún no está construido.

create or replace function public.rpc_admin_set_config(
  p_commission_pct numeric,
  p_cushion_pct    numeric,
  p_hold_days      integer,
  p_checkout_live  boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- AUTO-GATE: solo admin. Fail-closed.
  if not public.cng_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validación de rangos (el CHECK de platform_config es el respaldo).
  if p_commission_pct is null or p_commission_pct < 0 or p_commission_pct > 100 then
    raise exception 'commission_pct fuera de rango (0-100)';
  end if;
  if p_cushion_pct is null or p_cushion_pct < 0 or p_cushion_pct > 100 then
    raise exception 'cushion_pct fuera de rango (0-100)';
  end if;
  if p_hold_days is null or p_hold_days < 0 then
    raise exception 'hold_days fuera de rango (>= 0)';
  end if;

  update public.platform_config
     set commission_pct = p_commission_pct,
         cushion_pct    = p_cushion_pct,
         hold_days      = p_hold_days,
         checkout_live  = coalesce(p_checkout_live, false),
         updated_at     = now()
   where id = true;
end;
$function$;

revoke execute on function public.rpc_admin_set_config(numeric, numeric, integer, boolean) from public, anon;
grant  execute on function public.rpc_admin_set_config(numeric, numeric, integer, boolean) to authenticated;
