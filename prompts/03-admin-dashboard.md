# 03 · Admin Dashboard — Cloud RDP VPS

> **Role:** Senior full‑stack engineer building an internal operations console for a hosting reseller. Optimise for **speed of daily work, correctness of money, and an audit trail for every change**.
> **Prerequisite reading:** `01-homepage-and-design-system.md` (tokens, glossy buttons, component list, hard rules) · `04-backend-supabase.md` (tables, RPCs, RLS, server actions) · `02-user-dashboard.md` (shell patterns reused here). Hard rules from file 01 §1 apply unchanged: bg `#F1F1F1`, lavender primary, **no gradients except buttons**, **bare icons without backgrounds**, no AI‑cliché icons, 10px buttons, no capsules, glossy primary buttons.

> **TYPOGRAPHY (overrides every font mention below — see file 01 §4.2).** The only typefaces are **Inter Tight** (display, headings, prices) and **Inter** (everything else). Wherever this file says "mono", use Inter: uppercase tracked labels, or tabular figures for data. Wherever it says "serif", use Inter Tight. No serif and no monospace font anywhere.

> **FLAT-SURFACE RULE (overrides everything below — see file 01 §1 rule 11).** No cards, panels, tiles, filled/tinted blocks, image or texture backgrounds, and no background behind a background. Wherever this file says "card", "white card", "panel", "frame" or "filled block", build an open section on `#F1F1F1` separated by 1px hairlines (`.ruled-wrap` / `.ruled`, divided columns, underline tabs). Inputs are transparent with a 1px border. Lavender is an accent only. Illustrations sit directly on the page.

> **CARD-SURFACE UPDATE (supersedes the FLAT-SURFACE RULE for the admin console too).** The console now matches the customer dashboard: white cards on the `#F1F1F1` page (`rounded-panel` 20px, 6% black hairline, `shadow-1`), 20px between cards and 24px inside them. Use the same building blocks (`src/components/portal/cards.tsx`: `Card`, `StatCard`, `Tabs`, `RowList`/`Row`, `PagerBar`) through the admin wrappers in `src/components/ledger/primitives.tsx` (`LedgerSection` = a titled card, `flush` for lists and tables; `Figure` = a stat tile with an optional bare icon) and `src/components/admin/{parts,data-table,charts,status}.tsx`. Pages are a grid of cards: list pages = filter row + one table card; detail pages = a main column of cards plus a 340px aside of cards (Summary, Actions). Fields are white with a soft hairline, 40px tall, 14px radius (`FIELD`); form messages are tinted blocks, not left rules; dialogs are white rounded panels; save bars float as a sticky card instead of a full-width strip. Still binding: bare icons with **no chip, circle or tile behind them**, lavender as the only brand hue, solid fills only, Inter / Inter Tight, 10px buttons, WCAG AA text on every tint (use `text-bad-ink` on `bg-bad-bg`). Where the rest of this file says "open section", "hairline-separated" or "right rail", read "card", "card list" and "aside of cards".


---

## 1. What the admin does all day (design around this loop)

```
Customer places order → pays manually → uploads proof
        ↓
[1] REVIEW PAYMENT  → approve / reject
        ↓
[2] ALLOCATE SERVER → enter or pick IP, port, username, password → deliver
        ↓
[3] MANAGE LIFECYCLE → renewals (extend +30d), suspend, expire, terminate
        ↓
[4] SUPPORT         → tickets, contact messages
```
The console must make steps 1 and 2 possible in **under 30 seconds each** with the keyboard.

---

## 2. Routes

```
/admin                           Overview (command centre)
/admin/payments                  Payment review queue (split view)
/admin/orders      /[id]         Orders list · detail (+ Deliver server panel)
/admin/services    /[id]         Services list · detail
/admin/inventory                 Server inventory (optional module — build after core flows)
/admin/customers   /[id]         Customers list · detail
/admin/catalog/plans             Plan templates
/admin/catalog/pricing           Pricing & stock matrix
/admin/catalog/locations         Locations
/admin/payment-methods           Payment methods
/admin/coupons                   Coupons
/admin/tickets     /[id]         Support inbox · thread
/admin/inbox                     Contact‑form messages
/admin/invoices                  Invoices
/admin/content/faqs              FAQ editor
/admin/content/announcement      Announcement banner
/admin/reports                   Reports & CSV export
/admin/team                      Staff & roles
/admin/audit-log                 Audit log
/admin/settings                  Site settings
```

### Roles & permission matrix (enforced server‑side **and** by RLS)

| Area | `support` | `admin` |
|---|---|---|
| Overview, search | read (limited KPIs, no revenue) | full |
| Orders / payments | read; **cannot approve** | full |
| Services | read; cannot reveal credentials | full (reveal is audit‑logged) |
| Customers | read; add notes | full (suspend, notify) |
| Tickets / inbox | full | full |
| Catalog, pricing, methods, coupons, content, settings, reports, team, audit log | — | full |

First admin is created by a one‑off script `scripts/make-admin.ts <email>` (service role) — there is no public path to become staff. Staff must have **TOTP MFA enrolled (AAL2)**; `/admin` redirects to MFA enrolment/verification otherwise (toggle `require_staff_mfa`, default **on**).

---

## 3. Admin shell

- **Sidebar** 248px, `--bg`, hairline right border. Logo with a small mono `ADMIN` tag (`--lav-800` text, 1px `--lav-300` border, 6px radius). Groups with mono headings:
  **Operations** — Overview (LayoutDashboard) · Payments (CreditCard) · Orders (ShoppingCart) · Services (Server) · Inventory (Boxes) · Customers (Users)
  **Support** — Tickets (LifeBuoy) · Inbox (Mail)
  **Catalog** — Plans (Layers) · Pricing (Tag) · Locations (MapPin) · Payment methods (Landmark) · Coupons (Ticket)
  **Business** — Invoices (FileText) · Reports (ChartColumn — use whatever the installed lucide version names its bar‑chart icon)
  **System** — Content (FileEdit) · Team (UserCog) · Audit log (ScrollText) · Settings (Settings)
  Live count badges (mono, rectangular 6px, lavender text on `--lav-100`) on Payments, Orders (needs allocation), Tickets (awaiting staff), Inbox — driven by Realtime. **Icons stay bare.**
- **Top bar** 64px: breadcrumbs, **global search** (`/` or `⌘K`) over order numbers (`CRV‑000123`), customer email/name, service IP/label, ticket subject; notification bell for staff events; user menu.
- **Density:** compact by default (36px table rows), toggle to comfortable (48px). Persist in `localStorage`.
- **Layouts:** list pages = filters bar + `DataTable`; detail pages = main column + 320px right rail (summary, actions, danger zone).

### Shared admin building blocks
`DataTable` (TanStack: server‑side pagination/sort/filter via URL with `nuqs`, column visibility, row selection + bulk bar, sticky header, CSV export, keyboard `j/k` row focus, `Enter` open) · `FilterBar` · `StatCard` · `ConfirmDialog` (restates the object, optional required reason) · `ReasonSelect` · `JsonDiff` · `ImageViewer` (zoom/pan/rotate, PDF embed) · `Timeline` · `RelativeTime` (+ exact tooltip) · `MoneyInput` (USD, 2 dp) · `SecretField` (generate/copy/show) · `CommandPalette`.

---

## 4. Overview `/admin` (command centre)

1. **Header:** "Overview" + range select `Today · 7 days · 30 days · 90 days` + `Export` secondary.
2. **Action queue** (first, most important): one white card, five hairline‑separated columns — `PAYMENTS TO REVIEW` · `ORDERS TO ALLOCATE` · `EXPIRING ≤ 3 DAYS` · `TICKETS AWAITING STAFF` · `UNREAD INBOX`. Mono number links to the pre‑filtered list; the oldest item's age shown beneath ("oldest 3h 12m").
3. **KPI strip:** Net revenue · Orders · New customers · Active services · Renewal rate — each with delta vs previous period using `ArrowUpRight`/`ArrowDownRight` (bare, `--ok`/`--bad`). `support` role sees counts only, no money.
4. **Charts (Recharts, flat fills, hairline axes, mono ticks):**
   - Revenue over time — area: fill `--lav-200`, 2px `--lav-600` line (no gradient).
   - Orders by country — horizontal bars, `--lav-500`.
   - Product mix RDP vs VPS — single stacked bar.
   - Payment‑method usage — horizontal bars.
5. **Two work lists:** *Oldest unreviewed payments* (with `Review` buttons) · *Expiring in 3 days* (with `Extend`/`Contact`).
6. **Recent activity:** last 12 audit events.

---

## 5. Payment review `/admin/payments` (the most important screen)

Split view, full‑height, keyboard first.
- **Left (360px):** queue tabs `Pending · Approved · Rejected · All`. Rows: order #, customer, method, expected amount, **age badge** (green < 1h, amber < 4h, red > 4h), duplicate warning icon. Oldest first.
- **Right (detail):**
  - `ImageViewer` for the proof (zoom, pan, rotate, open original in new tab) — files fetched via **60‑second signed URLs**.
  - Facts: order link, customer, plan + location, method, **expected USD** and **expected local amount** (rate snapshot), customer's reference/ID, submitted time, file hash status (`Duplicate of order CRV‑000099` warning if the same hash/reference was used before).
  - **Amount received** input (USD) and **Method received on** select — required to approve; if received < expected, the UI forces the "Amount mismatch" path.
  - Actions: **`Approve payment`** (primary gloss; confirm dialog states the amount) · **`Reject`** (destructive; required reason preset — *Unreadable proof · Amount mismatch · Payment not received · Reference not found · Other* — plus optional message shown to the customer).
  - Shortcuts: `A` approve · `R` reject · `J/K` next/prev · `Z` zoom.
- Approving calls the atomic `approve_payment` RPC: payment → `verified`, order → `approved`, invoice issued, notification + email queued, audit logged. For **renewal** orders the panel previews the new expiry ("Extends from 12 Nov 2026 → 12 Dec 2026") and approval can **auto‑extend** the linked service in the same transaction.

---

## 6. Orders `/admin/orders` and `/admin/orders/[id]`

- **List:** filters (status, product, country, plan, method, date range, coupon, type `new|renewal`), search; columns: order #, customer, product·plan, location (flag), total, status, payment status, placed, age, assignee; bulk: export CSV, cancel unpaid.
- **Detail** (main + right rail):
  - Timeline of every state change with actor + timestamp (from `order_events`).
  - Cards: Items & totals (list price, coupon, discount, total — read‑only snapshot), Payments (all attempts, proof thumbnails, statuses), Customer card, Internal notes (staff only).
  - **Deliver server panel** (visible when `status ∈ approved|provisioning` and type `new`):
    - Choose **From inventory** (filtered to the order's plan + location; pick one) **or** **Enter manually**.
    - Fields: Label/hostname (optional), IP (IPv4/IPv6 validated), RDP port (default 3389), Username (default `Administrator`), Password (`SecretField` with **Generate 20‑char strong password**, copy, show/hide), Starts at (default now), **Expires at (auto = start + 30 days; editable only with a reason)**, Internal notes, `Notify customer` (default on).
    - `Deliver server` (primary gloss) → `allocateService` action: encrypts credentials, creates `services` + `service_credentials`, marks order `completed`, links inventory item, notifies the customer **(email never contains the password)**, logs the action.
  - Right rail actions: Cancel order · Mark refunded (reason, amount; manual since payments are manual) · Re‑open · Add note.

---

## 7. Services `/admin/services` and `/admin/services/[id]`

- **List:** filters (status, product, location, plan, expires within 3/7/30 days, supplier), search by label/IP/customer; columns: label, customer, product·plan, location, IP (mono + copy), status, expires (relative), supplier cost (admin only); bulk: extend, export.
- **Detail:** spec + customer + order history; credentials card (`Reveal` — audit‑logged, 30 s auto‑hide, admin role only); status timeline; internal notes.
- **Actions (each needs reason + audit log):** `Extend` (+30 days preset, +N days, or set date; shows new expiry preview) · `Suspend` / `Unsuspend` (customer sees status + reason) · `Edit credentials` (re‑encrypt, optional customer notification) · `Edit label/notes` · `Terminate` (type the service label to confirm; releases the inventory item to `retired`). No reassignment between customers in v1.
- **Lifecycle automation visible here:** a daily job marks past‑expiry services `expired`, and after `grace_days` flags them `terminate_due` for admin action (never auto‑deletes data). Reminder emails go out at the configured days before expiry.

---

## 8. Inventory `/admin/inventory` *(optional module — build after §5–§7 pass)*

Pre‑provisioned servers bought from suppliers and held in stock, so allocation is one click and margin is measurable.
- Table: product, location, plan class, IP, supplier, **supplier cost**, supplier expiry, status (`available · allocated · retired`), allocated to.
- Add single item (same `SecretField` for credentials) and **CSV import** (preview → validate IP/format → commit; reject duplicates by IP).
- Low‑stock warning per product+location+plan (threshold in settings) and a shortcut to mark pricing‑matrix stock `low`/`out_of_stock`.
- Margin = plan price − supplier cost, shown in Reports.

---

## 9. Customers `/admin/customers` and `/admin/customers/[id]`

- **List:** search (name/email/phone), filters (status, country, has active service, signed‑up range, lifetime spend range), columns: name, email (verified icon), country, orders, active services, lifetime spend, joined, last seen.
- **Detail:** profile, KPI row (lifetime spend, orders, active services, tickets), tabs *Orders · Services · Tickets · Notes · Activity*. Actions: `Suspend account` (reason; blocks ordering, keeps tickets open) · `Unsuspend` · `Send notification` · `Resend verification email`. **No impersonation feature.**

---

## 10. Catalog

### 10.1 Plans `/admin/catalog/plans`
Plan templates: product (`rdp|vps`), name, vCPU, RAM GB, storage GB (NVMe), bandwidth (TB), port speed (Mbps), 3–6 feature bullets, `is_featured`, sort, `is_active`. Windows is implicit — **no OS field**. Preview card exactly as the public site renders it.

### 10.2 Pricing & stock matrix `/admin/catalog/pricing`
Grid: rows = plans, columns = locations. Each cell: **price (USD)**, **stock status** (`in_stock · low · out_of_stock`), optional stock count, active toggle. Inline editing with a sticky "N unsaved changes — Review · Save all · Discard" bar and a diff preview. Bulk tools: set price across row/column, ±% adjust, copy column. Saving writes `plan_pricing`, audit‑logs old→new, and invalidates public cache tags (`plans`, `pricing`, `locations`).

### 10.3 Locations `/admin/catalog/locations`
Name, slug, ISO‑2 code (flag via `country-flag-icons`), image key (from file 05 manifest) or uploaded image, sort, `is_active`, short SEO blurb. Deactivating warns about active pricing rows.

---

## 11. Payment methods `/admin/payment-methods`
CRUD + drag‑to‑reorder (`@dnd-kit`). Fields: name, type (`bank · mobile_wallet · upi · crypto · other`), **regions** (ISO‑2 multi‑select or Global), **currency_code** + **rate_per_usd** (nullable = USD; show "rate last updated {time}" and a bulk *Update rates* dialog), fee note, account details (labelled key/value rows: account name, number/IBAN, wallet address, network, UPI ID …), QR image upload, markdown instructions, active toggle. **Live preview** of the customer's payment card. Per‑method stats (count, volume, 30 days).

## 12. Coupons `/admin/coupons`
Code (auto‑generate), type `percent|fixed_usd`, value, applies to (all / product / plan / location), min order, max redemptions, per‑user limit, starts/ends, active; usage table with orders. Codes are case‑insensitive and unique.

---

## 13. Support

### 13.1 Tickets `/admin/tickets`
Three‑pane on desktop (filters · list · thread), single column on mobile. Filters: status, priority, category, assignee (`me · unassigned`), service, age. Thread: customer messages, staff replies, **internal notes** (flat `--warn-bg` rectangle, "Internal" mono tag, never visible to customers). Right rail: customer card, their active services (with IPs), recent orders. **Canned responses** (`/` trigger, managed in Settings), assign, set priority/status, attachments (signed URLs), `Resolve & close`. SLA age chip (`awaiting staff 2h`). Realtime new‑message indicators.

### 13.2 Inbox `/admin/inbox`
Public contact‑form messages: unread/handled, `Reply by email` (mailto prefilled), `Convert to ticket` (if the sender has an account), `Mark handled`, spam flag.

---

## 14. Invoices & reports

- **Invoices `/admin/invoices`:** list/search/filter; view printable invoice; `Void` (reason, admin only, audit‑logged; voiding does not delete).
- **Reports `/admin/reports`:** date range + compare‑to‑previous. Sections: Revenue (gross, discounts, refunds, net) · By product / plan / location / payment method · New vs renewal · Order funnel (placed → proof submitted → approved → delivered) · Renewal rate & churn · Customers (new, active) · Supplier cost & margin (if inventory) · Support (volume, first‑response time). Every table has **CSV export**. Charts follow the flat‑fill rule.

---

## 15. Content, team, audit, settings

- **Content:** FAQ editor (categories, order, publish, markdown answers, live preview) · Announcement banner (text, link, tone `info|warn`, start/end, active) — both invalidate public cache tags.
- **Team `/admin/team`:** staff list, role (`support|admin`), MFA status, last active; **Invite** (Supabase admin `inviteUserByEmail` + role assignment) or promote an existing user by email; change role; deactivate. Guards: cannot demote/deactivate yourself or the last admin.
- **Audit log `/admin/audit-log`:** read‑only, filters (actor, action, entity, date), `JsonDiff` of before/after, IP and user agent, CSV export. Never editable or deletable from the UI.
- **Settings:** *General* (site name, support email, WhatsApp, Telegram, legal/company block for invoices) · *Orders* (unpaid‑order expiry hours default 48, max open orders per user 3, review ETA text, delivery ETA text, `grace_days` 2, reminder days `[3,1]`) · *Operations* (maintenance mode with message — disables ordering, shows banner; low‑stock threshold) · *Email* (sender name, reply‑to, **Send test email**) · *Security* (require staff MFA, optional `ADMIN_IP_ALLOWLIST` display) · *Canned responses*.

---

## 16. Engineering requirements

- **Authorization pattern:** every admin Server Component/Action starts with `await requireRole('admin' | 'support')` (reads the authenticated user from Supabase, loads `profiles.role`, checks AAL2 if required). Never trust a role sent from the client. UI hiding is cosmetic; RLS + server checks are authoritative.
- **Service‑role client** exists only in `src/server/admin/*` with `import "server-only"`; each function it exposes is single‑purpose (e.g. `approvePayment`, `allocateService`), validates input with Zod, and calls a Postgres RPC where atomicity matters.
- **Every mutation:** Zod validation → authorize → execute (RPC/transaction) → **write `audit_logs`** (actor, action, entity, before/after JSON, IP, UA) → invalidate cache tags → return `ActionResult<T>`.
- **Money & expiry** math is done in the database (integer cents, `timestamptz`), never in the browser.
- **Destructive/irreversible actions** require a confirm dialog and a stored reason.
- **Rate limiting** (Upstash) on credential reveal, password generation endpoints, CSV export and search.
- **Realtime** for staff: new `payments`, `orders`, `tickets`, `contact_messages` update sidebar counts and show a toast; optional sound (off by default); document title shows `(3) Admin · Cloud RDP VPS`.
- **CSV export** via streaming route handlers with the same filters as the list, capped (e.g. 50k rows), audit‑logged.
- **Performance:** server‑side pagination everywhere; DB indexes per file 04; no table loads more than 100 rows at once; skeletons not spinners.
- **Accessibility:** tables with proper headers, `aria-sort`, focus management in split views and dialogs, shortcut hints discoverable via `?`.

---

## 17. Acceptance checklist

- [ ] Approving a proof, then delivering a server, can be done end‑to‑end in < 60 seconds by keyboard.
- [ ] A `support` user cannot approve payments, see revenue, reveal credentials or open catalog/settings (UI **and** direct action/RPC calls fail).
- [ ] Every mutation produces an audit row with before/after; deleting audit rows is impossible via the app.
- [ ] Editing a price in the matrix updates the public site (cache invalidated) and records the change.
- [ ] Renewal approval extends the correct service by exactly 30 days from `max(now, expires_at)`.
- [ ] Credentials are encrypted at rest; never logged; never in emails; never in list payloads.
- [ ] Admin pages never expose the service‑role key to the client bundle (verify with a bundle grep).
- [ ] Visual rules: bg `#F1F1F1`, gradients only in button classes, bare icons, 10px buttons, no capsules, flat charts.
- [ ] Playwright e2e: admin login with MFA → review payment → deliver server → customer sees credentials; extend; suspend; ticket reply with internal note hidden from the customer.
