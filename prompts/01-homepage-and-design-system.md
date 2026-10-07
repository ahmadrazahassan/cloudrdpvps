# 01 · Homepage, Public Site & Global Design System — Cloud RDP VPS

> **Role:** You are a senior full‑stack engineer and product designer with 10+ years shipping high‑end SaaS and hosting products. Build exactly what is specified here. Where this file is silent, choose the most conservative, production‑grade option and keep it consistent with the rest of the system. Never leave TODOs, lorem ipsum, fake testimonials or invented statistics.
>
> **This is file 1 of 5.** The set: `01` homepage + design system (this file) · `02` user dashboard · `03` admin dashboard · `04` backend (Supabase) · `05` image generation prompts. Files 02 and 03 reuse the design system defined here. File 04 defines the data every page reads.

---

## 0. Project brief

**Brand:** Cloud RDP VPS  **Domain:** `cloudrdpvps` (read the full URL from `NEXT_PUBLIC_SITE_URL`; never hard‑code a TLD)
**What it is:** A storefront + customer portal + admin console for selling **Windows RDP** and **Windows VPS** servers.

### Business rules (these drive the UI everywhere)

| Rule | Value |
|---|---|
| Products | `RDP` and `VPS` (two product lines, separate plan ladders) |
| Operating system | **Windows only.** One OS. Show it as a fixed, locked spec ("Windows Server") — never render an OS picker |
| Locations | **Pakistan, India, Bangladesh, USA, UK** (admin can add more later; nothing hard‑coded to five) |
| Currency | **USD only.** Format `$12.00`. Never show another currency as the price of record |
| Term | **Every plan is exactly 30 days.** No monthly/yearly toggle, no auto‑renew. Renewal = a new order the customer places before expiry |
| Payment | **Manual for now.** Customer places an order → pays outside the site (bank/wallet/crypto/UPI etc.) → uploads proof → admin verifies |
| Fulfilment | **Admin manually allocates** the server (IP, port, username, password) to the order. Customer then sees it in their dashboard |
| Accounts | Customers and staff share one auth system; role decides which area they can enter |

Do **not** imply instant provisioning anywhere in copy. Use "delivered after payment verification" language.

---

## 1. Non‑negotiable rules (read twice)

1. **Global page background is exactly `#F1F1F1`** on every page, including dashboards.
2. **Primary colour is lavender.** Scale defined in §4.1. Lavender is the only brand hue.
3. **No gradients anywhere except buttons.** That includes backgrounds, cards, text, borders, charts, hero sections, overlays, skeleton shimmer and image masks. Allowed: flat fills, hairlines, flat translucency, soft box‑shadows. Glossy buttons (§4.5) are the **only** place `linear-gradient` appears in the codebase.
4. **Icons have no background.** Never put an icon in a circle, square, tile or chip. Icons are bare strokes in `--ink`, `--muted` or lavender. (A hover/active highlight on the whole row or button is fine; the icon itself never sits in a container.)
5. **No "AI‑cliché" icons or motifs.** Banned: Sparkles, Sparkle, Stars, Zap/Bolt, Wand, Magic, Bot, Brain, Atom, Rocket, Orbit, Flame as decoration. Use only accurate, relatable icons: Server, HardDrive, Cpu, MemoryStick, Network, Globe, MapPin, ShieldCheck, Monitor, Terminal, KeyRound, Clock, CalendarClock, ReceiptText, Wallet, LifeBuoy, Gauge, Activity, Download, Upload, Copy, Check.
6. **Buttons and headers are neither sharp squares nor capsules.** Buttons use a **10px** radius. The header is a full‑width bar with a hairline bottom border — **not** a floating pill/capsule nav. No `rounded-full` on buttons, nav, inputs, tabs or badges. (Avatars and status dots may be round.)
7. **Primary buttons / CTAs are glossy, shiny and premium** (§4.5).
8. **Images/illustrations come from the asset set in file 05.** Use the manifest keys; never use stock photos or emoji as imagery.
9. **Honesty:** no fake reviews, user counts, uptime percentages or logos. If a claim isn't verifiable, keep it out or put it in `src/content/claims.ts` behind a `verified: false` flag that hides it.
10. **Accessibility is a requirement:** WCAG 2.2 AA, visible focus, full keyboard use, `prefers-reduced-motion` respected, semantic landmarks.
11. **Flat surfaces — no cards, no background behind a background (added after review).** Every page, in all three apps, is drawn directly on the `#F1F1F1` page. **Do not use cards, tiles, panels, filled containers, tinted callouts, textured or image backgrounds, or nested fills.** Structure comes from whitespace, type, **1px hairlines** and open columns separated by hairlines (reference 1). Allowed fills only on: buttons (the glossy system), form controls (transparent fill + 1px border), overlays that must hide what is underneath (dropdowns, sheets, dialogs — filled with the same `--bg`, hairline outline, no shadow), the sticky header (`--bg` at 85% + blur), tags/badges (transparent, 1px coloured outline) and skeletons. Lavender is an **accent** (text, rules, buttons, illustration parts) — never a filled block. Illustrations sit directly on the page, un-framed. Wherever the text below says "card", "panel", "white card", "bento card", "frame" or "filled/lavender block", render it as an **open, hairline-divided section** instead (use the `.ruled-wrap`/`.ruled` grid utility in `globals.css`).
---

## 2. Tech stack (use latest stable; verified on npm 2026‑10‑03)

Install with `@latest`, then **pin exact versions** in `package.json` after the first clean build. If a package's newest major breaks the toolchain (notably TypeScript 7 or TanStack Table v9 with other libs), fall back one major rather than fighting it, and note the choice in `README.md`.

| Concern | Choice |
|---|---|
| Framework | **Next.js 16.x** (App Router, Turbopack, React Compiler on if stable), **React 19.x** |
| Language | **TypeScript strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off) |
| Styling | **Tailwind CSS 4.x** (CSS‑first config via `@theme`) + CSS variables for tokens |
| Components | **shadcn/ui** (Radix primitives) restyled to this spec — do not ship default shadcn look |
| Fonts | `next/font/google`, variable, self-hosted: **Inter Tight** (display, headings, prices, wordmark) and **Inter** (body, UI, labels, data). **No other typeface** — no serif, no monospace. |
| Icons | **lucide-react** (stroke 1.5, sizes 16/18/20/24) — obey the banned list in §1 |
| Flags | `country-flag-icons` (SVG) |
| Motion | `motion` (formerly Framer Motion) — restrained, see §4.8 |
| Forms | `react-hook-form` + `zod` (+ `@hookform/resolvers`) |
| Data fetching | Server Components first; `@tanstack/react-query` only for client‑side interactive lists |
| Tables | `@tanstack/react-table` |
| Charts | `recharts` (flat fills, no gradients) |
| URL state | `nuqs` |
| Toasts | `sonner` |
| Command palette | `cmdk` |
| Backend | **Supabase** — see file 04 |
| Email | Resend + React Email — see file 04 |
| Tests | Vitest + Testing Library, Playwright |
| Lint/format | ESLint (flat config) + Prettier + `prettier-plugin-tailwindcss` |
| Deploy target | Vercel (Node runtime), env‑driven |

Next.js 16 note: request interception lives in **`proxy.ts`** (the successor to `middleware.ts`). Use caching primitives from the installed Next version's docs (`use cache` / `cacheTag`) for public plan data and invalidate from admin mutations.

---

## 3. App structure (whole project — files 02–04 fill in their parts)

```
src/
  app/
    (marketing)/            ← THIS FILE: public site
      page.tsx              /
      rdp/page.tsx          /rdp
      vps/page.tsx          /vps
      pricing/page.tsx      /pricing
      locations/page.tsx    /locations
      locations/[slug]/page.tsx
      features/page.tsx
      faq/page.tsx
      about/page.tsx
      contact/page.tsx
      legal/{terms,privacy,acceptable-use,refund}/page.tsx
      layout.tsx            header + footer
    (auth)/                 ← file 02
    (portal)/dashboard/     ← file 02
    (admin)/admin/          ← file 03
    api/                    ← file 04
    sitemap.ts  robots.ts  opengraph-image.tsx  not-found.tsx  error.tsx  global-error.tsx
  components/
    ui/                     shadcn primitives, restyled
    brand/                  Logo, Wordmark, GlossButton
    marketing/              sections used on public pages
    shared/                 PriceTag, SpecList, StatusBadge, EmptyState, CopyButton, CountryFlag
  content/                  site copy, nav, FAQ seed, claims.ts, images.ts (manifest from file 05)
  lib/                      utils, formatters (money, date), constants, supabase clients (file 04)
  styles/globals.css        tokens + button system
public/images/…             assets from file 05
```

---

## 4. Design system (authoritative for all three UI files)

**Art direction:** *Technical editorial.* Calm, precise, premium. Think engineering‑manual meets modern brand site. Large light serif headlines, hairline rules, monospaced micro‑labels, numbered sections (`001`, `002`…), generous white space, flat colour, monoline illustrations. Derived from the five reference images:

- Ref 1 — oversized light headline, 4‑column numbered grid with hairline dividers, bare monoline illustrations, tiny captions, `/SECTION` tags.
- Ref 2 — technical exploded‑view line art, mono spec tables, one solid colour panel (we use lavender), small mono labels, 16–20px framed windows.
- Ref 3 — centred serif headline, mono nav, solid black + outlined buttons, horizontal scan‑line skyline art (we use lavender).
- Ref 4 — serif headline on a warm card, floating "glass" status card, binary 0/1 texture.
- Ref 5 — bento‑card footer, giant ghost wordmark across the bottom, newsletter field.

### 4.1 Colour tokens (`globals.css` → `@theme`)

```css
:root {
  /* surfaces */
  --bg:        #F1F1F1;   /* GLOBAL BACKGROUND — mandatory */
  --surface:   #FFFFFF;
  --surface-2: #F7F7F8;   /* inset / hover on white */
  --line:      #E2E2E6;   /* hairline */
  --line-2:    #D2D2D8;   /* stronger hairline */

  /* text */
  --ink:       #121214;
  --ink-2:     #3F3F46;
  --muted:     #6E6E78;

  /* lavender (primary) */
  --lav-50:  #F6F2FE;
  --lav-100: #EDE5FC;
  --lav-200: #DCCDF8;
  --lav-300: #C6AEF3;
  --lav-400: #AE8CEC;
  --lav-500: #9468E0;     /* brand fill */
  --lav-600: #7C4FCF;     /* text/links on --bg (≥4.5:1) */
  --lav-700: #6439AE;
  --lav-800: #4C2B85;
  --lav-900: #331D5C;

  /* status (flat) */
  --ok:   #1E8E5A;  --ok-bg:   #E6F4EC;
  --warn: #A65F00;  --warn-bg: #FBF0DC;
  --bad:  #C23B3B;  --bad-bg:  #FBE7E7;
}
```
Rules: lavender **text** on `--bg` uses `--lav-600` or darker. `--lav-500` is for fills, large graphics and focus rings only. Dark mode is **out of scope**; do not add it.

### 4.2 Typography

Two families only: **Inter Tight** (`font-display`) and **Inter** (`font-sans`), both variable. Tracking follows size — the bigger the type, the tighter (Inter Tight already has tight built-in spacing, so do not over-tighten: −0.045em made letters collide in testing).

| Role | Font | Weight | Size / line-height | Tracking |
|---|---|---|---|---|
| Display / H1 (hero, closing CTA) | Inter Tight | 450 | `clamp(44px, 7vw, 92px)` / 1.0 | −0.03em |
| H2 (section titles) | Inter Tight | 480 | `clamp(34px, 4.4vw, 54px)` / 1.06 | −0.026em |
| H1 on sign-in / app pages | Inter Tight | 500 | 36–44px / 1.06 | −0.026em |
| H3 | Inter Tight | 600 | 20–28px | −0.018em |
| H4 / card titles | Inter Tight | 600 | 16–20px | −0.012em |
| Prices | Inter Tight, tabular figures | 500 (big) / 600 (small) | 40px / 20px | −0.03em / −0.018em |
| Body | Inter | 400 | 16/1.6, `--ink-2`; secondary `--muted` | −0.011em |
| UI (nav, buttons, fields) | Inter | 500–600 | 14–16px | −0.006…−0.009em |
| Label (eyebrows, table heads, tags) | Inter, uppercase | 500 | 11–12px | +0.05…0.06em, `--muted` |
| Data (IPs, ports, order numbers, table figures) | Inter, `tabular-nums` | 400–500 | 13–14px | 0…+0.01em |

Rules: headings use `text-wrap: balance`, running text `text-wrap: pretty`. Only the weights above are used. Numbers that align in columns always use tabular figures. **Anywhere this spec or files 02–05 says "mono", render it as Inter — an uppercase tracked label, or tabular figures for data. Anywhere it says "serif", use Inter Tight.** (Google's delivery of Inter keeps `tnum` but strips stylistic sets such as slashed zero — do not rely on those.)

### 4.3 Shape, spacing, elevation

- Radius: **buttons/inputs/selects 10px · cards 14px · large panels/hero frames 20px · badges 6px**.
- Spacing scale: 4‑pt base. Section padding: 120px desktop / 88px tablet / 64px mobile. Content container: `max-w-[1240px]`, gutters 32/24/16px.
- Borders: 1px `--line` hairlines are the primary structure device; shadows are secondary.
- Shadows (soft, neutral, no colour tint except on buttons): `--shadow-1: 0 1px 2px rgba(18,18,20,.06)`; `--shadow-2: 0 8px 24px -12px rgba(18,18,20,.18)`.
- Section eyebrow motif: `/LOCATIONS`, `/PRICING` as Inter uppercase labels, with a hairline running to the right edge.
- Numbered motif: `001 · 002 · 003 · 004` as Inter labels above feature columns, separated by 1px vertical hairlines.

### 4.4 Icons
`lucide-react`, `strokeWidth={1.5}`, no container, colour via `currentColor`. Sizes 16 (inline), 20 (nav/buttons), 24 (feature), 32 (empty state only). For larger illustrative moments use the **line‑art illustrations from file 05**, not enlarged icons.

### 4.5 Glossy button system (the signature element)

Four variants, all `height 44px` (sm 36, lg 52), `padding 0 20px`, `radius 10px`, Inter 600 14px.

**Primary (lavender gloss) — reference implementation, keep the look:**

```css
.btn-primary {
  position: relative; isolation: isolate; overflow: hidden;
  color: #fff; font-weight: 600; letter-spacing: -0.005em;
  border: 1px solid #5B30A8; border-radius: 10px;
  background: linear-gradient(180deg, #AA8CEF 0%, #8D63DE 46%, #7B4FD0 54%, #6A3FBD 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.55),     /* top rim light */
    inset 0 -1px 0 rgba(0,0,0,.18),          /* bottom rim shade */
    0 1px 2px rgba(60,28,120,.35),           /* contact shadow */
    0 10px 20px -8px rgba(100,57,174,.55);   /* coloured glow */
  text-shadow: 0 1px 0 rgba(40,15,90,.35);
  transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
}
.btn-primary::before {            /* gloss band across the top half */
  content: ""; position: absolute; inset: 1px 1px 52% 1px; z-index: -1;
  border-radius: 9px 9px 60% 60% / 9px 9px 8px 8px;
  background: linear-gradient(180deg, rgba(255,255,255,.40), rgba(255,255,255,.05));
  pointer-events: none;
}
.btn-primary::after {             /* sheen sweep on hover */
  content: ""; position: absolute; top: -25%; bottom: -25%; left: -60%; width: 38%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent);
  transform: skewX(-20deg); transition: transform .8s cubic-bezier(.2,.7,.2,1);
  pointer-events: none;
}
.btn-primary:hover { filter: brightness(1.05) saturate(1.05); transform: translateY(-1px); }
.btn-primary:hover::after { transform: skewX(-20deg) translateX(430%); }
.btn-primary:active { transform: translateY(0); filter: brightness(.96);
  box-shadow: inset 0 2px 5px rgba(40,15,90,.4), 0 1px 1px rgba(60,28,120,.3); }
.btn-primary:focus-visible { outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 0 0 3px rgba(148,104,224,.45); }
.btn-primary:disabled { filter: grayscale(.5) opacity(.6); transform: none; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { .btn-primary::after { display: none; } .btn-primary { transition: none; } }
```

**Secondary (white gloss):** `#fff → #F2F2F4` vertical gloss, 1px `--line-2` border, inner top highlight, ink text.
**Dark (ink gloss):** `#26262A → #0C0C0E`, inner top highlight, white text — used for header "Log in"/utility CTAs and on lavender panels.
**Ghost:** transparent, ink text, hover `rgba(18,18,20,.05)` background. **Destructive:** same gloss recipe in `--bad`.

Build one `<Button variant size loading asChild>` component. `loading` shows a 16px spinner and keeps width stable. Every primary action in all three apps uses it. **Gradients are allowed only inside these button classes.**

### 4.6 Form controls
Height 44px, radius 10px, 1px `--line-2` border, `--surface` fill, 14–15px text, label above (never placeholder‑only), helper/error text below in 13px, error = `--bad` border + message with `aria-describedby`. Focus ring: `0 0 0 3px rgba(148,104,224,.35)` + border `--lav-500`. Select/combobox/date use Radix + cmdk styled identically.

### 4.7 Shared components to build once
`Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Tabs` (underline style, **not** pill), `Segmented` (rectangular, 10px), `Dialog`, `Sheet`, `Popover`, `Tooltip`, `Toast`, `Accordion`, `Badge`/`StatusBadge` (6px‑radius rectangle + 6px round dot), `Card`, `DataTable`, `EmptyState` (illustration + title + body + action), `PriceTag`, `SpecList` (mono key/value rows), `CopyButton`, `CountryFlag`, `Breadcrumbs`, `Pagination`, `Skeleton` (flat grey pulse — **no shimmer gradient**), `Logo`.

### 4.8 Motion
Subtle only. Reveal‑on‑scroll (opacity 0→1, translateY 12→0, 450ms, ease‑out, once). Tab underline slides via `layoutId`. Numbers count up once. Hover: 150ms. No parallax, no marquee, no auto‑playing carousels, no cursor effects. Honour `prefers-reduced-motion` by disabling all non‑essential motion.

### 4.9 Imagery treatment
Assets from file 05 are generated on **pure white** and placed with `mix-blend-mode: multiply` so they melt into `#F1F1F1` (white × `#F1F1F1` = `#F1F1F1`). Never place them on dark surfaces. Wrap in `next/image` with explicit `width/height`, `sizes`, alt text from the manifest, `priority` only for the hero.

---

## 5. Global layout

### 5.1 Header (full‑width bar — not a capsule)
- Height 72px, sticky, background `--bg` at 85% + `backdrop-filter: blur(12px)`, **1px `--line` bottom border**, no radius, no floating margins.
- Left: logo (mark + wordmark "Cloud RDP VPS"). Centre: nav in Inter 14px medium, sentence case — `Products ▾` · `Locations` · `Pricing` · `Features` · `Support` · `FAQ`. Right: `Log in` (ghost) + `Get started` (primary gloss, size md).
- `Products` opens a rectangular mega‑menu (20px radius panel, white, hairline border): two columns — **Windows RDP** and **Windows VPS**, each with a line‑art thumbnail from file 05, a one‑line description, and "From $X / 30 days" read live from the DB.
- Mobile: hamburger (bare icon) → full‑height sheet with accordion nav; CTAs pinned at bottom. Logged‑in users see "Dashboard" instead of Log in/Get started (staff also see "Admin").
- Optional slim top strip (32px, Inter 11px uppercase) for the announcement banner controlled from admin (`site_settings.announcement`); hidden when empty.

### 5.2 Footer (bento, from Ref 5)
Two rounded (20px) cards side by side on `--bg`, then a giant ghost wordmark.
- **Left card (flat `--lav-600`, white text):** logo, tagline "Windows RDP & VPS, delivered by people." , social icons (bare, white), small "Need help? Open a ticket" link. Subtle fine‑grain noise via a flat PNG overlay at 6% (no gradient).
- **Right card (`--surface`):** four link columns with uppercase label headings — Products, Locations, Company, Legal; newsletter field (`Enter email address` + dark gloss `Subscribe`); copyright line `© 2026 Cloud RDP VPS. All rights reserved.`; payment/support notes.
- **Ghost wordmark:** "Cloud RDP VPS" in Inter Tight 700, ~22vw, colour `#E6E6E8`, clipped by the viewport bottom, `aria-hidden`.
- Optional brand easter egg: the glossy 3D mark (file 05, asset `brand-mark-3d`) overlapping the card's top‑right corner, rotated 8°, with a tiny hand‑lettered "Need a server?" caption using `Caveat` — skip the caption if it feels off‑brand.

---

## 6. Homepage `/` — sections in order

Every section: uppercase label eyebrow `/LABEL`, Inter Tight H2, short muted paragraph, hairline dividers, `Reveal` on scroll. Copy below is the real copy — use it.

### S1 · Hero
- Eyebrow: `WINDOWS RDP & VPS · 5 LOCATIONS`
- H1 (Inter Tight, centred, 2 lines on desktop): **"Windows RDP and VPS, ready when you are."**
- Sub (max 60ch): "Dedicated Windows servers in Pakistan, India, Bangladesh, the USA and the UK. Simple 30‑day plans, flat dollar pricing, and every server set up by our team."
- CTAs: `View plans` (primary lg) · `Compare locations` (secondary lg).
- Below: a **framed hero panel** (20px radius, white, hairline, max 1100px wide) with the **exploded server illustration** (`hero-server-exploded`) centred and mono callout labels positioned around it — `CPU`, `RAM`, `NVMe`, `NIC` — each a 1px hairline leader line + label (pure CSS/SVG, no gradients).
- A floating **status card** (white, 14px radius, hairline, `--shadow-2`) overlapping the panel's lower‑right: Server icon + `WIN‑SRV‑0142` + a 6px green dot + "Online" + mono "Expires in 27 days". Purely illustrative; mark `aria-hidden`.
- Spec strip under the panel, four mono items separated by hairlines: `WINDOWS ONLY` · `30‑DAY PLANS` · `PRICED IN USD` · `FULL ADMIN ACCESS`.

### S2 · Choose your product (RDP vs VPS)
Two large cards (20px radius, white) side by side, each with its line illustration (`product-rdp`, `product-vps`), H3, 3 bullet specs, "From $X / 30 days" (live), and primary/secondary buttons.
- **Windows RDP** — "A ready‑to‑use Windows desktop you connect to from anywhere. Ideal for trading platforms, remote work and everyday Windows apps."
- **Windows VPS** — "A Windows server with dedicated resources and full administrator access for hosting, automation and heavier workloads."

### S3 · Locations
Eyebrow `/LOCATIONS`. H2 "Servers where you need them." A 5‑column row (stacks to 2→1) of **location cards**: scan‑line skyline image (`loc-pk`, `loc-in`, `loc-bd`, `loc-us`, `loc-uk`) with 3:2 crop, flag + country name, and `RDP from $X · VPS from $Y` (live minimum price per country). Out‑of‑stock locations show a mono `OUT OF STOCK` badge and a disabled action. Whole card links to `/locations/[slug]`.

### S4 · Pricing (live from DB)
Eyebrow `/PRICING`. H2 "Straightforward 30‑day pricing."
- Controls: **Tabs** `Windows RDP | Windows VPS` (underline tabs) and a **Segmented country selector** with flags (rectangular, 10px). State in URL via `nuqs` (`?product=rdp&country=pk`).
- Plan grid: 4 cards per product (white, 14px radius, hairline). Each: plan name, `PriceTag` (`$12` big mono‑numeral + `/ 30 days`), `SpecList` (vCPU, RAM, NVMe storage, bandwidth, port speed, OS = "Windows Server", location), stock badge, and primary `Order now` → `/order/new?plan=…&country=…` (file 02). Highlight one plan as "Most chosen" using a flat lavender 1px border + mono tag — only if admin flags it (`plans.is_featured`); never invent popularity.
- Below: "Compare all plans" expandable table (mono numerics, hairlines).
- Footnote: "All plans run for 30 days. Renew any time before expiry."

### S5 · Infrastructure spec panel (from Ref 2)
Left column: eyebrow `/INFRASTRUCTURE`, H2 "Built on dependable hardware.", short paragraph, and a 2×2 mono stat grid of **facts that are config‑driven** (`content/claims.ts`; only show `verified: true`).
Right column: `datacenter-aisle` line illustration in a white 20px frame.
Bottom: a **flat `--lav-600` panel** (20px radius) spanning full width with a mono spec table in white text: rows for `CORE SYSTEMS`, `STORAGE`, `NETWORK`, `ACCESS` with `Details` links. Mirrors Ref 2's blue panel.

### S6 · Features (4‑column numbered grid, from Ref 1)
Eyebrow `/FEATURES`. Four columns separated by 1px vertical hairlines, each: mono `001…004`, bare monoline illustration (`feat-admin`, `feat-nvme`, `feat-locations`, `feat-support`), H3, 2‑line description.
1. **Full administrator access** — "Log in with the credentials we deliver and manage your Windows environment yourself."
2. **NVMe‑backed storage** — "Fast disks across every plan for responsive desktops and applications."
3. **Five locations** — "Pick the country closest to your workflow and keep latency low."
4. **Hands‑on delivery** — "Every order is verified and set up by our team, with support one ticket away."

### S7 · How it works (4 steps)
Eyebrow `/PROCESS`. Horizontal 4‑step row with illustrations (`step-1…step-4`) and mono step numbers, connected by a 1px dashed hairline:
1. **Choose** a plan and location. 2. **Order** and get payment instructions. 3. **Pay & upload proof** with your preferred method. 4. **We deliver** — credentials appear in your dashboard after verification.
Below: a quiet line — "Typical delivery time" is **admin‑set** (`site_settings.delivery_eta`); render nothing if empty.

### S8 · Payment methods
Eyebrow `/PAYMENTS`. H2 "Pay the way that works for you." Group by region from the DB (`payment_methods`): Pakistan · India · Bangladesh · International. Show **text names + generic bare icons** (Landmark for bank transfer, Smartphone for mobile wallets, Bitcoin‑free generic Coins for crypto) — **no third‑party brand logos**. Note: "Manual payments are verified by our team before your server is delivered."

### S9 · Use cases
Four compact rows (hairline list, not cards): **Trading platforms**, **Remote work**, **Development & testing**, **Business applications** — each one sentence, bare icon (Monitor, Laptop, Terminal, Briefcase). Keep copy neutral; do not market scraping, spam, or anything the AUP prohibits.

### S10 · FAQ
Two‑column: left sticky H2 + "Still stuck? Open a ticket", right Radix Accordion with rectangular rows and hairlines. Source: `faqs` table (file 04); seed answers cover: delivery time, renewals, payment methods, refunds, supported OS, changing location, abuse policy, access method (RDP client on Windows/macOS/Android/iOS).

### S11 · Closing CTA
Full‑width **flat `--lav-600` panel** (20px radius) with `dot-mosaic` texture at 10% opacity (image, not gradient). Serif H2 in white "Choose a plan and get online today." + **white secondary‑gloss** button `View plans` and a ghost white `Contact us`.

---

## 7. Other public pages

| Route | Content |
|---|---|
| `/rdp`, `/vps` | Product landing: hero with product illustration, who it's for, full plan grid with country selector, spec comparison, FAQ subset, CTA. Unique copy per product (SEO). |
| `/pricing` | Full pricing explorer: product tabs + country segmented control + comparison table + FAQ. |
| `/locations` | All locations grid + a dotted world map (**build in code with the `dotted-map` package**, grey dots, 5 lavender highlight dots, no gradient). |
| `/locations/[slug]` | Per‑country page: skyline hero, plans for that country, "Windows RDP in {Country}" / "Windows VPS in {Country}" SEO copy, FAQ, CTA. Statically generated from DB with `generateStaticParams`. |
| `/features` | Longer version of S6/S5 with a mono spec table and the "how access works" explainer (RDP client per OS). |
| `/faq` | Full searchable FAQ (client filter) grouped by category. |
| `/about` | Short company story (editable content, no fabricated history), values, contact. |
| `/contact` | Form (name, email, topic select, message) → `contact_messages` (file 04) with Turnstile + rate limit; success state with `success-order-placed`‑style illustration reuse is optional. Also shows support email / WhatsApp / Telegram from `site_settings`. |
| `/legal/*` | Terms, Privacy, **Acceptable Use** (prohibits spam, DDoS, fraud, malware, scraping abuse; states suspension without refund), Refund policy. Provide full, sensible default text and a visible "Last updated" date. Flag in README that the owner must have these reviewed legally. |
| `not-found.tsx` / `error.tsx` | Use `error-404` / `error-500` illustrations, mono code, primary button home. |

---

## 8. SEO, performance, content

- **Metadata API** on every route; unique title/description; canonical URLs; `opengraph-image.tsx` (generated in code: serif title on `#F1F1F1` with a lavender mono tag — no gradients); `sitemap.ts` including all location pages; `robots.ts`; `manifest.webmanifest`; favicon set from the SVG logo.
- **JSON‑LD:** `Organization`, `WebSite`, `FAQPage` on FAQ, `Product` + `Offer` (priceCurrency `USD`, 30‑day term in description) on plan grids.
- **Performance budgets:** LCP < 2.0s on 4G mobile; JS for the homepage < 170KB gzipped; images via `next/image` (AVIF/WebP), lazy except the hero; fonts `display: swap` with size‑adjust; no layout shift (reserve image space).
- **Caching:** public plan/location/FAQ reads are cached with tags and revalidated from admin mutations (file 03/04).
- **Content config:** all marketing copy lives in `src/content/*.ts` (typed) so it is editable without touching components.
- **Responsive:** design at 1440; verify 1280, 1024, 768, 390. Grids collapse 4→2→1; header → sheet; tables → stacked cards.

---

## 9. Acceptance checklist (the build is not done until all pass)

- [ ] Every page background computes to `rgb(241,241,241)`.
- [ ] `grep -R "gradient" src` returns matches **only** inside the button style file.
- [ ] No icon is rendered inside a container with a background/border; no banned icon imported.
- [ ] No `rounded-full` on any button, tab, nav item, input or badge; header is a full‑width hairline bar.
- [ ] Primary buttons show gloss, rim light, sheen sweep on hover, pressed state, focus ring, loading and disabled states.
- [ ] Pricing, minimum prices and stock are read from Supabase (with a typed static fallback seed for local dev only).
- [ ] No OS selector anywhere; OS appears as fixed "Windows Server".
- [ ] No unverifiable claims/testimonials/numbers rendered.
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95, Best Practices ≥ 95 on `/`.
- [ ] Keyboard: full header, mega‑menu, tabs, accordion and forms operable; focus always visible.
- [ ] `tsc --noEmit`, ESLint and Playwright smoke test (home → pricing → order CTA) pass.
