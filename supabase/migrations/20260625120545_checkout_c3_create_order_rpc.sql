-- Checkout C-3 (DB): rpc_create_order — crea la orden de forma SERVER-ONLY y ATÓMICA.
--
-- El cálculo del monto vive AQUÍ (autoridad del servidor): lee el precio real de la
-- variante en la DB e ignora cualquier monto del cliente (no hay parámetro de precio).
-- Aplica commission_pct de platform_config (10% ENCIMA). Valida listing/variante active +
-- stock (NO descuenta stock — eso es C-4 al pagar). Inserta orders('pending_payment') +
-- order_items con snapshot de precio/título, en UNA transacción.
--
-- SOLO service_role lo ejecuta (lo llama la edge function cng-mp-create-order). El cliente
-- NO puede llamarlo ni insertar una orden (RLS de orders endurecida en C-1).

create or replace function public.rpc_create_order(
  p_buyer_user_id uuid,
  p_listing_id    uuid,
  p_variant_id    uuid,
  p_quantity      integer
)
returns table (order_id uuid, subtotal numeric, commission numeric, total numeric, currency text)
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
  v_total          numeric;
  v_order_id       uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity_invalid';
  end if;

  -- Comprador (perfil) a partir del user autenticado que pasa la edge function.
  select id into v_buyer_profile from public.identity_profiles where user_id = p_buyer_user_id;
  if v_buyer_profile is null then
    raise exception 'buyer_not_found';
  end if;

  -- Listing: debe estar ACTIVE y ser comprable (buy_now). Alias 'l' para no colisionar con
  -- los OUT params del RETURNS TABLE (currency, etc.).
  select l.store_id, l.title, l.status, l.type, l.currency
    into v_store_id, v_title, v_status, v_type, v_currency
    from public.listings l where l.id = p_listing_id;
  if v_store_id is null or v_status <> 'active' then
    raise exception 'listing_not_available';
  end if;
  if v_type <> 'buy_now' then
    raise exception 'listing_not_purchasable';
  end if;

  -- Variante: debe pertenecer al listing, estar activa y tener stock suficiente.
  select price, stock, is_active
    into v_price, v_stock, v_active
    from public.listing_variants where id = p_variant_id and listing_id = p_listing_id;
  if v_price is null or v_active is not true then
    raise exception 'variant_not_available';
  end if;
  if v_stock < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  -- Monto SERVER-SIDE: precio de la DB * cantidad + comisión (% encima), en 2 decimales (centavos exactos).
  select commission_pct into v_commission_pct from public.platform_config where id = true;
  v_subtotal   := round(v_price * p_quantity, 2);
  v_commission := round(v_subtotal * v_commission_pct / 100.0, 2);
  v_total      := v_subtotal + v_commission;

  insert into public.orders (buyer_id, store_id, status, subtotal, platform_fee, total, currency)
  values (v_buyer_profile, v_store_id, 'pending_payment', v_subtotal, v_commission, v_total, coalesce(v_currency, 'MXN'))
  returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, listing_id, title_snapshot, unit_price, quantity)
  values (v_order_id, p_variant_id, p_listing_id, v_title, v_price, p_quantity);

  return query select v_order_id, v_subtotal, v_commission, v_total, coalesce(v_currency, 'MXN');
end;
$function$;

-- SOLO service_role (la edge function). El cliente no lo llama (server-only).
revoke execute on function public.rpc_create_order(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant  execute on function public.rpc_create_order(uuid, uuid, uuid, integer) to service_role;
