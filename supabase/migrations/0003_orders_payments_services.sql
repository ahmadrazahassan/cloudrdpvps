-- =====================================================================
-- 0003: orders, payments, services, credentials, inventory, invoices
-- =====================================================================

create sequence public.order_number_seq   start 1000;
create sequence public.invoice_number_seq start 1000;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique
                    default ('CRV-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id         uuid not null references public.profiles (id) on delete restrict,
  type            public.order_type not null default 'new',
  service_id      uuid,                                   -- renewals; FK added below
  plan_id         uuid not null references public.plans (id),
  location_id     uuid not null references public.locations (id),
  product         public.product_type not null,
  -- snapshots: an order never changes if the catalog does
  plan_name       text not null,
  plan_specs      jsonb not null,
  location_name   text not null,
  list_price_cents int not null check (list_price_cents >= 0),
  discount_cents   int not null default 0 check (discount_cents >= 0),
  total_cents      int not null check (total_cents >= 0),
  currency        char(3) not null default 'USD',
  term_days       int not null default 30 check (term_days > 0),
  coupon_id       uuid references public.coupons (id) on delete set null,
  coupon_code     text,
  status          public.order_status not null default 'awaiting_payment',
  expires_at      timestamptz not null,                   -- unpaid auto-cancel deadline
  assigned_to     uuid references public.profiles (id) on delete set null,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint orders_total_math check (total_cents = list_price_cents - discount_cents)
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at);
create index orders_unpaid_expiry_idx on public.orders (expires_at)
  where status in ('awaiting_payment', 'rejected');
create index orders_service_idx on public.orders (service_id) where service_id is not null;

create table public.coupon_redemptions (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions (coupon_id, user_id);

create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  event       text not null,
  from_status public.order_status,
  to_status   public.order_status,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, id);

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete restrict,
  method_id         uuid not null references public.payment_methods (id),
  method_name       text not null,
  amount_usd_cents  int not null check (amount_usd_cents >= 0),
  quoted_currency   char(3),
  quoted_amount     numeric(14, 2),
  quoted_rate       numeric(14, 4),
  reference         text,
  note              text,
  proof_path        text not null,
  proof_sha256      text not null,
  proof_mime        text,
  proof_size        int,
  status            public.payment_status not null default 'pending',
  received_usd_cents int,
  reject_reason     text,
  reject_message    text,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint payments_reference_len check (reference is null or char_length(reference) <= 200),
  constraint payments_note_len check (note is null or char_length(note) <= 1000)
);
-- one open (pending) proof per order
create unique index payments_one_pending_per_order on public.payments (order_id) where status = 'pending';
create index payments_status_created_idx on public.payments (status, created_at);
create index payments_proof_sha_idx on public.payments (proof_sha256);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.inventory_items (
  id                    uuid primary key default gen_random_uuid(),
  product               public.product_type not null,
  location_id           uuid not null references public.locations (id),
  plan_id               uuid references public.plans (id) on delete set null,
  ip                    inet not null unique,
  rdp_port              int not null default 3389 check (rdp_port between 1 and 65535),
  username              text not null,
  password_enc          text not null,
  supplier              text,
  supplier_ref          text,
  supplier_cost_cents   int check (supplier_cost_cents >= 0),
  supplier_expires_at   date,
  status                public.inventory_status not null default 'available',
  allocated_service_id  uuid,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index inventory_pick_idx on public.inventory_items (product, location_id, status);

create table public.services (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete restrict,
  order_id           uuid not null unique references public.orders (id),   -- origin order
  plan_id            uuid not null references public.plans (id),
  location_id        uuid not null references public.locations (id),
  product            public.product_type not null,
  plan_name          text not null,
  plan_specs         jsonb not null,
  label              text not null check (char_length(label) between 1 and 60),
  hostname           text,
  ip                 inet not null,
  rdp_port           int not null default 3389 check (rdp_port between 1 and 65535),
  status             public.service_status not null default 'active',
  suspended_reason   text,
  started_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  terminated_at      timestamptz,
  inventory_item_id  uuid references public.inventory_items (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index services_user_idx on public.services (user_id);
create index services_status_expiry_idx on public.services (status, expires_at);
create index services_ip_idx on public.services (ip);

alter table public.orders
  add constraint orders_service_fk foreign key (service_id) references public.services (id) on delete set null;
alter table public.inventory_items
  add constraint inventory_service_fk foreign key (allocated_service_id) references public.services (id) on delete set null;

-- Credentials: RLS on, NO policies, no client grants. Only SECURITY DEFINER RPCs touch it.
create table public.service_credentials (
  service_id   uuid primary key references public.services (id) on delete cascade,
  username     text not null,
  password_enc text not null,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique
                     default ('INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  order_id         uuid not null unique references public.orders (id),
  payment_id       uuid references public.payments (id) on delete set null,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  subtotal_cents   int not null,
  discount_cents   int not null default 0,
  total_cents      int not null,
  currency         char(3) not null default 'USD',
  status           text not null default 'paid' check (status in ('paid', 'void')),
  void_reason      text,
  issued_at        timestamptz not null default now(),
  billing_snapshot jsonb not null default '{}'::jsonb
);
create index invoices_user_idx on public.invoices (user_id, issued_at desc);

-- Effective status / days-left without waiting for the nightly job.
create view public.services_v with (security_invoker = true) as
select
  s.*,
  case when s.status = 'active' and s.expires_at < now()
       then 'expired'::public.service_status else s.status end            as effective_status,
  greatest(0, ceil(extract(epoch from (s.expires_at - now())) / 86400.0))::int as days_left
from public.services s;

create trigger orders_set_updated     before update on public.orders          for each row execute function public.set_updated_at();
create trigger services_set_updated   before update on public.services        for each row execute function public.set_updated_at();
create trigger inventory_set_updated  before update on public.inventory_items for each row execute function public.set_updated_at();
