-- Envíos E-2: direcciones de ORIGEN del vendedor (varias por vendedor) + origen POR PRODUCTO.
-- 🟢 sin dinero. Crea seller_addresses (RLS owner-only), helpers, listings.origin_address_id
-- (FK ON DELETE RESTRICT) y extiende rpc_upsert_product (13 -> 14 args) para EXIGIR y VALIDAR el
-- origen. Los campos cubren lo que /ship/rate/ de Envia pide en `origin` (name/phone/street/number/
-- district/city/state/postalCode/country). Candado: un producto SOLO puede apuntar a una dirección
-- PROPIA (misma dueña que su tienda), validado server-side de forma determinista (no depende de RLS).

-- 1) Helper: id del miembro (identity_profiles) del usuario actual. SECURITY DEFINER para no
--    depender de la RLS de identity_profiles. Usado por la RLS de seller_addresses.
create or replace function public.cng_my_member_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.identity_profiles where user_id = auth.uid() limit 1;
$function$;
revoke execute on function public.cng_my_member_id() from public, anon;
grant  execute on function public.cng_my_member_id() to authenticated;

-- 2) Tabla de direcciones de origen del vendedor (varias por vendedor).
create table if not exists public.seller_addresses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.identity_profiles(id) on delete cascade,
  label        text not null,                 -- interno: "Bodega Centro", para que el vendedor la identifique
  contact_name text not null,                 -- origin.name
  phone        text not null,                 -- origin.phone
  email        text,                          -- origin.email (opcional)
  street       text not null,                 -- origin.street (calle)
  ext_number   text not null,                 -- origin.number (número exterior)
  int_number   text,                          -- interior (opcional; se anexa a reference al cotizar)
  district     text not null,                 -- origin.district (colonia)
  city         text not null,                 -- origin.city
  state        text not null,                 -- origin.state
  postal_code  text not null,                 -- origin.postalCode
  country      text not null default 'MX',    -- origin.country
  reference    text,                          -- origin.reference (opcional)
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint seller_addresses_country_chk check (country ~ '^[A-Z]{2}$'),
  -- CP MX = 5 dígitos (sub-decisión 3). Otros países no se validan aquí (hoy solo MX).
  constraint seller_addresses_cp_mx_chk check (country <> 'MX' or postal_code ~ '^[0-9]{5}$')
);

create index if not exists seller_addresses_owner_idx on public.seller_addresses(owner_id);
-- A lo sumo UNA dirección default por vendedor.
create unique index if not exists seller_addresses_one_default_idx
  on public.seller_addresses(owner_id) where is_default;

-- updated_at automático (reusa el trigger estándar del proyecto, el mismo de stores).
drop trigger if exists t_seller_addresses_updated on public.seller_addresses;
create trigger t_seller_addresses_updated before update on public.seller_addresses
  for each row execute function public.set_updated_at();

-- 3) RLS owner-only (lectura también para admin, igual que stores).
alter table public.seller_addresses enable row level security;

drop policy if exists seller_addresses_select_own on public.seller_addresses;
create policy seller_addresses_select_own on public.seller_addresses
  for select using (owner_id = public.cng_my_member_id() or public.cng_has_role('admin'));

drop policy if exists seller_addresses_insert_own on public.seller_addresses;
create policy seller_addresses_insert_own on public.seller_addresses
  for insert with check (owner_id = public.cng_my_member_id());

drop policy if exists seller_addresses_update_own on public.seller_addresses;
create policy seller_addresses_update_own on public.seller_addresses
  for update using (owner_id = public.cng_my_member_id())
              with check (owner_id = public.cng_my_member_id());

drop policy if exists seller_addresses_delete_own on public.seller_addresses;
create policy seller_addresses_delete_own on public.seller_addresses
  for delete using (owner_id = public.cng_my_member_id());

revoke all on public.seller_addresses from public, anon;
grant select, insert, update, delete on public.seller_addresses to authenticated;

-- 4) Helper de candado: ¿la dirección y la tienda pertenecen al MISMO dueño? SECURITY DEFINER ->
--    chequeo determinista de "origen propio", independiente de la visibilidad RLS. Usado por el RPC.
create or replace function public.cng_address_belongs_to_store(p_address_id uuid, p_store_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.seller_addresses a
    join public.stores s on s.id = p_store_id
    where a.id = p_address_id and a.owner_id = s.owner_id
  );
$function$;
revoke execute on function public.cng_address_belongs_to_store(uuid, uuid) from public, anon;
grant  execute on function public.cng_address_belongs_to_store(uuid, uuid) to authenticated;

-- 5) Marcar una dirección como default de forma ATÓMICA (apaga las otras, prende esta).
create or replace function public.rpc_set_default_address(p_address_id uuid)
returns void
language plpgsql security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.seller_addresses set is_default = false
   where owner_id = public.cng_my_member_id() and is_default and id <> p_address_id;
  update public.seller_addresses set is_default = true
   where id = p_address_id and owner_id = public.cng_my_member_id();
  if not found then
    raise exception 'address_not_found_or_forbidden' using errcode = 'no_data_found';
  end if;
end;
$function$;
revoke execute on function public.rpc_set_default_address(uuid) from public, anon;
grant  execute on function public.rpc_set_default_address(uuid) to authenticated;

-- 6) Origen POR PRODUCTO: columna en listings (FK a seller_addresses, RESTRICT al borrar en uso).
alter table public.listings
  add column if not exists origin_address_id uuid references public.seller_addresses(id) on delete restrict;
-- Grant explícito por columna (listings ya tiene grant a nivel tabla; esto es a prueba de balas).
grant insert (origin_address_id), update (origin_address_id) on public.listings to authenticated;

-- 7) rpc_upsert_product extendido (13 -> 14 args): + p_origin_address_id REQUERIDO y validado propio.
--    DROP del signature de 13 args (E-1) + CREATE del de 14 para no dejar overload ambiguo.
drop function if exists public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid, integer, numeric, numeric, numeric);

create or replace function public.rpc_upsert_product(
  p_store_id          uuid,
  p_category_id       uuid,
  p_title             text,
  p_price             numeric,
  p_stock             integer,
  p_description       text    default null,
  p_images            text[]  default '{}',
  p_status            text    default 'active',
  p_listing_id        uuid    default null,
  p_weight_grams      integer default null,
  p_length_cm         numeric default null,
  p_width_cm          numeric default null,
  p_height_cm         numeric default null,
  p_origin_address_id uuid    default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_listing_id uuid;
  v_variant_id uuid;
  v_desc       text := nullif(btrim(coalesce(p_description, '')), '');
  v_stock      integer := coalesce(p_stock, 0);
begin
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'title_required'  using errcode = 'check_violation';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'price_invalid'   using errcode = 'check_violation';
  end if;
  if v_stock < 0 then
    raise exception 'stock_invalid'   using errcode = 'check_violation';
  end if;
  if p_status not in ('draft', 'active', 'suspended') then
    raise exception 'status_invalid'  using errcode = 'check_violation';
  end if;
  -- E-1: datos de envío REQUERIDOS (sin peso/dimensiones no se puede cotizar envío después).
  if p_weight_grams is null or p_weight_grams < 1 then
    raise exception 'weight_required' using errcode = 'check_violation';
  end if;
  if p_length_cm is null or p_length_cm <= 0
     or p_width_cm is null or p_width_cm <= 0
     or p_height_cm is null or p_height_cm <= 0 then
    raise exception 'dimensions_required' using errcode = 'check_violation';
  end if;
  -- E-2: origen de envío REQUERIDO y debe ser una dirección PROPIA (misma dueña que la tienda).
  if p_origin_address_id is null then
    raise exception 'origin_required' using errcode = 'check_violation';
  end if;
  if not public.cng_address_belongs_to_store(p_origin_address_id, p_store_id) then
    raise exception 'origin_address_invalid' using errcode = 'check_violation';
  end if;

  if p_listing_id is null then
    insert into public.listings (store_id, category_id, type, lob, title, description, currency, status, origin_address_id)
    values (p_store_id, p_category_id, 'buy_now', 'store', btrim(p_title), v_desc, 'MXN', p_status, p_origin_address_id)
    returning id into v_listing_id;

    insert into public.listing_variants (listing_id, name, price, stock, is_active, weight_grams, length_cm, width_cm, height_cm)
    values (v_listing_id, 'default', p_price, v_stock, true, p_weight_grams, p_length_cm, p_width_cm, p_height_cm);
  else
    update public.listings
       set category_id       = p_category_id,
           title             = btrim(p_title),
           description       = v_desc,
           status            = p_status,
           origin_address_id = p_origin_address_id
     where id = p_listing_id
    returning id into v_listing_id;

    if v_listing_id is null then
      raise exception 'not_found_or_forbidden' using errcode = 'no_data_found';
    end if;

    update public.listing_variants
       set price = p_price, stock = v_stock, is_active = true,
           weight_grams = p_weight_grams, length_cm = p_length_cm, width_cm = p_width_cm, height_cm = p_height_cm
     where listing_id = v_listing_id
    returning id into v_variant_id;

    if v_variant_id is null then
      insert into public.listing_variants (listing_id, name, price, stock, is_active, weight_grams, length_cm, width_cm, height_cm)
      values (v_listing_id, 'default', p_price, v_stock, true, p_weight_grams, p_length_cm, p_width_cm, p_height_cm);
    end if;

    delete from public.listing_images where listing_id = v_listing_id;
  end if;

  if array_length(p_images, 1) is not null then
    insert into public.listing_images (listing_id, url, sort_order)
    select v_listing_id, img.url, (img.ord - 1)::int
    from unnest(p_images) with ordinality as img(url, ord)
    where coalesce(btrim(img.url), '') <> '';
  end if;

  return v_listing_id;
end;
$function$;

revoke execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid, integer, numeric, numeric, numeric, uuid) from public, anon;
grant  execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid, integer, numeric, numeric, numeric, uuid) to authenticated;
