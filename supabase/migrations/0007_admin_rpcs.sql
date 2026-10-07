-- =====================================================================
-- 0007: staff / admin RPCs
-- Each function authorises INSIDE the database (private.require_admin /
-- require_staff), mutates atomically, audits, and notifies the customer.
-- Callers use their own JWT so auth.uid() is the real actor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
create or replace function public.approve_payment(p_payment_id uuid, p_received_usd_cents int)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin   uuid := private.require_admin();
  v_pay     public.payments%rowtype;
  v_order   public.orders%rowtype;
  v_service public.services%rowtype;
  v_profile public.profiles%rowtype;
  v_new_exp timestamptz;
  v_from    public.order_status;
begin
  select * into v_pay from public.payments p where p.id = p_payment_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_pay.status <> 'pending' then perform private.fail('CONFLICT'); end if;

  select * into v_order from public.orders o where o.id = v_pay.order_id for update;
  if v_order.status <> 'under_review' then perform private.fail('CONFLICT'); end if;

  if p_received_usd_cents is null or p_received_usd_cents < v_order.total_cents then
    perform private.fail('AMOUNT_MISMATCH');
  end if;

  select * into v_profile from public.profiles pr where pr.id = v_order.user_id;
  v_from := v_order.status;

  update public.payments
     set status = 'verified', received_usd_cents = p_received_usd_cents,
         reviewed_by = v_admin, reviewed_at = now()
   where id = v_pay.id;

  insert into public.invoices (
    order_id, payment_id, user_id, subtotal_cents, discount_cents, total_cents, currency, billing_snapshot
  ) values (
    v_order.id, v_pay.id, v_order.user_id, v_order.list_price_cents, v_order.discount_cents,
    v_order.total_cents, v_order.currency,
    jsonb_build_object(
      'name', v_profile.full_name, 'email', v_profile.email,
      'country', v_profile.billing_country, 'company', v_profile.company,
      'order_number', v_order.order_number,
      'items', jsonb_build_array(jsonb_build_object(
        'description', v_order.plan_name || ' — ' || v_order.location_name || ' (' || v_order.term_days || ' days)',
        'amount_cents', v_order.list_price_cents)),
      'discount_code', v_order.coupon_code,
      'company_block', private.setting('company_block')
    )
  );

  if v_order.type = 'renewal' then
    select * into v_service from public.services s where s.id = v_order.service_id for update;
    if not found or v_service.status = 'terminated' then
      perform private.fail('SERVICE_TERMINATED');
    end if;
    v_new_exp := greatest(now(), v_service.expires_at) + make_interval(days => v_order.term_days);
    update public.services
       set expires_at = v_new_exp,
           status = case when status = 'expired' then 'active'::public.service_status else status end
     where id = v_service.id;
    update public.orders set status = 'completed', completed_at = now()
     where id = v_order.id returning * into v_order;

    perform private.notify(v_order.user_id, 'renewal_confirmed', 'Renewal confirmed',
      v_service.label || ' now runs until ' || to_char(v_new_exp at time zone 'UTC', 'DD Mon YYYY') || '.',
      '/dashboard/services/' || v_service.id, jsonb_build_object('service_id', v_service.id));
    perform private.enqueue_email(v_order.user_id, 'renewal_confirmed',
      jsonb_build_object('order_number', v_order.order_number, 'service_id', v_service.id, 'expires_at', v_new_exp));
  else
    update public.orders set status = 'approved'
     where id = v_order.id returning * into v_order;
    perform private.notify(v_order.user_id, 'payment_approved', 'Payment verified',
      'Your payment for ' || v_order.order_number || ' is verified. We are preparing your server.',
      '/dashboard/orders/' || v_order.id, jsonb_build_object('order_id', v_order.id));
    perform private.enqueue_email(v_order.user_id, 'payment_approved',
      jsonb_build_object('order_number', v_order.order_number, 'order_id', v_order.id));
  end if;

  perform private.order_event(v_order.id, 'payment_approved', v_from, v_order.status,
    jsonb_build_object('payment_id', v_pay.id, 'received_usd_cents', p_received_usd_cents));
  perform private.audit('payment.approve', 'payment', v_pay.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'verified', 'received_usd_cents', p_received_usd_cents, 'order', v_order.order_number));
  return v_order;
end;
$$;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text, p_message text default null)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_pay   public.payments%rowtype;
  v_order public.orders%rowtype;
  v_ext   int := private.setting_int('reject_extension_hours', 24);
begin
  if p_reason is null or btrim(p_reason) = '' then
    perform private.fail('REASON_REQUIRED');
  end if;

  select * into v_pay from public.payments p where p.id = p_payment_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_pay.status <> 'pending' then perform private.fail('CONFLICT'); end if;

  select * into v_order from public.orders o where o.id = v_pay.order_id for update;

  update public.payments
     set status = 'rejected', reject_reason = btrim(p_reason), reject_message = nullif(btrim(p_message), ''),
         reviewed_by = v_admin, reviewed_at = now()
   where id = v_pay.id;

  update public.orders
     set status = 'rejected',
         expires_at = greatest(expires_at, now()) + make_interval(hours => v_ext)
   where id = v_order.id returning * into v_order;

  perform private.order_event(v_order.id, 'payment_rejected', 'under_review', 'rejected',
    jsonb_build_object('payment_id', v_pay.id, 'reason', btrim(p_reason)));
  perform private.notify(v_order.user_id, 'payment_rejected', 'Payment could not be verified',
    btrim(p_reason) || coalesce(' — ' || nullif(btrim(p_message), ''), ''),
    '/dashboard/orders/' || v_order.id || '/pay', jsonb_build_object('order_id', v_order.id));
  perform private.enqueue_email(v_order.user_id, 'payment_rejected',
    jsonb_build_object('order_number', v_order.order_number, 'order_id', v_order.id, 'reason', btrim(p_reason)));
  perform private.audit('payment.reject', 'payment', v_pay.id::text,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), btrim(p_reason));
  return v_order;
end;
$$;

create or replace function public.start_provisioning(p_order_id uuid)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.type <> 'new' or v_order.status <> 'approved' then perform private.fail('CONFLICT'); end if;
  update public.orders set status = 'provisioning', assigned_to = v_admin
   where id = v_order.id returning * into v_order;
  perform private.order_event(v_order.id, 'provisioning_started', 'approved', 'provisioning');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Deliver a server. Credentials arrive ALREADY ENCRYPTED from the app.
-- ---------------------------------------------------------------------
create or replace function public.allocate_service(
  p_order_id uuid,
  p_label text,
  p_hostname text,
  p_ip inet,
  p_port int,
  p_username text,
  p_password_enc text,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_inventory_item_id uuid default null,
  p_expiry_reason text default null,
  p_notify boolean default true
)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin   uuid := private.require_admin();
  v_order   public.orders%rowtype;
  v_item    public.inventory_items%rowtype;
  v_service public.services%rowtype;
  v_start   timestamptz := coalesce(p_starts_at, now());
  v_default timestamptz;
  v_expires timestamptz;
  v_label   text;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.type <> 'new' or v_order.status not in ('approved', 'provisioning') then
    perform private.fail('CONFLICT');
  end if;
  if exists (select 1 from public.services s where s.order_id = v_order.id) then
    perform private.fail('CONFLICT');
  end if;
  if p_ip is null or p_username is null or btrim(p_username) = '' or p_password_enc is null or p_password_enc = '' then
    perform private.fail('VALIDATION');
  end if;
  if p_port is not null and p_port not between 1 and 65535 then
    perform private.fail('VALIDATION');
  end if;

  v_default := v_start + make_interval(days => v_order.term_days);
  v_expires := coalesce(p_expires_at, v_default);
  if v_expires <> v_default and (p_expiry_reason is null or btrim(p_expiry_reason) = '') then
    perform private.fail('REASON_REQUIRED');
  end if;
  if v_expires <= now() then perform private.fail('VALIDATION'); end if;

  v_label := coalesce(nullif(left(btrim(p_label), 60), ''), left(v_order.plan_name, 60));

  if p_inventory_item_id is not null then
    select * into v_item from public.inventory_items i where i.id = p_inventory_item_id for update;
    if not found
       or v_item.status <> 'available'
       or v_item.product <> v_order.product
       or v_item.location_id <> v_order.location_id then
      perform private.fail('CONFLICT');
    end if;
  end if;

  insert into public.services (
    user_id, order_id, plan_id, location_id, product, plan_name, plan_specs,
    label, hostname, ip, rdp_port, started_at, expires_at, inventory_item_id
  ) values (
    v_order.user_id, v_order.id, v_order.plan_id, v_order.location_id, v_order.product,
    v_order.plan_name, v_order.plan_specs,
    v_label, nullif(btrim(p_hostname), ''), p_ip, coalesce(p_port, 3389), v_start, v_expires, p_inventory_item_id
  )
  returning * into v_service;

  insert into public.service_credentials (service_id, username, password_enc, updated_by)
  values (v_service.id, btrim(p_username), p_password_enc, v_admin);

  if p_inventory_item_id is not null then
    update public.inventory_items
       set status = 'allocated', allocated_service_id = v_service.id
     where id = p_inventory_item_id;
  end if;

  update public.orders set status = 'completed', completed_at = now(), assigned_to = v_admin
   where id = v_order.id;

  perform private.order_event(v_order.id, 'service_delivered', v_order.status, 'completed',
    jsonb_build_object('service_id', v_service.id));

  if p_notify then
    perform private.notify(v_order.user_id, 'service_delivered', 'Your server is ready',
      v_service.label || ' has been delivered. Open it to see your connection details.',
      '/dashboard/services/' || v_service.id, jsonb_build_object('service_id', v_service.id));
    -- NEVER include credentials in the email payload.
    perform private.enqueue_email(v_order.user_id, 'service_delivered',
      jsonb_build_object('order_number', v_order.order_number, 'service_id', v_service.id, 'label', v_service.label));
  end if;

  perform private.audit('service.allocate', 'service', v_service.id::text, null,
    jsonb_build_object('order', v_order.order_number, 'ip', host(p_ip), 'expires_at', v_expires,
                       'inventory_item_id', p_inventory_item_id), p_expiry_reason);
  return v_service;
end;
$$;

-- ---------------------------------------------------------------------
-- Service lifecycle
-- ---------------------------------------------------------------------
create or replace function public.extend_service(
  p_service_id uuid,
  p_days int default null,
  p_set_expires_at timestamptz default null,
  p_reason text default null
)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.services%rowtype;
  v_old timestamptz;
  v_new timestamptz;
begin
  if (p_days is null) = (p_set_expires_at is null) then
    perform private.fail('VALIDATION');             -- exactly one of the two
  end if;
  if p_days is not null and p_days not between 1 and 3650 then
    perform private.fail('VALIDATION');
  end if;

  select * into v_s from public.services s where s.id = p_service_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_s.status = 'terminated' then perform private.fail('CONFLICT'); end if;

  -- custom extensions (anything other than the standard term) need a reason
  if (p_days is not null and p_days <> public.term_days() or p_set_expires_at is not null)
     and (p_reason is null or btrim(p_reason) = '') then
    perform private.fail('REASON_REQUIRED');
  end if;

  v_old := v_s.expires_at;
  v_new := coalesce(p_set_expires_at, greatest(now(), v_old) + make_interval(days => p_days));

  update public.services
     set expires_at = v_new,
         status = case when status = 'expired' and v_new > now() then 'active'::public.service_status else status end
   where id = v_s.id returning * into v_s;

  perform private.notify(v_s.user_id, 'service_extended', 'Service extended',
    v_s.label || ' now runs until ' || to_char(v_new at time zone 'UTC', 'DD Mon YYYY') || '.',
    '/dashboard/services/' || v_s.id, jsonb_build_object('service_id', v_s.id));
  perform private.audit('service.extend', 'service', v_s.id::text,
    jsonb_build_object('expires_at', v_old), jsonb_build_object('expires_at', v_new), p_reason);
  return v_s;
end;
$$;

create or replace function public.suspend_service(p_service_id uuid, p_reason text)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.services%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then perform private.fail('REASON_REQUIRED'); end if;
  select * into v_s from public.services s where s.id = p_service_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_s.status not in ('active', 'expired') then perform private.fail('CONFLICT'); end if;

  update public.services set status = 'suspended', suspended_reason = btrim(p_reason)
   where id = v_s.id returning * into v_s;

  perform private.notify(v_s.user_id, 'service_suspended', 'Service suspended',
    v_s.label || ' has been suspended: ' || btrim(p_reason), '/dashboard/services/' || v_s.id,
    jsonb_build_object('service_id', v_s.id));
  perform private.audit('service.suspend', 'service', v_s.id::text, null, null, btrim(p_reason));
  return v_s;
end;
$$;

create or replace function public.unsuspend_service(p_service_id uuid)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.services%rowtype;
begin
  select * into v_s from public.services s where s.id = p_service_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_s.status <> 'suspended' then perform private.fail('CONFLICT'); end if;

  update public.services
     set status = case when expires_at < now() then 'expired'::public.service_status else 'active'::public.service_status end,
         suspended_reason = null
   where id = v_s.id returning * into v_s;

  perform private.notify(v_s.user_id, 'service_unsuspended', 'Service restored',
    v_s.label || ' is available again.', '/dashboard/services/' || v_s.id,
    jsonb_build_object('service_id', v_s.id));
  perform private.audit('service.unsuspend', 'service', v_s.id::text);
  return v_s;
end;
$$;

create or replace function public.terminate_service(p_service_id uuid, p_reason text)
returns public.services
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.services%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then perform private.fail('REASON_REQUIRED'); end if;
  select * into v_s from public.services s where s.id = p_service_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_s.status = 'terminated' then perform private.fail('CONFLICT'); end if;

  update public.services set status = 'terminated', terminated_at = now()
   where id = v_s.id returning * into v_s;
  delete from public.service_credentials where service_id = v_s.id;
  update public.inventory_items set status = 'retired' where id = v_s.inventory_item_id;

  perform private.notify(v_s.user_id, 'service_terminated', 'Service terminated',
    v_s.label || ' has been terminated.', '/dashboard/services/' || v_s.id,
    jsonb_build_object('service_id', v_s.id));
  perform private.audit('service.terminate', 'service', v_s.id::text, null, null, btrim(p_reason));
  return v_s;
end;
$$;

create or replace function public.update_service_credentials(
  p_service_id uuid,
  p_username text,
  p_password_enc text,
  p_notify boolean default false
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.services%rowtype;
begin
  if p_username is null or btrim(p_username) = '' or p_password_enc is null or p_password_enc = '' then
    perform private.fail('VALIDATION');
  end if;
  select * into v_s from public.services s where s.id = p_service_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_s.status = 'terminated' then perform private.fail('CONFLICT'); end if;

  insert into public.service_credentials (service_id, username, password_enc, updated_by)
  values (v_s.id, btrim(p_username), p_password_enc, v_admin)
  on conflict (service_id) do update
    set username = excluded.username, password_enc = excluded.password_enc,
        updated_by = excluded.updated_by, updated_at = now();

  if p_notify then
    perform private.notify(v_s.user_id, 'credentials_updated', 'Connection details updated',
      'The login details for ' || v_s.label || ' were updated.', '/dashboard/services/' || v_s.id,
      jsonb_build_object('service_id', v_s.id));
  end if;
  -- audit the fact, never the secret
  perform private.audit('service.credentials_update', 'service', v_s.id::text);
end;
$$;

-- ---------------------------------------------------------------------
-- Orders / invoices
-- ---------------------------------------------------------------------
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_order public.orders%rowtype;
  v_from public.order_status;
begin
  if p_reason is null or btrim(p_reason) = '' then perform private.fail('REASON_REQUIRED'); end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.status not in ('awaiting_payment', 'under_review', 'rejected', 'approved', 'provisioning') then
    perform private.fail('CONFLICT');
  end if;
  v_from := v_order.status;
  update public.orders set status = 'cancelled', cancelled_at = now()
   where id = v_order.id returning * into v_order;
  -- a pending proof can no longer be approved
  update public.payments set status = 'rejected', reject_reason = 'Order cancelled', reviewed_by = v_admin, reviewed_at = now()
   where order_id = v_order.id and status = 'pending';
  perform private.release_coupon(v_order.id);
  perform private.order_event(v_order.id, 'cancelled_by_admin', v_from, 'cancelled', jsonb_build_object('reason', btrim(p_reason)));
  perform private.notify(v_order.user_id, 'order_cancelled', 'Order cancelled',
    'Order ' || v_order.order_number || ' was cancelled: ' || btrim(p_reason), '/dashboard/orders/' || v_order.id,
    jsonb_build_object('order_id', v_order.id));
  perform private.audit('order.cancel', 'order', v_order.id::text, jsonb_build_object('status', v_from), jsonb_build_object('status', 'cancelled'), btrim(p_reason));
  return v_order;
end;
$$;

-- Refunds are made outside the system (manual payments); this records them.
create or replace function public.mark_order_refunded(p_order_id uuid, p_amount_cents int, p_reason text)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_order public.orders%rowtype;
  v_from public.order_status;
begin
  if p_reason is null or btrim(p_reason) = '' then perform private.fail('REASON_REQUIRED'); end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_order.status not in ('approved', 'provisioning', 'completed') then perform private.fail('CONFLICT'); end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_order.total_cents then
    perform private.fail('VALIDATION');
  end if;
  v_from := v_order.status;
  update public.orders set status = 'refunded' where id = v_order.id returning * into v_order;
  perform private.order_event(v_order.id, 'refunded', v_from, 'refunded',
    jsonb_build_object('amount_cents', p_amount_cents, 'reason', btrim(p_reason)));
  perform private.audit('order.refund', 'order', v_order.id::text, jsonb_build_object('status', v_from),
    jsonb_build_object('status', 'refunded', 'amount_cents', p_amount_cents), btrim(p_reason));
  return v_order;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns public.invoices
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_inv public.invoices%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then perform private.fail('REASON_REQUIRED'); end if;
  update public.invoices set status = 'void', void_reason = btrim(p_reason)
   where id = p_invoice_id and status = 'paid' returning * into v_inv;
  if not found then perform private.fail('NOT_FOUND'); end if;
  perform private.audit('invoice.void', 'invoice', v_inv.id::text, null, null, btrim(p_reason));
  return v_inv;
end;
$$;

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_p public.profiles%rowtype;
  v_old public.user_role;
begin
  if p_user_id = v_admin then perform private.fail('FORBIDDEN'); end if;       -- never change your own role
  select * into v_p from public.profiles p where p.id = p_user_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  v_old := v_p.role;
  if v_old = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles x where x.role = 'admin' and x.status = 'active' and x.id <> p_user_id) = 0 then
    perform private.fail('LAST_ADMIN');
  end if;
  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set role = p_role where id = p_user_id returning * into v_p;
  perform set_config('app.bypass_profile_guard', 'off', true);
  perform private.audit('user.set_role', 'profile', p_user_id::text,
    jsonb_build_object('role', v_old), jsonb_build_object('role', p_role));
  return v_p;
end;
$$;

create or replace function public.set_account_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_p public.profiles%rowtype;
  v_old public.account_status;
begin
  if p_user_id = v_admin then perform private.fail('FORBIDDEN'); end if;
  if p_status = 'suspended' and (p_reason is null or btrim(p_reason) = '') then
    perform private.fail('REASON_REQUIRED');
  end if;
  select * into v_p from public.profiles p where p.id = p_user_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_p.role = 'admin' and p_status = 'suspended'
     and (select count(*) from public.profiles x where x.role = 'admin' and x.status = 'active' and x.id <> p_user_id) = 0 then
    perform private.fail('LAST_ADMIN');
  end if;
  v_old := v_p.status;
  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
     set status = p_status, suspended_reason = case when p_status = 'suspended' then btrim(p_reason) end
   where id = p_user_id returning * into v_p;
  perform set_config('app.bypass_profile_guard', 'off', true);
  if p_status = 'suspended' then
    perform private.enqueue_email(p_user_id, 'account_suspended', jsonb_build_object('reason', btrim(p_reason)));
  end if;
  perform private.audit('user.set_status', 'profile', p_user_id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_reason);
  return v_p;
end;
$$;

-- One-time bootstrap used by scripts/make-admin.ts with the SERVICE ROLE key.
-- Refuses to run once any admin exists.
create or replace function public.bootstrap_first_admin(p_email text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    perform private.fail('CONFLICT');
  end if;
  select p.id into v_id from public.profiles p where lower(p.email) = lower(btrim(p_email));
  if v_id is null then perform private.fail('NOT_FOUND'); end if;
  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set role = 'admin' where id = v_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, after)
  values (null, null, 'user.bootstrap_admin', 'profile', v_id::text, jsonb_build_object('role', 'admin'));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Support (staff)
-- ---------------------------------------------------------------------
create or replace function public.staff_reply_to_ticket(
  p_ticket_id uuid,
  p_body text,
  p_is_internal boolean default false,
  p_attachments jsonb default '[]'::jsonb
)
returns public.ticket_messages
language plpgsql security definer
set search_path = ''
as $$
declare
  v_staff uuid := private.require_staff();
  v_ticket public.tickets%rowtype;
  v_msg public.ticket_messages%rowtype;
  v_role public.user_role := private.app_role();
begin
  select * into v_ticket from public.tickets t where t.id = p_ticket_id for update;
  if not found then perform private.fail('NOT_FOUND'); end if;

  insert into public.ticket_messages (ticket_id, author_id, author_role, body, is_internal, attachments)
  values (v_ticket.id, v_staff, v_role, p_body, coalesce(p_is_internal, false), coalesce(p_attachments, '[]'::jsonb))
  returning * into v_msg;

  if not coalesce(p_is_internal, false) then
    update public.tickets set status = 'awaiting_customer' where id = v_ticket.id;
    perform private.notify(v_ticket.user_id, 'ticket_reply', 'New reply on your ticket',
      v_ticket.subject, '/dashboard/tickets/' || v_ticket.id, jsonb_build_object('ticket_id', v_ticket.id));
    if coalesce((select (pr.notification_prefs ->> 'ticket_replies')::boolean from public.profiles pr where pr.id = v_ticket.user_id), true) then
      perform private.enqueue_email(v_ticket.user_id, 'ticket_reply',
        jsonb_build_object('ticket_id', v_ticket.id, 'ticket_no', v_ticket.ticket_no, 'subject', v_ticket.subject));
    end if;
  end if;
  return v_msg;
end;
$$;

create or replace function public.assign_ticket(p_ticket_id uuid, p_assignee uuid)
returns public.tickets
language plpgsql security definer
set search_path = ''
as $$
declare
  v_staff uuid := private.require_staff();
  v_ticket public.tickets%rowtype;
begin
  if p_assignee is not null and not exists (
    select 1 from public.profiles p where p.id = p_assignee and p.role in ('support', 'admin')
  ) then
    perform private.fail('VALIDATION');
  end if;
  update public.tickets set assigned_to = p_assignee where id = p_ticket_id returning * into v_ticket;
  if not found then perform private.fail('NOT_FOUND'); end if;
  return v_ticket;
end;
$$;

create or replace function public.set_ticket_fields(
  p_ticket_id uuid,
  p_status public.ticket_status default null,
  p_priority public.ticket_priority default null,
  p_category public.ticket_category default null
)
returns public.tickets
language plpgsql security definer
set search_path = ''
as $$
declare
  v_staff uuid := private.require_staff();
  v_ticket public.tickets%rowtype;
begin
  update public.tickets set
    status   = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    category = coalesce(p_category, category),
    resolved_at = case when p_status = 'resolved' then now() when p_status is not null then null else resolved_at end,
    closed_at   = case when p_status = 'closed' then now() when p_status is not null then null else closed_at end
  where id = p_ticket_id returning * into v_ticket;
  if not found then perform private.fail('NOT_FOUND'); end if;
  return v_ticket;
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboards
-- ---------------------------------------------------------------------
create or replace function public.admin_action_queue()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v uuid := private.require_staff();
begin
  return jsonb_build_object(
    'payments_to_review',        (select count(*) from public.payments where status = 'pending'),
    'oldest_pending_payment_at', (select min(created_at) from public.payments where status = 'pending'),
    'orders_to_allocate',        (select count(*) from public.orders where type = 'new' and status in ('approved', 'provisioning')),
    'expiring_3d',               (select count(*) from public.services where status = 'active' and expires_at between now() and now() + interval '3 days'),
    'tickets_awaiting_staff',    (select count(*) from public.tickets where status = 'open'),
    'unread_inbox',              (select count(*) from public.contact_messages where status = 'unread')
  );
end;
$$;

create or replace function public.admin_kpis(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v uuid := private.require_admin();
begin
  return jsonb_build_object(
    'revenue_cents', coalesce((select sum(i.total_cents) from public.invoices i
                               where i.status = 'paid' and i.issued_at >= p_from and i.issued_at < p_to), 0),
    'orders',        (select count(*) from public.orders o where o.created_at >= p_from and o.created_at < p_to),
    'new_customers', (select count(*) from public.profiles p where p.role = 'customer' and p.created_at >= p_from and p.created_at < p_to),
    'active_services', (select count(*) from public.services s where s.status = 'active' and s.expires_at > now()),
    'renewals',      (select count(*) from public.orders o where o.type = 'renewal' and o.status = 'completed'
                      and o.completed_at >= p_from and o.completed_at < p_to),
    'new_orders_completed', (select count(*) from public.orders o where o.type = 'new' and o.status = 'completed'
                      and o.completed_at >= p_from and o.completed_at < p_to)
  );
end;
$$;

create or replace function public.admin_revenue_series(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns table (bucket timestamptz, revenue_cents bigint, invoices bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare v uuid := private.require_admin();
begin
  if p_bucket not in ('day', 'week', 'month') then perform private.fail('VALIDATION'); end if;
  return query
    select date_trunc(p_bucket, i.issued_at), sum(i.total_cents)::bigint, count(*)::bigint
    from public.invoices i
    where i.status = 'paid' and i.issued_at >= p_from and i.issued_at < p_to
    group by 1 order by 1;
end;
$$;
