-- Estándar de publicación 100% completo (Camino B: borrador privado).
-- draft = privado/incompleto-OK (no visible, no vendible). active = publicado, exige 100%.
-- Validación en RPC (mensajes) + DB (sello a prueba de balas para CUALQUIER vía de escritura).
-- Requiere datos ya limpios: las direcciones sin state-código y los productos active incompletos
-- se resolvieron ANTES (PIEZA D + DealNorte->draft) para que los ADD CONSTRAINT no fallen.

-- 1) rpc_upsert_product: completitud SOLO para 'active'; 'draft' puede guardarse a medias.
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
  v_title      text := btrim(coalesce(p_title, ''));
  v_n_images   int := coalesce(array_length(p_images, 1), 0);
begin
  -- SIEMPRE (draft y active): mínimos para tener una fila válida.
  if p_status not in ('draft', 'active', 'suspended') then
    raise exception 'status_invalid'   using errcode = 'check_violation';
  end if;
  if v_title = '' then
    raise exception 'title_required'    using errcode = 'check_violation';
  end if;
  if p_category_id is null then
    raise exception 'category_required' using errcode = 'check_violation';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'price_invalid'     using errcode = 'check_violation';
  end if;
  if v_stock < 0 then
    raise exception 'stock_invalid'     using errcode = 'check_violation';
  end if;
  -- Si se asigna un origen (en draft o active), debe ser una dirección PROPIA.
  if p_origin_address_id is not null
     and not public.cng_address_belongs_to_store(p_origin_address_id, p_store_id) then
    raise exception 'origin_address_invalid' using errcode = 'check_violation';
  end if;

  -- COMPLETITUD: solo al PUBLICAR (active).
  if p_status = 'active' then
    if char_length(v_title) < 2 or char_length(v_title) > 80 then
      raise exception 'title_length'        using errcode = 'check_violation';
    end if;
    if char_length(coalesce(v_desc, '')) < 30 then
      raise exception 'description_required' using errcode = 'check_violation';
    end if;
    if p_price <= 0 then
      raise exception 'price_required'       using errcode = 'check_violation';
    end if;
    if p_weight_grams is null or p_weight_grams < 1 then
      raise exception 'weight_required'      using errcode = 'check_violation';
    end if;
    if p_length_cm is null or p_length_cm <= 0
       or p_width_cm is null or p_width_cm <= 0
       or p_height_cm is null or p_height_cm <= 0 then
      raise exception 'dimensions_required'  using errcode = 'check_violation';
    end if;
    if p_origin_address_id is null then
      raise exception 'origin_required'      using errcode = 'check_violation';
    end if;
    if v_n_images < 3 then
      raise exception 'photos_required'      using errcode = 'check_violation';
    end if;
  end if;

  if p_listing_id is null then
    insert into public.listings (store_id, category_id, type, lob, title, description, currency, status, origin_address_id)
    values (p_store_id, p_category_id, 'buy_now', 'store', v_title, v_desc, 'MXN', p_status, p_origin_address_id)
    returning id into v_listing_id;

    insert into public.listing_variants (listing_id, name, price, stock, is_active, weight_grams, length_cm, width_cm, height_cm)
    values (v_listing_id, 'default', p_price, v_stock, true, p_weight_grams, p_length_cm, p_width_cm, p_height_cm);
  else
    update public.listings
       set category_id = p_category_id, title = v_title, description = v_desc,
           status = p_status, origin_address_id = p_origin_address_id
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

-- 2) Sello DB tabla-misma: un listing 'active' exige origen + título 2-80 + descripción >=30.
alter table public.listings drop constraint if exists listings_active_complete_chk;
alter table public.listings add constraint listings_active_complete_chk check (
  status <> 'active' or (
    origin_address_id is not null
    and char_length(btrim(title)) between 2 and 80
    and char_length(btrim(coalesce(description, ''))) >= 30
  )
);

-- 3) Sello DB cross-table (DIFERIDO): un listing 'active' exige variante con peso/dims + >=3 fotos.
--    Diferido a commit -> el RPC inserta listing->variante->fotos; al commit ya existen todas.
--    Atrapa CUALQUIER via de escritura (incluido INSERT directo saltando el RPC).
create or replace function public.cng_check_listing_active_complete()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ok_dims boolean;
  v_imgs    int;
begin
  if NEW.status = 'active' then
    select exists (
      select 1 from public.listing_variants v
      where v.listing_id = NEW.id
        and v.weight_grams >= 1 and v.length_cm > 0 and v.width_cm > 0 and v.height_cm > 0
    ) into v_ok_dims;
    if not v_ok_dims then
      raise exception 'listing_incomplete_shipping' using errcode = 'check_violation';
    end if;
    select count(*) into v_imgs from public.listing_images i where i.listing_id = NEW.id;
    if v_imgs < 3 then
      raise exception 'listing_incomplete_photos' using errcode = 'check_violation';
    end if;
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_listing_active_complete on public.listings;
create constraint trigger trg_listing_active_complete
  after insert or update on public.listings
  deferrable initially deferred
  for each row execute function public.cng_check_listing_active_complete();

-- 4) CHECK de state = uno de los 32 códigos válidos de Envia (solo MX). Datos ya limpios (PIEZA D).
alter table public.seller_addresses drop constraint if exists seller_addresses_state_chk;
alter table public.seller_addresses add constraint seller_addresses_state_chk check (
  country <> 'MX' or state = any(array[
    'AGS','BCN','BCS','CAM','CHP','CHH','CMX','COA','COL','DGO','GTO','GRO','HGO','JAL','MEX','MIC',
    'MOR','NAY','NLE','OAX','PUE','QRO','ROO','SLP','SIN','SON','TAB','TAM','TLA','VER','YUC','ZAC'])
);
alter table public.buyer_addresses drop constraint if exists buyer_addresses_state_chk;
alter table public.buyer_addresses add constraint buyer_addresses_state_chk check (
  country <> 'MX' or state = any(array[
    'AGS','BCN','BCS','CAM','CHP','CHH','CMX','COA','COL','DGO','GTO','GRO','HGO','JAL','MEX','MIC',
    'MOR','NAY','NLE','OAX','PUE','QRO','ROO','SLP','SIN','SON','TAB','TAM','TLA','VER','YUC','ZAC'])
);
