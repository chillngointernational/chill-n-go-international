-- Envíos E-4: libreta de direcciones del COMPRADOR (destino de entrega) para el checkout.
-- 🟢 sin dinero. Espejo de seller_addresses: varias por comprador, RLS owner-only (cng_my_member_id),
-- campos = lo que /ship/rate/ pide en `destination`. Incluye el GRANT a service_role DESDE EL INICIO
-- (el edge cng-shipping-quote y el futuro rpc_create_order de E-5 leen con service_role; service_role
-- bypasea RLS pero NO los GRANTs -> sin esto, el bug de E-3 se repetiría).

create table if not exists public.buyer_addresses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.identity_profiles(id) on delete cascade,
  label        text not null,                 -- "Casa", "Oficina"… (lo elige el comprador)
  contact_name text not null,                 -- destination.name (quién recibe)
  phone        text not null,                 -- destination.phone
  email        text,                          -- opcional
  street       text not null,                 -- destination.street (calle)
  ext_number   text not null,                 -- destination.number (núm. exterior)
  int_number   text,                          -- interior (opcional; se anexa a reference)
  district     text not null,                 -- destination.district (colonia)
  city         text not null,                 -- destination.city
  state        text not null,                 -- destination.state
  postal_code  text not null,                 -- destination.postalCode
  country      text not null default 'MX',    -- destination.country
  reference    text,                          -- opcional (entre calles, etc.)
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint buyer_addresses_country_chk check (country ~ '^[A-Z]{2}$'),
  constraint buyer_addresses_cp_mx_chk check (country <> 'MX' or postal_code ~ '^[0-9]{5}$')
);

create index if not exists buyer_addresses_owner_idx on public.buyer_addresses(owner_id);
create unique index if not exists buyer_addresses_one_default_idx
  on public.buyer_addresses(owner_id) where is_default;

drop trigger if exists t_buyer_addresses_updated on public.buyer_addresses;
create trigger t_buyer_addresses_updated before update on public.buyer_addresses
  for each row execute function public.set_updated_at();

-- RLS owner-only (lectura también admin), idéntico al patrón de seller_addresses.
alter table public.buyer_addresses enable row level security;

drop policy if exists buyer_addresses_select_own on public.buyer_addresses;
create policy buyer_addresses_select_own on public.buyer_addresses
  for select using (owner_id = public.cng_my_member_id() or public.cng_has_role('admin'));

drop policy if exists buyer_addresses_insert_own on public.buyer_addresses;
create policy buyer_addresses_insert_own on public.buyer_addresses
  for insert with check (owner_id = public.cng_my_member_id());

drop policy if exists buyer_addresses_update_own on public.buyer_addresses;
create policy buyer_addresses_update_own on public.buyer_addresses
  for update using (owner_id = public.cng_my_member_id())
              with check (owner_id = public.cng_my_member_id());

drop policy if exists buyer_addresses_delete_own on public.buyer_addresses;
create policy buyer_addresses_delete_own on public.buyer_addresses
  for delete using (owner_id = public.cng_my_member_id());

revoke all on public.buyer_addresses from public, anon;
grant select, insert, update, delete on public.buyer_addresses to authenticated;
-- service_role (edges + futuro rpc_create_order) NO hereda del revoke-from-public -> grant explícito.
grant select, insert, update, delete on public.buyer_addresses to service_role;

-- Marcar una dirección como default de forma ATÓMICA (apaga las otras, prende esta).
create or replace function public.rpc_set_default_buyer_address(p_address_id uuid)
returns void
language plpgsql security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.buyer_addresses set is_default = false
   where owner_id = public.cng_my_member_id() and is_default and id <> p_address_id;
  update public.buyer_addresses set is_default = true
   where id = p_address_id and owner_id = public.cng_my_member_id();
  if not found then
    raise exception 'address_not_found_or_forbidden' using errcode = 'no_data_found';
  end if;
end;
$function$;
revoke execute on function public.rpc_set_default_buyer_address(uuid) from public, anon;
grant  execute on function public.rpc_set_default_buyer_address(uuid) to authenticated;
