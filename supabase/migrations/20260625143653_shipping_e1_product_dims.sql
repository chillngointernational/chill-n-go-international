-- Envíos E-1: el alta de producto captura peso/dimensiones (REQUERIDOS para cotizar envío).
-- Las columnas ya existían en listing_variants (weight_grams, length_cm, width_cm, height_cm).
-- Extiende rpc_upsert_product con 4 params nuevos (requeridos + positivos) que se escriben en la
-- variante default. Sigue SECURITY INVOKER (la RLS de propietario gatea; sin cambios de seguridad).
-- DROP del signature viejo (9 args) + CREATE del nuevo (13 args) para no dejar overload ambiguo.

drop function if exists public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid);

create or replace function public.rpc_upsert_product(
  p_store_id     uuid,
  p_category_id  uuid,
  p_title        text,
  p_price        numeric,
  p_stock        integer,
  p_description  text    default null,
  p_images       text[]  default '{}',
  p_status       text    default 'active',
  p_listing_id   uuid    default null,
  p_weight_grams integer default null,
  p_length_cm    numeric default null,
  p_width_cm     numeric default null,
  p_height_cm    numeric default null
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

  if p_listing_id is null then
    insert into public.listings (store_id, category_id, type, lob, title, description, currency, status)
    values (p_store_id, p_category_id, 'buy_now', 'store', btrim(p_title), v_desc, 'MXN', p_status)
    returning id into v_listing_id;

    insert into public.listing_variants (listing_id, name, price, stock, is_active, weight_grams, length_cm, width_cm, height_cm)
    values (v_listing_id, 'default', p_price, v_stock, true, p_weight_grams, p_length_cm, p_width_cm, p_height_cm);
  else
    update public.listings
       set category_id = p_category_id,
           title       = btrim(p_title),
           description = v_desc,
           status      = p_status
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

revoke execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid, integer, numeric, numeric, numeric) from public, anon;
grant  execute on function public.rpc_upsert_product(uuid, uuid, text, numeric, integer, text, text[], text, uuid, integer, numeric, numeric, numeric) to authenticated;
