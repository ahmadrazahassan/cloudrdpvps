# Cloud RDP VPS

Storefront for selling **Windows RDP** and **Windows VPS** (30-day plans, USD pricing, manual payment, admin-allocated servers) in 75 countries (the launch set in `src/content/launch.json`; Pakistan is deliberately not one of them) — the owner switches countries on and off in Admin → Catalog → Countries.

## Status

| Phase | State |
|---|---|
| 1. Public site (`prompts/01`): homepage, `/rdp`, `/vps`, `/pricing`, `/locations` (+ one page per country), `/features`, `/faq`, `/about`, `/contact`, `/legal/*` | **Done** — plans, prices and stock are read live from Supabase |
| 2. Backend (`prompts/04`): schema, RLS, RPCs, jobs, storage | **Done and applied** to the Supabase project `cloudrdpvps` (migrations `0001`–`0013` + seed) |
| 3. Auth: sign in / register / forgot & reset password / email confirmation / **two-step verification (TOTP) for everyone** | **Done** (flat screens, server actions, rate limits, optional Turnstile; an account with an authenticator is asked for a code after the password, on every screen *and* every action) |
| 4. Checkout and customer dashboard (`prompts/02`): `/order/new` (with live coupon preview), overview, servers (credential reveal, `.rdp` download), orders, manual payment + proof upload, billing & invoices, tickets, notifications, settings; **⌘K command palette** | **Built** — verified with unit tests, rendered-page checks and browser tests; the signed-in flows against the live database haven't been exercised (see "Not yet exercised") |
| 5. Admin console (`prompts/03`) at `/admin` | **Built** — every module in the spec: overview, payment review, orders + deliver-server, services, customers, tickets, inbox, invoices, plans, pricing & stock grid, locations, payment methods, coupons, FAQs, announcement, team, audit log, settings, inventory (+ CSV import), reports (+ CSV export). Role split (support vs admin), staff MFA, audit trail on every change |
| 6. Transactional email (Resend) | **Built** — the database queues every notice; `/api/cron/maintenance` sends them (retries, never any password). Needs `RESEND_API_KEY` + `EMAIL_FROM` and a scheduler hitting that endpoint every 5–10 minutes. Staff are emailed about new payment proofs, tickets and contact messages |
| 7. Public site reads what admins edit | **Done** — support contacts, delivery ETA, announcement banner, maintenance banner and the FAQ come from the database (with built-in fallbacks), refreshed the moment an admin saves |

Every link in the header and footer now goes to a real page.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm test               # 270+ tests: database behaviour (PGlite) + app logic + every admin and portal screen rendered
npm run typecheck
npm run faqs:sync      # one-off: load the built-in FAQ answers into the database so admins can edit them
```

Without Supabase keys the homepage still renders from the bundled seed and the account screens say so. With keys it reads live data.

## Environment (`.env.local`, see `.env.example`)

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, auth email links | no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything backed by the database | the publishable key is fine; both are public |
| `SUPABASE_SERVICE_ROLE_KEY` | the **contact form** (it writes `contact_messages`, which has no public insert policy), `npm run make-admin`, the cron route, the email sender, delivering a server **from stock**, inviting staff by email, staff two-step status, audit-logging CSV exports | **secret** — bypasses row-level security; server only |
| `CREDENTIAL_KEYS` | encrypting server login details | `npm run key:gen`; **back it up** — without it stored passwords can't be recovered |
| `CRON_SECRET` | `/api/cron/maintenance` — the **email sender** and the housekeeping fallback | call it every 5–10 minutes (Vercel Cron, GitHub Actions, cron-job.org): `curl -X POST $SITE/api/cron/maintenance -H "Authorization: Bearer $CRON_SECRET"` |
| `UPSTASH_REDIS_REST_URL/TOKEN` | shared rate limits | falls back to in-memory — **per server instance, so set this before you run more than one** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | bot protection on auth forms | set both or neither; without them sign-up and sign-in have no captcha |
| `RESEND_API_KEY`, `EMAIL_FROM` | order/payment/ticket/staff emails | until set, emails stay queued (nothing is lost) |

## Supabase runbook

The project is already provisioned and migrated. For a **new** project: run `supabase/migrations/*.sql` in order, then `supabase/seed.sql` (it only inserts what is missing and never overwrites admin edits).

**Settings only the Supabase dashboard can change** (Authentication):

1. **URL Configuration** → Site URL = your site (`http://localhost:3000` for development). Add redirect URLs: `http://localhost:3000/auth/confirm` and the production equivalent.
2. **Email Templates** — use the `token_hash` form so links work on any device. Confirm signup:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`
   Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
3. **Sign In / Providers → Email**: keep "Confirm email" **on** (ordering requires a verified address) and set the minimum password length to **10** (the forms enforce it; this closes the direct-API route).
4. **SMTP**: the built-in sender is for testing only and is heavily rate-limited — configure your own SMTP before launch.
5. Optional: enable CAPTCHA protection with Turnstile, and leaked-password protection on plans that include it.
6. **Multi-factor**: make sure TOTP is enabled (Authentication → Multi-Factor). Staff must enrol an authenticator to open `/admin` (the `require_staff_mfa` setting, on by default); customers can opt in under Settings → Security. If a project has TOTP disabled, `/admin/mfa` explains it and the setting can be switched off in Admin → Settings.
7. **Realtime**: already enabled for the queue tables (migration `0010`) — the console counts update live.

**After first deploy:** run `npm run faqs:sync` once against production (or press "Import built-in answers" in Admin → FAQs), set the support contacts and delivery ETA in Admin → Settings, activate at least one payment method (Admin → Payment methods) and put real prices in the pricing grid.

**Create the first admin** — register normally on `/register`, confirm the email, then:

```bash
npm run make-admin -- you@example.com     # needs SUPABASE_SERVICE_ROLE_KEY; refuses once any admin exists
```

All later role changes are made by an admin inside the app and are audited.

**Housekeeping jobs** (cancel unpaid orders, expire services, expiry reminders) run in the database via `pg_cron` (already scheduled). `POST /api/cron/maintenance` with `Authorization: Bearer $CRON_SECRET` is the fallback.

**Types** are generated from the migrations: `npm run types:gen` after changing SQL (a test fails if the file is stale).

## Pages

| Area | Routes |
|---|---|
| Marketing | `/` · `/rdp` · `/vps` · `/pricing` · `/locations` · `/locations/[country]` (one per active location, built from the catalog) · `/features` · `/faq` (searchable) · `/about` · `/contact` · `/legal` and `/legal/{terms,privacy,acceptable-use,refund}` |
| Auth | `/login` · `/login/verify` (authenticator code) · `/register` · `/forgot-password` · `/reset-password` · `/verify-email` · `/auth/confirm` |
| Admin console | `/admin` (overview) · `/admin/payments` (split-view review, `A` approve · `R` reject · `Z` zoom) · `/admin/orders` and `/[id]` (Deliver-server panel) · `/admin/services` and `/[id]` · `/admin/customers` and `/[id]` · `/admin/tickets` and `/[id]` · `/admin/inbox` · `/admin/invoices` · `/admin/catalog/{plans,pricing,locations}` · `/admin/payment-methods` · `/admin/coupons` · `/admin/content/{faqs,announcement}` · `/admin/reports` · `/admin/team` · `/admin/audit-log` · `/admin/settings` · `/admin/inventory` · `/admin/mfa`. Keyboard: `⌘K` or `/` search & jump, `g` then a letter navigates, `j`/`k` move between rows |
| Checkout | `/order/new` — public; configure a plan signed out, sign in only to place the order (the selection survives sign-in/sign-up). `?renew=<server id>` renews an existing server |
| Customer dashboard | `/dashboard` · `/dashboard/services` and `/[id]` (Overview · Connection · Billing · Support) · `/dashboard/orders` and `/[id]` and `/[id]/pay` · `/dashboard/billing` and `/invoices/[id]` (printable) · `/dashboard/tickets` (+ `/new`, `/[id]`) · `/dashboard/notifications` · `/dashboard/settings` |

Prices are never read from the browser: the order form sends only *which plan, where, and a coupon code*, and the `create_order` database function looks up the price, checks stock, applies the coupon and snapshots the result on the order.

**Payment proof** is posted to a Server Action, which checks what the file really is (magic bytes — not its name or claimed type) and its size, fingerprints it, stores it in the customer's private folder, then calls `submit_payment`. **Server logins** are shown only through `get_service_credentials` (ownership + active checks, audit-logged), decrypted on the server, visible in the browser for 30 seconds. The `.rdp` download carries the address and username only, never the password.

### Not yet exercised

The signed-in flows — customer (place order → pay → upload proof → credentials) and admin (review proof → approve → deliver → extend/suspend → reply to a ticket) — have **not** been run end-to-end against the live Supabase project, because that needs real accounts there (and an admin account with an authenticator). What *is* covered: every database function they call (PGlite tests, now including coupon preview and staff alerts), unit tests for the pure logic, **render tests that draw every portal and every admin screen from fixture data** (admin and support roles — the tests assert support never sees revenue, credentials, approve/deliver controls or any admin-only page), a real-Chrome check of every one of those screens (layout at 1440 and 390 px, colours, fonts, axe WCAG 2.2 AA), and browser tests of checkout and auth while signed out.

**First real run-through** once the dashboard settings above are done: register → confirm email → `npm run make-admin -- you@example.com` → open `/admin` and enrol the authenticator → activate a payment method and set prices → in a second browser register a customer, place an order, upload proof → approve it in `/admin/payments` (you land on the Deliver-server panel) → deliver → the customer sees the login. Then try renew, suspend, a ticket with an internal note, and turning on two-step verification as the customer.

**Known gaps:** ticket attachments work on replies but not on a ticket's very first message; no Content-Security-Policy yet (the other security headers are set; a CSP needs per-request nonces for Next's inline scripts); payment-proof OCR / automatic verification, a customer wallet, and an API for resellers are not built (see the roadmap in the project notes).

## Legal pages

`/legal/*` ships with complete, plain-language default text written to match how the service actually works (manual payment, delivery after verification, 30-day terms, no auto-renewal, the grace period, the refund rules). It is **not legal advice**: have a lawyer review all four documents for the places you operate before launch. Governing law is deliberately worded generically ("the jurisdiction in which Cloud RDP VPS is established") — set the real one. The text lives in `src/content/legal.ts`; bump `legalUpdated` there when you change it.

## Security model in one paragraph

Row-level security is on for every table; clients can **read their own rows and call RPCs, nothing else**. Prices, coupons, stock and totals are computed inside the database; customers can't write orders, payments, services or roles. Server passwords are AES-256-GCM encrypted by the app before they reach the database and are never in logs, audit rows or emails. The audit log is append-only. Staff/admin checks happen inside every RPC (the proxy only checks "signed in"). Auth forms return uniform messages (no account enumeration), are rate-limited per IP and per email, and redirects only ever go to same-site paths.

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, Realtime) · `zod` · `nuqs` · `lucide-react` · Radix Dialog · Vitest + PGlite · Playwright.
Typography: **Inter Tight** (display, headings, prices) and **Inter** (everything else) — variable, self-hosted by `next/font`; nothing else, no serif, no monospace (a test enforces it).

## Design rules (enforced)

- Page background is exactly `#F1F1F1`; lavender is the only brand colour (tokens in `src/app/globals.css`).
- **Flat surfaces: no cards, no filled panels, no background-on-background anywhere** — structure comes from hairlines, whitespace and type. Form fields are transparent with a hairline outline.
- **Gradients exist only in `src/styles/buttons.css`** (the glossy buttons).
- Icons are bare (no container); no AI-cliché icons. Buttons are 10px-radius, never capsules; the header is a full-width hairline bar.
- Windows is the only OS — there is no OS picker.

## Where things live

```
src/app/(marketing)/        homepage + every public page, header/footer layout, 404, error boundary
src/app/(marketing)/order/  checkout (public) + its place-order Server Action
src/app/(auth)/             login, register, forgot/reset password, verify email + server actions
src/app/(portal)/           the signed-in customer dashboard (layout = sidebar + top bar) and its Server Actions
src/app/admin/              the admin console: (console)/ = every screen behind the shell, mfa/ = second-factor enrolment
src/app/auth/confirm/       landing route for links in Supabase emails
src/app/api/cron/           maintenance fallback endpoint
src/proxy.ts                session refresh + "signed in?" gate for /dashboard and /admin
src/content/                all copy: site, nav, pages, legal text, FAQs, catalog seed, image manifest
src/components/{marketing,checkout,portal,auth,ui,shared,brand,illustrations}/
src/lib/action.ts           the Server Action wrapper: auth level, rate limit, captcha, validation, error mapping
src/lib/portal/             read queries (run as the signed-in user, so RLS applies) + pure helpers (service state, order timeline, "needs attention")
src/lib/supabase/           server / browser / admin (service role) / public (cached catalog) clients
src/lib/security/           credential encryption, password generator, .rdp builder, upload sniffing
src/lib/auth/               session helpers (requireUser / requireStaff / requireAdmin), authenticator (AAL) checks, error mapping
src/lib/admin/              console queries, Server Actions (one file per area: payments, orders, services, catalog, content, system, inventory…), guards, CSV, report maths
src/lib/email/              email templates (pure), the Resend sender and the outbox drain
src/components/ledger/      the shared visual language: ruler meter, signal dots, numbered sections, command palette
src/components/admin/       console shell, data table, dialogs, editors, proof viewer, pricing grid…
src/types/database.ts       GENERATED from the migrations
src/test/                   fixtures + the render test that draws every portal screen
supabase/migrations/        the schema, RLS, RPCs, jobs, storage (applied)
supabase/tests/             database behaviour tests
scripts/qa/                 browser checks (fonts, auth, public pages, checkout, portal)
prompts/                    the 5 build specs
```

## Prices and content are placeholders

Seed prices are placeholders — edit them in Admin → Pricing & stock. Every payment method is seeded **inactive** with empty details; fill one in and switch it on in Admin → Payment methods. Support email / Telegram / WhatsApp / delivery ETA are `null` and render nothing until set in Admin → Settings.

## Replacing the illustrations with your ChatGPT images

Every image renders as a code-built SVG. To use a generated image instead, save it with the exact filename and folder from `prompts/05-image-generation-prompts.md` (e.g. `public/images/hero/hero-server-exploded.png`). `<SiteImage>` picks it up automatically. Generate on a **pure white** background; images are blended into `#F1F1F1` with `mix-blend-mode: multiply`.

## Quality gates

| Check | Result |
|---|---|
| Unit + database tests (`npm test`) | 268 passing: RLS, tenant isolation, money, coupons (+ preview parity with `create_order`), jobs, tickets, roles, staff alerts, storage; formatting, markdown, CSV, reports, email templates (no password can appear), settings/FAQ mapping, the authenticator gate on actions; and render tests of every portal screen and every admin screen (admin vs support) |
| Supabase security advisor | 0 errors; remaining warnings are the intentional customer/admin RPCs (each authorises inside the function) |
| Type-check / lint / production build | clean |
| axe-core WCAG 2.2 AA — every public page, the auth screens, every portal screen and every admin screen (desktop + phone) | 0 violations |
| Horizontal overflow at 390 / 820 / 1440 px | none |
| Gradient usage outside `buttons.css` | none |
| Typography | Inter Tight + Inter only (test + browser check) |

### Running the browser checks

They run against a production build:

```bash
npm run build && npx next start -p 3100
BASE=http://localhost:3100 npm run qa:pages      # every public page
BASE=http://localhost:3100 npm run qa:checkout   # checkout + contact form, signed out
BASE=http://localhost:3100 npm run qa:auth       # sign-in/up screens
BASE=http://localhost:3100 npm run qa:fonts      # only Inter Tight + Inter render

# Signed-in screens, without signing in: render them from fixtures, then check them
QA_OUT=./.qa/portal npx vitest run src/test/portal-render.test.tsx
SNAPS=./.qa/portal SHOTS=./.qa/shots BASE=http://localhost:3100 npm run qa:portal

# ...and the admin console
QA_OUT=./.qa/admin npx vitest run src/test/admin-render.test.tsx
SNAPS=./.qa/admin SHOTS=./.qa/shots-admin BASE=http://localhost:3100 npm run qa:admin
```
