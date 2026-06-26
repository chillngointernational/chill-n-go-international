-- Envíos E-5: integrar el ENVÍO al cobro real. 💰 (sandbox mientras checkout_live=false).
-- orders gana shipping_cost/carrier/service + total normalizado; rpc_create_order acepta el envío
-- YA RE-COTIZADO por el edge (server-side) y lo suma al total. Params de envío OPCIONALES con
-- default -> llamado sin envío = comportamiento C-3 IDÉNTICO (subtotal+comisión, shipping 0).
-- La comisión sigue SOLO sobre el producto; el envío es pass-through (sin comisión).
-- SEGURIDAD: rpc_create_order queda ejecutable SOLO por service_role (el edge re-cotiza; el cliente
-- nunca llama directo -> no puede inyectar un precio de envío falso).

-- 1) Columnas de envío en orders + normalización de total.
alter table public.orders
  add column if not exists shipping_cost    numeric(12,2) not null default 0,
  add column if not exists shipping_carrier text,
  add column if not exists shipping_service text;

-- total era numeric sin precisión y nullable; normalizar a numeric(12,2) NOT NULL (0 nulos hoy).
alter table public.orders alter column total type numeric(12,2) using round(total, 2);
alter table public.orders alter column total set not null;

-- 2) rpc_create_order: + envío opcional. DROP del de 4 args (evita overload ambiguo) + CREATE de 8.
drop function if exists public.rpc_create_order(uuid, uuid, uuid, integer);

create or replace function public.rpc_create_order(
  p_buyer_user_id    uuid,
  p_listing_id       uuid,
  p_variant_id       uuid,
  p_quantity         integer,
  p_shipping_cost    numeric default 0,
  p_shipping_address jsonb   default null,
  p_shipping_carrier text    default null,
  p_shipping_service text    default null
)
returns table(order_id uuid, subtotal numeric, commission numeric, shipping numeric, total numeric, currency text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_buyer_profile  uuid;
  v_store_id       uuid;
  v_title          text;
  v_status         text;
  v_type           text;
  v_currency       text;
  v_price          numeric;
  v_stock          integer;
  v_active         boolean;
  v_commission_pct numeric;
  v_subtotal       numeric;
  v_commission     numeric;
  v_shipping       numeric;
  v_total          numeric;
  v_order_id       uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity_invalid';
  end if;

  -- E-5: envío YA re-cotizado por el edge (server-side). Aquí solo se registra y suma.
  v_shipping := round(coalesce(p_shipping_cost, 0), 2);
  if v_shipping < 0 then
    raise exception 'shipping_invalid';
  end if;

  select id into v_buyer_profile from public.identity_profiles where user_id = p_buyer_user_id;
  if v_buyer_profile is null then
    raise exception 'buyer_not_found';
  end if;

  select l.store_id, l.title, l.status, l.type, l.currency
    into v_store_id, v_title, v_status, v_type, v_currency
    from public.listings l where l.id = p_listing_id;
  if v_store_id is null or v_status <> 'active' then
    raise exception 'listing_not_available';
  end if;
  if v_type <> 'buy_now' then
    raise exception 'listing_not_purchasable';
  end if;

  select lv.price, lv.stock, lv.is_active
    into v_price, v_stock, v_active
    from public.listing_variants lv where lv.id = p_variant_id and lv.listing_id = p_listing_id;
  if v_price is null or v_active is not true then
    raise exception 'variant_not_available';
  end if;
  if v_stock < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  select pc.commission_pct into v_commission_pct from public.platform_config pc where pc.id = true;
  v_subtotal   := round(v_price * p_quantity, 2);
  v_commission := round(v_subtotal * v_commission_pct / 100.0, 2);  -- comisión SOLO sobre el producto
  v_total      := v_subtotal + v_commission + v_shipping;            -- + envío (pass-through)

  insert into public.orders
    (buyer_id, store_id, status, subtotal, platform_fee, shipping_cost, total, currency,
     shipping_address, shipping_carrier, shipping_service)
  values
    (v_buyer_profile, v_store_id, 'pending_payment', v_subtotal, v_commission, v_shipping, v_total, coalesce(v_currency, 'MXN'),
     p_shipping_address, p_shipping_carrier, p_shipping_service)
  returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, listing_id, title_snapshot, unit_price, quantity)
  values (v_order_id, p_variant_id, p_listing_id, v_title, v_price, p_quantity);

  return query select v_order_id, v_subtotal, v_commission, v_shipping, v_total, coalesce(v_currency, 'MXN');
end;
$function$;

-- Preservar la postura de C-3: SOLO service_role (el edge). El cliente nunca lo llama directo.
revoke execute on function public.rpc_create_order(uuid, uuid, uuid, integer, numeric, jsonb, text, text) from public, anon, authenticated;
grant  execute on function public.rpc_create_order(uuid, uuid, uuid, integer, numeric, jsonb, text, text) to service_role;
