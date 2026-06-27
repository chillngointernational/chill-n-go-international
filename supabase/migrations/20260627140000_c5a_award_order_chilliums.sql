-- C-5a: reparto de Chilliums 70/30 al LIBERAR. Acuña el 70% de la comisión (1 Chillium = 1 peso):
-- 50% comprador / 50% invitador (referred_by, profile.id directo). Sin invitador o redondeo -> tesoro.
-- Reusa apply_chilliums (buyer/inviter) + platform_treasury/treasury_ledger (tesoro). Idempotente por
-- orders.chilliums_awarded. Solo se acredita en orden 'completed' (no refunded/cancelled).

-- 1) config: % de Chilliums (resto = empresa). 50/50 comprador/invitador es fijo (core del modelo).
alter table public.platform_config
  add column if not exists chilliums_reward_pct numeric not null default 70;
comment on column public.platform_config.chilliums_reward_pct is
  '% de la comision que se acuna como Chilliums (resto = empresa). Default 70. El 50/50 comprador/invitador es fijo.';

-- 2) treasury_ledger: + tipo chilliums_rounding (para el crumb del redondeo cuando hay invitador).
alter table public.treasury_ledger drop constraint if exists treasury_ledger_type_check;
alter table public.treasury_ledger add constraint treasury_ledger_type_check check (type in
  ('cushion_accrual','hold_reclaim','refund_draw','chilliums_cushion','chilliums_orphan','chilliums_rounding','adjustment'));

-- 3) rpc_award_order_chilliums
create or replace function public.rpc_award_order_chilliums(p_order_id uuid)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  v_status text; v_buyer uuid; v_fee numeric; v_awarded boolean;
  v_pct numeric; v_pool bigint; v_buyer_share bigint; v_partner_share bigint;
  v_inviter uuid; v_treasury bigint; v_treasury_type text; v_chill_after bigint;
begin
  select status, buyer_id, platform_fee, chilliums_awarded
    into v_status, v_buyer, v_fee, v_awarded
  from public.orders where id=p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if v_awarded then return 'already_awarded'; end if;            -- idempotencia
  if v_status <> 'completed' then return 'not_released'; end if; -- solo al liberar (excluye refunded/cancelled)

  select coalesce(chilliums_reward_pct, 70) into v_pct from public.platform_config where id=true;
  v_pool := floor(coalesce(v_fee,0) * v_pct / 100.0)::bigint;    -- Chilliums del 70% (1 Chillium = 1 peso)
  v_buyer_share   := (v_pool / 2);                               -- floor (division entera bigint)
  v_partner_share := (v_pool / 2);                               -- floor

  select referred_by into v_inviter from public.identity_profiles where id = v_buyer;

  if v_buyer_share > 0 then
    perform public.apply_chilliums(v_buyer, v_buyer_share, 'purchase_reward', 'Recompensa por compra', null, 0, p_order_id);
  end if;

  if v_inviter is not null then
    if v_partner_share > 0 then
      perform public.apply_chilliums(v_inviter, v_partner_share, 'referral_reward', 'Recompensa por invitado', v_buyer, 1, p_order_id);
    end if;
    v_treasury := v_pool - v_buyer_share - v_partner_share;      -- solo el crumb del redondeo
    v_treasury_type := 'chilliums_rounding';
  else
    v_treasury := v_pool - v_buyer_share;                        -- huerfano: 50% invitador + redondeo
    v_treasury_type := 'chilliums_orphan';
  end if;

  if v_treasury > 0 then
    update public.platform_treasury set chilliums_balance = chilliums_balance + v_treasury, updated_at=now()
      where id=true returning chilliums_balance into v_chill_after;
    insert into public.treasury_ledger(order_id, asset, type, amount, balance_after, description)
    values (p_order_id, 'chilliums', v_treasury_type, v_treasury, v_chill_after,
            case when v_treasury_type='chilliums_orphan' then 'Sin invitador: 50% + redondeo al tesoro'
                 else 'Redondeo al tesoro' end);
  end if;

  update public.orders set chilliums_awarded = true, updated_at=now() where id=p_order_id;
  return 'awarded';
end $function$;

revoke execute on function public.rpc_award_order_chilliums(uuid) from public, anon, authenticated;
grant  execute on function public.rpc_award_order_chilliums(uuid) to service_role;
