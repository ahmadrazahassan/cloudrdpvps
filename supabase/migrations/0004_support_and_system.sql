-- =====================================================================
-- 0004: tickets, notifications, email outbox, audit log, staff notes,
--       contact messages
-- =====================================================================

create table public.tickets (
  id                       uuid primary key default gen_random_uuid(),
  ticket_no                bigint generated always as identity,
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  service_id               uuid references public.services (id) on delete set null,
  subject                  text not null check (char_length(subject) between 3 and 200),
  category                 public.ticket_category not null default 'other',
  priority                 public.ticket_priority not null default 'normal',
  status                   public.ticket_status not null default 'open',
  assigned_to              uuid references public.profiles (id) on delete set null,
  last_message_at          timestamptz not null default now(),
  last_customer_message_at timestamptz,
  last_staff_message_at    timestamptz,
  resolved_at              timestamptz,
  closed_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index tickets_user_idx on public.tickets (user_id, last_message_at desc);
create index tickets_status_idx on public.tickets (status, last_message_at);

create table public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  author_role public.user_role not null,
  body        text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create table public.canned_responses (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body_md    text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Emails are queued inside the same transaction as the event, then drained by the app.
-- `data` must never contain secrets (no passwords / credentials).
create table public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  to_email    text not null,
  template    text not null,
  data        jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts    int not null default 0,
  last_error  text,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index email_outbox_due_idx on public.email_outbox (send_after) where status = 'pending';

-- Append-only (enforced by trigger + revoked privileges).
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.user_role,
  action      text not null,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create table public.staff_notes (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer', 'order', 'service')),
  entity_id   uuid not null,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null check (char_length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index staff_notes_entity_idx on public.staff_notes (entity_type, entity_id, created_at desc);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) between 3 and 254),
  topic      text,
  message    text not null check (char_length(message) between 10 and 5000),
  status     text not null default 'unread' check (status in ('unread', 'handled', 'spam')),
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

create trigger tickets_set_updated before update on public.tickets for each row execute function public.set_updated_at();
