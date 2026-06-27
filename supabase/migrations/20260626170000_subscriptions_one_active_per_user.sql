-- Palanca #2 (anti-duplicados, hallazgo HIGH de la revisión adversarial): a lo sumo UNA
-- suscripción 'authorized' por usuario. Candado atómico que gana cualquier carrera entre dos
-- submits del Card Payment Brick. Las suscripciones 'pending'/'cancelled' NO se restringen
-- (permite re-suscribirse tras cancelar). El edge cng-mp-create-subscription también chequea
-- una suscripción activa antes de cobrar; este índice cierra la carrera a nivel DB.
-- Reversible: drop index if exists public.subscriptions_one_active_per_user;
create unique index if not exists subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status = 'authorized';
