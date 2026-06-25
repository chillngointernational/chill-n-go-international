-- Checkout C-1: fundación DB. SOLO esquema/RLS. NO mueve dinero (las tablas wallet
-- nacen vacías; la lógica que las escribe llega en C-4+ y va detrás del kill-switch).
--
--   1) platform_config: config editable (comisión, colchón, retención) + checkout_live
--      (kill-switch: false = sandbox / sin dinero real). Singleton.
--   2) orders: CHECK de status (máquina de estados) + columnas del flujo. Y se ENDURECE la
--      RLS -> la creación de órdenes pasa a ser SERVER-ONLY (el cliente ya no puede insertar,
--      no puede fabricar una orden 'paid'); solo lee las suyas.
--   3) wallet_accounts / wallet_ledger: saldos de DINERO del vendedor (pendiente/disponible).
--      Lectura: el dueño. Escritura: SOLO service_role / RPC SECURITY DEFINER (C-4+).

-- ============================================================================
-- 1) platform_config (singleton)
-- ============================================================================
create table public.platform_config (
  id             boolean primary key default true,
  commission_pct numeric not null default 10 check (commission_pct >= 0 and commission_pct <= 100),
  cushion_pct    numeric not null default 10 check (cushion_pct >= 0 and cushion_pct <= 100), -- % DE LA COMISIÓN; Chilliums = el resto
  hold_days      integer not null default 7  check (hold_days >= 0),
  checkout_live  boolean not null default false,  -- kill-switch: false = sandbox / sin dinero real
  updated_at     timestamptz not null default now(),
  constraint platform_config_singleton check (id = true)
);
insert into public.platform_config (id) values (true);

alter table public.platform_config enable row level security;
grant select on public.platform_config to anon, authenticated;
grant all    on public.platform_config to service_role;
-- Lectura pública (la UI necesita commission_pct para mostrar el total). Escritura: SOLO server
-- (el RPC admin llega en C-2). Sin policy de write -> el cliente no escribe.
create policy "config_select_all" on public.platform_config for select to anon, authenticated using (true);

-- ============================================================================
-- 2) orders: máquina de estados + columnas + endurecer RLS (creación server-only)
-- ============================================================================
alter table public.orders alter column status set default 'pending_payment';
alter table public.orders
  add constraint orders_status_check check (status in (
    'pending_payment', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed'
  ));
alter table public.orders
  add column mp_preference_id   text,
  add column payment_method     text,
  add column payment_type       text,
  add column total              numeric,          -- monto que paga el comprador (subtotal + platform_fee)
  add column paid_at            timestamptz,
  add column delivered_at       timestamptz,
  add column buyer_confirmed_at timestamptz,
  add column released_at        timestamptz,
  add column chilliums_awarded  boolean not null default false;

-- ENDURECER: la creación de órdenes pasa a server-only. El cliente ya NO inserta.
drop policy if exists "orders_insert_buyer" on public.orders;
drop policy if exists "items_insert_buyer"  on public.order_items;
-- (orders_select_party / items_select_party se conservan: comprador y vendedor leen.)

-- ============================================================================
-- 3) wallet de DINERO del vendedor (tablas vacías; escritura solo server)
-- ============================================================================
create table public.wallet_accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null unique references public.identity_profiles(id) on delete restrict,
  pending_cents   bigint not null default 0 check (pending_cents >= 0),
  available_cents bigint not null default 0 check (available_cents >= 0),
  currency        text not null default 'MXN',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.wallet_ledger (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.wallet_accounts(id) on delete cascade,
  order_id        uuid references public.orders(id) on delete set null,
  type            text not null check (type in ('sale_hold', 'release', 'refund', 'adjustment', 'withdrawal')),
  pending_delta   bigint not null default 0,
  available_delta bigint not null default 0,
  pending_after   bigint not null,
  available_after bigint not null,
  description     text,
  created_at      timestamptz not null default now()
);
create index idx_wallet_ledger_account on public.wallet_ledger(account_id);
create index idx_wallet_ledger_order   on public.wallet_ledger(order_id);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger   enable row level security;
grant select on public.wallet_accounts, public.wallet_ledger to authenticated;
grant all    on public.wallet_accounts, public.wallet_ledger to service_role;

-- Lectura: el DUEÑO (vendedor) lee su wallet; admin lee todo. Sin policy de write -> el cliente
-- nunca mueve su propio saldo; solo lo hace el server (service_role / RPC definer en C-4+).
create policy "wallet_accounts_select_own" on public.wallet_accounts
  for select to authenticated
  using (public.cng_is_admin() or exists (
    select 1 from public.identity_profiles p where p.id = wallet_accounts.owner_id and p.user_id = auth.uid()
  ));
create policy "wallet_ledger_select_own" on public.wallet_ledger
  for select to authenticated
  using (public.cng_is_admin() or exists (
    select 1 from public.wallet_accounts a
    join public.identity_profiles p on p.id = a.owner_id
    where a.id = wallet_ledger.account_id and p.user_id = auth.uid()
  ));
