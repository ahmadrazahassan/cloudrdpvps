-- =====================================================================
-- 0013: email alerts to staff
-- Until now only CUSTOMERS were emailed. A payment proof or a support message that arrives when nobody has the
-- console open would wait unnoticed. These triggers queue an email (through the same outbox the customer emails
-- use, so the same retry and delivery logic applies) to the people who act on it:
--   new payment proof      -> active admins        (only admins can approve)
--   new ticket / reply     -> active support + admins
--   new contact message    -> active support + admins
-- The message body is never copied into the email — only who, what and a link into the console.
-- A staff member can opt out by setting profiles.notification_prefs.staff_alerts = false.
-- =====================================================================

create or replace function private.alert_staff(p_template text, p_data jsonb, p_admins_only boolean default false)
returns void
language sql security definer
set search_path = ''
as $$
  select private.enqueue_email(p.id, p_template, p_data)
  from public.profiles p
  where p.status = 'active'
    and (p.role = 'admin' or (not p_admins_only and p.role = 'support'))
    and coalesce((p.notification_prefs ->> 'staff_alerts')::boolean, true);
$$;

create or replace function private.on_payment_submitted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if new.status <> 'pending' then return new; end if;
  select * into v_order from public.orders o where o.id = new.order_id;
  perform private.alert_staff('staff_payment_submitted', jsonb_build_object(
    'payment_id', new.id,
    'order_number', v_order.order_number,
    'amount_cents', new.amount_usd_cents,
    'method', new.method_name,
    'type', v_order.type
  ), true);
  return new;
end;
$$;

create or replace function private.on_customer_ticket_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets%rowtype;
  v_first boolean;
begin
  if new.author_role <> 'customer' or new.is_internal then return new; end if;
  select * into v_ticket from public.tickets t where t.id = new.ticket_id;
  v_first := (select count(*) from public.ticket_messages m where m.ticket_id = new.ticket_id) = 1;
  perform private.alert_staff('staff_ticket', jsonb_build_object(
    'ticket_id', v_ticket.id,
    'ticket_no', v_ticket.ticket_no,
    'subject', v_ticket.subject,
    'is_new', v_first,
    'priority', v_ticket.priority
  ));
  return new;
end;
$$;

create or replace function private.on_contact_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.alert_staff('staff_contact', jsonb_build_object('name', new.name, 'topic', new.topic));
  return new;
end;
$$;

create trigger staff_alert_payment after insert on public.payments
  for each row execute function private.on_payment_submitted();
create trigger staff_alert_ticket_message after insert on public.ticket_messages
  for each row execute function private.on_customer_ticket_message();
create trigger staff_alert_contact after insert on public.contact_messages
  for each row execute function private.on_contact_message();
