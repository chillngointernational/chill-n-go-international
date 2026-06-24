-- get_my_referrals: red DIRECTA (1 nivel) del usuario autenticado.
-- SECURITY DEFINER porque la RLS de identity_profiles (profiles_select_self) NO deja
-- leer perfiles ajenos. La funcion resuelve al llamante con auth.uid() y SOLO devuelve
-- sus referidos directos (referred_by = su id de perfil). NO toma argumentos -> el
-- llamante no puede pedir la red de otro usuario. Expone unicamente columnas no sensibles.

create or replace function public.get_my_referrals()
returns table (
  id                     uuid,
  full_name              text,
  display_name           text,
  membership_status      text,
  created_at             timestamptz,
  direct_referrals_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.full_name,
    c.display_name,
    c.membership_status,
    c.created_at,
    c.direct_referrals_count
  from public.identity_profiles c
  where c.referred_by in (
    select p.id from public.identity_profiles p where p.user_id = auth.uid()
  )
  order by c.created_at desc;
$$;

-- Cierra el default de Postgres (EXECUTE a PUBLIC) y concede SOLO a usuarios autenticados.
revoke all on function public.get_my_referrals() from public, anon, authenticated;
grant execute on function public.get_my_referrals() to authenticated;
