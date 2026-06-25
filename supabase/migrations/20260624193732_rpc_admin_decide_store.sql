-- Etapa D-2 (atómico): RPC que decide una tienda en UNA sola transacción.
--   Status (stores) + auditoría (store_moderation) pasan JUNTOS o no pasa ninguno.
--   Reemplaza el "update + insert best-effort" de la edge function por una transición atómica.
--
-- DOBLE CIERRE de admin:
--   1) la edge function ya gatea cng_is_admin() con el JWT del caller (403 limpio),
--   2) este RPC SE AUTO-GATEA con cng_is_admin() ANTES de tocar nada (fail-closed).
-- Como es SECURITY DEFINER y se llama con el JWT del caller (no service_role),
-- auth.uid() dentro = el admin que llama -> cng_is_admin() lo evalúa de verdad.
--
-- ATOMICIDAD: SIN bloque EXCEPTION. Si el INSERT de auditoría falla DESPUÉS del UPDATE,
-- la excepción propaga y revierte TODA la transacción (la tienda NO queda transicionada
-- sin su fila de moderación). Ese es justo el invariante que se exige.
--
-- El WHERE condicional `id = :store_id and status = 'pending'` es, a la vez:
--   candado (solo desde pending), idempotencia (2ª llamada -> 0 filas) y fail-closed.

create or replace function public.rpc_admin_decide_store(
  p_store_id uuid,
  p_action   text,
  p_reason   text default null
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new_status text;
  v_updated    uuid;
begin
  -- (1) AUTO-GATE: solo admin. Fail-closed -> cualquier no-admin sale sin tocar nada.
  if not public.cng_is_admin() then
    return 'forbidden';
  end if;

  -- (2) Validación (defensa en profundidad; la edge function también valida).
  if p_action not in ('approved', 'rejected') then
    return 'invalid_action';
  end if;
  if p_action = 'rejected' and coalesce(btrim(p_reason), '') = '' then
    return 'reason_required';
  end if;

  v_new_status := case when p_action = 'approved' then 'active' else 'rejected' end;

  -- (3) Transición CONDICIONAL (candado + idempotencia + fail-closed).
  update public.stores
     set status = v_new_status
   where id = p_store_id
     and status = 'pending'
  returning id into v_updated;

  -- (4) Auditoría EN LA MISMA TRANSACCIÓN. Si esto falla, el UPDATE de arriba se revierte.
  if v_updated is not null then
    insert into public.store_moderation (store_id, admin_id, action, reason)
    values (p_store_id, auth.uid(), p_action, nullif(btrim(coalesce(p_reason, '')), ''));
    return p_action;  -- 'approved' | 'rejected'
  end if;

  -- (5) 0 filas: ¿no existe, o ya no estaba en pending?
  if not exists (select 1 from public.stores where id = p_store_id) then
    return 'not_found';
  end if;
  return 'idempotent';  -- ya decidida -> no-op (NO re-loguea)
end;
$function$;

-- Callable por el caller autenticado (la edge function usa SU JWT, para que el auto-gate
-- evalúe al admin real). Se AUTO-GATEA fail-closed, así que un no-admin que lo llame directo
-- recibe 'forbidden' con CERO efecto. Nunca anon/public.
revoke execute on function public.rpc_admin_decide_store(uuid, text, text) from public, anon;
grant  execute on function public.rpc_admin_decide_store(uuid, text, text) to authenticated;
