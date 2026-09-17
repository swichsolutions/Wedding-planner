# WeddingPlanner — Design System (MASTER)

> **Source of truth for tokens:** `frontend/src/styles/_tokens.scss` (CSS custom properties)
> and `frontend/src/styles/_breakpoints.scss` (Sass breakpoints + `respond-to` mixin).
> This file is the *spec*; the SCSS files are the *implementation*. Build every surface
> with **frontend-design**, consuming these tokens. Do not introduce raw hex/px in
> components, and do not re-run a design-system generator (CLAUDE.md design rules).

---

## 1. Direction — "Editorial Georgian"

Clean, editorial, photo-forward. A warm paper canvas with near-black ink and **one
confident accent — garnet/wine** (a nod to Georgia's wine heritage), supported by a
restrained brass and a calm sage. UI chrome stays quiet so **vendor portfolios are the
hero**. Distinctiveness comes from *type treatment, asymmetry, and generous whitespace* —
not from color tricks.

**Mobile-first** (couples browse on phones). Vendor portfolio surfaces get the most design
investment.

### Explicitly avoid (anti-slop)
- ❌ Inter + purple/violet gradient + evenly-spaced minimal card grid (the generic AI look).
- ❌ Decorative-only gradients, glows, or drop shadows that fight the photography.
- ❌ Symmetric, monotonous grids with no focal hierarchy. Use editorial asymmetry, varied
  card sizes, and intentional emphasis.
- ❌ Emoji as icons. Use a single SVG icon set (e.g. Lucide), consistent stroke ~1.75px.

---

## 2. Typography (Georgian-capable — non-negotiable)

The product is **Georgian-primary**, so type *must* render Mkhedruli well.

| Role | Font | Notes |
|------|------|-------|
| Display / headings | **Noto Serif Georgian** | Editorial serif, full Mkhedruli + Latin coverage. Used large with tight tracking. |
| Body / UI | **Noto Sans Georgian** | Clean, legible Georgian + Latin sans. |

Both families cover **Georgian + Latin**, so bilingual `ka`/`en` strings stay visually
coherent (no jarring font swap when toggling language). Loaded via Google Fonts in
`index.html` with `display=swap` + preconnect. Fallbacks: Noto Serif/Sans → Georgia/system.

> **Future local character:** the BPG family (classic Georgian faces) could be self-hosted
> later for stronger local flavor; kept off the MVP for licensing/perf simplicity.

**Scale** (tokens): `--fs-caption 14` · `--fs-body 16` (min body — avoids iOS zoom) ·
`--fs-lead 18` · `--fs-h5 20` · `--fs-h4 24` · `--fs-h3 28→36` · `--fs-h2 36→48` ·
`--fs-display 44→64` (fluid `clamp`, mobile-first).

**Rules:** body line-height 1.6; headings 1.18; display 1.05. Weights — body 400, labels
500, headings 600, emphasis 700. Reading measure capped at `--measure` (65ch). Use the
`.overline` helper for small uppercase editorial eyebrows.

---

## 3. Color

Semantic aliases are what components use; raw ramps exist for one-off needs.

| Token | Value | Use |
|-------|-------|-----|
| `--color-canvas` | `#fbf7f1` | Page background (warm ivory) |
| `--color-surface` | `#ffffff` | Cards / raised content (crisp backing for photos) |
| `--color-surface-sunken` | `#f4ede3` | Section bands |
| `--color-text` | `#1c1714` | Primary text |
| `--color-text-secondary` | `#4d433b` | Secondary text (AA) |
| `--color-text-muted` | `#8a7e72` | Large/secondary only (below 4.5:1 for body) |
| `--color-action` | `#8c2f40` (brand-600) | Primary CTA — white text ≈ 7:1+ (AA) |
| `--color-action-hover` | `#6f2433` (brand-700) | Hover / pressed |
| `--color-gold-500` | `#b89154` | Fine accents, marks, dividers — **not body text** |
| `--color-sage-600` | `#5e6b53` | Calm tags / category chips |

**Semantic:** success `#3c7a55`, warning `#b5821f`, danger `#b83a2b` (distinct from
garnet — always pair with an icon, never color alone), info `#356c8c`. Each has a `-100`
tint for backgrounds.

**Accessibility:** body/background pairs meet WCAG AA (4.5:1); large text/icons ≥3:1.
`--color-text-muted` is for large or secondary text only. Functional color is never the
sole signal (add icon/text). Dark theme scaffolded (`html[data-theme="dark"]`) but the
product ships **light-first**; verify dark contrast before enabling.

---

## 4. Space, radius, elevation, motion

- **Spacing:** 4px base scale (`--space-1`…`--space-24`). Section rhythm tiers: 32 / 48 / 64 / 96.
- **Radius:** crisp/editorial — buttons & images `--radius-md (8)`, cards `--radius-lg (12)`,
  feature panels `--radius-xl (20)`, chips `--radius-pill`.
- **Elevation:** soft, warm-tinted (`--shadow-xs…lg`). Rest cards on `xs/sm`; lift to `md`
  on hover; reserve `lg` for overlays. Shadows must never overpower photography.
- **Motion:** 150–300ms; `--ease-out` for enter. Subtle press scale (0.98–1.0). Honor
  `prefers-reduced-motion` (handled globally in `_base.scss`).
- **Focus:** `--ring` (double ring) is applied globally via `:focus-visible` — keep it.

---

## 5. Layout & responsive

- Breakpoints (Sass `respond-to`): `sm 600` · `md 768` · `lg 1024` · `xl 1280` · `xxl 1440`.
- Content max `--container-max` (1200px); full-bleed galleries `--container-wide` (1440px).
- Mobile-first; no horizontal scroll; touch targets ≥44×44px with ≥8px spacing.
- Use `min-height: 100dvh` (not 100vh) on full-height regions.

---

## 6. Component guidance (key surfaces)

### Vendor card (the workhorse — invest here)
- Photo-dominant: large 4:5 or 3:4 portrait image on top, `--radius-lg`, `object-fit: cover`,
  declared aspect-ratio (no CLS), `loading="lazy"` below the fold, descriptive `alt`.
- Below image: vendor name (`--fs-h5`, display serif), category·city (muted caption),
  starting price (tabular figures). Optional 1–2 sage style-tag chips.
- Card rests on `--shadow-sm`; hover lifts to `--shadow-md` + subtle image scale (≤1.03,
  clipped). Whole card is one link; secondary "save" heart is a separate 44px target.
- Browse grid: editorial, **not** a rigid uniform grid — vary with occasional featured
  (wider) cards; generous gutters (`--space-6`+).

### Vendor profile (the showcase)
- Hero: full-bleed gallery / portfolio carousel (real-wedding shots prioritized). Asymmetric
  intro: name + garnet eyebrow category, bio in reading measure, key facts (price range,
  areas served) in a side rail.
- Sticky contact affordance (phone / Instagram / message form) — single primary CTA in
  garnet; secondary actions subordinate. Contact clicks feed `VendorStat` (silent).
- Schema.org `LocalBusiness`/`Service` + semantic headings for SEO. Galleries lazy-loaded.

### Category browse (e.g. /fotografi/tbilisi)
- Editorial header: H1 = category × city, a genuinely distinct intro paragraph (no
  templated city-swap), then filters (category, city, price, style) and the vendor grid.
- Filters: chips/selects with clear active state; results count in tabular figures.

### Budget planner (SEO hook, standalone)
- Input: total budget → allocation across categories (Georgian wedding norms). Output as a
  clear breakdown (bar/segmented list), tabular currency, editable per-line.
- Works before the directory is full. Empty/initial state guides the first action.

### Buttons / forms / chips
- Primary button: `--color-action` bg, white text, `--radius-md`, press feedback, disabled
  at reduced opacity. One primary CTA per view; secondary = outline/ghost in ink.
- Inputs: visible labels (never placeholder-only), helper text below, error below field with
  icon + recovery, validate on blur, ≥44px height, semantic input types for mobile keyboards.
- Chips: `--radius-pill`, sage for styles / neutral for filters; clear selected state.

---

## 7. How to use this system

When building a surface with **frontend-design**:
1. Read this MASTER.md and `frontend/src/styles/_tokens.scss`.
2. If `design-system/pages/<page>.md` exists, its rules override this file for that page.
3. Consume tokens via `var(--…)`; use `@use 'styles/breakpoints' as bp;` for media queries.
4. After building, run the **review** pass separately (`web-design-guidelines` + `impeccable`).
   Do not run reviewers while building, and never invoke two builders together.
