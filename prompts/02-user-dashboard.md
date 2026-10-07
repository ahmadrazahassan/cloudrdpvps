# 02 · Auth, Checkout & User Dashboard — Cloud RDP VPS

> **Role:** Senior full‑stack engineer + product designer. Build the customer‑facing authenticated experience exactly as specified.
> **Prerequisite reading:** `01-homepage-and-design-system.md` (tokens, typography, glossy buttons, component list, hard rules) and `04-backend-supabase.md` (tables, RPCs, server actions). This file does **not** repeat the design system — it applies it. Where a rule in file 01 §1 applies (bg `#F1F1F1`, lavender primary, **no gradients except buttons**, **bare icons with no background**, no banned AI‑cliché icons, 10px button radius, no capsule shapes, glossy primary buttons) it applies here without exception.

> **TYPOGRAPHY (overrides every font mention below — see file 01 §4.2).** The only typefaces are **Inter Tight** (display, headings, prices) and **Inter** (everything else). Wherever this file says "mono", use Inter: uppercase tracked labels, or tabular figures for data. Wherever it says "serif", use Inter Tight. No serif and no monospace font anywhere.

> **FLAT-SURFACE RULE (overrides everything below — see file 01 §1 rule 11).** No cards, panels, tiles, filled/tinted blocks, image or texture backgrounds, and no background behind a background. Wherever this file says "card", "white card", "panel", "frame" or "filled block", build an open section on `#F1F1F1` separated by 1px hairlines (`.ruled-wrap` / `.ruled`, divided columns, underline tabs). Inputs are transparent with a 1px border. Lavender is an accent only. Illustrations sit directly on the page.

---

## 1. Scope & routes

```
(auth)
  /login            /register          /forgot-password
  /reset-password   /verify-email      /auth/callback (route handler)
(checkout)
  /order/new        configure + review (guest can configure; must sign in to place order)
(portal)  — requires session + verified email
  /dashboard                              Overview
  /dashboard/services                     list
  /dashboard/services/[id]                detail (tabs: Overview · Connection · Billing · Support)
  /dashboard/orders                       list
  /dashboard/orders/[id]                  detail + timeline
  /dashboard/orders/[id]/pay              manual payment flow
  /dashboard/billing                      Invoices · Payments tabs
  /dashboard/billing/invoices/[id]        printable invoice
  /dashboard/tickets                      list
  /dashboard/tickets/new
  /dashboard/tickets/[id]                 thread
  /dashboard/notifications
  /dashboard/settings                     Profile · Security · Preferences · Danger zone
```

**Access control** (enforced in `proxy.ts` **and** re‑checked in every Server Component/Action — never trust the proxy alone):
- Unauthenticated → `/login?next=<validated same‑origin path>`.
- Authenticated but email unverified → `/verify-email`.
- Staff roles (`support`, `admin`) may open `/dashboard` for their own account; they reach `/admin` via the user menu.
- Banned/suspended profile (`profiles.status = 'suspended'`) → read‑only banner, ordering disabled, support tickets still allowed.
- `next` parameter must be validated (starts with `/`, not `//`, no scheme) to prevent open redirects.

---

## 2. Shells

### 2.1 Auth shell
Split layout, full viewport height, `--bg` background.
- **Left (form side, max 440px, vertically centred):** logo, serif H1 (36px), muted line, form, secondary links. Footer line with Terms/Privacy.
- **Right (art side, hidden < 1024px):** white 20px‑radius frame inset 16px from the edges containing `auth-art` (portrait lavender scan‑line server rack from file 05) and, bottom‑left, a mono caption `WINDOWS RDP & VPS · PK · IN · BD · US · UK`. Flat colours only.

### 2.2 Portal shell
- **Sidebar** 264px (collapsible to 72px; state in `localStorage`), `--bg`, **1px hairline right border**. Top: logo. Then a primary gloss `New order` button (full width). Nav (bare icons, 20px, stroke 1.5):
  `Overview` (LayoutDashboard) · `Services` (Server) · `Orders` (ReceiptText) · `Billing` (Wallet) · `Support` (LifeBuoy) · `Notifications` (Bell, unread count in mono) · `Settings` (Settings).
  Active item: ink text weight 600, lavender‑600 icon, a 2px lavender‑500 bar on the left edge, row background `rgba(18,18,20,.04)`. **No box around the icon itself.**
  Bottom: user block (initials avatar — round is allowed, 32px, `--lav-100` fill with `--lav-800` initials), name, email, menu → Settings · Admin (staff only) · Sign out.
- **Top bar** 64px, `--bg`, hairline bottom: breadcrumbs (mono 12px), command palette trigger (`⌘K` hint, rectangular 10px), notifications bell (bare icon + 6px lavender dot when unread), user menu.
- **Page header:** Inter 28px/600 title, muted description, right‑aligned actions. Content max‑width 1200px, 32px padding (16px mobile). Cards: white, 14px radius, 1px hairline.
- **Mobile (< 1024px):** sidebar becomes a left `Sheet`; bottom padding for safe areas; tables render as stacked cards.
- **Command palette (`cmdk`):** Navigate (all routes), Quick actions (New order, Open ticket, Renew service X), recent orders/services.

---

## 3. Authentication pages

Backend: Supabase Auth via `@supabase/ssr` (cookie sessions). All forms: `react-hook-form` + `zod`, server actions, inline errors, `aria-live` status, loading primary button.

| Page | Fields & behaviour |
|---|---|
| **/register** | Full name, email, password (min 10 chars; strength meter; show/hide toggle), confirm password not required. Checkbox "I agree to the Terms, Privacy Policy and Acceptable Use Policy" (required, links open new tab). **Cloudflare Turnstile**. On success → `/verify-email` with "We sent a link to {email}", resend button (60s cooldown). Optional "Continue with Google" **only if** `NEXT_PUBLIC_GOOGLE_AUTH=true`. |
| **/login** | Email, password, "Forgot password?", Turnstile after 3 failed attempts. Generic error "Email or password is incorrect." Never reveal whether an email exists. Honour validated `next`. Staff land on `/admin` by default, customers on `/dashboard`. |
| **/forgot-password** | Email → always shows "If an account exists, we've sent a reset link." Rate limited. |
| **/reset-password** | New password + strength meter; requires valid recovery session; success → sign out other sessions → `/login` with toast. |
| **/verify-email** | State screen with resend; polls session every 5s and redirects when verified. |
| **/auth/callback** | Exchanges code for session, handles PKCE, redirects to validated `next`. |

Copy tone: calm, plain, no exclamation marks. Page titles in serif.

---

## 4. Checkout — `/order/new`

Public page; ordering requires auth. Query params pre‑fill: `?product=rdp|vps&country=pk&plan=<uuid>` and `?renew=<serviceId>`.

### 4.1 Layout
Two columns ≥ 1024px: left **configurator** (flex‑1), right **sticky Order Summary** (360px, white card). Single column on mobile with the summary collapsing into a bottom bar that expands.

### 4.2 Steps (visible as a mono stepper `01 Configure — 02 Review — 03 Pay`)
1. **Configure**
   - Product: underline Tabs `Windows RDP | Windows VPS`.
   - Location: rectangular segmented control with flags (only countries that have an active price for the selected product; out‑of‑stock disabled with mono `OUT OF STOCK`).
   - Plan: radio card grid (4 per product). Each card: name, spec list (vCPU · RAM · NVMe · Bandwidth · Port), price `$/30 days`.
   - **Operating system row:** read‑only, a Lock icon (bare) + "Windows Server" + muted "Included with every plan". **No picker.**
   - Term row: read‑only "30 days".
2. **Review**
   - Summary of selection, coupon field (`Apply` secondary button; shows discount line or inline error), "I agree to Terms & AUP" checkbox, total in `$`.
   - Primary lg button `Place order` (requires auth; if signed out the button opens `/login?next=…` preserving selection).
3. **Pay** — after `Place order` succeeds, redirect to `/dashboard/orders/[id]/pay`.

### 4.3 Rules
- **Price is never trusted from the client.** The server action calls the `create_order` RPC with `plan_id`, `country_id`, optional `coupon_code`; the DB recomputes price, stock and discount and snapshots them on the order.
- Renewal mode (`?renew=`): configurator is replaced by a locked summary of the existing service (same plan & location), current price shown, label "Renewal · extends from {expires_at}". If the plan is no longer sold, show the nearest equivalent and require confirmation.
- Block ordering for suspended profiles; show reason.
- Show a one‑line honest notice: "Your server is delivered after we verify your payment."
- Max 3 open `awaiting_payment` orders per user (server‑enforced) with a friendly message.

---

## 5. Manual payment flow — `/dashboard/orders/[id]/pay`

Purpose: take the customer from "order placed" to "proof submitted" with zero confusion.

**Header:** order number (mono), plan + location + flag, total due, and a flat countdown "Pay within 47h 12m" (from `orders.expires_at`; unpaid orders auto‑cancel after the admin‑set window).

**Layout:** left = 3 numbered steps; right = sticky summary.

1. **Choose a payment method** — list of active `payment_methods` available to the customer's region + international ones (radio rows, rectangular): method name, a bare type icon (Landmark = bank, Smartphone = mobile wallet, Coins = crypto, QrCode = UPI/QR), fee note if any.
2. **Send your payment** — an instructions card driven by the chosen method:
   - Amount block: **USD total** and, when the method has `currency_code`/`rate_per_usd`, the **local amount to send** ("Send PKR 5,700 — rate 1 USD = 285 PKR"). Copy button on every value.
   - Account details (name, number/IBAN/UPI ID/wallet address, network for crypto with an explicit warning "Send only on {network}"), method QR image (signed URL), markdown instructions written by admin.
   - Reference: show the order number to put in the payment note.
3. **Upload proof** — dropzone (drag/drop + click, keyboard accessible), accepts PNG/JPG/WebP/PDF ≤ 5 MB, image preview thumbnail, optional transaction/reference ID (required for crypto), optional note. Client + server validation. `Submit payment proof` primary button → server action `submit_payment` → order becomes `under_review`.

**States**
- `under_review`: replace the form with a calm status card (illustration `status-under-review`), "We're reviewing your payment" + `site_settings.review_eta` if set + link to order. Customer can still add a note.
- `rejected`: reason from admin in a `--bad-bg` rectangular alert, button `Submit new proof`.
- `approved/completed`: success card (`success-order-placed`) with links to the order and, when delivered, the service.
- `expired/cancelled`: explain and offer `Place a new order`.

Security: proof is uploaded to the private `payment-proofs` bucket under `{user_id}/{order_id}/…` via a signed upload URL; never public.

---

## 6. Dashboard pages

### 6.1 Overview `/dashboard`
1. **Greeting row:** "Good {morning|afternoon|evening}, {first name}" (serif 36px) + primary `New order`.
2. **Stat strip:** one white card, four columns separated by 1px hairlines (echoes Ref 1): `ACTIVE SERVICES`, `EXPIRING IN 7 DAYS`, `ORDERS IN PROGRESS`, `OPEN TICKETS`. Mono label above a large number; number links to the filtered list.
3. **Needs your attention** (only if non‑empty), list rows with a bare icon, text, and a button: *Pay for order CRV‑000123* · *Renew “Trading‑1” — expires in 3 days* · *Reply on ticket #48*.
4. **Your services:** grid of **Service cards** (§7.1); empty state `empty-services` with `Order your first server`.
5. **Recent activity:** last 8 notifications as a hairline timeline.
6. **Help card:** "Connecting for the first time?" → link to connection guide; `Open a ticket` secondary button.

### 6.2 Services `/dashboard/services`
Filters (status: Active · Expiring · Suspended · Expired; product; location) via `nuqs`; search by label/IP; sort by expiry. Grid/list toggle (rectangular segmented). Pagination 12/page. Empty + no‑results states.

### 6.3 Service detail `/dashboard/services/[id]`
Header: editable label (inline, pencil icon, saves via action), product tag, flag + location, status badge, expiry meter, `Renew` primary button (always visible; becomes prominent ≤ 7 days). Tabs (underline):
- **Overview:** `SpecList` (vCPU, RAM, storage, bandwidth, port speed, OS = Windows Server, location, started on, expires on, order link), expiry meter, activity timeline.
- **Connection** (the key screen): *Credentials card* (white, 14px) with mono rows
  `HOST` ip · `PORT` 3389 · `USERNAME` · `PASSWORD` ••••••••••.
  - `Reveal` fetches the password through a server action (decrypts server‑side, checks ownership & status, writes an audit log, rate‑limited) and shows it for **30 seconds** then masks again. Copy buttons on each row (toast "Copied").
  - `Download .rdp file` generates `full address:s:{ip}:{port}` + `username:s:{user}` + `prompt for credentials:i:1` (never embeds the password).
  - Accordion **Connection guide**: Windows (Remote Desktop Connection), macOS (Windows App), Android, iOS — short numbered steps with mono values.
  - Suspended/expired services hide credentials and show why + a Renew/Contact support action.
- **Billing:** orders/invoices for this service (renewal history).
- **Support:** tickets linked to the service + `Open ticket` prefilled (categories: *Restart request*, *Reinstall request*, *Cannot connect*, *Other*). **No self‑serve power controls** — provisioning is manual; say so plainly.

### 6.4 Orders `/dashboard/orders` & `/dashboard/orders/[id]`
List: table (order #, product+location, total, status badge, placed on, action) with status filter chips (rectangular). Detail:
- **Status timeline** (vertical hairline stepper, mono timestamps): *Order placed → Payment submitted → Payment verified → Server delivered* (+ terminal states *Rejected*, *Cancelled*, *Refunded*).
- Cards: Order summary (line items, coupon, total), Payment (latest attempt: method, amount, reference, proof thumbnail via 60‑second signed URL, status, admin rejection reason), Delivery (link to the service or "We'll notify you when your server is ready").
- Actions by state: `Pay now` (awaiting_payment) · `Cancel order` (awaiting_payment only, confirm dialog) · `Submit new proof` (rejected) · `Contact support`.

### 6.5 Billing `/dashboard/billing`
Tabs **Invoices** and **Payments**. Invoices table: invoice #, date, order, amount, status "Paid", `View`/`Print`. Printable invoice page: company block from `site_settings`, bill‑to, line items, total, "Paid on {date}", flat bordered "PAID" mark (no gradient), `@media print` stylesheet (white, no chrome). Payments table: date, order, method, amount, status badge, reference.

### 6.6 Support
- **List:** status filter (Open · Awaiting reply · Resolved · Closed), search, `New ticket` primary.
- **New ticket:** subject, category select, related service (optional select), message (min 20 chars), up to 3 attachments (images/PDF ≤ 5 MB) to `ticket-attachments` bucket.
- **Thread:** chat‑like but rectangular bubbles (10px radius); staff replies show a `SUPPORT` mono tag; customer can reply, attach, `Mark resolved`, reopen within 7 days. Internal staff notes are **never** visible here (RLS enforces). Realtime updates.

### 6.7 Notifications
Full page + bell dropdown (last 10). Types: order placed, payment under review, payment approved/rejected, server delivered, expiring (3 d, 1 d), expired, ticket reply, admin announcement. Each has an icon, text, relative time, deep link; `Mark all as read`. Realtime insert → toast + bell dot.

### 6.8 Settings
Tabs (underline): **Profile** (full name, phone with country code, billing country, optional company, optional Telegram/WhatsApp for support) · **Security** (change password, change email with re‑verify, **TOTP two‑factor** via Supabase MFA with QR enrol + recovery guidance, "Sign out of all devices") · **Preferences** (email notification toggles; critical emails — payment decision, delivery, expiry — cannot be disabled) · **Danger zone** (request account deletion → creates a ticket; blocked while active services exist).

---

## 7. Key components (build once, reuse)

### 7.1 `ServiceCard`
White 14px card. Row 1: `RDP`/`VPS` mono tag + flag + location, status badge right. Row 2: label (H3) and mono spec line `4 vCPU · 8 GB · 120 GB NVMe`. Row 3: IP in mono with `CopyButton`. Row 4: **ExpiryMeter** — flat 6px track `--line`, fill `--lav-500` (→ `--warn` ≤ 7 days, `--bad` expired), caption "Expires 12 Nov 2026 · 21 days left". Footer: `Open` secondary + `Renew` (primary when ≤ 7 days, secondary otherwise).

### 7.2 `StatusBadge`
6px‑radius rectangle, 12px Inter 500, 6px round dot. Mapping — Orders: `awaiting_payment` warn · `under_review` lavender · `approved`/`provisioning` lavender · `completed` ok · `rejected`/`cancelled` bad · `refunded` neutral. Services: `active` ok · `suspended` warn · `expired` bad · `terminated` neutral. Tickets: `open` lavender · `awaiting_customer` warn · `resolved` ok · `closed` neutral.

### 7.3 `Timeline`, `CopyButton` (check icon swap, `aria-live` "Copied"), `FileDropzone`, `ExpiryMeter`, `RevealField`, `PriceTag`, `EmptyState` (illustration key + title + body + action).

---

## 8. Data layer & behaviour (contracts from file 04)

- **Reads:** Server Components using the cookie‑bound Supabase client (RLS enforced). Never use the service‑role client in these pages except through the explicitly named server actions below.
- **Writes (Server Actions, Zod‑validated, return `ActionResult<T>`):** `placeOrder`, `cancelOrder`, `submitPayment`, `getPaymentUploadUrl`, `renewServiceOrder`, `renameService`, `revealCredentials`, `createTicket`, `replyToTicket`, `setTicketStatus`, `markNotificationsRead`, `updateProfile`, `requestAccountDeletion`.
- **Realtime:** subscribe (RLS‑filtered) to `orders`, `payments`, `services`, `notifications`, `ticket_messages` for the signed‑in user; update lists in place and toast key events.
- **Caching:** per‑user data is dynamic; use tags like `user:{id}:orders` and `updateTag`/`revalidateTag` after mutations.
- **Errors:** friendly inline messages; map known error codes (`OUT_OF_STOCK`, `PRICE_CHANGED`, `COUPON_INVALID`, `TOO_MANY_OPEN_ORDERS`, `RATE_LIMITED`); never leak SQL/internal messages.
- **Pagination:** server‑side, 10–20 per page, URL‑driven.

---

## 9. UX quality bar

- Skeletons (flat grey pulse, no shimmer gradient) for every async region; no layout shift.
- Every list has designed empty, no‑results and error states using file‑05 illustrations (`empty-services`, `empty-orders`, `empty-tickets`, `empty-notifications`, `empty-search`, `error-404`, `error-500`, `success-order-placed`).
- Destructive actions use a confirm `Dialog` with the object's name restated.
- Toasts (sonner) bottom‑right, rectangular, concise.
- Forms keep input on validation failure; focus moves to the first error; double‑submit prevented.
- Dates: `12 Nov 2026`, times in the user's locale; relative time with exact time in a tooltip. Money: `$12.00`.
- Fully keyboard operable; focus rings per file 01 §4.6; tables have proper headers/scopes; reveal/copy actions announce via `aria-live`.

---

## 10. Acceptance checklist

- [ ] A new user can register → verify → configure → place order → see payment page → upload proof → see "under review", end to end.
- [ ] Price, stock and coupon are recomputed server‑side; tampering with form values cannot change the price.
- [ ] Credentials are never in HTML/RSC payloads or emails; they appear only after `revealCredentials`, auto‑hide after 30 s, and each reveal is audit‑logged.
- [ ] RLS: a second test user cannot read the first user's orders, payments, proofs, services, tickets or notifications (covered by pgTAP tests in file 04).
- [ ] No OS picker anywhere; OS shown as "Windows Server".
- [ ] Bg `#F1F1F1` everywhere; gradients only in button classes; no icon sits inside a container; no capsule shapes.
- [ ] Playwright e2e: register/login, place order, upload proof, cancel order, open ticket, reveal credentials (seeded active service).
- [ ] Lighthouse a11y ≥ 95 on `/login`, `/dashboard`, `/order/new`.
