-- =====================================================================
-- Cloud RDP VPS — 0001: enums, private schema, shared trigger helpers
-- Conventions: money = integer cents (USD) · time = timestamptz (UTC)
-- No hard dependency on extensions (gen_random_uuid() is built in).
-- =====================================================================

-- Helper functions that must NOT be exposed through the Data API live here.
create schema if not exists private;

create type public.user_role           as enum ('customer', 'support', 'admin');
create type public.account_status      as enum ('active', 'suspended');
create type public.product_type        as enum ('rdp', 'vps');
create type public.stock_status        as enum ('in_stock', 'low', 'out_of_stock');
create type public.order_type          as enum ('new', 'renewal');
create type public.order_status        as enum (
  'awaiting_payment', 'under_review', 'approved', 'provisioning',
  'completed', 'rejected', 'cancelled', 'refunded'
);
create type public.payment_status      as enum ('pending', 'verified', 'rejected');
create type public.service_status      as enum ('active', 'suspended', 'expired', 'terminated');
create type public.payment_method_type as enum ('bank', 'mobile_wallet', 'upi', 'crypto', 'other');
create type public.discount_type       as enum ('percent', 'fixed_usd');
-- 'open' = waiting for staff
create type public.ticket_status       as enum ('open', 'awaiting_customer', 'resolved', 'closed');
create type public.ticket_priority     as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_category     as enum (
  'billing', 'technical', 'order', 'restart_request',
  'reinstall_request', 'cannot_connect', 'other'
);
create type public.inventory_status    as enum ('available', 'allocated', 'retired');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
