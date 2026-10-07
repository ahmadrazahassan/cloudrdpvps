# 04 · Backend (Supabase + Next.js server layer) — Cloud RDP VPS

> **Role:** Senior backend/platform engineer. Build a **secure, auditable, money‑correct** backend for a manual‑payment hosting reseller. The database enforces invariants; Next.js Server Actions orchestrate; nothing sensitive reaches the browser.
> **Read with:** `01` (product rules), `02` (customer flows), `03` (admin flows). Table/column/RPC names here are the **contract** those files use — do not rename.

---

## 1. Principles

1. **RLS on every table in `public`.** Default‑deny. Policies written per role. Test them (pgTAP).
2. **The database owns invariants:** prices, stock, coupons, order state transitions, expiry maths, invoice issuing and audit logging happen inside Postgres functions (single transaction), never in the browser and never split across multiple client round‑trips.
3. **Never trust the client:** price, role, status, ownership, file paths and totals are recomputed/validated server‑side.
4. **Secrets never leave the server.** Service‑role key only in `server-only` modules. Server‑generated credentials are encrypted at rest and never emailed or logged.
5. **Append‑only audit trail** for every privileged action.
6. **Money = integer cents**, currency `USD`. Time = `timestamptz` UTC. Term = 30 days (single source: `public.term_days()`).
7. **Idempotent, ordered migrations**; generated TypeScript types from the schema; no schema edits in the dashboard.

---

## 2. Architecture

```
Browser ──► Next.js (App Router, proxy.ts, Server Components, Server Actions, Route Handlers)
              │  cookie‑bound Supabase client (user JWT, RLS applies)   ← default for everything
              │  service‑role client (src/lib/supabase/admin.ts)         ← only for: invite user, storage head/sign,
              │                                                            email outbox drain, cron, contact form insert
              ▼
        Supabase: Postgres (RLS, RPCs, triggers, pg_cron) · Auth · Storage · Realtime
              │
              ├── Resend (transactional email via outbox table)
              ├── Upstash Redis (rate limiting)
              └── Cloudflare Turnstile (bot protection on public forms/auth)
```
Authorisation for privileged RPCs uses the **caller's JWT** (not the service role) so `auth.uid()` is available for ownership checks and the audit log.

---

## 3. Environment variables (`.env.example` — document every one)

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # (legacy name: ANON key)
SUPABASE_SECRET_KEY=                       # (legacy name: SERVICE_ROLE key) — server only
CREDENTIALS_ENCRYPTION_KEYS={"k1":"<base64 32 bytes>"}
CREDENTIALS_ACTIVE_KEY_ID=k1
NEXT_PUBLIC_TURNSTILE_SITE_KEY=            TURNSTILE_SECRET_KEY=
UPSTASH_REDIS_REST_URL=                    UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=                            EMAIL_FROM="Cloud RDP VPS <no-reply@…>"
CRON_SECRET=                               # Bearer token Vercel Cron sends
ADMIN_IP_ALLOWLIST=                        # optional, comma‑separated
NEXT_PUBLIC_GOOGLE_AUTH=false
```
Validate with a Zod `env.ts` that throws at boot; split `serverEnv` (import `server-only`) from `clientEnv`.

---

## 4. Code layout (backend parts)

```
supabase/
  config.toml  seed.sql  templates/*.html (auth emails, branded)
  migrations/ 0001_extensions_enums.sql … 0010_indexes.sql
  tests/*.test.sql                          (pgTAP RLS + RPC tests)
src/
  lib/supabase/{client,server,admin,proxy}.ts
  lib/auth/{require-user,require-role,mfa}.ts
  lib/crypto/credentials.ts                 AES‑256‑GCM, key ids
  lib/security/{rate-limit,turnstile,file-sniff,csp}.ts
  lib/email/{client,outbox}.ts  + templates/*.tsx (React Email)
  lib/{money,dates,errors,action}.ts        action.ts = createAction() wrapper
  lib/validators/*.ts                       Zod schemas shared by client+server
  server/actions/{auth,orders,payments,services,tickets,profile,notifications,contact}.ts
  server/admin/{payments,orders,services,inventory,customers,catalog,methods,coupons,tickets,content,reports,team,settings}.ts
  server/queries/{public,portal,admin}/*.ts   cached reads (tagged)
  app/api/{cron/emails,cron/maintenance,export/[entity]}/route.ts
  types/database.ts                         generated: supabase gen types
scripts/{make-admin,rotate-credentials-key,seed-dev-users}.ts
vercel.json                                 cron schedules
```

### 4.1 Supabase clients
- `server.ts`: `createServerClient` from `@supabase/ssr` with `cookies.getAll/setAll` (Next `cookies()`), used in Server Components/Actions/Route Handlers. `client.ts`: browser client (publishable key) for Realtime + Storage uploads only.
- `proxy.ts` (Next 16 `proxy.ts`): refresh session cookies, gate `/dashboard`, `/admin`, `/order` (place step), `/login` redirect when signed in; use `supabase.auth.getClaims()` for the cheap check. **Every Server Component/Action still re‑authorises** with `supabase.auth.getUser()` — the proxy is a convenience, not a security boundary. Add per‑request CSP nonce here.
- `admin.ts`: `import "server-only"`; `createClient(url, SUPABASE_SECRET_KEY, { auth: { persistSession:false, autoRefreshToken:false } })`.

### 4.2 `createAction()` wrapper (every Server Action uses it)
`createAction({ input: ZodSchema, auth: 'public'|'user'|'staff'|'admin', mfa?: boolean, rateLimit?: {key, limit, window}, handler })` → parses input, authenticates, authorises, rate‑limits, runs handler, maps errors, tags a request id, and returns:
```ts
type ActionResult<T> =
 | { ok: true; data: T }
 | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string,string[]> }
type ErrorCode = 'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION'|'NOT_FOUND'|'OUT_OF_STOCK'|'PRICE_CHANGED'
 |'COUPON_INVALID'|'TOO_MANY_OPEN_ORDERS'|'RATE_LIMITED'|'AMOUNT_MISMATCH'|'CONFLICT'|'MAINTENANCE'
 |'ACCOUNT_SUSPENDED'|'UPLOAD_INVALID'|'MFA_REQUIRED'|'INTERNAL'
```
Postgres functions signal domain errors with `raise exception using errcode='P0001', message='OUT_OF_STOCK'`; the wrapper maps `message` to `ErrorCode`. Unknown errors → `INTERNAL` + logged with request id; the user sees a generic message.

---

## 5. Database schema (migrations)

Conventions: `id uuid primary key default gen_random_uuid()` unless noted; every table also has `created_at timestamptz not null default now()` and (if mutable) `updated_at` maintained by `public.set_updated_at()` trigger. Helper functions live in a **non‑exposed `private` schema** (`private.is_staff()`, `private.is_admin()`, `private.app_role()` — `security definer`, `set search_path = ''`, `stable`, execute granted to `authenticated` only). Public RPCs live in `public`, `revoke execute … from public, anon` then `grant … to authenticated` explicitly.

### 5.1 Extensions & enums
```sql
create extension if not exists pgcrypto;  create extension if not exists citext;
create extension if not exists pg_trgm;   create extension if not exists pg_cron;

create type user_role           as enum ('customer','support','admin');
create type account_status      as enum ('active','suspended');
create type product_type        as enum ('rdp','vps');
create type stock_status        as enum ('in_stock','low','out_of_stock');
create type order_type          as enum ('new','renewal');
create type order_status        as enum ('awaiting_payment','under_review','approved','provisioning','completed','rejected','cancelled','refunded');
create type payment_status      as enum ('pending','verified','rejected');
create type service_status      as enum ('active','suspended','expired','terminated');
create type payment_method_type as enum ('bank','mobile_wallet','upi','crypto','other');
create type discount_type       as enum ('percent','fixed_usd');
create type ticket_status       as enum ('open','awaiting_customer','resolved','closed');   -- 'open' = awaiting staff
create type ticket_priority     as enum ('low','normal','high','urgent');
create type ticket_category     as enum ('billing','technical','order','restart_request','reinstall_request','cannot_connect','other');
create type inventory_status    as enum ('available','allocated','retired');
```

### 5.2 Tables (columns & constraints)

**`profiles`** — `id uuid pk references auth.users on delete cascade`, `email citext not null`, `full_name text not null default ''`, `phone text`, `billing_country char(2)`, `company text`, `telegram text`, `whatsapp text`, `role user_role not null default 'customer'`, `status account_status not null default 'active'`, `suspended_reason text`, `notification_prefs jsonb not null default '{"ticket_replies":true,"marketing":false}'`, `last_seen_at timestamptz`.
Privileges: `revoke update on profiles from authenticated; grant update (full_name, phone, billing_country, company, telegram, whatsapp, notification_prefs) on profiles to authenticated;` so customers can never change `role`/`status`. Role/status change only via admin RPCs.

**`locations`** — `name, slug unique, iso2 char(2) unique, image_key text, blurb text, sort_order int, is_active bool default true`.

**`plans`** — `product product_type, name, slug, vcpu int>0, ram_gb int>0, storage_gb int>0, bandwidth_tb numeric(6,2), port_mbps int, features text[] default '{}', is_featured bool default false, sort_order int, is_active bool default true, unique(product, slug)`. *(No OS column — Windows is implicit; `public.os_label()` returns `'Windows Server'`.)*

**`plan_pricing`** — `plan_id fk cascade, location_id fk cascade, price_cents int not null check (>=0), stock stock_status default 'in_stock', stock_count int check (>=0), is_active bool default true, updated_at, primary key (plan_id, location_id)`.

**`payment_methods`** — `name, type payment_method_type, regions char(2)[] default '{}' (empty = global), currency_code char(3), rate_per_usd numeric(14,4) check (>0), rate_updated_at, fee_note, details jsonb default '[]' ([{label,value}]), qr_path text, instructions_md text, requires_reference bool default false, sort_order int, is_active bool default true`.

**`coupons`** — `code citext unique, type discount_type, value int>0 (percent 1–100 enforced by check; fixed = cents), applies_product product_type, applies_plan_id, applies_location_id (null = all), min_order_cents int default 0, max_redemptions int, per_user_limit int default 1, redeemed_count int default 0, starts_at, ends_at, is_active bool`. **`coupon_redemptions`** — `coupon_id, user_id, order_id unique`.

**`orders`** — `order_number text unique default 'CRV-'||lpad(nextval('order_number_seq')::text,6,'0')`, `user_id fk profiles restrict`, `type order_type default 'new'`, `service_id uuid` (renewals; FK added after `services`), `plan_id, location_id, product`, **snapshots** `plan_name text, plan_specs jsonb, location_name text`, `list_price_cents int, discount_cents int default 0, total_cents int check (>=0)`, `currency char(3) default 'USD'`, `term_days int default 30`, `coupon_id, coupon_code`, `status order_status default 'awaiting_payment'`, `expires_at timestamptz not null` (unpaid deadline), `assigned_to uuid`, `completed_at, cancelled_at`.
**`order_events`** — `id bigint identity, order_id fk cascade, actor_id, event text, from_status, to_status, data jsonb`.

**`payments`** — `order_id fk cascade, user_id, method_id fk, method_name text (snapshot), amount_usd_cents int, quoted_currency char(3), quoted_amount numeric(14,2), quoted_rate numeric(14,4), reference text, note text, proof_path text not null, proof_sha256 text not null, proof_mime text, proof_size int, status payment_status default 'pending', received_usd_cents int, reject_reason text, reject_message text, reviewed_by, reviewed_at`.
`create unique index on payments(order_id) where status='pending';` `create index on payments(proof_sha256);`

**`services`** — `user_id, order_id uuid unique not null (origin order), plan_id, location_id, product, plan_name, plan_specs jsonb, label text not null, hostname text, ip inet not null, rdp_port int default 3389 check (1..65535), status service_status default 'active', suspended_reason text, started_at, expires_at not null, terminated_at, inventory_item_id uuid`.
**`service_credentials`** — `service_id pk fk cascade, username text not null, password_enc text not null, updated_by, updated_at`. **RLS on, zero policies, `revoke all … from anon, authenticated`** — readable only through `get_service_credentials()` below.
View **`services_v`** (security_invoker) adds `effective_status` (`expired` if `expires_at < now()` and status `active`) and `days_left`.

**`inventory_items`** — `product, location_id, plan_id, ip inet unique, rdp_port, username, password_enc, supplier text, supplier_ref text, supplier_cost_cents int, supplier_expires_at date, status inventory_status default 'available', allocated_service_id, notes`. Column privileges: grant `select` on all columns **except `password_enc`** to `authenticated` (RLS limits rows to admins); all writes through admin RPCs/service role.

**`invoices`** — `invoice_number text unique default 'INV-'||lpad(nextval('invoice_number_seq')::text,6,'0'), order_id uuid unique, payment_id, user_id, subtotal_cents, discount_cents, total_cents, currency, status text check in ('paid','void') default 'paid', void_reason, issued_at default now(), billing_snapshot jsonb` (name, email, country, company, line items, company block).

**`tickets`** — `ticket_no bigint generated always as identity, user_id, service_id, subject text check (length 3..200), category ticket_category, priority ticket_priority default 'normal', status ticket_status default 'open', assigned_to, last_message_at, last_customer_message_at, last_staff_message_at, resolved_at, closed_at`.
**`ticket_messages`** — `ticket_id fk cascade, author_id, author_role user_role, body text check (length 1..10000), is_internal bool default false, attachments jsonb default '[]' ([{path,name,mime,size}])`.
**`canned_responses`** — `title, body_md, created_by`.

**`notifications`** — `user_id fk cascade, type text, title text, body text, link text, data jsonb, read_at timestamptz`. Customers: `select` own; `update (read_at)` own via column grant. Inserts only from definer functions.
**`email_outbox`** — `user_id, to_email citext, template text, data jsonb (never secrets), status text check in ('pending','sent','failed') default 'pending', attempts int default 0, last_error text, send_after timestamptz default now(), sent_at`.
**`audit_logs`** — `id bigint identity, actor_id, actor_role, action text, entity_type text, entity_id text, before jsonb, after jsonb, reason text, ip inet, user_agent text`. **Append‑only:** `revoke update, delete`, plus `before update or delete` trigger that raises.
**`site_settings`** — `key text pk, value jsonb not null, is_public bool default false, updated_by, updated_at`.
**`faqs`** — `category text, question text, answer_md text, sort_order int, is_published bool default true`.
**`contact_messages`** — `name, email citext, topic, message, status text check in ('unread','handled','spam') default 'unread', ip inet, user_agent`.
**`staff_notes`** — `entity_type text check in ('customer','order','service'), entity_id uuid, author_id, body text`. Staff‑only (customers can never read these).

Add the circular FKs after creation: `orders.service_id → services(id)`, `services.inventory_item_id → inventory_items(id)`.

### 5.3 Indexes
`orders(user_id, created_at desc)`, `orders(status, created_at)`, `orders(expires_at) where status in ('awaiting_payment','rejected')`, `payments(status, created_at)`, `services(user_id)`, `services(status, expires_at)`, `services(ip)`, `tickets(user_id, last_message_at desc)`, `tickets(status, last_message_at)`, `ticket_messages(ticket_id, created_at)`, `notifications(user_id, created_at desc)` (+ partial where `read_at is null`), `audit_logs(created_at desc)`, `audit_logs(entity_type, entity_id)`, `email_outbox(status, send_after)`, trigram GIN on `profiles(email, full_name)` and `services(label)`.

---

## 6. Functions, triggers & RPCs

### 6.1 Triggers
- `handle_new_user()` (after insert on `auth.users`): inserts the `profiles` row with `full_name` from `raw_user_meta_data` and **`role='customer'` always** — never read role from user‑controlled metadata.
- `set_updated_at()` on mutable tables. `prevent_audit_mutation()` on `audit_logs`.
- `sync_ticket_timestamps()` after insert on `ticket_messages`.
- A guard trigger on `profiles` that blocks any change to `role`/`status` unless the caller is an admin RPC (`current_setting('app.bypass_profile_guard', true)`).

### 6.2 Customer RPCs (`security definer`, `set search_path=''`, require `auth.uid()`, active profile)

| RPC | Behaviour |
|---|---|
| `create_order(p_plan_id, p_location_id, p_coupon_code default null, p_renew_service_id default null) → orders` | Requires **verified email** and `maintenance.enabled = false`. Rejects if the user already has ≥ `max_open_orders` (3) in `awaiting_payment` → `TOO_MANY_OPEN_ORDERS`. Locks the `plan_pricing` row; plan/location/pricing must be active, stock ≠ `out_of_stock` → `OUT_OF_STOCK`. `list_price_cents` from DB. Coupon (locked `for update`): active, within dates, scope matches, `min_order_cents`, `max_redemptions`, `per_user_limit` → else `COUPON_INVALID`; percent discount `floor(list*pct/100)`, fixed capped at list; **total must stay > 0**. Renewal: service owned by caller, `status in ('active','expired')`, product/location match, uses *current* price. Snapshots plan/location, sets `expires_at = now() + unpaid_order_hours`, writes `order_events`, redemption row, `notifications` (+ outbox `order_placed`). |
| `cancel_order(p_order_id)` | Owner only, only `awaiting_payment`/`rejected`; releases coupon redemption; event. |
| `submit_payment(p_order_id, p_method_id, p_proof_path, p_proof_sha256, p_mime, p_size, p_reference, p_note)` | Owner; order `awaiting_payment` or `rejected`; method active; `proof_path` must start with `'{uid}/{order_id}/'`; `reference` required if `requires_reference`; snapshots `method_name`, computes `quoted_amount = round(total/100 * rate_per_usd, 2)` and `quoted_rate`; inserts `payments(status='pending')`; order → `under_review`; event. |
| `get_service_credentials(p_service_id) → (username, password_enc)` | Allowed if caller owns the service **and** service effective status is `active`, **or** caller `is_admin()`. Writes an `audit_logs` row (`credentials.reveal`) every call. Returns ciphertext; the Next.js action decrypts and returns plaintext for 30 s display. |
| `rename_service(p_service_id, p_label)` | Owner; 1–60 chars. |
| `create_ticket(...)`, `reply_to_ticket(p_ticket_id, p_body, p_attachments)` | Owner; ticket not `closed`; reply sets status `open` (awaiting staff); closed tickets can be reopened ≤ 7 days after `closed_at`. |
| `set_ticket_status_customer(p_ticket_id, p_status)` | Owner may set `resolved`/`open` only. |

### 6.3 Staff/Admin RPCs (each checks `private.is_admin()` or `is_staff()` **inside**, writes `audit_logs` with before/after, creates the customer notification + `email_outbox` row, returns the updated row)

| RPC | Behaviour |
|---|---|
| `approve_payment(p_payment_id, p_received_usd_cents)` **admin** | Locks payment+order. Payment must be `pending`. `received < order.total` → `AMOUNT_MISMATCH`. Payment → `verified`; order → `approved`; **issues invoice**. If `order.type='renewal'`: `services.expires_at = greatest(now(), expires_at) + term_days()`; `status → 'active'` unless `suspended`; order → `completed`. |
| `reject_payment(p_payment_id, p_reason, p_message)` **admin** | Payment → `rejected`; order → `rejected`; `expires_at += reject_extension_hours` (24h); customer notified with the reason. |
| `start_provisioning(p_order_id)` **admin** | `approved → provisioning` (optional status). |
| `allocate_service(p_order_id, p_label, p_hostname, p_ip, p_port, p_username, p_password_enc, p_starts_at, p_expires_at, p_inventory_item_id, p_expiry_reason, p_notify)` **admin** | Order type `new`, status `approved|provisioning`, no existing service for the order. Default expiry = `p_starts_at + term_days()`; any other value requires `p_expiry_reason`. Inserts `services` + `service_credentials`; if `p_inventory_item_id`: locks it, must be `available` and match product/location → `allocated`. Order → `completed`. Notification + outbox `service_delivered` (**no credentials in payload**). |
| `extend_service(p_service_id, p_days, p_set_expires_at, p_reason)`, `suspend_service(p_service_id, p_reason)`, `unsuspend_service(p_service_id)`, `terminate_service(p_service_id, p_reason)`, `update_service_credentials(p_service_id, p_username, p_password_enc, p_notify)`, `update_service_label_notes(...)` **admin** | Reason mandatory for suspend/terminate/extend‑custom. Terminate retires the inventory item. |
| `admin_cancel_order`, `mark_order_refunded(p_order_id, p_amount_cents, p_reason)` **admin** | Manual refunds are *recorded*, not executed. Invoice marked `void` only via `void_invoice(p_invoice_id, p_reason)`. |
| `set_user_role(p_user_id, p_role)`, `set_account_status(p_user_id, p_status, p_reason)` **admin** | Cannot change own role; cannot remove the last admin. Sets the guard setting so the profile trigger allows it. |
| `staff_reply_to_ticket(p_ticket_id, p_body, p_is_internal, p_attachments)`, `assign_ticket`, `set_ticket_fields` **staff** | Public reply → status `awaiting_customer`, notifies customer; internal notes never notify. |
| `admin_action_queue()`, `admin_kpis(p_from, p_to)`, `admin_revenue_series(p_from, p_to, p_bucket)` **admin/staff (limited)** | Aggregations computed in SQL for the Overview/Reports. `support` receives counts only. |

### 6.4 Scheduled jobs (pg_cron, UTC)
| Job | Schedule | Action |
|---|---|---|
| `cancel_stale_orders()` | hourly | `awaiting_payment`/`rejected` with `expires_at < now()` → `cancelled`, release coupon, notify. |
| `expire_services()` | daily 00:05 | `active` with `expires_at < now()` → `expired`, notify + outbox. |
| `enqueue_expiry_reminders()` | daily 06:00 | For each day in `reminder_days` (default `[3,1]`) enqueue one reminder per service (idempotent via `data->>'reminder_key'`). |
| `flag_terminate_due()` | daily 06:10 | `expired` older than `grace_days` → staff notification (never auto‑deletes). |
Fallback/ops: `GET /api/cron/maintenance` (secured by `Authorization: Bearer $CRON_SECRET`) runs the same functions; `GET /api/cron/emails` drains `email_outbox`. Configure in `vercel.json`.

---

## 7. Row‑Level Security matrix

Use `(select auth.uid())` and `(select private.is_staff())` forms inside policies (initplan caching). Default deny; each `✔` is an explicit policy; “own” = `user_id = (select auth.uid())`.

| Table | Anonymous | Customer | Support | Admin |
|---|---|---|---|---|
| `locations`, `plans`, `plan_pricing` | select **active** rows | same | same | all (insert/update/delete) |
| `faqs` | select published | same | same | all |
| `site_settings` | select `is_public` | same | same | all |
| `payment_methods` | — | select active | select all | all |
| `coupons` | — | — (validated inside `create_order`) | — | all |
| `profiles` | — | select/update **own** (column grant) | select all | select all (writes via RPC) |
| `orders`, `order_events` | — | select own | select all | select all (writes via RPC) |
| `payments` | — | select own | select all | select all (writes via RPC) |
| `services` / `services_v` | — | select own | select all | select all (writes via RPC) |
| `service_credentials` | — | **none** | **none** | **none** (RPC only) |
| `inventory_items` | — | — | — | select (no `password_enc`) |
| `invoices` | — | select own | select all | select all |
| `tickets` | — | select/insert own | select all | all |
| `ticket_messages` | — | select own tickets where `is_internal=false` | all | all |
| `notifications` | — | select own; update `read_at` own | select own | select own |
| `staff_notes`, `canned_responses`, `contact_messages` | — | — | select/insert | all |
| `email_outbox` | — | — | — | select (drain uses service role) |
| `audit_logs` | — | — | — | select only |
| `coupon_redemptions`, `order_events` writes | — | — | — | via RPC only |

Rules of thumb: no `insert/update/delete` policies for customers on money/state tables — they call RPCs. `contact_messages` are inserted by a server action using the service role after Turnstile + rate limit (no anonymous insert policy).

---

## 8. Storage

| Bucket | Visibility | Limits | Policies |
|---|---|---|---|
| `payment-proofs` | **private** | 5 MB; png/jpeg/webp/pdf | Insert: `(storage.foldername(name))[1] = auth.uid()::text`. Select: owner folder **or** `is_staff()`. No customer update/delete (evidence is immutable). Retention configurable; never public. |
| `ticket-attachments` | private | 5 MB; images/pdf | Path `{ticket_id}/{uuid}.ext`. Insert/select: ticket owner (via `exists` on `tickets`) or staff. |
| `method-qr` | private | 1 MB; png/jpeg/webp | Select: any authenticated. Write: admin. Served via 60 s signed URLs. |
| `site-assets` | public | 2 MB | Write: admin. (Location photos, OG assets.) |

Flow for proofs: action `getPaymentUploadUrl(orderId, mime, size)` validates ownership/status/MIME/size → returns a **signed upload URL** for `{uid}/{orderId}/{uuid}.{ext}`. After upload, `submitPayment` uses the service client to read the object's first bytes (**magic‑byte sniff** must match PNG/JPEG/WebP/PDF), stream‑hash it (**sha256**), re‑check size, then calls `submit_payment`. Mismatch → delete object, `UPLOAD_INVALID`. Viewing always through **60‑second signed URLs**.

---

## 9. Auth configuration (`supabase/config.toml` + dashboard parity)

- Email + password; **email confirmations required**; password min length 10 with upper/lower/digit; secure password change; leaked‑password protection on if the plan allows.
- Redirect URLs: `${SITE_URL}/auth/callback` (+ localhost). Site URL set. PKCE flow.
- **Captcha: Cloudflare Turnstile** enabled for sign‑up, sign‑in and password reset.
- **MFA (TOTP)** enabled. Staff MFA enforced in app (`require_staff_mfa`): admin routes need `aal2`.
- JWT expiry 3600 s, refresh‑token rotation on, reuse interval short.
- Custom SMTP through Resend; brand all auth emails in `supabase/templates` (confirm, recover, invite, email change) with the lavender wordmark and plain, calm copy.
- Rate limits tuned conservatively (sign‑in, sign‑up, OTP, password reset).
- Optional Google OAuth behind `NEXT_PUBLIC_GOOGLE_AUTH`.

---

## 10. Credential encryption (`lib/crypto/credentials.ts`)

- **AES‑256‑GCM**, random 12‑byte IV, 128‑bit tag, AAD = constant `"crv-cred"`.
- Keys from `CREDENTIALS_ENCRYPTION_KEYS` (map of key id → base64 32 bytes); active id from `CREDENTIALS_ACTIVE_KEY_ID`.
- Stored string: `v1.<kid>.<iv_b64url>.<tag_b64url>.<ct_b64url>` → supports **key rotation** (`scripts/rotate-credentials-key.ts` re‑encrypts all rows, then retire old key).
- Functions: `encryptSecret(plain)`, `decryptSecret(blob)`. Decrypt **only** inside `revealCredentials` (customer/admin) and never log plaintext (add a Pino/console redaction list for `password`, `password_enc`, `authorization`, `token`).
- **Password generator** (`generateStrongPassword()`): `crypto.randomInt`, 20 chars, guaranteed upper/lower/digit/symbol, exclude ambiguous (`0 O o 1 l I`) and RDP/CLI‑hostile symbols (`" ' \ % ^ & < > | `` ` ``); symbol set `!@#$*-_=+?`.
- `.rdp` generator (`buildRdpFile`) never includes the password.

---

## 11. Server Actions catalog (all via `createAction`, Zod validated)

**Customer (`auth: 'user'`)** — `placeOrder`, `cancelOrder`, `renewServiceOrder`, `getPaymentUploadUrl` (rate 20/h), `submitPayment`, `revealCredentials` (rate 10 / 10 min, returns plaintext + `expiresAt = now+30s`), `renameService`, `createTicket` (10/h), `replyToTicket`, `setTicketStatus`, `markNotificationsRead`, `updateProfile`, `requestAccountDeletion`, `changeEmail`, `changePassword`, MFA enrol/verify/unenrol helpers.
**Public (`auth: 'public'`)** — `submitContactForm` (Turnstile + 5/h/IP → service‑role insert + staff notification), `subscribeNewsletter` (optional; double opt‑in).
**Admin (`auth: 'admin'`, `mfa: true`)** — `approvePayment`, `rejectPayment`, `startProvisioning`, `allocateService`, `extendService`, `suspendService`, `unsuspendService`, `terminateService`, `updateServiceCredentials`, `revealServiceCredentials`, `adminCancelOrder`, `markOrderRefunded`, `voidInvoice`, `upsertPlan`, `upsertPricingBatch` (diff + audit), `upsertLocation`, `upsertPaymentMethod`, `reorderPaymentMethods`, `updateRates`, `upsertCoupon`, `importInventoryCsv`, `upsertInventoryItem`, `setAccountStatus`, `sendNotificationToUser`, `upsertFaq`, `setAnnouncement`, `updateSettings`, `inviteStaff`, `setUserRole`, canned‑response CRUD, export route handlers.
**Staff (`auth: 'staff'`)** — `staffReplyToTicket`, `assignTicket`, `setTicketFields`, `addStaffNote`, `markInboxHandled`, `convertInboxToTicket`.

After mutations: `updateTag`/`revalidateTag` for `plans`, `pricing`, `locations`, `faqs`, `settings`, and per‑user tags `user:{id}:orders|services|tickets|notifications`. Public queries use `use cache` + `cacheTag`.

---

## 12. Email & notifications

- DB functions insert into `email_outbox`; the app drains it (`after()` right after a mutation, and `/api/cron/emails` on a schedule) through **Resend** with exponential backoff (max 5 attempts) and `last_error`.
- Templates (React Email, branded, calm): `order_placed`, `payment_under_review`, `payment_approved`, `payment_rejected`, `service_delivered`, `renewal_confirmed`, `expiring_soon`, `service_expired`, `ticket_reply`, `account_suspended`, `staff_new_contact`. **Never include passwords or full credentials**; link to the dashboard instead.
- In‑app notifications are rows in `notifications` (Realtime to the bell/toasts).

---

## 13. Realtime
Add to the `supabase_realtime` publication: `orders, payments, services, notifications, tickets, ticket_messages, contact_messages`. Clients subscribe with filters (`user_id=eq.<uid>`); RLS governs what each subscriber receives. Staff subscribe unfiltered for queue counts.

---

## 14. Security hardening checklist

- **Headers** (`next.config` + proxy): CSP with per‑request nonce (`default-src 'self'`; `script-src 'self' 'nonce-…' https://challenges.cloudflare.com`; `connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co`; `img-src 'self' data: blob: https://<project>.supabase.co`; `frame-src https://challenges.cloudflare.com`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`), HSTS (1 year, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `Cross-Origin-Opener-Policy: same-origin`.
- **Rate limits (Upstash sliding window):** contact 5/h/IP · reveal 10/10 min/user · upload‑url 20/h/user · ticket create 10/h/user · search 30/min/user · CSV export 5/h/admin · login handled by Supabase + Turnstile.
- **Open redirect** protection on `next`; **CSRF**: Server Actions' origin checks + same‑site cookies.
- **Input validation** with Zod at every boundary; strict string lengths; reject unknown keys.
- **SQL injection:** only parameterised RPC/PostgREST calls; no string‑built SQL.
- **Logging hygiene:** structured logs with request id; redact secrets; no PII in client errors.
- **Admin:** MFA (AAL2), optional IP allow‑list, role re‑checked per action, every mutation audited.
- **Abuse controls:** AUP enforced via suspend/terminate flows; per‑user open‑order cap; duplicate proof detection by sha256/reference; Turnstile on public forms.
- **Backups/DR:** enable PITR (Supabase Pro), nightly storage export of `payment-proofs`, documented restore drill in `README`.
- **Dependencies:** lockfile, `npm audit` in CI, Dependabot/Renovate.

---

## 15. Seed data (`supabase/seed.sql` — idempotent `on conflict do update`)

**Locations:** Pakistan (`pakistan`, PK, `loc-pk`) · India (`india`, IN, `loc-in`) · Bangladesh (`bangladesh`, BD, `loc-bd`) · USA (`usa`, US, `loc-us`) · UK (`uk`, GB, `loc-uk`).

**Plans & prices (USD / 30 days) — placeholder market‑style numbers; the owner edits them in the admin pricing matrix. Mark seeded rows in the README as placeholders.**

| Product | Plan | vCPU | RAM | NVMe | Bandwidth | Port | PK | IN | BD | US | UK |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RDP | Starter | 2 | 4 GB | 60 GB | 2 TB | 100 Mbps | 6 | 6 | 6 | 9 | 10 |
| RDP | Standard ★ | 4 | 8 GB | 120 GB | 4 TB | 200 Mbps | 12 | 12 | 12 | 16 | 18 |
| RDP | Pro | 6 | 16 GB | 200 GB | 6 TB | 500 Mbps | 22 | 22 | 22 | 28 | 30 |
| RDP | Elite | 8 | 32 GB | 300 GB | 8 TB | 1 Gbps | 38 | 38 | 38 | 48 | 52 |
| VPS | S | 2 | 4 GB | 80 GB | 3 TB | 200 Mbps | 8 | 8 | 8 | 12 | 13 |
| VPS | M ★ | 4 | 8 GB | 160 GB | 5 TB | 500 Mbps | 16 | 16 | 16 | 22 | 24 |
| VPS | L | 8 | 16 GB | 320 GB | 8 TB | 1 Gbps | 30 | 30 | 30 | 40 | 44 |
| VPS | XL | 12 | 32 GB | 480 GB | 12 TB | 1 Gbps | 55 | 55 | 55 | 72 | 78 |
★ = `is_featured`. All `stock='in_stock'`.

**Payment methods (seeded `is_active=false` with empty details so nothing unverified goes live):** Pakistan — Bank transfer, JazzCash, Easypaisa (PKR) · India — UPI, Bank transfer (INR) · Bangladesh — bKash, Nagad (BDT) · International — USDT (TRC20), Wise. Names are text only; no brand logos.

**Settings (`site_settings`):** `site_name`, `support_email`, `whatsapp`, `telegram`, `company_block`, `term_days=30`, `unpaid_order_hours=48`, `reject_extension_hours=24`, `max_open_orders=3`, `grace_days=2`, `reminder_days=[3,1]`, `review_eta`, `delivery_eta` (both public, empty by default), `maintenance={enabled:false,message:''}` (public), `announcement={enabled:false,text:'',link:'',tone:'info',starts_at:null,ends_at:null}` (public), `require_staff_mfa=true`, `low_stock_threshold=3`.

**FAQs (published, ordered):** 1) *How long does delivery take?* — Servers are delivered after we verify your payment; the typical time is shown on your order page and we notify you by email and in your dashboard. 2) *What operating system do you provide?* — Every server runs Windows; we currently offer one Windows Server image on all plans. 3) *How does the 30‑day term work?* — A plan runs for 30 days from delivery; renew from your dashboard before it expires to add another 30 days. 4) *Which payment methods do you accept?* — Manual payments such as bank transfer, mobile wallets, UPI and crypto depending on your region; choose one at checkout and upload proof. 5) *Can I get a refund?* — See our Refund Policy; refunds are handled manually by our team. 6) *Can I change my server's location?* — Locations are fixed per server; order a new server in the location you need. 7) *How do I connect?* — Use Remote Desktop Connection on Windows, Windows App on macOS, or the Remote Desktop app on Android/iOS with the IP, port, username and password from your dashboard. 8) *What is not allowed?* — Spam, DDoS, fraud, malware and other abuse prohibited by the Acceptable Use Policy lead to suspension without refund.

**Dev seed script** (`scripts/seed-dev-users.ts`, refuses to run if `NODE_ENV=production`): one customer with an active seeded service (fake IP from `203.0.113.0/24`), one support user, one admin — passwords generated at runtime and printed once to the console, **not** committed.

---

## 16. Testing

- **pgTAP (`supabase/tests`)** — for each role (anon, customer A, customer B, support, admin): read/write attempts per table must match §7; customer cannot update `role`/`status`; customer B cannot see A's orders/payments/proofs/services/tickets; `service_credentials` unreadable by every client role; `audit_logs` update/delete fails even for admin; `create_order` rejects tampered/out‑of‑stock/over‑limit/invalid‑coupon; `approve_payment` is atomic and idempotent‑safe; renewal extends from `greatest(now(), expires_at)`; `allocate_service` is single‑use per order.
- **Vitest** — money/discount math, coupon rules, expiry maths, crypto round‑trip + tamper detection + key rotation, magic‑byte sniffing, `createAction` error mapping, `.rdp` builder, password generator constraints.
- **Playwright** — flows listed in files 02 and 03.
- **CI** — GitHub Actions: install, `tsc --noEmit`, ESLint, Vitest, `supabase db reset` + pgTAP, Playwright against a local stack, bundle check that `SUPABASE_SECRET_KEY`/`CREDENTIALS_*` never appear in client output.

---

## 17. Runbook (put in `README.md`)

```bash
npx supabase init
npx supabase start                         # needs Docker
npx supabase db reset                      # migrations + seed
npx supabase gen types typescript --local > src/types/database.ts
npx supabase test db                       # pgTAP
npx supabase link --project-ref <ref> && npx supabase db push
npx tsx scripts/make-admin.ts you@example.com
```
Then set Vercel env vars, add `vercel.json` crons (`/api/cron/emails` every 5 min on Pro or hourly on Hobby; `/api/cron/maintenance` daily), configure Supabase Auth URLs/SMTP/captcha, and enable PITR.

---

## 18. Acceptance checklist

- [ ] `supabase db reset` succeeds from scratch; types generate; all pgTAP tests pass.
- [ ] No table in `public` lacks RLS; no policy lets customers write money/state tables directly.
- [ ] Price tampering, role escalation, cross‑tenant reads and credential reads by non‑owners are all impossible (tests prove it).
- [ ] Approve → deliver → reveal works end‑to‑end; credentials are encrypted at rest, absent from emails/logs/client bundles.
- [ ] Renewal extends by exactly 30 days from `greatest(now(), expires_at)`; expiry, stale‑order cancellation and reminders run on schedule and are idempotent.
- [ ] Every privileged action writes an immutable audit row with actor, reason and before/after.
- [ ] Rate limits, Turnstile, CSP/HSTS and upload sniffing verified.
- [ ] Seeds load with zero live payment methods until the owner fills them in.
