-- =====================================================================
-- 0002: profiles + the public catalog (locations, plans, pricing),
--       payment methods, coupons, site settings, FAQs
-- =====================================================================

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null,
  full_name          text not null default '',
  phone              text,
  billing_country    char(2),
  company            text,
  telegram           text,
  whatsapp           text,
  role               public.user_role not null default 'customer',
  status             public.account_status not null default 'active',
  suspended_reason   text,
  notification_prefs jsonb not null default '{"ticket_replies": true, "marketing": false}'::jsonb,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_full_name_len check (char_length(full_name) <= 120),
  constraint profiles_phone_len check (phone is null or char_length(phone) <= 32),
  constraint profiles_company_len check (company is null or char_length(company) <= 120)
);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where role <> 'customer';

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  iso2       char(2) not null unique,
  image_key  text,
  blurb      text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A plan is a spec template. Windows is implicit — there is deliberately no OS column.
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  product      public.product_type not null,
  name         text not null,
  slug         text not null,
  vcpu         int not null check (vcpu > 0),
  ram_gb       int not null check (ram_gb > 0),
  storage_gb   int not null check (storage_gb > 0),
  bandwidth_tb numeric(6, 2) not null check (bandwidth_tb > 0),
  port_mbps    int not null check (port_mbps > 0),
  features     text[] not null default '{}',
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product, slug)
);

-- Price + stock per plan per location (USD cents, per 30-day term).
create table public.plan_pricing (
  plan_id     uuid not null references public.plans (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  price_cents int not null check (price_cents >= 0),
  stock       public.stock_status not null default 'in_stock',
  stock_count int check (stock_count >= 0),
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (plan_id, location_id)
);
create index plan_pricing_location_idx on public.plan_pricing (location_id);

create table public.payment_methods (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  type                  public.payment_method_type not null,
  regions               char(2)[] not null default '{}',        -- empty = international
  currency_code         char(3),
  rate_per_usd          numeric(14, 4) check (rate_per_usd > 0), -- null = USD
  rate_updated_at       timestamptz,
  fee_note              text,
  details               jsonb not null default '[]'::jsonb,      -- [{label, value}]
  qr_path               text,
  instructions_md       text,
  requires_reference    boolean not null default false,
  sort_order            int not null default 0,
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.coupons (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null,
  type                 public.discount_type not null,
  value                int not null check (value > 0),
  applies_product      public.product_type,
  applies_plan_id      uuid references public.plans (id) on delete set null,
  applies_location_id  uuid references public.locations (id) on delete set null,
  min_order_cents      int not null default 0 check (min_order_cents >= 0),
  max_redemptions      int check (max_redemptions > 0),
  per_user_limit       int default 1 check (per_user_limit > 0),
  redeemed_count       int not null default 0 check (redeemed_count >= 0),
  starts_at            timestamptz,
  ends_at              timestamptz,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint coupons_percent_range check (type <> 'percent' or value between 1 and 100)
);
create unique index coupons_code_key on public.coupons (lower(code));

create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  category     text not null default 'general',
  question     text not null,
  answer_md    text not null,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- updated_at maintenance
create trigger profiles_set_updated       before update on public.profiles        for each row execute function public.set_updated_at();
create trigger locations_set_updated      before update on public.locations       for each row execute function public.set_updated_at();
create trigger plans_set_updated          before update on public.plans           for each row execute function public.set_updated_at();
create trigger plan_pricing_set_updated   before update on public.plan_pricing    for each row execute function public.set_updated_at();
create trigger payment_methods_set_updated before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger site_settings_set_updated  before update on public.site_settings   for each row execute function public.set_updated_at();
create trigger faqs_set_updated           before update on public.faqs            for each row execute function public.set_updated_at();
