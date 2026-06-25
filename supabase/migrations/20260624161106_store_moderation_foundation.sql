-- Etapa D-1: cimiento de moderación de tiendas.
--   1) CHECK formal del set de estados de stores.status.
--   2) Tabla de auditoría store_moderation (cada aprobación/rechazo) con RLS.
-- Solo AGREGA; no modifica stores ni otras tablas/funciones.

-- ============================================================================
-- 1) CHECK de stores.status (hoy era texto libre). Validado contra filas existentes.
-- ============================================================================
alter table public.stores
  add constraint stores_status_check
  check (status in ('pending', 'active', 'rejected', 'suspended'));

-- ============================================================================
-- 2) store_moderation: rastro de cada decisión de admin sobre una tienda.
-- ============================================================================
create table public.store_moderation (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  admin_id   uuid references auth.users(id) on delete set null,   -- preserva el log si el admin se borra
  action     text not null check (action in ('approved', 'rejected', 'suspended', 'reactivated')),
  reason     text,
  created_at timestamptz not null default now()
);
create index idx_store_moderation_store on public.store_moderation(store_id);

alter table public.store_moderation enable row level security;

-- Lectura: admins (todo el historial) + el DUEÑO de la tienda (su motivo de rechazo).
-- Escritura: SOLO service_role (la edge function cng-admin-store-decision). El cliente no escribe.
grant select on public.store_moderation to authenticated;
grant all    on public.store_moderation to service_role;

create policy "store_moderation_select" on public.store_moderation
  for select to authenticated
  using (public.cng_is_admin() or public.cng_owns_store(store_id));
-- (SIN policy de INSERT/UPDATE/DELETE -> el cliente no puede escribir; el server usa service_role.)
