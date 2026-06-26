-- Envíos E-3: lista CURADA de paqueterías (configurable desde admin) + anti-abuso del cotizador.
-- 🟢 sin dinero. El edge cng-shipping-quote hace fan-out a /ship/rate/ por cada carrier ENABLED.
-- La lista vive en tabla dedicada (NO en platform_config singleton): N filas con orden/estado y
-- code estable (futura FK desde orders/shipments). Escritura solo admin (cng_is_admin), lectura
-- pública (como platform_config). Además: rate-limit por IP en DB para el edge verify_jwt:false.

-- 1) Tabla de paqueterías curadas.
create table if not exists public.shipping_carriers (
  code        text primary key,
  label       text not null,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint shipping_carriers_code_chk check (code ~ '^[a-z0-9_]+$')
);

-- Seed: los 5 curados (codes reales de Envia). redpack/sendex quedan para habilitar luego.
insert into public.shipping_carriers (code, label, enabled, sort_order) values
  ('fedex',         'FedEx',         true, 10),
  ('estafeta',      'Estafeta',      true, 20),
  ('dhl',           'DHL',           true, 30),
  ('ups',           'UPS',           true, 40),
  ('paquetexpress', 'Paquetexpress', true, 50)
on conflict (code) do nothing;

drop trigger if exists t_shipping_carriers_updated on public.shipping_carriers;
create trigger t_shipping_carriers_updated before update on public.shipping_carriers
  for each row execute function public.set_updated_at();

-- RLS: lectura pública (lista no sensible; mismo patrón que platform_config). Escritura solo por RPC.
alter table public.shipping_carriers enable row level security;
drop policy if exists shipping_carriers_select_all on public.shipping_carriers;
create policy shipping_carriers_select_all on public.shipping_carriers for select using (true);

revoke all on public.shipping_carriers from public, anon, authenticated;
grant select on public.shipping_carriers to anon, authenticated;
-- service_role (edges) NO hereda del revoke-from-public -> concederle SELECT explícito.
grant select on public.shipping_carriers to service_role;

-- Fix retroactivo de E-2: el edge cng-shipping-quote lee seller_addresses con service_role, que
-- NO tiene SELECT porque E-2 hizo "revoke all from public" y solo concedió a authenticated. Sin
-- esto, la resolución del origen falla y todo producto parece "sin datos de envío". (No afectó
-- producción: el cliente usa el rol authenticated, que sí tiene grants.)
grant select, insert, update, delete on public.seller_addresses to service_role;

-- 2) RPC admin para crear/editar un carrier (upsert por code). Gateado con cng_is_admin().
create or replace function public.rpc_admin_upsert_carrier(
  p_code text, p_label text, p_enabled boolean, p_sort_order int
)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.cng_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(btrim(p_code), '') = '' or lower(btrim(p_code)) !~ '^[a-z0-9_]+$' then
    raise exception 'code_invalid' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_label), '') = '' then
    raise exception 'label_required' using errcode = 'check_violation';
  end if;
  insert into public.shipping_carriers (code, label, enabled, sort_order)
  values (lower(btrim(p_code)), btrim(p_label), coalesce(p_enabled, true), coalesce(p_sort_order, 0))
  on conflict (code) do update
    set label = excluded.label, enabled = excluded.enabled, sort_order = excluded.sort_order;
end;
$function$;
revoke execute on function public.rpc_admin_upsert_carrier(text, text, boolean, int) from public, anon;
grant  execute on function public.rpc_admin_upsert_carrier(text, text, boolean, int) to authenticated;

-- 3) Anti-abuso del cotizador (edge verify_jwt:false): rate-limit por IP respaldado en DB.
--    Cross-instance (no in-memory). Solo el edge (service_role) escribe vía rpc_quote_rate_hit.
create table if not exists public.quote_rate_limit (
  ip           text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (ip, window_start)
);
alter table public.quote_rate_limit enable row level security; -- sin policies: nadie salvo service_role
revoke all on public.quote_rate_limit from public, anon, authenticated;

-- Cuenta un golpe del IP en la ventana actual y dice si sigue dentro del límite. Limpia ventanas viejas.
create or replace function public.rpc_quote_rate_hit(p_ip text, p_limit int, p_window_seconds int default 60)
returns boolean
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_secs   int := greatest(coalesce(p_window_seconds, 60), 1);
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);
  v_count  int;
begin
  insert into public.quote_rate_limit (ip, window_start, count)
  values (coalesce(nullif(btrim(p_ip), ''), 'unknown'), v_window, 1)
  on conflict (ip, window_start) do update set count = public.quote_rate_limit.count + 1
  returning count into v_count;
  delete from public.quote_rate_limit where window_start < now() - interval '1 hour';
  return v_count <= coalesce(p_limit, 20);
end;
$function$;
revoke execute on function public.rpc_quote_rate_hit(text, int, int) from public, anon, authenticated;
grant  execute on function public.rpc_quote_rate_hit(text, int, int) to service_role;
