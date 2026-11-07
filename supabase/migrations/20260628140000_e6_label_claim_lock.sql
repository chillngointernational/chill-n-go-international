-- E-6 · Pieza 3: candado anti-doble-cargo para la generación de guía (SOLO DB; sin edge ni frontend).
-- rpc_claim_label  : claim atómico + fetch de los insumos congelados, todo bajo FOR UPDATE de la orden.
--                    El guard `label_state IS NULL` es lo que bloquea el segundo clic (already_claimed).
-- rpc_release_label: revierte un claim EN CURSO ('generating') cuando Envia falla. NUNCA toca 'generated'.
--                    outcome 'failed' = terminal (revisión manual: no sabemos si Envia cobró);
--                    outcome 'retry'  = vuelve a NULL (reclamable: seguro que Envia no creó nada).
-- SECURITY DEFINER, idempotentes, fail-closed. Solo service_role (las invoca el edge con cliente admin).
-- Join al dueño: orders.store_id -> stores.id -> stores.owner_id (= identity_profiles.id), igual que rpc_mark_shipped.

create or replace function public.rpc_claim_label(p_order_id uuid, p_seller_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_owner uuid; v_status text; v_label_state text;
  v_origin jsonb; v_package jsonb; v_declared int;
  v_ship_addr jsonb; v_carrier text; v_service text;
begin
  -- Lock REAL de la fila de la orden (join a stores solo para resolver el dueño).
  select s.owner_id, o.status, o.label_state,
         o.origin_snapshot, o.package_snapshot, o.declared_value_cents,
         o.shipping_address, o.shipping_carrier, o.shipping_service
    into v_owner, v_status, v_label_state, v_origin, v_package, v_declared,
         v_ship_addr, v_carrier, v_service
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id
  for update of o;

  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_seller_id is null or v_owner is distinct from p_seller_id then
    return jsonb_build_object('ok', false, 'code', 'not_owner'); end if;
  if v_status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'not_paid'); end if;
  if v_label_state is not null then        -- generating/generated/failed -> bloquea el segundo clic
    return jsonb_build_object('ok', false, 'code', 'already_claimed'); end if;
  if v_origin is null or v_package is null or v_declared is null then  -- fail-closed si Pieza 2 no llenó
    return jsonb_build_object('ok', false, 'code', 'missing_snapshot'); end if;

  update public.orders set label_state = 'generating', updated_at = now() where id = p_order_id;

  -- Claim + fetch atómico: devuelve los insumos congelados que el edge necesita para armar el body.
  return jsonb_build_object(
    'ok', true, 'code', 'claimed',
    'origin_snapshot', v_origin,
    'package_snapshot', v_package,
    'declared_value_cents', v_declared,
    'shipping_address', v_ship_addr,
    'shipping_carrier', v_carrier,
    'shipping_service', v_service
  );
end $function$;

create or replace function public.rpc_release_label(p_order_id uuid, p_seller_id uuid, p_outcome text)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare v_owner uuid; v_label_state text; v_new_state text;
begin
  if p_outcome not in ('failed', 'retry') then
    return jsonb_build_object('ok', false, 'code', 'bad_outcome'); end if;

  select s.owner_id, o.label_state into v_owner, v_label_state
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id
  for update of o;

  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_seller_id is null or v_owner is distinct from p_seller_id then
    return jsonb_build_object('ok', false, 'code', 'not_owner'); end if;
  -- Solo revierte un claim EN CURSO. NUNCA toca 'generated' (ni 'failed' ni NULL).
  if v_label_state is distinct from 'generating' then
    return jsonb_build_object('ok', false, 'code', 'not_generating', 'label_state', v_label_state); end if;

  v_new_state := case when p_outcome = 'failed' then 'failed' else null end;
  update public.orders set label_state = v_new_state, updated_at = now() where id = p_order_id;

  return jsonb_build_object('ok', true, 'code', 'released', 'label_state', v_new_state);
end $function$;

-- Seguridad: solo service_role (el edge admin). Fuera de public/anon/authenticated.
revoke execute on function public.rpc_claim_label(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public.rpc_release_label(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.rpc_claim_label(uuid, uuid)        to service_role;
grant  execute on function public.rpc_release_label(uuid, uuid, text) to service_role;
