# 05 · Image Generation Prompts (for ChatGPT) — Cloud RDP VPS

> **Purpose:** One complete, consistent image set for the whole website. You generate these in ChatGPT, then drop the files into `public/images/…`. Every image listed here is referenced by a **manifest key** used in files 01–03, so filenames matter.
> **Total:** 27 images to generate (+1 optional logo exploration sheet). *(`dot-mosaic` and `brand-mark-3d` were dropped — they only existed for filled panels, which the flat-surface rule removes. Ignore their entries below.)* Everything not listed here is built in code (see §8).

---

## 1. Analysis of your reference images → our visual language

| Ref | What it shows | What we borrow | What we deliberately change |
|---|---|---|---|
| **1** Design agency grid | Light grey page, huge light headline, 4 numbered columns split by hairlines, **bare black monoline illustrations**, tiny captions, `/WORK` tags | Numbered 4‑column feature grid, bare monoline illustrations with no container, mono micro‑labels | Add lavender as the single accent |
| **2** District 9 | **Technical exploded‑view device** in fine black line‑art with soft grey shading, mono spec tables, one solid colour panel, 16–20px framed windows | The exploded‑server hero, spec table panel, engineering‑manual feel | Solid colour panel is lavender, not blue |
| **3** Logistics hero | Centred serif headline, mono nav, black + outlined buttons, **horizontal scan‑line skyline** in periwinkle, **dot‑mosaic** background | Scan‑line skyline art for each country; dot‑mosaic texture | Skylines are our 5 locations, in lavender |
| **4** Voice agents | Serif headline on warm card, floating glass status card, **binary 0/1 texture**, grain | Floating status card, binary matrix motif (built in code) | **No gradients/blur** — the blurred green field is *not* reproduced |
| **5** Kresna footer | **Bento cards**, giant ghost wordmark, glossy 3D app icon, newsletter field | Bento footer, ghost wordmark, optional glossy 3D brand mark | Flat lavender card instead of a gradient card |

**Resulting art direction:** *Technical editorial.* Three image families, one consistent palette:

- **Family A — Technical line‑art** (product, features, process, empty/error states): black monoline, optional flat grey tone, **one** lavender accent part.
- **Family B — Lavender scan‑line** (locations, auth panel): the subject is built from horizontal lavender lines on white.
- **Family C — Dot mosaic** (CTA texture): a grid of round flat‑colour dots in lavender tints.
- **One brand exception:** a glossy 3D lavender mark for the footer (optional; skip if you want the site strictly flat).

### Palette to quote in every prompt
Ink `#121214` · Lavender `#9468E0` (accent) · Lavender tints `#EDE5FC #DCCDF8 #C6AEF3 #AE8CEC` · Lavender deep `#7C4FCF #6439AE` · Light grey tone `#E6E6EA` · **Background pure white `#FFFFFF`**.

### Why pure white backgrounds?
The site background is `#F1F1F1`. Images are generated on **pure white** and displayed with CSS `mix-blend-mode: multiply` — white × `#F1F1F1` = exactly `#F1F1F1`, so every image melts into the page with no visible box, and no transparency export is needed. (If you can get a clean transparent PNG from ChatGPT, that also works; the manifest has a `blend` field.)

---

## 2. How to run this in ChatGPT (workflow that keeps the set consistent)

1. Open a **new chat** per batch (A–F). Use a ChatGPT image‑capable model.
2. In the **first message** attach your 5 reference images and paste the matching **STYLE block** (§3) below them, with: *"These are style references for mood and line quality only. Do not copy their text, layout or colours other than what the STYLE block says. Reply 'ready'."*
3. Paste each image prompt **one at a time**. Ask for **one image per message**.
4. When one image comes out perfect, **re‑attach it** to later prompts in that chat: *"Match the line weight and style of the attached approved image."* This is the single best consistency trick.
5. Fixes (copy‑paste as needed):
   - *"Remove every gradient and shadow. Flat fills only. Keep the composition."*
   - *"Make the background pure white #FFFFFF, edge to edge."*
   - *"Remove all text and letters."*
   - *"Reduce to a single lavender accent part; everything else black line‑art or flat light grey."*
   - *"Match the stroke weight of the previous image."*
6. **Sizes:** ChatGPT supports three: **1024×1024** (1:1), **1536×1024** (3:2), **1024×1536** (2:3). Each prompt names which to use; the site crops with `object-fit` where needed.
7. Save as **PNG** with the exact filename given. The build converts to AVIF/WebP via `next/image`.

---

## 3. STYLE blocks (paste at the start of each batch)

### STYLE A — Technical line‑art
```text
STYLE A. Premium technical-editorial line illustration in the spirit of an engineering manual. Clean uniform monoline strokes in near-black ink (#121214), about 2px visual weight at 1024px, rounded line caps and joins, crisp and even. Optional single flat light-grey tone (#E6E6EA) only on shaded faces. EXACTLY ONE accent part per image filled with flat lavender (#9468E0) — nothing else coloured. Isometric (30°) or flat front view as specified. PURE WHITE background (#FFFFFF), edge to edge. Subject centred, occupying about 70% of the frame with generous margin. STRICT RULES: no gradients, no shadows, no glow, no 3D render, no photorealism, no textures, no text, letters or numbers, no logos or brand marks (never draw a Windows or Microsoft logo), no people or faces, no watermark, no border, no background shapes.
```

### STYLE B — Lavender scan‑line
```text
STYLE B. The subject is built entirely from thin horizontal scan lines, like a line-scan or halftone print: evenly spaced horizontal strokes (about 4px thick with about 5px gaps at 1536px width) in flat lavender (#9468E0) on a PURE WHITE background (#FFFFFF). Shapes are defined only by where lines start, stop and vary in length; small gaps and breaks give an architectural, slightly digital feel. The artwork rises from the bottom edge of the image (lines run flush to the bottom edge). No outlines, no fills, no gradients, no shadows, no other colours, no text, no sky details, no ground plane. Upper part of the image stays empty white.
```

### STYLE C — Dot mosaic
```text
STYLE C. A mosaic made of a perfect square grid of round dots (about 24px pitch at 1536px width). Every dot is a single flat colour chosen from this lavender palette only: #EDE5FC, #DCCDF8, #C6AEF3, #AE8CEC, #9468E0, #7C4FCF, #6439AE. No gradients inside dots, no outlines, no shadows, no blur, no text. Dots fill the entire image edge to edge with no background showing.
```

### STYLE D — Glossy brand object (optional exception)
```text
STYLE D. A single glossy 3D app-icon style object: a rounded-square (squircle) tile in rich lavender (#8D63DE to #6A3FBD) with a polished glass-like highlight on the top half, soft inner rim light and a subtle contact shadow beneath it. Clean studio look. PURE WHITE background (#FFFFFF). No text, no letters, no extra objects.
```

---

## 4. Image list

Each entry: **Key** (manifest) · **File** · **Size** · **Used in** · **Alt text** · **Prompt**. Paste the matching STYLE block first, then the prompt.

### Batch A — Hero & product (STYLE A)

**A1 · `hero-server-exploded`** — `public/images/hero/hero-server-exploded.png` — **1536×1024**
Used in: homepage hero panel (S1), `/features`, OG image source. Alt: "Exploded view of a rack server showing CPU, memory, storage and network card".
```text
Isometric exploded view of a 2U rack-mounted server. The top lid floats above the chassis. Revealed and floating at different heights with thin dotted vertical leader lines to their positions: two CPU sockets with heatsinks, two banks of four RAM modules, four front-loading NVMe drive bays, three cooling fans in a row, a rear power supply unit, and one network interface card with ports. Fine, precise technical line-art, light grey tone on the shaded faces. The CPU heatsinks are the single flat lavender accent. No labels or text. Leave clear empty margin all around so callout labels can be added later.
```

**A2 · `product-rdp`** — `public/images/products/product-rdp.png` — **1024×1024**
Used in: S2 product card, Products mega‑menu, `/rdp`. Alt: "Desktop monitor showing remote Windows desktop windows".
```text
Isometric desktop monitor on a slim stand with a keyboard and mouse in front. On the screen: three overlapping rectangular application windows with title bars and simple line content, and a taskbar along the bottom with a row of small square icons — generic, no logos, no Windows flag. A thin dotted arc with an arrowhead leaves the monitor toward the right edge, suggesting a remote connection. The title bar of the front window is the single flat lavender accent.
```

**A3 · `product-vps`** — `public/images/products/product-vps.png` — **1024×1024**
Used in: S2 product card, Products mega‑menu, `/vps`. Alt: "Stack of virtual server layers".
```text
Isometric stack of four thin server slabs floating above one another with equal gaps, joined by thin dotted vertical guide lines. Each slab shows a front panel with a row of small ports and tiny LED squares. The top slab is lifted slightly higher than the others. The LED strip on the second slab is the single flat lavender accent.
```

**A4 · `datacenter-aisle`** — `public/images/hero/datacenter-aisle.png` — **1536×1024**
Used in: S5 Infrastructure frame, `/features`. Alt: "Data centre aisle between two rows of server racks".
```text
One-point-perspective view down a data-centre aisle between two rows of tall server racks vanishing to the centre. Racks drawn as fine line-art with rows of small rectangular server units and tiny port details; cable trays run along the ceiling; a tiled floor grid in thin lines; one rack door is open. A single cable run along the ceiling is the flat lavender accent line. Calm, symmetrical, precise.
```

### Batch B — Feature illustrations (STYLE A, bare, no container)

**B1 · `feat-admin`** — `public/images/features/feat-admin.png` — **1024×1024** — Used in S6 column 001. Alt: "Terminal window with a key".
```text
A flat front-view terminal window with a title bar and three tiny circular window buttons, containing a command-prompt glyph (a chevron and an underscore) on its first line and two short placeholder lines below. A large key emerges from the right side of the window, its teeth pointing left. The key is the single flat lavender accent.
```

**B2 · `feat-nvme`** — `public/images/features/feat-nvme.png` — **1024×1024** — S6 column 002. Alt: "NVMe solid-state drive".
```text
A single M.2 NVMe solid-state drive shown in slight isometric view: long narrow circuit board, a controller chip and four memory chips on top, a notched connector edge with fine contact lines, a mounting notch at the far end. Three short horizontal motion lines to the left of the board suggest speed. The controller chip is the single flat lavender accent.
```

**B3 · `feat-locations`** — `public/images/features/feat-locations.png` — **1024×1024** — S6 column 003. Alt: "Globe with five location pins".
```text
A wireframe globe made of latitude and longitude lines with simplified continent outlines. Five simple teardrop location pins stand on the globe surface at different places, joined by thin curved arcs that rise off the surface. One pin is filled flat lavender (the single accent); the others are outline only.
```

**B4 · `feat-support`** — `public/images/features/feat-support.png` — **1024×1024** — S6 column 004. Alt: "Headset and chat bubble".
```text
A headset with a headband, one ear cup and a thin microphone boom, placed beside a rounded speech-bubble outline containing a small check mark. The speech bubble's check mark is the single flat lavender accent.
```

### Batch C — Process steps (STYLE A)

**C1 · `step-1`** — `public/images/process/step-1.png` — **1024×1024** — S7 step 1. Alt: "Choosing a plan from three cards".
```text
Three upright plan cards of equal size side by side, each with a header band and a few horizontal text-line placeholders. The middle card is raised higher than the others and its header band is flat lavender (the single accent). A simple cursor arrow points at the middle card.
```

**C2 · `step-2`** — `public/images/process/step-2.png` — **1024×1024** — S7 step 2. Alt: "Order checklist".
```text
A clipboard with a checklist of four rows (small square checkbox plus a line). The top two checkboxes are ticked. A small price tag hangs from a string at the clipboard's top-right corner. The tick marks are the single flat lavender accent.
```

**C3 · `step-3`** — `public/images/process/step-3.png` — **1024×1024** — S7 step 3. Alt: "Uploading a payment receipt".
```text
An upright smartphone showing a receipt on its screen (a few lines and a total bar). Above the phone an upward arrow leads toward a document tray. A banknote (rectangle with a centre circle and corner marks) rests at the phone's side. The upward arrow is the single flat lavender accent.
```

**C4 · `step-4`** — `public/images/process/step-4.png` — **1024×1024** — S7 step 4. Alt: "Delivered server with a key tag".
```text
A single tower-style server unit in isometric view with front vents, drive bays and a power button. A key hangs from the unit on a looped string with a small tag. A round check-mark badge sits at the top-right corner of the server. The check-mark badge is the single flat lavender accent.
```

### Batch D — Location skylines (STYLE B, lavender scan‑line)

All five: **1536×1024**, skyline occupying the lower ~60%, white sky above. Used in S3 location cards and `/locations/[slug]` heroes.

**D1 · `loc-pk`** — `public/images/locations/loc-pk.png` — Alt: "Faisal Mosque and Margalla hills, Pakistan".
```text
Islamabad: the Faisal Mosque with its tent-shaped main hall and four slender needle minarets, with the low ridgeline of the Margalla Hills behind it and a few modern mid-rise buildings at the left edge.
```
**D2 · `loc-in`** — `public/images/locations/loc-in.png` — Alt: "Gateway of India and Mumbai skyline, India".
```text
Mumbai: the Gateway of India arch with its central dome and four corner turrets in the centre-left, the domes of the Taj Mahal Palace hotel beside it, and a skyline of modern residential towers rising on the right.
```
**D3 · `loc-bd`** — `public/images/locations/loc-bd.png` — Alt: "National Parliament House and Dhaka skyline, Bangladesh".
```text
Dhaka: the Jatiya Sangsad Bhaban (National Parliament House), massive geometric concrete volumes with large circular and triangular openings, in the centre, flanked by a few modern towers of different heights.
```
**D4 · `loc-us`** — `public/images/locations/loc-us.png` — Alt: "Manhattan skyline, USA".
```text
New York: the Manhattan skyline with the Empire State Building's stepped tower and spire in the centre, One World Trade Center's tall spire to the left, and a dense cluster of varied skyscrapers with flat and stepped crowns.
```
**D5 · `loc-uk`** — `public/images/locations/loc-uk.png` — Alt: "Big Ben, London Eye and The Shard, UK".
```text
London: Big Ben's clock tower beside the Houses of Parliament on the left, the large circular London Eye wheel in the centre, and The Shard's tall pointed glass pinnacle on the right.
```

### Batch E — Textures & brand

**E1 · `dot-mosaic`** — `public/images/textures/dot-mosaic.png` — **1536×1024** — STYLE C — Used in: S11 closing CTA (10% opacity), auth/marketing accents. Alt: decorative (`alt=""`).
```text
An abstract landscape of soft rolling hills and a wide open sky simplified into the dot grid. Lighter lavender dots in the sky area, mid and deeper lavender dots forming the hills and valleys, with irregular, organic boundaries between colour zones so it reads as a pixelated landscape photograph. No visible shapes besides the colour fields.
```

**E2 · `auth-art`** — `public/images/auth/auth-art.png` — **1024×1536 (2:3 portrait)** — STYLE B — Used in: auth shell right panel. Alt: "Server rack illustration".
```text
A tall server rack seen straight-on, built from scan lines: the rack frame, eight stacked 1U server units each with a row of tiny drive-bay blocks and an LED dot cluster, and a cable bundle dropping to the bottom edge. The rack stands centred and rises from the bottom edge; the upper third stays empty white.
```

**E3 · `brand-mark-3d`** *(optional)* — `public/images/brand/brand-mark-3d.png` — **1024×1024** — STYLE D — Used in: footer easter egg. Alt: "Cloud RDP VPS app mark".
```text
On the lavender squircle tile, an embossed white glyph: a simple cloud outline whose lower edge is formed by two short horizontal server bars. The glyph is clean, geometric and centred, with a slight glass-like polish. No text.
```

**E4 · Logo exploration sheet** *(not shipped — pick a direction, then we rebuild it as SVG in code)* — **1536×1024**
```text
Brand-mark exploration sheet on a pure white background: a 3×2 grid of six minimalist logo marks for "Cloud RDP VPS", each in flat ink (#121214) with a single flat lavender (#9468E0) element. Ideas: (1) a cloud outline with two server bars inside, (2) a monogram of the letters C R V built from geometric strokes, (3) a rounded-square window with a cloud notch, (4) stacked horizontal bars forming a cloud silhouette, (5) a cloud whose bottom edge is a straight server line, (6) a minimal remote-desktop monitor with a cloud as the screen. Flat vector style, no gradients, no shadows, no text under the marks, equal spacing.
```

### Batch F — Empty, error & status states (STYLE A, **1024×1024**, files in `public/images/states/`)

**F1 · `empty-services`** — `empty-services.png` — Used in: dashboard overview/services empty. Alt: "Empty server rack".
```text
An open server rack frame in isometric view with several empty slots shown as dotted outlines, and one dotted-outline server unit hovering just above the rack as if waiting to be inserted. The hovering dotted unit's front edge is the single flat lavender accent.
```

**F2 · `empty-orders`** — `empty-orders.png` — Used in: orders empty. Alt: "Empty orders tray".
```text
An empty open document tray in isometric view with a single dotted-outline receipt floating above it. The receipt's top line is the single flat lavender accent.
```

**F3 · `empty-tickets`** — `empty-tickets.png` — Used in: support empty. Alt: "Empty inbox".
```text
An empty inbox tray in isometric view with one dotted-outline envelope floating above it. The envelope flap is the single flat lavender accent.
```

**F4 · `empty-notifications`** — `empty-notifications.png` — Used in: notifications empty. Alt: "Bell with check mark".
```text
A bell at rest, front view, with a small check mark beside it and a faint dotted ring around the bell. The check mark is the single flat lavender accent.
```

**F5 · `empty-search`** — `empty-search.png` — Used in: no results (all lists, user and admin). Alt: "Magnifier over an empty page".
```text
A magnifying glass held over a blank document sheet that has a dotted outline of missing text lines. The magnifier lens ring is the single flat lavender accent.
```

**F6 · `error-404`** — `error-404.png` — Used in: 404 page. Alt: "Unplugged network cable".
```text
A network cable with an RJ45 plug pulled away from a wall socket, the two ends separated by a gap and joined by a thin dotted line. The plug is the single flat lavender accent.
```

**F7 · `error-500`** — `error-500.png` — Used in: 500 / maintenance. Alt: "Server under maintenance".
```text
A server unit with its top panel open and a spanner leaning against it, with a small triangle outline beside it containing a short vertical line and a dot (a plain warning symbol, no letters). The spanner is the single flat lavender accent.
```

**F8 · `success-order-placed`** — `success-order-placed.png` — Used in: order placed / payment approved. Alt: "Server with check mark".
```text
A tower server unit in isometric view with a large round check-mark badge overlapping its top-right corner. The badge is the single flat lavender accent.
```

**F9 · `status-under-review`** — `status-under-review.png` — Used in: payment under review (customer payment page and order detail). Alt: "Document being reviewed".
```text
An hourglass standing beside a document sheet, with a magnifying glass resting over the first line of the document. The sand in the hourglass is the single flat lavender accent.
```

---

## 5. Manifest the site must use (`src/content/images.ts`)

Typed registry so no component hard‑codes a path. Fields: `key`, `src`, `width`, `height`, `alt`, `blend: 'multiply' | 'none'`, `family: 'A'|'B'|'C'|'D'`.

```ts
export const images = {
  'hero-server-exploded': { src: '/images/hero/hero-server-exploded.png', width: 1536, height: 1024, blend: 'multiply', alt: 'Exploded view of a rack server showing CPU, memory, storage and network card' },
  'datacenter-aisle':     { src: '/images/hero/datacenter-aisle.png',     width: 1536, height: 1024, blend: 'multiply', alt: 'Data centre aisle between two rows of server racks' },
  'product-rdp':          { src: '/images/products/product-rdp.png',      width: 1024, height: 1024, blend: 'multiply', alt: 'Desktop monitor showing remote Windows desktop windows' },
  'product-vps':          { src: '/images/products/product-vps.png',      width: 1024, height: 1024, blend: 'multiply', alt: 'Stack of virtual server layers' },
  // feat-admin, feat-nvme, feat-locations, feat-support, step-1…step-4, loc-pk|in|bd|us|uk,
  // auth-art (1024×1536), dot-mosaic (blend 'none', alt ''), brand-mark-3d (blend 'none'),
  // empty-services, empty-orders, empty-tickets, empty-notifications, empty-search,
  // error-404, error-500, success-order-placed, status-under-review
} as const
```
The generator must complete this map for **all 29 keys** using the filenames, sizes and alt texts above, and expose `<SiteImage name="…" priority? sizes? className? />` which wraps `next/image` and applies `mix-blend-mode: multiply` when `blend === 'multiply'`.

---

## 6. Usage map (where each asset appears)

| Surface | Assets |
|---|---|
| Header mega‑menu | `product-rdp`, `product-vps` (small thumbnails) |
| Homepage | S1 `hero-server-exploded` · S2 `product-rdp`, `product-vps` · S3 `loc-*` · S5 `datacenter-aisle` · S6 `feat-*` · S7 `step-1…4` · S11 `dot-mosaic` · Footer `brand-mark-3d` |
| `/rdp`, `/vps` | matching `product-*` + `hero-server-exploded` |
| `/locations`, `/locations/[slug]` | `loc-*` |
| Auth pages | `auth-art` |
| Checkout / payment | `status-under-review`, `success-order-placed`, `step-3` |
| User dashboard | `empty-services`, `empty-orders`, `empty-tickets`, `empty-notifications`, `empty-search`, `error-*` |
| Admin dashboard | `empty-*`, `empty-search`, `error-*` (reused) |
| 404 / 500 | `error-404`, `error-500` |

---

## 7. Quality gate (check every image before accepting it)

- [ ] Background is pure white and edge‑to‑edge; no off‑white, no vignette, no border.
- [ ] No gradients, shadows, glow or textures (Family D is the only exception).
- [ ] No text, letters, numbers, logos or Windows/Microsoft marks.
- [ ] Line weight matches the rest of the batch; strokes are even and crisp.
- [ ] Exactly one lavender accent part (Family A); lavender‑only lines (Family B); lavender‑only dots (Family C).
- [ ] Subject centred with generous margin (Family A); skyline anchored to the bottom edge (Family B).
- [ ] Landmarks recognisable (D1–D5): re‑prompt with *"make the {landmark} more recognisable and larger"* if not.
- [ ] Filename and size exactly as listed; file < 600 KB (compress PNG with Squoosh/TinyPNG if needed).

---

## 8. Built in code — do **not** generate

Logo SVG (wordmark + mark, from the E4 direction you choose) · favicon/app icons · Open Graph images (`opengraph-image.tsx`) · dotted world map (`dotted-map` package) · binary 0/1 matrix texture (SVG pattern) · fine grain overlay (SVG `feTurbulence`, flat) · country flags (`country-flag-icons`) · charts · skeleton loaders · QR codes (uploaded by admin) · payment‑method brand logos (**not used** — text names only).

---

## 9. Rights & safety notes

- Generated images are yours to use per your ChatGPT plan's terms; keep the prompts and chat links for provenance.
- Do not generate or use third‑party trademarks (Windows/Microsoft logos, payment brand marks). Prompts above already forbid them.
- Landmarks are public architecture; avoid adding flags, political symbols or text to the location images.
