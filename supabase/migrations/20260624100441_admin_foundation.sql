-- Cimiento del panel de admin (Etapa C). Solo AGREGA:
--   1) helper reutilizable cng_is_admin() para TODAS las secciones futuras del panel
--      (tiendas, vendedores, ventas, usuarios, reportes).
--   2) formaliza/versiona el rol admin que el FUNDADOR ya tiene desde construcción.
-- NO modifica policies existentes ni otras funciones.

-- ============================================================================
-- 1) Helper cng_is_admin(): solo-lectura, reutilizable. Envuelve cng_has_role('admin').
-- ============================================================================
create or replace function public.cng_is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.cng_has_role('admin');
$function$;

-- Permisos (mismo estándar del cierre de RPC): nunca anon; sí authenticated (lo usan las
-- policies del panel y los edge functions admin-gated con el JWT del caller) + service_role.
revoke execute on function public.cng_is_admin() from public, anon;
grant  execute on function public.cng_is_admin() to authenticated, service_role;

-- ============================================================================
-- 2) Formaliza (idempotente) el rol admin del FUNDADOR.
--    Fundador: oscar.jovani@chillngointernational.com
--              (uid 6269f1fa-2ed6-4c98-85cb-9e70561915ba).
--    La fila ya existe desde construcción -> hoy esto es un NO-OP; su valor es dejar el
--    hecho reproducible y documentado. NO crea poder nuevo. UNIQUE(user_id,platform,role)
--    garantiza que no se duplique.
-- ============================================================================
insert into public.platform_roles (user_id, platform, role, is_active)
select u.id, 'cng_store', 'admin', true
from auth.users u
where u.email = 'oscar.jovani@chillngointernational.com'
on conflict (user_id, platform, role) do nothing;
