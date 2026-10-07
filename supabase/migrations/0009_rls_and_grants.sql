-- =====================================================================
-- 0009: Row Level Security + privileges
-- Default-deny. Customers can READ their own rows and call RPCs; they cannot
-- write money / state tables directly. Policies use the (select ...) form so
-- Postgres evaluates auth.uid() / role checks once per statement.
-- =====================================================================

-- ---- 1. start from zero (Supabase auto-grants broad privileges) -------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- RLS policies call these two helpers as the invoking role.
grant usage on schema private to authenticated;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

-- ---- 2. enable RLS everywhere ----------------------------------------
alter table public.profiles            enable row level security;
alter table public.locations           enable row level security;
alter table public.plans               enable row level security;
alter table public.plan_pricing        enable row level security;
alter table public.payment_methods     enable row level security;
alter table public.coupons             enable row level security;
alter table public.coupon_redemptions  enable row level security;
alter table public.site_settings       enable row level security;
alter table public.faqs                enable row level security;
alter table public.orders              enable row level security;
alter table public.order_events        enable row level security;
alter table public.payments            enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.services            enable row level security;
alter table public.service_credentials enable row level security;   -- no policies: unreachable by clients
alter table public.invoices            enable row level security;
alter table public.tickets             enable row level security;
alter table public.ticket_messages     enable row level security;
alter table public.canned_responses    enable row level security;
alter table public.notifications       enable row level security;
alter table public.email_outbox        enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.staff_notes         enable row level security;
alter table public.contact_messages    enable row level security;

-- ---- 3. public catalog (anonymous + signed-in) ------------------------
grant select on public.locations, public.plans, public.plan_pricing, public.faqs, public.site_settings to anon, authenticated;

create policy locations_public_read on public.locations for select to anon, authenticated using (is_active);
create policy plans_public_read     on public.plans     for select to anon, authenticated using (is_active);
create policy plan_pricing_public_read on public.plan_pricing for select to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.plans p where p.id = plan_id and p.is_active)
    and exists (select 1 from public.locations l where l.id = location_id and l.is_active)
  );
create policy faqs_public_read      on public.faqs      for select to anon, authenticated using (is_published);
create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (is_public);

-- Only non-sensitive columns of ACTIVE payment methods, for the marketing site.
create view public.payment_methods_public as
  select id, name, type, regions, sort_order
  from public.payment_methods
  where is_active;
grant select on public.payment_methods_public to anon, authenticated;

-- ---- 4. admin-managed catalog writes ----------------------------------
grant select, insert, update, delete on
  public.locations, public.plans, public.plan_pricing, public.payment_methods,
  public.coupons, public.site_settings, public.faqs to authenticated;

create policy locations_staff_read on public.locations for select to authenticated using ((select private.is_staff()));
create policy locations_admin_write on public.locations for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy plans_staff_read on public.plans for select to authenticated using ((select private.is_staff()));
create policy plans_admin_write on public.plans for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy plan_pricing_staff_read on public.plan_pricing for select to authenticated using ((select private.is_staff()));
create policy plan_pricing_admin_write on public.plan_pricing for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy faqs_staff_read on public.faqs for select to authenticated using ((select private.is_staff()));
create policy faqs_admin_write on public.faqs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy site_settings_staff_read on public.site_settings for select to authenticated using ((select private.is_staff()));
create policy site_settings_admin_write on public.site_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- payment methods hold account details: signed-in users see ACTIVE ones only
create policy payment_methods_customer_read on public.payment_methods for select to authenticated using (is_active);
create policy payment_methods_staff_read    on public.payment_methods for select to authenticated using ((select private.is_staff()));
create policy payment_methods_admin_write   on public.payment_methods for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy coupons_admin_all on public.coupons for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.coupon_redemptions to authenticated;
create policy coupon_redemptions_admin_read on public.coupon_redemptions for select to authenticated using ((select private.is_admin()));

-- ---- 5. profiles -------------------------------------------------------
grant select on public.profiles to authenticated;
-- customers may change ONLY these columns; role/status/email are RPC-only
grant update (full_name, phone, billing_country, company, telegram, whatsapp, notification_prefs)
  on public.profiles to authenticated;

create policy profiles_own_read   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_staff_read on public.profiles for select to authenticated using ((select private.is_staff()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---- 6. orders / payments / services / invoices (read-only for clients)
grant select on public.orders, public.order_events, public.payments, public.services, public.services_v, public.invoices to authenticated;

create policy orders_own_read   on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy orders_staff_read on public.orders for select to authenticated using ((select private.is_staff()));

create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy payments_own_read   on public.payments for select to authenticated using (user_id = (select auth.uid()));
create policy payments_staff_read on public.payments for select to authenticated using ((select private.is_staff()));

create policy services_own_read   on public.services for select to authenticated using (user_id = (select auth.uid()));
create policy services_staff_read on public.services for select to authenticated using ((select private.is_staff()));

create policy invoices_own_read   on public.invoices for select to authenticated using (user_id = (select auth.uid()));
create policy invoices_staff_read on public.invoices for select to authenticated using ((select private.is_staff()));

-- ---- 7. inventory (admin only; the encrypted password column is never selectable)
grant select (id, product, location_id, plan_id, ip, rdp_port, username, supplier, supplier_ref,
              supplier_cost_cents, supplier_expires_at, status, allocated_service_id, notes, created_at, updated_at)
  on public.inventory_items to authenticated;
grant insert, update, delete on public.inventory_items to authenticated;
create policy inventory_admin_all on public.inventory_items for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---- 8. support --------------------------------------------------------
grant select on public.tickets, public.ticket_messages to authenticated;
grant select, insert, update, delete on public.canned_responses to authenticated;

create policy tickets_own_read   on public.tickets for select to authenticated using (user_id = (select auth.uid()));
create policy tickets_staff_read on public.tickets for select to authenticated using ((select private.is_staff()));

-- customers never see internal staff notes
create policy ticket_messages_customer_read on public.ticket_messages for select to authenticated
  using (not is_internal and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid())));
create policy ticket_messages_staff_read on public.ticket_messages for select to authenticated using ((select private.is_staff()));

create policy canned_responses_staff_all on public.canned_responses for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ---- 9. notifications / outbox / audit / notes / contact ---------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_own_read   on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.email_outbox to authenticated;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated using ((select private.is_admin()));

grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using ((select private.is_admin()));

grant select, insert on public.staff_notes to authenticated;
create policy staff_notes_staff_read   on public.staff_notes for select to authenticated using ((select private.is_staff()));
create policy staff_notes_staff_insert on public.staff_notes for insert to authenticated
  with check ((select private.is_staff()) and author_id = (select auth.uid()));

-- contact messages are inserted by a server action (service role) after Turnstile + rate limit
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;
create policy contact_messages_staff_read   on public.contact_messages for select to authenticated using ((select private.is_staff()));
create policy contact_messages_staff_update on public.contact_messages for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- service_credentials: RLS on, zero policies, zero grants -> only SECURITY DEFINER RPCs.

-- ---- 10. function execution -------------------------------------------
grant execute on function public.term_days() to anon, authenticated;

do $$
declare
  r record;
begin
  -- RPCs for signed-in users (each re-checks its own authorisation internally)
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'create_order', 'cancel_order', 'submit_payment', 'get_service_credentials', 'rename_service',
      'create_ticket', 'reply_to_ticket', 'set_ticket_status_customer',
      'approve_payment', 'reject_payment', 'start_provisioning', 'allocate_service',
      'extend_service', 'suspend_service', 'unsuspend_service', 'terminate_service',
      'update_service_credentials', 'admin_cancel_order', 'mark_order_refunded', 'void_invoice',
      'set_user_role', 'set_account_status',
      'staff_reply_to_ticket', 'assign_ticket', 'set_ticket_fields',
      'admin_action_queue', 'admin_kpis', 'admin_revenue_series'
    ])
  loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;

  -- maintenance + bootstrap: service role only
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'cancel_stale_orders', 'expire_services', 'enqueue_expiry_reminders',
      'flag_terminate_due', 'bootstrap_first_admin'
    ])
  loop
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end;
$$;
