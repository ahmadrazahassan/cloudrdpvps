-- =====================================================================
-- 0011: fixes from Supabase's security advisor
--   1. payment_methods_public was a SECURITY DEFINER view (ERROR). It is now
--      SECURITY INVOKER: anonymous visitors get a column-level grant on the six
--      safe columns plus a row policy for ACTIVE methods, so account details
--      (details, qr_path, instructions_md, rate, fees) stay unreachable.
--   2. public.term_days() was executable by anon/authenticated (WARN). Nothing
--      outside the database calls it — the order RPCs call it internally with
--      their owner's privileges — so client roles lose EXECUTE.
-- =====================================================================

-- ---- 1. safe payment-method listing, without a definer view ------------
drop view if exists public.payment_methods_public;

create view public.payment_methods_public with (security_invoker = true) as
  select id, name, type, regions, sort_order
  from public.payment_methods
  where is_active;

grant select on public.payment_methods_public to anon, authenticated;

-- Exactly the columns the view reads (is_active is needed for its WHERE clause).
grant select (id, name, type, regions, sort_order, is_active) on public.payment_methods to anon;

create policy payment_methods_anon_read on public.payment_methods
  for select to anon using (is_active);

-- ---- 2. no client-callable helper that isn't part of the API ------------
revoke execute on function public.term_days() from public, anon, authenticated;
