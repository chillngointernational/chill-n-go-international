-- Etapa Productos P-1 (capa de datos). SOLO agrega; no modifica datos existentes.
--   1) Formaliza listings.status con CHECK ('draft','active','suspended') + índice (store_id,status).
--      Validado contra las filas existentes (listings vacío -> limpio).
--   2) RPC atómico rpc_upsert_product: guarda un "producto simple" (listing + 1 variante
--      default que carga precio/stock + N imágenes) en UNA transacción.
--
-- Las tablas listings/listing_variants/listing_images y su RLS de propietario YA existían
-- (migración del marketplace): insert/update/delete gateados por cng_owns_store(store_id),
-- lectura pública de status='active'. Esta pieza NO toca esa RLS.

-- ============================================================================
-- 1) CHECK + índice de status
-- ============================================================================
alter table public.listings
  add constraint listings_status_check
  check (status in ('draft', 'active', 'suspended'));

create index if not exists idx_listings_store_status
  on public.listings (store_id, status);

-- ============================================================================
-- 2) RPC atómico para guardar un producto (create o update).
--    SECURITY INVOKER a propósito: corre como el caller, así la RLS EXISTENTE
--    (listings_insert_own / listings_update_own = cng_owns_store(store_id),
--     variants/images manage_own) es la que gatea la propiedad. El RPC NO abre
--    superficie nueva: un vendedor solo puede escribir en SU tienda, igual que
--    con escrituras directas, pero ahora ATÓMICO (o se guarda todo, o nada).
--
--    Producto "simple": type='buy_now', lob='store', 1 variante default (precio/stock),
--    imágenes en orden. Publicar al instante = p_status='active'.
--    p_listing_id NULL -> create; con valor -> update idempotente (reemplaza imágenes).
-- ============================================================================
create or replace function public.rpc_upsert_product(
  p_store_id    uuid,
  p_category_id uuid,
  p_title       text,
  p_price       numeric,
  p_stock       integer,
  p_description text   default null,
  p_images      text[] default '{}',
  p_status      text   default 'active',
  p_listing_id  uuid   default null
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
  -- Validaciones de entrada (defensa en profundidad; la propiedad la gatea la RLS).
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

  if p_listing_id is null then
    -- CREATE. La RLS listings_insert_own (with_check cng_owns_store) bloquea crear
    -- en una tienda ajena -> error -> rollback de TODO lo de esta transacción.
    insert into public.listings (store_id, category_id, type, lob, title, description, currency, status)
    values (p_store_id, p_category_id, 'buy_now', 'store', btrim(p_title), v_desc, 'MXN', p_status)
    returning id into v_listing_id;

    insert into public.listing_variants (listing_id, name, price, stock, is_active)
    values (v_listing_id, 'default', p_price, v_stock, true);
  else
    -- UPDATE. La RLS listings_update_own (cng_owns_store) bloquea editar lo ajeno.
    update public.listings
       set category_id = p_category_id,
           title       = btrim(p_title),
           description = v_desc,
           status      = p_status
     where id = p_listing_id
    returning id into v_listing_id;

    if v_listing_id is null then
      -- 0 filas: no existe o no es tuyo (filtrado por RLS) -> nada que guardar.
      raise exception 'not_found_or_forbidden' using errcode = 'no_data_found';
    end if;

    -- Variante default: actualizar la existente; si faltara, crearla.
    update public.listing_variants
       set price = p_price, stock = v_stock, is_active = true
     where listing_id = v_listing_id
    returning id into v_variant_id;

    if v_variant_id is null then
      insert into public.listing_variants (listing_id, name, price, stock, is_active)
      values (v_listing_id, 'default', p_price, v_stock, true);
    end if;

    -- Imágenes: reemplazo total (idempotente).
    delete from public.listing_images where listing_id = v_listing_id;
  end if;

  -- Imágenes (compartido create/update). sort_order = posición en el arreglo.
  if array_length(p_images, 1) is not null then
    insert into public.listing_images (listing_id, url, sort_order)
    select v_listing_id, img.url, (img.ord - 1)::int
    from unnest(p_images) with ordinality as img(url, ord)
    where coalesce(btrim(img.url), '') <> '';
  end if;

  return v_listing_id;
end;
$function$;

-- Callable por el caller autenticado (SECURITY INVOKER + RLS hacen el gate de propiedad).
-- Nunca anon/public.
revoke execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid) from public, anon;
grant  execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid) to authenticated;
