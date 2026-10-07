-- =====================================================================
-- 0012: coupon preview for checkout
-- Lets the order page show "−$5.00 with WELCOME10" BEFORE the order is placed.
-- It applies exactly the same rules as create_order (same checks, same maths) but
-- writes nothing and locks nothing. create_order stays the only authority: a
-- preview is advice, the order total is computed again when the order is placed.
-- Callable while signed out (checkout is public); the per-customer limit is only
-- checked when someone is signed in.
-- =====================================================================
create or replace function public.preview_coupon(p_plan_id uuid, p_location_id uuid, p_code text)
returns table (discount_cents int, list_price_cents int, total_cents int)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_plan   public.plans%rowtype;
  v_price  public.plan_pricing%rowtype;
  v_coupon public.coupons%rowtype;
  v_list   int;
  v_disc   int := 0;
begin
  select * into v_plan from public.plans p where p.id = p_plan_id and p.is_active;
  if not found then perform private.fail('NOT_FOUND'); end if;

  select pp.* into v_price
  from public.plan_pricing pp
  join public.locations l on l.id = pp.location_id and l.is_active
  where pp.plan_id = v_plan.id and pp.location_id = p_location_id and pp.is_active;
  if not found then perform private.fail('NOT_FOUND'); end if;

  v_list := v_price.price_cents;

  select * into v_coupon from public.coupons c where lower(c.code) = lower(btrim(p_code));
  if not found
     or not v_coupon.is_active
     or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
     or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
     or (v_coupon.applies_product is not null and v_coupon.applies_product <> v_plan.product)
     or (v_coupon.applies_plan_id is not null and v_coupon.applies_plan_id <> v_plan.id)
     or (v_coupon.applies_location_id is not null and v_coupon.applies_location_id <> p_location_id)
     or v_list < v_coupon.min_order_cents
     or (v_coupon.max_redemptions is not null and v_coupon.redeemed_count >= v_coupon.max_redemptions)
     or (v_uid is not null and v_coupon.per_user_limit is not null and (
           select count(*) from public.coupon_redemptions r
           where r.coupon_id = v_coupon.id and r.user_id = v_uid
         ) >= v_coupon.per_user_limit)
  then
    perform private.fail('COUPON_INVALID');
  end if;

  if v_coupon.type = 'percent' then
    v_disc := floor(v_list::numeric * v_coupon.value / 100)::int;
  else
    v_disc := least(v_coupon.value, v_list);
  end if;
  if v_list - v_disc <= 0 then perform private.fail('COUPON_INVALID'); end if;

  return query select v_disc, v_list, v_list - v_disc;
end;
$$;

revoke execute on function public.preview_coupon(uuid, uuid, text) from public;
grant execute on function public.preview_coupon(uuid, uuid, text) to anon, authenticated;
