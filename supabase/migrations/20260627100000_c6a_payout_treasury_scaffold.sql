-- C-6a: andamiaje de retención/liberación + tesoro (fondo de devoluciones).
-- Aditivo y NO-destructivo. NO enciende retiro real al banco ni checkout_live.

-- 1) orders: columnas de envío/tracking (listas para E-6) + reembolso. Todas nullable.
alter table public.orders
  add column if not exists shipped_at          timestamptz,
  add column if not exists tracking_number     text,
  add column if not exists tracking_carrier    text,
  add column if not exists tracking_url         text,
  add column if not exists shipping_label_url   text,
  add column if not exists refunded_at          timestamptz,
  add column if not exists refund_amount_cents  bigint;

-- 2) platform_treasury (singleton). money_reserve_cents = fondo de devoluciones (C-6);
--    chilliums_balance = lo usará C-5. Saldos no-negativos (backstop del needs_admin).
create table if not exists public.platform_treasury (
  id boolean primary key default true,
  money_reserve_cents bigint not null default 0,
  chilliums_balance   bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint platform_treasury_singleton    check (id = true),
  constraint platform_treasury_money_nonneg check (money_reserve_cents >= 0),
  constraint platform_treasury_chill_nonneg check (chilliums_balance >= 0)
);
insert into public.platform_treasury (id) values (true) on conflict (id) do nothing;

-- Tesoro = interno: ningún cliente lo lee/escribe. RLS sin políticas + revoke a public/anon/authenticated
-- (deshace los default privileges de Supabase) + grant explícito SOLO a service_role.
alter table public.platform_treasury enable row level security;
revoke all on public.platform_treasury from public, anon, authenticated;
grant select, insert, update on public.platform_treasury to service_role;

-- 3) treasury_ledger: auditoría firmada de ambos activos (money/chilliums).
create table if not exists public.treasury_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  asset text not null check (asset in ('money','chilliums')),
  type  text not null check (type in
        ('cushion_accrual','hold_reclaim','refund_draw',
         'chilliums_cushion','chilliums_orphan','adjustment')),
  amount bigint not null,                 -- firmado: + entra, - sale
  balance_after bigint not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_treasury_ledger_order on public.treasury_ledger(order_id);

alter table public.treasury_ledger enable row level security;
revoke all on public.treasury_ledger from public, anon, authenticated;
grant select, insert on public.treasury_ledger to service_role;

-- 4) platform_config: % del colchón de dinero (admin), default 0 = apagado.
alter table public.platform_config
  add column if not exists money_cushion_pct numeric not null default 0;
comment on column public.platform_config.money_cushion_pct is
  '% de la comision que se acumula al FONDO de devoluciones al liberar (C-6). Default 0 = apagado. Guia: mantener <=30 (parte de la empresa).';
