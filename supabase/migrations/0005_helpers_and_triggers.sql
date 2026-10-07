-- =====================================================================
-- 0005: private helpers (never exposed through the Data API) + triggers
-- Every SECURITY DEFINER function pins search_path = '' and schema-qualifies
-- every object it touches.
-- =====================================================================

-- ---- raise a domain error the app maps to an ErrorCode ----------------
create or replace function private.fail(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end;
$$;

-- ---- who is calling ----------------------------------------------------
create or replace function private.app_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

-- Staff / admin only count while their account is active.
create or replace function private.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('support', 'admin') and p.status = 'active'
       from public.profiles p where p.id = (select auth.uid())),
    false);
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' and p.status = 'active'
       from public.profiles p where p.id = (select auth.uid())),
    false);
$$;

create or replace function private.require_user()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := (select auth.uid());
begin
  if v is null then
    perform private.fail('UNAUTHENTICATED');
  end if;
  return v;
end;
$$;

create or replace function private.require_active_user()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v uuid := private.require_user();
  v_status public.account_status;
begin
  select p.status into v_status from public.profiles p where p.id = v;
  if not found then
    perform private.fail('UNAUTHENTICATED');
  end if;
  if v_status <> 'active' then
    perform private.fail('ACCOUNT_SUSPENDED');
  end if;
  return v;
end;
$$;

create or replace function private.require_admin()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := private.require_user();
begin
  if not private.is_admin() then
    perform private.fail('FORBIDDEN');
  end if;
  return v;
end;
$$;

create or replace function private.require_staff()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := private.require_user();
begin
  if not private.is_staff() then
    perform private.fail('FORBIDDEN');
  end if;
  return v;
end;
$$;

-- ---- settings ----------------------------------------------------------
create or replace function private.setting(p_key text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select s.value from public.site_settings s where s.key = p_key;
$$;

create or replace function private.setting_int(p_key text, p_default int)
returns int
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::int from public.site_settings s where s.key = p_key), p_default);
$$;

-- Single source of truth for the plan length (30 days).
create or replace function public.term_days()
returns int
language sql stable security definer
set search_path = ''
as $$
  select private.setting_int('term_days', 30);
$$;

-- ---- audit / notify / email -------------------------------------------
create or replace function private.audit(
  p_action text, p_entity_type text, p_entity_id text,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip inet;
  v_ua text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  if v_headers is not null then
    begin
      v_ip := nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '')::inet;
    exception when others then
      v_ip := null;
    end;
    v_ua := left(v_headers ->> 'user-agent', 300);
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after, reason, ip, user_agent)
  values ((select auth.uid()), private.app_role(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason, v_ip, v_ua);
end;
$$;

create or replace function private.notify(
  p_user uuid, p_type text, p_title text,
  p_body text default null, p_link text default null, p_data jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb));
$$;

-- Queue an email. `p_data` must never contain credentials or passwords.
create or replace function private.enqueue_email(p_user uuid, p_template text, p_data jsonb default '{}'::jsonb)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.email_outbox (user_id, to_email, template, data)
  select p.id, p.email, p_template, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.id = p_user and p.email <> '';
$$;

create or replace function private.order_event(
  p_order uuid, p_event text,
  p_from public.order_status default null, p_to public.order_status default null,
  p_data jsonb default null
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.order_events (order_id, actor_id, event, from_status, to_status, data)
  values (p_order, (select auth.uid()), p_event, p_from, p_to, p_data);
$$;

-- Give back a coupon redemption when an order is cancelled / expires.
create or replace function private.release_coupon(p_order uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_coupon uuid;
begin
  delete from public.coupon_redemptions r where r.order_id = p_order returning r.coupon_id into v_coupon;
  if v_coupon is not null then
    update public.coupons c set redeemed_count = greatest(c.redeemed_count - 1, 0) where c.id = v_coupon;
  end if;
end;
$$;

-- ---- triggers ----------------------------------------------------------

-- New auth user -> profile. The role is ALWAYS 'customer': never read from
-- user-controlled metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync with auth.users.email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  perform set_config('app.bypass_profile_guard', 'off', true);
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Role / status / email can only change through the admin RPCs (which raise the
-- bypass flag). Defence in depth on top of the column-level grants.
create or replace function private.guard_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.suspended_reason is distinct from old.suspended_reason
      or new.email is distinct from old.email
      or new.id is distinct from old.id)
     and coalesce(current_setting('app.bypass_profile_guard', true), '') <> 'on' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function private.guard_profile();

-- Audit log is append-only — for every role, including the service role.
create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'AUDIT_IMMUTABLE';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_mutation();

-- Maintain ticket timestamps. Internal staff notes never touch customer-visible fields.
create or replace function private.sync_ticket_timestamps()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.is_internal then
    return new;
  end if;
  update public.tickets t set
    last_message_at = new.created_at,
    last_customer_message_at = case when new.author_role = 'customer' then new.created_at else t.last_customer_message_at end,
    last_staff_message_at    = case when new.author_role <> 'customer' then new.created_at else t.last_staff_message_at end
  where t.id = new.ticket_id;
  return new;
end;
$$;

create trigger ticket_messages_sync
  after insert on public.ticket_messages
  for each row execute function private.sync_ticket_timestamps();
