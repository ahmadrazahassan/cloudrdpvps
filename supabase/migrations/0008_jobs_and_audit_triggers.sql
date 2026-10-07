-- =====================================================================
-- 0008: scheduled jobs + automatic audit of catalog edits
-- Jobs are SECURITY DEFINER, callable only by postgres / service_role.
-- =====================================================================

-- Unpaid orders past their deadline are cancelled and their coupon released.
create or replace function public.cancel_stale_orders()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select o.id, o.user_id, o.order_number, o.status
    from public.orders o
    where o.status in ('awaiting_payment', 'rejected') and o.expires_at < now()
    for update skip locked
  loop
    update public.orders set status = 'cancelled', cancelled_at = now() where id = r.id;
    perform private.release_coupon(r.id);
    perform private.order_event(r.id, 'expired_unpaid', r.status, 'cancelled');
    perform private.notify(r.user_id, 'order_cancelled', 'Order expired',
      'Order ' || r.order_number || ' was cancelled because payment was not received in time.',
      '/dashboard/orders/' || r.id, jsonb_build_object('order_id', r.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Active services past their expiry become 'expired' (data is never deleted here).
create or replace function public.expire_services()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id, s.user_id, s.label
    from public.services s
    where s.status = 'active' and s.expires_at < now()
    for update skip locked
  loop
    update public.services set status = 'expired' where id = r.id;
    perform private.notify(r.user_id, 'service_expired', 'Service expired',
      r.label || ' has expired. Renew it to keep your server.', '/dashboard/services/' || r.id,
      jsonb_build_object('service_id', r.id));
    perform private.enqueue_email(r.user_id, 'service_expired',
      jsonb_build_object('service_id', r.id, 'label', r.label));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- One reminder per service per threshold bucket (idempotent via reminder_key).
create or replace function public.enqueue_expiry_reminders()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
  v_days jsonb := coalesce(private.setting('reminder_days'), '[3,1]'::jsonb);
  v_key text;
begin
  for r in
    select s.id, s.user_id, s.label, s.expires_at,
           (select min(x::int) from jsonb_array_elements_text(v_days) x
             where s.expires_at <= now() + make_interval(days => x::int)) as bucket
    from public.services s
    where s.status = 'active' and s.expires_at > now()
  loop
    continue when r.bucket is null;
    v_key := r.id::text || ':' || r.bucket::text || ':' || to_char(r.expires_at at time zone 'UTC', 'YYYYMMDD');
    continue when exists (
      select 1 from public.notifications nt
      where nt.user_id = r.user_id and nt.type = 'expiring_soon' and nt.data ->> 'reminder_key' = v_key
    );
    perform private.notify(r.user_id, 'expiring_soon', 'Service expiring soon',
      r.label || ' expires on ' || to_char(r.expires_at at time zone 'UTC', 'DD Mon YYYY') || '.',
      '/dashboard/services/' || r.id,
      jsonb_build_object('service_id', r.id, 'reminder_key', v_key, 'days', r.bucket));
    perform private.enqueue_email(r.user_id, 'expiring_soon',
      jsonb_build_object('service_id', r.id, 'label', r.label, 'expires_at', r.expires_at, 'days', r.bucket));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Services past the grace period are flagged to admins (never auto-deleted).
create or replace function public.flag_terminate_due()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  a record;
  n int := 0;
  v_grace int := private.setting_int('grace_days', 2);
  v_key text;
begin
  for r in
    select s.id, s.label from public.services s
    where s.status = 'expired' and s.expires_at < now() - make_interval(days => v_grace)
  loop
    v_key := 'terminate_due:' || r.id::text;
    for a in select p.id from public.profiles p where p.role = 'admin' and p.status = 'active' loop
      if not exists (
        select 1 from public.notifications nt
        where nt.user_id = a.id and nt.type = 'terminate_due' and nt.data ->> 'reminder_key' = v_key
      ) then
        perform private.notify(a.id, 'terminate_due', 'Service ready to terminate',
          r.label || ' is past its grace period.', '/admin/services/' || r.id,
          jsonb_build_object('service_id', r.id, 'reminder_key', v_key));
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end;
$$;

-- pg_cron (Supabase). Skipped silently where the extension is unavailable
-- (e.g. local PGlite tests); the app also exposes /api/cron/maintenance as a fallback.
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron not available: %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('crv-cancel-stale-orders',   '0 * * * *',  'select public.cancel_stale_orders()');
    perform cron.schedule('crv-expire-services',       '5 0 * * *',  'select public.expire_services()');
    perform cron.schedule('crv-expiry-reminders',      '0 6 * * *',  'select public.enqueue_expiry_reminders()');
    perform cron.schedule('crv-flag-terminate-due',    '10 6 * * *', 'select public.flag_terminate_due()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Generic audit for direct (RLS-guarded) admin edits of catalog tables:
-- prices, plans, locations, payment methods, coupons, settings, FAQs.
-- ---------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id  text := coalesce(v_row ->> 'id', v_row ->> 'key', (v_row ->> 'plan_id') || ':' || (v_row ->> 'location_id'));
begin
  -- Only audit edits made by a signed-in actor. Seeding, migrations and system
  -- jobs run without a user and would otherwise flood the log.
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  -- never persist secrets that may live in a row
  v_old := v_old - 'password_enc';
  v_new := v_new - 'password_enc';
  perform private.audit(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_old, v_new);
  return coalesce(new, old);
end;
$$;

create trigger audit_locations        after insert or update or delete on public.locations        for each row execute function private.audit_row_change();
create trigger audit_plans            after insert or update or delete on public.plans            for each row execute function private.audit_row_change();
create trigger audit_plan_pricing     after insert or update or delete on public.plan_pricing     for each row execute function private.audit_row_change();
create trigger audit_payment_methods  after insert or update or delete on public.payment_methods  for each row execute function private.audit_row_change();
create trigger audit_coupons          after insert or update or delete on public.coupons          for each row execute function private.audit_row_change();
create trigger audit_site_settings    after insert or update or delete on public.site_settings    for each row execute function private.audit_row_change();
create trigger audit_faqs             after insert or update or delete on public.faqs             for each row execute function private.audit_row_change();
create trigger audit_inventory_items  after insert or update or delete on public.inventory_items  for each row execute function private.audit_row_change();
