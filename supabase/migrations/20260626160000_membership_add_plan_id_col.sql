-- Palanca #1: guardar el preapproval_plan_id de la membresía ($140/mes) en la config singleton,
-- para reutilizarlo al enganchar la suscripción al plan (flujo card_token/Bricks, Palanca #2).
-- El VALOR (el id del plan de producción) se fija operacionalmente por entorno, no en la migración
-- (es config específica de la cuenta MP de producción, como el access token).
-- Reversible: alter table public.platform_config drop column membership_plan_id;
alter table public.platform_config
  add column if not exists membership_plan_id text;

comment on column public.platform_config.membership_plan_id is
  'preapproval_plan_id de Mercado Pago (app de membresía) para suscripciones $140/mes enganchadas a plan. NULL = aún no se usa el flujo basado en plan.';
