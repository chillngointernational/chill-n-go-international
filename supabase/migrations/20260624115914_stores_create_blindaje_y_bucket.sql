-- ETAPA A (creación de tienda) — blindaje de stores + bucket de assets de tienda.
-- NO toca SELECT (stores_select_public / stores_select_own) ni stores_update_own (RLS de "es mía").

-- ============================================================================
-- 1) Blindaje de stores (anti-auto-aprobación + creación solo server-side).
-- ============================================================================
-- Creación SOLO vía edge function (service_role). El cliente pierde INSERT.
revoke insert on public.stores from authenticated;

-- Edición segura del cliente: quitar el UPDATE amplio y conceder SOLO columnas no sensibles.
-- (status, slug, owner_id, mp_user_id, mp_connected quedan FUERA -> no auto-aprobación, slug fijo.)
revoke update on public.stores from authenticated;
grant  update (name, description, logo_url, brand_config) on public.stores to authenticated;

-- La policy de inserción rota (gateaba en el rol 'seller' que nadie concede) queda sin privilegio
-- detrás; la quitamos por limpieza (A-6). La creación es exclusivamente service_role.
drop policy if exists "stores_insert_seller" on public.stores;

-- ============================================================================
-- 2) Bucket cng-store-assets (público) para logos de tienda (y, a futuro, banner/video).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cng-store-assets', 'cng-store-assets', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

-- Escritura SOLO en la carpeta propia (<user_id>/...); lectura pública vía bucket public=true.
create policy "cng_store_assets_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'cng-store-assets' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "cng_store_assets_update_own" on storage.objects for update to authenticated
  using      (bucket_id = 'cng-store-assets' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'cng-store-assets' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "cng_store_assets_delete_own" on storage.objects for delete to authenticated
  using      (bucket_id = 'cng-store-assets' and (storage.foldername(name))[1] = (auth.uid())::text);
