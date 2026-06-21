-- service_role grants — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- La migracion del core/marketplace (chillngo_core_marketplace.sql) otorgo permisos a
-- anon/authenticated pero NO a service_role, dejando 14 tablas (identity_profiles,
-- invitations, listings, orders, stores, etc.) sin acceso para el rol de backend.
-- Sintoma: las edge functions (que usan la service key / sb_secret_) reciben
-- "42501 permission denied for table ...". service_role es el rol de servidor (bypassa
-- RLS, solo se usa server-side) y debe tener acceso completo al esquema public.
-- Idempotente: re-otorgar es no-op. NO afecta anon/authenticated ni las policies RLS.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
