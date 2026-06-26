-- C-4: aplicar el pago de una orden de producto (lo llama cng-mp-order-webhook tras confirmar el
-- pago real en Mercado Pago). ATÓMICO + IDEMPOTENTE (dedupe por la transición de status con FOR
-- UPDATE: una orden solo pasa de pending_payment una vez). Marca paid + decrementa stock con guarda
-- atómica (sobreventa explícita 'paid_oversold', no silenciosa) + acredita el wallet del vendedor
-- (RETENIDO = pending; su SUBTOTAL). Chilliums y liberación quedan FUERA (C-5/C-6): chilliums_awarded
-- se queda en false y el dinero queda retenido esperando. checkout_live NO se toca (sandbox).
-- Solo service_role lo ejecuta (lo invoca el edge); el cliente nunca lo llama directo.

create or replace function public.rpc_apply_order_payment(
  p_order_id        uuid,
  p_mp_payment_id   text,
  p_status          text,
  p_amount_cents    bigint,
  p_currency        text,
  p_payment_method  text default null,
  p_payment_type    text default null
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status         text;
  v_total          numeric;
  v_subtotal       numeric;
  v_currency       text;
  v_store_id       uuid;
  v_owner_id       uuid;
  v_subtotal_cents bigint;
  v_acct_id        uuid;
  v_pending        bigint;
  v_available      bigint;
  v_oversold       boolean := false;
  r                record;
begin
  -- Lock de la orden (serializa avisos concurrentes/duplicados de MP).
  select status, total, subtotal, currency, store_id
    into v_status, v_total, v_subtotal, v_currency, v_store_id
  from public.orders where id = p_order_id for update;

  if not found then
    return 'unknown_order';
  end if;

  -- IDEMPOTENCIA: si ya no está pendiente, ya se procesó (segundo aviso de MP = no-op).
  if v_status <> 'pending_payment' then
    return 'duplicate';
  end if;

  -- Defensa en profundidad: re-validar monto y moneda (el edge ya cruzó esto).
  if p_amount_cents is null or p_amount_cents <> round(v_total * 100)::bigint then
    return 'amount_mismatch';
  end if;
  if p_currency is null or p_currency <> v_currency then
    return 'currency_mismatch';
  end if;

  if p_status = 'approved' then
    -- 1) Decrementar stock con GUARDA ATÓMICA por item (stock >= qty). Si falla -> sobreventa.
    for r in select variant_id, quantity from public.order_items where order_id = p_order_id loop
      update public.listing_variants
         set stock = stock - r.quantity, updated_at = now()
       where id = r.variant_id and stock >= r.quantity;
      if not found then
        v_oversold := true; -- el dinero ya entró; se resuelve manual (reabastecer/reembolsar)
      end if;
    end loop;

    -- 2) Marcar la orden pagada (registra datos del pago de MP).
    update public.orders
       set status = 'paid', paid_at = now(),
           mp_payment_id = p_mp_payment_id, mp_status = p_status,
           payment_method = coalesce(p_payment_method, payment_method),
           payment_type   = coalesce(p_payment_type, payment_type),
           updated_at = now()
     where id = p_order_id;

    -- 3) Acreditar el wallet del vendedor (RETENIDO). Recibe su SUBTOTAL (comisión = plataforma;
    --    envío = financia la guía E-6). La liberación pending->available es C-6.
    select owner_id into v_owner_id from public.stores where id = v_store_id;
    v_subtotal_cents := round(coalesce(v_subtotal, 0) * 100)::bigint;

    insert into public.wallet_accounts (owner_id, currency)
    values (v_owner_id, coalesce(v_currency, 'MXN'))
    on conflict (owner_id) do nothing;

    select id, pending_cents, available_cents
      into v_acct_id, v_pending, v_available
    from public.wallet_accounts where owner_id = v_owner_id for update;

    v_pending := v_pending + v_subtotal_cents;
    update public.wallet_accounts set pending_cents = v_pending, updated_at = now() where id = v_acct_id;

    insert into public.wallet_ledger (account_id, order_id, type, pending_delta, available_delta, pending_after, available_after, description)
    values (v_acct_id, p_order_id, 'sale_hold', v_subtotal_cents, 0, v_pending, v_available, 'Venta retenida');

    if v_oversold then return 'paid_oversold'; end if;
    return 'paid';

  elsif p_status in ('rejected', 'cancelled') then
    update public.orders
       set status = 'cancelled', mp_status = p_status,
           mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id), updated_at = now()
     where id = p_order_id;
    return 'failed';

  else
    -- pending / in_process / authorized / etc.: dejar la orden pendiente.
    return 'noop';
  end if;
end;
$function$;

revoke execute on function public.rpc_apply_order_payment(uuid, text, text, bigint, text, text, text) from public, anon, authenticated;
grant  execute on function public.rpc_apply_order_payment(uuid, text, text, bigint, text, text, text) to service_role;
