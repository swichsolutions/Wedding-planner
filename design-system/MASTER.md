# WeddingPlanner — Design System v2 (MASTER) — "Program on Paper"

> **Source of truth for tokens:** `frontend/src/styles/_tokens.scss` (CSS custom properties)
> and `frontend/src/styles/_breakpoints.scss` (Sass breakpoints + `respond-to` mixin).
> This file is the *spec*; the SCSS files are the *implementation*. Build every surface from
> these tokens; no raw hex/px in components.
>
> v2 replaces the v1 "Editorial Georgian" (pink) system entirely. Pages that still use v1
> token names keep working through the **legacy alias block** at the bottom of
> `_tokens.scss`; each alias is removed when its last consumer is redesigned. See
> `REDESIGN-PLAN.md` for the page order.

---

## 1. Direction

The site reads like a well-set **wedding program booklet** printed on limestone paper:
numbered chapters (`01 / დაპირება`), hairlines, dotted leaders (`ცერემონია ........ 17:00`),
big condensed Georgian headlines, serif body text. The feeling the product promises is the
feeling of the design: **calm, organized, confident — you can do this yourself.**

Distinctiveness comes from *type treatment, numbered structure and one example wedding
told through the page*, not from color tricks.

### Avoid (anti-slop)
- ❌ Pink / garnet from v1, cream-and-script "AI wedding" look, pastel gradients.
- ❌ Uniform card grids with no focal hierarchy. Grids always have one 2× element.
- ❌ Emoji as icons. One inline-SVG set, 1.75px stroke.
- ❌ Invented testimonials, reviews, partner logos. Trust = practical answers.
- ❌ "Book now" wording — bookings are not confirmed on-platform (sitemap §07).

---

## 2. Typography (Georgian-capable — non-negotiable)

| Role | Face | Setting |
|---|---|---|
| Display / headings | **Noto Sans Georgian** | `font-stretch: 70%` (width axis), weight 700–800, tracking −0.015 … −0.025em, line-height 0.96–1.04 |
| Body | **Noto Serif Georgian** | 400, 17px, line-height 1.6, measure 62ch |
| UI (nav, buttons, labels, tables) | **Noto Sans Georgian** | `font-stretch: 100%`, 500/600, 15–16px |
| Program labels / eyebrows | Noto Sans Georgian | 13px, 600, tracking 0.12em, uppercase (renders Mtavruli in ka) |

Both faces are loaded as variable fonts in `index.html` (the width axis of Noto Sans
Georgian is what makes the display face condensed). Tokens: `--font-display`,
`--font-body`, `--font-ui`, `--stretch-display`, `--stretch-ui`.

Scale: `--fs-caption 13` · `--fs-small 15` · `--fs-ui 16` · `--fs-body 17` · `--fs-lead 20` ·
`--fs-h4 24` · `--fs-h3 28→40` · `--fs-h2 36→60` · `--fs-display 48→104` (fluid clamp).

Numbers in tables, prices and times use `.num` (tabular figures).

---

## 3. Color

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F1EDE4` | page canvas |
| `--paper-deep` | `#E7E1D4` | alternating section bands |
| `--paper-white` | `#FFFFFF` | cards, the organizer "sheet", tickets |
| `--paper-line` / `-strong` | `#D5CFC2` / `#BFB7A7` | hairlines, dotted leaders |
| `--ink` | `#15171A` | text, primary buttons, section rules |
| `--ink-700` | `#3E4247` | secondary text (AA on paper) |
| `--ink-500` | `#6B6F75` | muted — labels and large text only |
| `--spruce` | `#1F3D33` | dark bands: organizer chapter, footer |
| `--on-spruce` / `-muted` | `#F1EDE4` / 66% | text on spruce |
| `--clay` | `#C2451F` | **the one accent**: primary CTA, chapter rules, markers, "next payment" |
| `--clay-700` | `#9E3717` | hover / pressed |
| `--clay-300` | `#F0906A` | accent on spruce (text/marks; never fills) |
| `--clay-100` | `#F6DDD3` | tint (edited row highlight) |

Semantic: success `#2F6B4A`, warning `#9C6A12`, danger `#A8311F`, info `#2D5F7A`, each with
a `-100` tint. Functional color is never the only signal.

**Rules.** Clay is for the action and the thread of the example wedding — never for
decoration or backgrounds larger than a button. Spruce bands never follow each other; they
sit between paper sections. Contrast: ink on paper 15:1, ink-700 on paper 9:1, white on clay
5:1, paper on spruce 11:1.

---

## 4. Layout

- Mobile-first. Gutter `--gutter` = 16px on phones; container `--container-max` = 1248px.
- Breakpoints: `sm 600 · md 768 · lg 1024 · xl 1280 · xxl 1440`.
- Chapters: `padding-block` 80 → 96 → 128px (phone → md → lg); each begins with a hairline.
- Chapter header = `.chapter` label (clay rule + "0N / name") → `h2` question → serif lead,
  capped at 36rem. At md+ the `--row` variant puts the lead in a second column.
- Grids always carry one dominant element (hero 1.25fr/1fr, category tile 2×2, 5/7 splits).
- Dotted leaders (`.leaders`) for every label/value list: budget, ticket, program.
- Radius is small (2/4/8/14px): printed matter, not bubbles. Shadows only on the ticket and
  the organizer sheet (`--shadow-lg`); hairlines do the rest.

---

## 5. Components (landing)

| Component | Where | Notes |
|---|---|---|
| `.wordmark` | header, footer | display face, clay full stop; `brand.name` placeholder |
| Header `.hdr` | app shell | sticky, paper 92% + blur, hairline; 3 links + შესვლა + ink CTA; condenses on scroll; phone: full-height paper sheet with numbered links |
| Footer `.ftr` | app shell | spruce; brand + promise, five sitemap links, © + language |
| `.ticket` | hero | the example wedding's "first plan"; overlaps the hero photo |
| `.toc` | under hero | program index = in-page chapter nav; scrolls horizontally on phones |
| `.steps` / `.step` | 02 | big numerals, each with the example's answer in a clay-ruled box |
| `.cats` / `.cat` | 03 | photo tiles on spruce; venues tile 2×2 (md+) carries the chosen venue |
| `.sheet` | 04 | white organizer on spruce: names, countdown, progress; tasks · budget · vendors |
| `.program` | 05 | time ...... event rows; one row shows an edit (struck time, clay flag) |
| `.gets` / `.faq` | 06 | numbered "what you get" + native `<details>` FAQ |
| `.final` | 06 | rule-bound closing call |

Buttons: `.btn--clay` (primary, one per screen), `.btn--ink`, `.btn--outline-ink`,
`.btn--paper` / `.btn--outline-paper` (on spruce), `.btn--lg`. Min height 44px.

---

## 6. Motion

- One orchestrated moment: hero copy + visual stagger in on load (`hero-in`, 80ms steps).
- Chapters reveal on scroll via `appReveal` (`core/reveal.directive.ts`): SSR renders
  everything visible; the browser adds `data-reveal` after hydration and `is-in` on
  intersection. 700ms, `--ease-out`, translate 18px → 0.
- Micro: link underline scale-x 240ms, tile image scale 1.04 on hover, FAQ chevron rotate.
- `prefers-reduced-motion`: the directive never attaches; global reset kills transitions.

---

## 7. Accessibility checklist (landing verified 2026-10-07)

- `<html lang="ka">`, skip link, focusable `#main`, visible focus ring (`--ring`).
- All interactive targets ≥ 44px; menu toggle has `aria-controls` / `aria-expanded`;
  Escape closes the sheet; page scroll locks while it is open.
- Headings sequential (h1 → h2 per chapter → h3 inside); FAQ uses native disclosure.
- No horizontal overflow at 375 / 768 / 1280 (checked with Playwright).
- Text contrast: all body pairs ≥ 4.5:1 (see §3).
