-- ============================================================================
-- Chill n Go Marketplace — Migración 1 (proyecto Supabase NUEVO y limpio)
-- Núcleo (identidad, roles, invitaciones, Chilliums) + Marketplace
-- ----------------------------------------------------------------------------
-- Decisiones de diseño:
--  * Pensado para el proyecto Supabase NUEVO. Sin Stripe, sin KYC.
--  * RLS habilitado en TODAS las tablas, con políticas REALES (no "siempre true").
--  * "Automatically expose new tables" está OFF en el proyecto, así que cada
--    tabla recibe GRANTs explícitos (control de acceso manual + RLS).
--  * Identificadores en inglés (evita la "ñ" de "reseñas" como nombre de tabla).
--    Mapeo: listings=publicaciones, listing_variants=variantes,
--    listing_images=imagenes, orders=pedidos, order_items=pedido_items,
--    reviews=reseñas, quote_requests=solicitudes.
--  * El árbol de referidos se simplificó: con recompensa de 1 nivel, el enlace
--    directo `referred_by` en el perfil es suficiente; se eliminó la tabla
--    redundante `referral_tree`.
--  * Los tokens de Mercado Pago de cada vendedor viven en una tabla aparte
--    (`store_mp_credentials`) SIN acceso por la API (solo service_role).
--  * La capa social (feed/chat/stories) se recrea en una migración aparte
--    antes del cutover; no se incluye aquí para mantener esto enfocado.
-- ============================================================================

-- ---------- 0. Extensiones y helpers genéricos ------------------------------
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. IDENTIDAD Y ROLES
-- ============================================================================

-- Perfil maestro del socio. Se crea SOLO por el flujo de invitación
-- (server-side). No hay política de INSERT para clientes => nadie se
-- auto-registra un perfil real.
create table public.identity_profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references auth.users(id) on delete cascade,
  email                   text not null,
  first_name              text,
  last_name               text,
  full_name               text,
  display_name            text,
  avatar_url              text,
  bio                     text,
  phone                   text,
  country                 text,
  -- referidos (1 nivel)
  ref_code                text unique,
  referred_by             uuid references public.identity_profiles(id) on delete restrict, -- null SOLO para la cuenta raíz
  referral_depth          integer not null default 0,
  direct_referrals_count  integer not null default 0,
  -- Chilliums (centi-chilliums: 1 CHL = 100)
  chilliums_balance       bigint not null default 0,
  chilliums_total_earned  bigint not null default 0,
  chilliums_total_spent   bigint not null default 0,
  -- membresía (modelo gratis-por-invitación vs. de pago se define luego)
  membership_status       text not null default 'active',
  is_active               boolean not null default true,
  accepted_terms          boolean not null default false,
  accepted_privacy        boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_identity_referred_by on public.identity_profiles(referred_by);

-- Roles por plataforma/LOB. Aquí viven admin / seller / member.
create table public.platform_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null default 'cng_store',
  role        text not null,                         -- 'admin' | 'seller' | 'member'
  is_active   boolean not null default true,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  revoked_at  timestamptz,
  unique (user_id, platform, role)
);
create index idx_platform_roles_user on public.platform_roles(user_id);

-- NOTA: los helpers de rol cng_has_role()/cng_owns_store() se definen más
-- abajo (sección 4b), DESPUÉS de crear la tabla "stores", porque una función
-- SQL valida las tablas que referencia en el momento de crearse.

-- ============================================================================
-- 2. INVITACIONES (modelo "solo por invitación")
-- ============================================================================
-- Cualquier socio puede generar una invitación; la aceptación (que crea el
-- perfil real con referred_by = invited_by) ocurre server-side en el Paso 2.
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by   uuid references public.identity_profiles(id) on delete set null, -- null = semilla de admin/raíz
  email        text,
  status       text not null default 'pending',      -- pending | accepted | expired | revoked
  accepted_by  uuid references public.identity_profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  accepted_at  timestamptz
);
create index idx_invitations_invited_by on public.invitations(invited_by);
create index idx_invitations_status on public.invitations(status);

-- ============================================================================
-- 3. CHILLIUMS (libro mayor "banking-grade")
-- ============================================================================
create table public.chilliums_ledger (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.identity_profiles(id) on update cascade on delete restrict,
  type                  text not null,               -- p.ej. cashback_purchase, earn_referral_level_1, spend
  amount                bigint not null,             -- centi-chilliums (+/-)
  balance_after         bigint not null,
  source_transaction_id uuid,                        -- referencia a una orden (sin FK dura por ahora)
  source_user_id        uuid references public.identity_profiles(id) on delete restrict,
  referral_level        integer,                     -- 0 = propio, 1 = invitador directo
  description           text,
  created_at            timestamptz not null default now()
);
create index idx_chilliums_user on public.chilliums_ledger(user_id);
create index idx_chilliums_source_user on public.chilliums_ledger(source_user_id);

-- Única puerta para mover Chilliums: atómica, con lock FOR UPDATE.
-- SOLO service_role puede ejecutarla (no anon, no authenticated).
create or replace function public.apply_chilliums(
  p_user_id               uuid,
  p_amount                bigint,
  p_type                  text,
  p_description           text default null,
  p_source_user_id        uuid default null,
  p_referral_level        integer default null,
  p_source_transaction_id uuid default null
)
returns table (ledger_id uuid, new_balance bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_balance bigint;
  v_new bigint;
  v_id uuid;
begin
  select chilliums_balance into v_balance
  from public.identity_profiles where id = p_user_id for update;

  if v_balance is null then
    raise exception 'identity_profile % no existe', p_user_id;
  end if;

  v_new := v_balance + p_amount;
  if v_new < 0 then
    raise exception 'saldo insuficiente de Chilliums (actual %, intento %)', v_balance, p_amount;
  end if;

  insert into public.chilliums_ledger
    (user_id, type, amount, balance_after, source_user_id, referral_level, source_transaction_id, description)
  values
    (p_user_id, p_type, p_amount, v_new, p_source_user_id, p_referral_level, p_source_transaction_id, p_description)
  returning id into v_id;

  update public.identity_profiles
  set chilliums_balance      = v_new,
      chilliums_total_earned = chilliums_total_earned + greatest(p_amount, 0),
      chilliums_total_spent  = chilliums_total_spent  + greatest(-p_amount, 0),
      updated_at = now()
  where id = p_user_id;

  return query select v_id, v_new;
end;
$$;

revoke all on function public.apply_chilliums(uuid,bigint,text,text,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.apply_chilliums(uuid,bigint,text,text,uuid,integer,uuid) to service_role;

-- ============================================================================
-- 4. MARKETPLACE
-- ============================================================================

-- Categorías = las LOBs nativas (Travel NO vive aquí; es enlace a Expedia).
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  default_type  text not null default 'buy_now',     -- buy_now | quote
  is_active     boolean not null default true,
  sort_order    integer not null default 0
);

-- Vendedores (la "tienda" de cada uno dentro del marketplace).
create table public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.identity_profiles(id) on delete restrict,
  name          text not null,
  slug          text not null unique,
  description   text,
  logo_url      text,
  brand_config  jsonb not null default '{}'::jsonb,  -- colores/branding de su presencia
  status        text not null default 'pending',     -- pending | active | suspended
  mp_user_id    text,                                -- collector_id de Mercado Pago (público)
  mp_connected  boolean not null default false,
  rating_avg    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_stores_owner on public.stores(owner_id);
create index idx_stores_status on public.stores(status);

-- Credenciales OAuth de Mercado Pago del vendedor. TABLA SENSIBLE:
-- sin GRANTs a anon/authenticated => inaccesible por la API. Solo service_role.
create table public.store_mp_credentials (
  store_id      uuid primary key references public.stores(id) on delete cascade,
  mp_user_id    text,
  access_token  text,
  refresh_token text,
  public_key    text,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

-- Publicaciones (productos/servicios). type decide el flujo:
--  buy_now  => tiene variantes (precio/stock) y va por carrito + Mercado Pago.
--  quote    => sin precio; genera una solicitud/lead de contacto.
create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  category_id   uuid not null references public.categories(id) on delete restrict,
  type          text not null check (type in ('buy_now','quote')),
  title         text not null,
  description   text,
  currency      text not null default 'MXN',
  status        text not null default 'draft',        -- draft | active | paused | archived
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_listings_store on public.listings(store_id);
create index idx_listings_category on public.listings(category_id);
create index idx_listings_status on public.listings(status);

-- Variantes (solo para buy_now): talla/color con su propio precio y stock.
create table public.listing_variants (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  sku           text,
  name          text,                                 -- "Talla M / Rojo"
  attributes    jsonb not null default '{}'::jsonb,
  price         numeric(12,2) not null,
  stock         integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_variants_listing on public.listing_variants(listing_id);

create table public.listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  url           text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index idx_images_listing on public.listing_images(listing_id);

-- Órdenes (compra). Una orden = un vendedor (encaja con el límite de 2
-- cuentas del Split de Pagos de Mercado Pago).
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references public.identity_profiles(id) on delete restrict,
  store_id          uuid not null references public.stores(id) on delete restrict,
  status            text not null default 'pending',  -- pending | paid | shipped | delivered | cancelled | refunded
  subtotal          numeric(12,2) not null default 0,
  platform_fee      numeric(12,2) not null default 0, -- comisión de la plataforma
  currency          text not null default 'MXN',
  mp_payment_id     text,
  mp_status         text,
  shipping_address  jsonb,                            -- el vendedor envía => se captura dirección
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_orders_buyer on public.orders(buyer_id);
create index idx_orders_store on public.orders(store_id);
create index idx_orders_status on public.orders(status);

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  variant_id      uuid references public.listing_variants(id) on delete restrict,
  listing_id      uuid references public.listings(id) on delete restrict,
  title_snapshot  text,                               -- foto del producto al momento de comprar
  unit_price      numeric(12,2) not null,
  quantity        integer not null check (quantity > 0),
  created_at      timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_variant on public.order_items(variant_id);

-- Reseñas (reputación del vendedor, estilo ML).
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  reviewer_id   uuid references public.identity_profiles(id) on delete set null,
  rating        integer not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);
create index idx_reviews_store on public.reviews(store_id);

-- Solicitudes (leads) para las publicaciones tipo "quote".
create table public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  store_id      uuid not null references public.stores(id) on delete cascade,
  requester_id  uuid references public.identity_profiles(id) on delete set null,
  name          text,
  email         text,
  phone         text,
  message       text,
  status        text not null default 'new',          -- new | contacted | closed
  created_at    timestamptz not null default now()
);
create index idx_quotes_store on public.quote_requests(store_id);
create index idx_quotes_listing on public.quote_requests(listing_id);

-- ---------- triggers updated_at ---------------------------------------------
create trigger t_identity_updated   before update on public.identity_profiles    for each row execute function public.set_updated_at();
create trigger t_stores_updated     before update on public.stores               for each row execute function public.set_updated_at();
create trigger t_mpcred_updated     before update on public.store_mp_credentials for each row execute function public.set_updated_at();
create trigger t_listings_updated   before update on public.listings             for each row execute function public.set_updated_at();
create trigger t_variants_updated   before update on public.listing_variants     for each row execute function public.set_updated_at();
create trigger t_orders_updated     before update on public.orders               for each row execute function public.set_updated_at();

-- ============================================================================
-- 4b. HELPERS DE ROL (después de las tablas; una función SQL valida tablas al crear)
-- ============================================================================
create or replace function public.cng_has_role(p_role text)
returns boolean language sql security definer set search_path = public, pg_temp stable as $$
  select exists (
    select 1 from public.platform_roles
    where user_id = auth.uid() and platform = 'cng_store'
      and role = p_role and is_active = true
  );
$$;

create or replace function public.cng_owns_store(p_store_id uuid)
returns boolean language sql security definer set search_path = public, pg_temp stable as $$
  select exists (
    select 1
    from public.stores s
    join public.identity_profiles p on p.id = s.owner_id
    where s.id = p_store_id and p.user_id = auth.uid()
  );
$$;

grant execute on function public.cng_has_role(text) to anon, authenticated;
grant execute on function public.cng_owns_store(uuid) to anon, authenticated;

-- ============================================================================
-- 5. RLS — habilitar en todo
-- ============================================================================
alter table public.identity_profiles    enable row level security;
alter table public.platform_roles        enable row level security;
alter table public.invitations           enable row level security;
alter table public.chilliums_ledger      enable row level security;
alter table public.categories            enable row level security;
alter table public.stores                enable row level security;
alter table public.store_mp_credentials  enable row level security;
alter table public.listings              enable row level security;
alter table public.listing_variants      enable row level security;
alter table public.listing_images        enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.reviews               enable row level security;
alter table public.quote_requests        enable row level security;

-- ---------- identity_profiles: cada quien el suyo; admin todo --------------
grant select, update on public.identity_profiles to authenticated;
create policy "profiles_select_self" on public.identity_profiles
  for select to authenticated using (user_id = auth.uid() or public.cng_has_role('admin'));
create policy "profiles_update_self" on public.identity_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- (sin INSERT para clientes: los perfiles se crean server-side por invitación)

-- ---------- platform_roles: lectura propia; gestión server-side ------------
grant select on public.platform_roles to authenticated;
create policy "roles_select_self" on public.platform_roles
  for select to authenticated using (user_id = auth.uid() or public.cng_has_role('admin'));

-- ---------- invitations: cada socio crea/ve las suyas ----------------------
grant select, insert on public.invitations to authenticated;
create policy "inv_insert_self" on public.invitations
  for insert to authenticated
  with check (exists (select 1 from public.identity_profiles p where p.id = invited_by and p.user_id = auth.uid()));
create policy "inv_select_self" on public.invitations
  for select to authenticated
  using (public.cng_has_role('admin')
         or exists (select 1 from public.identity_profiles p where p.id = invited_by and p.user_id = auth.uid()));

-- ---------- chilliums_ledger: lectura propia; escritura solo por RPC --------
grant select on public.chilliums_ledger to authenticated;
create policy "ledger_select_self" on public.chilliums_ledger
  for select to authenticated using (user_id = auth.uid() or public.cng_has_role('admin'));

-- ---------- categories: catálogo público -----------------------------------
grant select on public.categories to anon, authenticated;
create policy "cat_select_public" on public.categories
  for select to anon, authenticated using (is_active = true);

-- ---------- stores: público las activas; dueño/admin gestionan -------------
grant select on public.stores to anon, authenticated;
grant insert, update on public.stores to authenticated;
create policy "stores_select_public" on public.stores
  for select to anon, authenticated using (status = 'active');
create policy "stores_select_own" on public.stores
  for select to authenticated using (public.cng_owns_store(id) or public.cng_has_role('admin'));
create policy "stores_insert_seller" on public.stores
  for insert to authenticated
  with check (public.cng_has_role('seller')
              and exists (select 1 from public.identity_profiles p where p.id = owner_id and p.user_id = auth.uid()));
create policy "stores_update_own" on public.stores
  for update to authenticated using (public.cng_owns_store(id)) with check (public.cng_owns_store(id));

-- ---------- store_mp_credentials: NADIE por la API (solo service_role) ------
-- (sin GRANTs y sin políticas => inaccesible para anon/authenticated)

-- ---------- listings: público las activas; dueño/admin gestionan -----------
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
create policy "listings_select_public" on public.listings
  for select to anon, authenticated using (status = 'active');
create policy "listings_select_own" on public.listings
  for select to authenticated using (public.cng_owns_store(store_id) or public.cng_has_role('admin'));
create policy "listings_insert_own" on public.listings
  for insert to authenticated with check (public.cng_owns_store(store_id));
create policy "listings_update_own" on public.listings
  for update to authenticated using (public.cng_owns_store(store_id)) with check (public.cng_owns_store(store_id));
create policy "listings_delete_own" on public.listings
  for delete to authenticated using (public.cng_owns_store(store_id));

-- ---------- listing_variants -----------------------------------------------
grant select on public.listing_variants to anon, authenticated;
grant insert, update, delete on public.listing_variants to authenticated;
create policy "variants_select_public" on public.listing_variants
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active'));
create policy "variants_manage_own" on public.listing_variants
  for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and public.cng_owns_store(l.store_id)))
  with check (exists (select 1 from public.listings l where l.id = listing_id and public.cng_owns_store(l.store_id)));

-- ---------- listing_images -------------------------------------------------
grant select on public.listing_images to anon, authenticated;
grant insert, update, delete on public.listing_images to authenticated;
create policy "images_select_public" on public.listing_images
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active'));
create policy "images_manage_own" on public.listing_images
  for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and public.cng_owns_store(l.store_id)))
  with check (exists (select 1 from public.listings l where l.id = listing_id and public.cng_owns_store(l.store_id)));

-- ---------- orders: comprador y vendedor ven la suya ------------------------
grant select, insert on public.orders to authenticated;
create policy "orders_select_party" on public.orders
  for select to authenticated
  using (public.cng_has_role('admin')
         or public.cng_owns_store(store_id)
         or exists (select 1 from public.identity_profiles p where p.id = buyer_id and p.user_id = auth.uid()));
create policy "orders_insert_buyer" on public.orders
  for insert to authenticated
  with check (exists (select 1 from public.identity_profiles p where p.id = buyer_id and p.user_id = auth.uid()));
-- (cambios de status/pago: server-side con service_role)

-- ---------- order_items ----------------------------------------------------
grant select, insert on public.order_items to authenticated;
create policy "items_select_party" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (public.cng_has_role('admin') or public.cng_owns_store(o.store_id)
           or exists (select 1 from public.identity_profiles p where p.id = o.buyer_id and p.user_id = auth.uid()))));
create policy "items_insert_buyer" on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    join public.identity_profiles p on p.id = o.buyer_id
    where o.id = order_id and p.user_id = auth.uid()));

-- ---------- reviews: lectura pública; inserta el comprador -----------------
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
create policy "reviews_select_public" on public.reviews
  for select to anon, authenticated using (true);
create policy "reviews_insert_buyer" on public.reviews
  for insert to authenticated
  with check (exists (select 1 from public.identity_profiles p where p.id = reviewer_id and p.user_id = auth.uid()));

-- ---------- quote_requests: requester y vendedor ---------------------------
grant select, insert on public.quote_requests to authenticated;
create policy "quotes_insert_requester" on public.quote_requests
  for insert to authenticated
  with check (exists (select 1 from public.identity_profiles p where p.id = requester_id and p.user_id = auth.uid()));
create policy "quotes_select_party" on public.quote_requests
  for select to authenticated
  using (public.cng_has_role('admin')
         or public.cng_owns_store(store_id)
         or exists (select 1 from public.identity_profiles p where p.id = requester_id and p.user_id = auth.uid()));

-- ============================================================================
-- 6. SEED — categorías (LOBs nativas; Travel queda fuera, es enlace a Expedia)
-- ============================================================================
insert into public.categories (slug, name, default_type, sort_order) values
  ('store',        'Store',        'buy_now', 1),
  ('nutrition',    'Nutrition',    'buy_now', 2),
  ('real_estate',  'Real Estate',  'quote',   3),
  ('store_local',  'Store Local',  'quote',   4)
on conflict (slug) do nothing;

-- ============================================================================
-- FIN migración 1.
-- Pendientes para después de aplicar:
--  (1) En el panel de Supabase Auth del proyecto NUEVO: desactivar el registro
--      público ("Allow new users to sign up" = OFF). Ese es el switch DURO de
--      "solo por invitación".
--  (2) Crear la cuenta RAÍZ (fundador): darla de alta en Auth, luego insertar
--      su fila en identity_profiles con referred_by = NULL, y un rol
--      ('cng_store','admin') en platform_roles.
--  (3) Migración 2: recrear la capa social (cng_posts, cng_messages, etc.)
--      antes del cutover de la app al proyecto nuevo.
-- ============================================================================
