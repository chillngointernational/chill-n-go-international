-- Cierra el agujero del default-PUBLIC (EXECUTE a PUBLIC nunca revocado) en las funciones
-- SECURITY DEFINER que MUTAN estado sensible (verificacion, membresia, cuota de vendedor).
-- Solo el servidor (service_role, via las webhooks) debe ejecutarlas.

-- (1) service_role debe conservar EXECUTE. Las 3 rpc_apply_* ya tienen grant explicito;
--     _recompute_membership NO (ACL NULL) -> se lo damos ANTES de revocar PUBLIC.
grant execute on function public._recompute_membership(uuid) to service_role;

-- (2) Revocar EXECUTE de PUBLIC (cubre anon, authenticated y cualquier rol futuro).
revoke execute on function public.rpc_apply_identity_verification(text, text, uuid, text, integer, boolean, boolean, text, jsonb) from public;
revoke execute on function public.rpc_apply_mp_subscription_event(text, text, text, uuid, text, jsonb) from public;
revoke execute on function public.rpc_apply_seller_fee_payment(uuid, text, text) from public;
revoke execute on function public._recompute_membership(uuid) from public;

-- (3) Defensa idempotente: hoy NO hay grant explicito a estos roles en estas 4 (el acceso
--     venia de PUBLIC), pero lo dejamos explicito por si alguien lo agregara en el futuro.
revoke execute on function public.rpc_apply_identity_verification(text, text, uuid, text, integer, boolean, boolean, text, jsonb) from anon, authenticated;
revoke execute on function public.rpc_apply_mp_subscription_event(text, text, text, uuid, text, jsonb) from anon, authenticated;
revoke execute on function public.rpc_apply_seller_fee_payment(uuid, text, text) from anon, authenticated;
revoke execute on function public._recompute_membership(uuid) from anon, authenticated;
