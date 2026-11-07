-- E-6 · Pieza 1: cimientos DB para la generación de guía con Envia. SOLO esquema; sin lógica de guía.
-- Idempotente (add column if not exists + guarda de constraint). Todas las columnas nuevas en orders
-- son NULLABLE para no romper las filas existentes. shipping_live es el kill-switch de envío (default
-- OFF), gemelo de checkout_live: SOLO === true en el edge encenderá Envia LIVE; null/error = sandbox.

-- 1) orders: estado de la guía + insumos congelados al cobrar (origen, paquete, valor declarado).
alter table public.orders add column if not exists label_state          text;
alter table public.orders add column if not exists envia_shipment_id    text;
alter table public.orders add column if not exists origin_snapshot      jsonb;
alter table public.orders add column if not exists package_snapshot     jsonb;
alter table public.orders add column if not exists declared_value_cents integer;

-- CHECK de label_state (NULL = sin guía aún). ADD CONSTRAINT no acepta IF NOT EXISTS -> guarda manual.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_label_state_check'
  ) then
    alter table public.orders
      add constraint orders_label_state_check
      check (label_state is null or label_state in ('generating','generated','failed'));
  end if;
end $$;

comment on column public.orders.label_state          is 'E-6: estado de la guía Envia. NULL=sin guía; generating=claim en curso; generated=guía emitida; failed=falló (reintentable).';
comment on column public.orders.envia_shipment_id    is 'E-6: shipmentId de Envia (data[0].shipmentId), necesario para cancelar/anular la guía y recuperar saldo.';
comment on column public.orders.origin_snapshot      is 'E-6: origen congelado al cobrar (name, phone, email, street, number, district, city, state[código 3 díg], postal_code, country, reference). Espejo de shipping_address (destino).';
comment on column public.orders.package_snapshot     is 'E-6: paquete congelado al cobrar (weight_grams, length_cm, width_cm, height_cm).';
comment on column public.orders.declared_value_cents is 'E-6: valor declarado congelado en centavos (precio × cantidad al momento de la compra).';

-- 2) platform_config: kill-switch de envío live (default OFF, fail-closed). Gemelo de checkout_live.
alter table public.platform_config add column if not exists shipping_live boolean not null default false;

comment on column public.platform_config.shipping_live is 'E-6 kill-switch: true = Envia LIVE (gasta saldo real); false/null = sandbox. Se lee con === true (fail-closed), igual que checkout_live.';
