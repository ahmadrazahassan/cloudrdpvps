-- =====================================================================
-- 0006: customer RPCs (SECURITY DEFINER, caller identity from auth.uid())
-- Customers have NO direct write access to money / state tables; they call these.
-- Domain errors: RAISE ... errcode 'P0001', message = '<CODE>' (see lib/errors.ts)
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_order: price, stock, coupon and totals are computed HERE.
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_plan_id uuid,
  p_location_id uuid,
  p_coupon_code text default null,
  p_renew_service_id uuid default null
)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_active_user();
  v_plan    public.plans%rowtype;
  v_loc     public.locations%rowtype;
  v_price   public.plan_pricing%rowtype;
  v_service public.services%rowtype;
  v_coupon  public.coupons%rowtype;
  v_order   public.orders%rowtype;
  v_type    public.order_type := 'new';
  v_plan_id uuid := p_plan_id;
  v_loc_id  uuid := p_location_id;
  v_list    int;
  v_disc    int := 0;
  v_total   int;
  v_open    int;
  v_hours   int := private.setting_int('unpaid_order_hours', 48);
begin
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    perform private.fail('EMAIL_NOT_VERIFIED');
  end if;

  if coalesce((private.setting('maintenance') ->> 'enabled')::boolean, false) then
    perform private.fail('MAINTENANCE');
  end if;

  select count(*) into v_open
  from public.orders o
  where o.user_id = v_uid and o.status = 'awaiting_payment';
  if v_open >= private.setting_int('max_open_orders', 3) then
    perform private.fail('TOO_MANY_OPEN_ORDERS');
  end if;

  -- Renewal: same plan + location as the existing service, at today's price.
  if p_renew_service_id is not null then
    select * into v_service
    from public.services s
    where s.id = p_renew_service_id and s.user_id = v_uid
    for update;
    if not found then
      perform private.fail('NOT_FOUND');
    end if;
    if v_service.status not in ('active', 'expired') then
      perform private.fail('CONFLICT');
    end if;
    if exists (
      select 1 from public.orders o
      where o.service_id = v_service.id
        and o.status in ('awaiting_payment', 'under_review', 'rejected')
    ) then
      perform private.fail('RENEWAL_PENDING');
    end if;
    v_type := 'renewal';
    v_plan_id := v_service.plan_id;
    v_loc_id := v_service.location_id;
  end if;

  select * into v_plan from public.plans p where p.id = v_plan_id and p.is_active;
  if not found then
    perform private.fail(case when v_type = 'renewal' then 'PLAN_UNAVAILABLE' else 'NOT_FOUND' end);
  end if;

  select * into v_loc from public.locations l where l.id = v_loc_id and l.is_active;
  if not found then
    perform private.fail(case when v_type = 'renewal' then 'PLAN_UNAVAILABLE' else 'NOT_FOUND' end);
  end if;

  select * into v_price
  from public.plan_pricing pp
  where pp.plan_id = v_plan.id and pp.location_id = v_loc.id and pp.is_active
  for share;
  if not found then
    perform private.fail(case when v_type = 'renewal' then 'PLAN_UNAVAILABLE' else 'NOT_FOUND' end);
  end if;

  if v_type = 'new' and v_price.stock = 'out_of_stock' then
    perform private.fail('OUT_OF_STOCK');
  end if;

  v_list := v_price.price_cents;

  -- Coupon (locked so redemption counters stay correct under concurrency).
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons c
    where lower(c.code) = lower(btrim(p_coupon_code))
    for update;

    if not found
       or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
       or (v_coupon.applies_product is not null and v_coupon.applies_product <> v_plan.product)
       or (v_coupon.applies_plan_id is not null and v_coupon.applies_plan_id <> v_plan.id)
       or (v_coupon.applies_location_id is not null and v_coupon.applies_location_id <> v_loc.id)
       or v_list < v_coupon.min_order_cents
       or (v_coupon.max_redemptions is not null and v_coupon.redeemed_count >= v_coupon.max_redemptions)
       or (v_coupon.per_user_limit is not null and (
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
  end if;

  v_total := v_list - v_disc;
  if v_total <= 0 then
    perform private.fail('COUPON_INVALID');   -- never allow a free / negative order
  end if;

  insert into public.orders (
    user_id, type, service_id, plan_id, location_id, product,
    plan_name, plan_specs, location_name,
    list_price_cents, discount_cents, total_cents, term_days,
    coupon_id, coupon_code, expires_at
  ) values (
    v_uid, v_type, v_service.id, v_plan.id, v_loc.id, v_plan.product,
    v_plan.name,
    jsonb_build_object(
      'vcpu', v_plan.vcpu, 'ram_gb', v_plan.ram_gb, 'storage_gb', v_plan.storage_gb,
      'bandwidth_tb', v_plan.bandwidth_tb, 'port_mbps', v_plan.port_mbps,
      'features', to_jsonb(v_plan.features)
    ),
    v_loc.name,
    v_list, v_disc, v_total, public.term_days(),
    case when v_disc > 0 then v_coupon.id end,
    case when v_disc > 0 then v_coupon.code end,
    now() + make_interval(hours => v_hours)
  )
  returning * into v_order;

  if v_disc > 0 then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (v_coupon.id, v_uid, v_order.id);
    update public.coupons c set redeemed_count = c.redeemed_count + 1 where c.id = v_coupon.id;
  end if;

  perform private.order_event(v_order.id, 'created', null, v_order.status,
    jsonb_build_object('type', v_type, 'total_cents', v_total));
  perform private.notify(v_uid, 'order_placed', 'Order ' || v_order.order_number || ' placed',
    'Pay for your order to have your server delivered.', '/dashboard/orders/' || v_order.id,
    jsonb_build_object('order_id', v_order.id));
  perform private.enqueue_email(v_uid, 'order_placed',
    jsonb_build_object('order_number', v_order.order_number, 'total_cents', v_total, 'order_id', v_order.id));

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.id = p_order_id and o.user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.status not in ('awaiting_payment', 'rejected') then
    perform private.fail('CONFLICT');
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now()
  where id = v_order.id returning * into v_order;

  perform private.release_coupon(v_order.id);
  perform private.order_event(v_order.id, 'cancelled_by_customer', 'awaiting_payment', 'cancelled');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- submit_payment: the proof file was uploaded (and sniffed/hashed) by the app.
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(
  p_order_id uuid,
  p_method_id uuid,
  p_proof_path text,
  p_proof_sha256 text,
  p_mime text,
  p_size int,
  p_reference text default null,
  p_note text default null
)
returns public.payments
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active_user();
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_payment public.payments%rowtype;
  v_from public.order_status;
begin
  select * into v_order from public.orders o where o.id = p_order_id and o.user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.status not in ('awaiting_payment', 'rejected') then
    perform private.fail('CONFLICT');
  end if;
  if v_order.expires_at < now() then
    perform private.fail('ORDER_EXPIRED');
  end if;

  select * into v_method from public.payment_methods m where m.id = p_method_id and m.is_active;
  if not found then perform private.fail('NOT_FOUND'); end if;

  if v_method.requires_reference and (p_reference is null or btrim(p_reference) = '') then
    perform private.fail('REFERENCE_REQUIRED');
  end if;

  -- The proof must live in this user's own folder for this order.
  if p_proof_path is null
     or p_proof_path not like (v_uid::text || '/' || p_order_id::text || '/%')
     or p_proof_path like '%..%' then
    perform private.fail('UPLOAD_INVALID');
  end if;
  if p_proof_sha256 !~ '^[0-9a-f]{64}$' then
    perform private.fail('UPLOAD_INVALID');
  end if;

  if exists (select 1 from public.payments p where p.order_id = v_order.id and p.status = 'pending') then
    perform private.fail('CONFLICT');
  end if;

  insert into public.payments (
    order_id, user_id, method_id, method_name, amount_usd_cents,
    quoted_currency, quoted_amount, quoted_rate,
    reference, note, proof_path, proof_sha256, proof_mime, proof_size
  ) values (
    v_order.id, v_uid, v_method.id, v_method.name, v_order.total_cents,
    v_method.currency_code,
    case when v_method.rate_per_usd is not null
         then round(v_order.total_cents / 100.0 * v_method.rate_per_usd, 2) end,
    v_method.rate_per_usd,
    left(btrim(p_reference), 200), left(btrim(p_note), 1000),
    p_proof_path, p_proof_sha256, p_mime, p_size
  )
  returning * into v_payment;

  v_from := v_order.status;
  update public.orders set status = 'under_review' where id = v_order.id;

  perform private.order_event(v_order.id, 'payment_submitted', v_from, 'under_review',
    jsonb_build_object('payment_id', v_payment.id, 'method', v_method.name));
  perform private.notify(v_uid, 'payment_under_review', 'Payment received for review',
    'We are verifying your payment for order ' || v_order.order_number || '.',
    '/dashboard/orders/' || v_order.id, jsonb_build_object('order_id', v_order.id));
  perform private.enqueue_email(v_uid, 'payment_under_review',
    jsonb_build_object('order_number', v_order.order_number, 'order_id', v_order.id));

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------
-- Credentials: returns CIPHERTEXT only. The Next.js action decrypts.
-- Owner: only while the service is genuinely active. Admin: always. Every call audited.
-- ---------------------------------------------------------------------
create or replace function public.get_service_credentials(p_service_id uuid)
returns table (username text, password_enc text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_service public.services%rowtype;
  v_is_admin boolean := private.is_admin();
begin
  select * into v_service from public.services s where s.id = p_service_id;
  if not found then perform private.fail('NOT_FOUND'); end if;

  if v_is_admin then
    perform private.audit('credentials.reveal.admin', 'service', v_service.id::text);
  elsif v_service.user_id = v_uid then
    if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
      perform private.fail('ACCOUNT_SUSPENDED');
    end if;
    if v_service.status <> 'active' or v_service.expires_at < now() then
      perform private.fail('SERVICE_NOT_ACTIVE');
    end if;
    perform private.audit('credentials.reveal', 'service', v_service.id::text);
  else
    perform private.fail('FORBIDDEN');
  end if;

  return query
    select c.username, c.password_enc
    from public.service_credentials c
    where c.service_id = v_service.id;
end;
$$;

create or replace function public.rename_service(p_service_id uuid, p_label text)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active_user();
  v_service public.services%rowtype;
  v_label text := btrim(coalesce(p_label, ''));
begin
  if char_length(v_label) not between 1 and 60 then
    perform private.fail('VALIDATION');
  end if;
  update public.services set label = v_label
  where id = p_service_id and user_id = v_uid
  returning * into v_service;
  if not found then perform private.fail('NOT_FOUND'); end if;
  return v_service;
end;
$$;

-- ---------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------
create or replace function public.create_ticket(
  p_subject text,
  p_category public.ticket_category,
  p_service_id uuid,
  p_message text,
  p_attachments jsonb default '[]'::jsonb
)
returns public.tickets
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active_user();
  v_ticket public.tickets%rowtype;
begin
  if p_service_id is not null and not exists (
    select 1 from public.services s where s.id = p_service_id and s.user_id = v_uid
  ) then
    perform private.fail('NOT_FOUND');
  end if;

  insert into public.tickets (user_id, service_id, subject, category)
  values (v_uid, p_service_id, btrim(p_subject), p_category)
  returning * into v_ticket;

  insert into public.ticket_messages (ticket_id, author_id, author_role, body, attachments)
  values (v_ticket.id, v_uid, 'customer', p_message, coalesce(p_attachments, '[]'::jsonb));

  select * into v_ticket from public.tickets t where t.id = v_ticket.id;
  return v_ticket;
end;
$$;

create or replace function public.reply_to_ticket(
  p_ticket_id uuid,
  p_body text,
  p_attachments jsonb default '[]'::jsonb
)
returns public.ticket_messages
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active_user();
  v_ticket public.tickets%rowtype;
  v_msg public.ticket_messages%rowtype;
begin
  select * into v_ticket from public.tickets t where t.id = p_ticket_id and t.user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;

  if v_ticket.status = 'closed'
     and v_ticket.closed_at is not null
     and v_ticket.closed_at < now() - interval '7 days' then
    perform private.fail('TICKET_CLOSED');
  end if;

  insert into public.ticket_messages (ticket_id, author_id, author_role, body, attachments)
  values (v_ticket.id, v_uid, 'customer', p_body, coalesce(p_attachments, '[]'::jsonb))
  returning * into v_msg;

  update public.tickets set status = 'open', closed_at = null, resolved_at = null
  where id = v_ticket.id;
  return v_msg;
end;
$$;

create or replace function public.set_ticket_status_customer(p_ticket_id uuid, p_status public.ticket_status)
returns public.tickets
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active_user();
  v_ticket public.tickets%rowtype;
begin
  if p_status not in ('resolved', 'open') then
    perform private.fail('FORBIDDEN');
  end if;
  select * into v_ticket from public.tickets t where t.id = p_ticket_id and t.user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;

  if p_status = 'open'
     and v_ticket.status = 'closed'
     and v_ticket.closed_at is not null
     and v_ticket.closed_at < now() - interval '7 days' then
    perform private.fail('TICKET_CLOSED');
  end if;

  update public.tickets set
    status = p_status,
    resolved_at = case when p_status = 'resolved' then now() else null end,
    closed_at = case when p_status = 'open' then null else closed_at end
  where id = v_ticket.id
  returning * into v_ticket;
  return v_ticket;
end;
$$;
