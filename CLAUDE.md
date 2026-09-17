# CLAUDE.md — Georgian Wedding Platform ("Georgian Knot")

> Project handover / working brief. Read this first in any Claude Code session.
> Owner: Beka (Swich Solutions, Tbilisi). Stack: Angular + .NET 8 + PostgreSQL.

---

## 1. What we're building (one paragraph)

A Georgian-language wedding-planning destination for couples in Georgia (Tbilisi first),
modelled on **The Knot / Zola / WeddingWire** mostly Knot. Couples come to discover, compare, and
shortlist every vendor they need for a wedding — photographer, videographer, decorator,
venue/restaurant, makeup, hair, florist, DJ/band, cake, dress, suit, rings, transport(car rental). Vendors get rich, photo-heavy profiles. The product's center of gravity is
**content + discovery for couples**, with a vendor directory attached — NOT a directory
with content bolted on. That ordering is deliberate (see §3).

## 2. Why this idea (context for future-me)

- Proven model globally (The Knot since 1996, 200k+ vendors; Zola; WeddingWire).
- All global players are US-centric, English, USD, US wedding norms. **None localize for
  Georgia** and almost certainly never will (small market). That's the opening.
- No clear Georgian-language, mass-market, self-serve wedding vendor *marketplace* exists
  yet. Local competition is mostly full-service *agencies* — a different business, mostly
  chasing foreign/destination couples — plus a couple of platform-shaped players to watch.
- Fits Beka's stack (Angular/.NET/Postgres), design sensibility, and local-language edge.
- Avoids the walls that killed prior projects: no NBG/bank regulatory gate (if payments
  stay out — see §4), no Meta/platform gatekeeper.

## 3. The core strategic truth (do not forget this)

**This business lives or dies on COUPLE TRAFFIC, not on the software.**

The Knot started as *content for couples* (planning guides, "Weddings for the Real World"),
built the couple audience first, and monetized vendors only afterwards. Couple traffic is
the whole game. The hard, slow, unglamorous work of the first 6–18 months is **SEO +
Georgian-language content + Instagram**, not coding. The platform is almost secondary at the
start. If couples don't come, no monetization model works — commission, listings, or ads.

Known risks to respect (all real, none fatal but all slow):
- **Cold-start:** no couples without vendors, no vendor value without couples. Seed vendors
  free first; build their profiles for them from their Instagram.
- **Delayed payoff:** couples book 6–18 months ahead and never return (one-and-done). Work
  done in January may not show a wedding/review/revenue until autumn. Plan emotionally for a
  long dead zone before the first proof point.
- **Cultural headwind (open question):** Georgian wedding sourcing may be word-of-mouth /
  Facebook-group / Instagram-DM driven. Validate that couples will actually *use a directory*
  before over-investing. (Scout the FB groups + IG hashtags where couples ask "ვინ მირჩევთ
  ფოტოგრაფს?")

## 4. Monetization & payments — UNDECIDED, build payment-agnostic for now

Beka is **not yet committed** on money. Build so this can be decided later without rework.

What we reasoned through (record so we don't re-litigate):
- **Commission on bookings = fragile.** High-value, low-frequency, both sides want to avoid
  a middleman fee, Georgian culture is phone/relationship-driven → heavy disintermediation
  ("platform leakage"). Don't anchor the business on commission.
- **Featured/VIP listings (TNET / myauto.ge model) = the likely model, but timing matters.**
  Charging "pay to exist" on day one fails (no traffic = no vendor value). Correct sequence:
  listings FREE first → generate couple traffic → THEN sell visibility ("you got 40 views &
  8 contacts free last month; featured gets 3x — 150 GEL/month"). Sell *more of a proven
  result*, not a promise.
- **Caveat on the listings model:** Beka's payer pool is small/fixed (~max a couple thousand
  vendors), unlike myauto's huge pool. Cheap-per-payer pricing won't generate much. Either
  charge more per vendor (justified by real bookings delivered) or treat the directory as a
  modest side-income, not a big business.
- **Lead/advertising model warning:** The Knot got sued (2025) over "fake brides" — vendors
  paying for leads that don't convert feel cheated. If we ever do paid leads, design for
  lead quality/proof.

**Build directive:** No payment processing in MVP. No escrow, no deposits, no commission
tracking. Couples and vendors handle money between themselves. This keeps us OUT of fintech
/ NBG territory entirely (the thing that killed PayTaxi). A "Featured" flag on vendor records
is enough plumbing to switch on paid placement later via a single TBC/BOG e-commerce
integration when/if we decide to monetize.

## 5. MVP scope (build this, nothing more)

A **content + directory** product. No payments, no real-time booking, no calendar sync.

### Couple-facing (the priority — this is what brings traffic)
- Browse vendors by category, city, price range, style/aesthetic tags.
- Vendor profile pages: photo-heavy portfolio, starting price + range, areas served,
  contact (phone, Instagram, message form). Real-wedding galleries > styled shots.
- Search & filter (category, location, price, style).
- Wishlist / saved vendors.
- **Wedding budget planner** (couple enters total budget → suggested allocation across
  categories using Georgian wedding norms). SEO gold + great first-visit hook.
- **Content/SEO surface:** planning guides, checklists, real Georgian wedding features.
  This is a first-class part of the product, not an afterthought.
- Bilingual/trilingual: **Georgian primary**, English secondary.

### Vendor-facing
- Self-serve profile creation (name, category, photos w/ reordering, pricing, areas, contact).
- Inbox for couple messages.
- Basic analytics: profile views, contact/message counts. **This analytics data is the future
  sales tool** for selling featured placement — track it from day one even though it's free.

### Admin
- Vendor approval / moderation, content management, a "Featured" toggle (dormant until
  monetization is decided).

### Explicitly OUT of MVP
Payments, escrow, deposits, commission, real-time calendars, booking confirmation flows,
dispute resolution, multi-tenant architecture (single tenant — it's one platform, ours).

## 6. Tech stack & conventions

- **Frontend:** Angular + TypeScript. Visual-heavy, mobile-first (couples browse on phones).
## Design skills — use by role, never all at once

Building UI is one job; don't invoke multiple design skills simultaneously (causes
conflicting guidance). Use each for its specific role:

- BUILD with `frontend-design` only. It's the default UI builder for every surface.
- GENERATE the design system once, at project start, with `ui-ux-pro-max`
  (palette, spacing, and Georgian-script-friendly fonts). Save output to a tokens
  file and then stop invoking it.
- REVIEW after a surface is built, as a separate pass: `web-design-guidelines`
  for accessibility, and `impeccable` anti-slop detectors to catch generic/templated
  look. Do not run reviewers while building.
- Do NOT invoke `design-taste-frontend` and `frontend-design` together — they're
  both builders and will conflict. Pick frontend-design.

Aesthetic target (concrete): clean, editorial, photo-forward, card-based browsing,
generous whitespace, mobile-first. Vendor portfolios are the showcase — invest design effort there.

- **Backend:** .NET 8.
- **DB:** PostgreSQL.
- **i18n:** wire up Georgian/English from the start; Georgian is default. Don't
  retrofit localization later.
## SEO (product requirement, not a nice-to-have)
- SSR: server sends fully-rendered HTML; JS hydrates after. Couples and Google both
  get a complete page without waiting on client-side rendering.
- Clean URLs per vendor and per category×city (e.g. /fotografi/tbilisi/<vendor-slug>).
- Content comes from REAL DATA, not generated filler. A vendor page's SEO substance is
  the vendor's actual bio, pricing, portfolio (with descriptive alt text), reviews, and
  areas served. Do NOT pad pages with boilerplate marketing copy.
- No duplicate/templated text across similar pages. Category×city pages must differ by
  more than a swapped city name — real vendor lists + genuinely distinct intro content.
- Avoid thin pages (a profile with no text won't rank) AND avoid bloated repetitive copy.
  Aim for enough unique, substantive, data-driven content per page.
- Per-page unique <title> + meta description generated from the page's actual data.
- Semantic HTML + schema.org structured data (LocalBusiness / Service) on vendor pages.
- Keep components lean, lazy-load routes, small initial bundle — page speed is a ranking
  factor. Don't ship monolithic heavy components.
- Single-tenant. Keep it simple.

## 7. Suggested data model (starting point, not final)

- `Vendor` (id, name, category, city, areas_served, price_min, price_range, bio,
  instagram, phone, message_email, is_featured, is_approved, created_at)
- `VendorPhoto` (id, vendor_id, url, sort_order, is_real_wedding)
- `Category` (id, name_ka, name_en, slug)
- `StyleTag` (rustic, modern, traditional, minimalist, …) + `VendorStyleTag`
- `Couple` (id, name, email, wedding_date, guest_count, total_budget)
- `SavedVendor` (couple_id, vendor_id)
- `Message` (id, couple_id, vendor_id, body, created_at)
- `VendorStat` (vendor_id, date, profile_views, contact_clicks, messages) ← future $$ proof
- `Availability` (vendor_id, date, status) ← manual, optional
- `ContentPage` (slug, title_ka/en, body, type=guide|checklist|real_wedding) ← SEO

## 8. First build steps (in order)

1. Project scaffold: Angular front + .NET 8 API + Postgres, i18n wired (ka/en).
2. Vendor model + admin CRUD + profile pages (couple-facing, photo-heavy, SEO URLs).
3. Browse/search/filter by category + city + price + style.
4. Budget planner tool (standalone, SEO-targeted, works before directory is full).
5. Content/SEO pages scaffold (guides, real weddings).
6. Couple accounts: wishlist + message form. Vendor inbox. Stat tracking (silent).
7. Seed 30–50 real vendor profiles by hand (from Instagram) to make the directory look full.

## 9. Code health status (updated 2026-08-24 — don't re-audit without new evidence)

Three full adversarial review passes were completed and ALL findings fixed (commits
2afba7a..e35d79c): a 29-item review, a ~30-finding whole-app sweep, and a verification
sweep of the fixes themselves. Details live in the session memory file
(security-review-status.md). Deliberately accepted, with reasons: no vendors-list
pagination (MVP scale; reviews capped at 200), Identity lockout undercount under truly
parallel failures + login timing enumeration (both bounded by per-IP rate limits),
browse has no city select (never existed; city filter works via URL).

## 10. DEPLOYMENT CHECKLIST (production) — things that WILL break if forgotten

The app is deliberately config-driven; a bare deploy fails in specific known ways:

1. **Proxy `/api`, `/uploads` AND `/sitemap.xml` to the .NET API in front of the SSR
   Node server.** The Angular prod build uses a relative `apiBaseUrl` (`''`); without
   the reverse-proxy route, SSR fetches hit the Express catch-all and get HTML instead
   of JSON. One origin, e.g. nginx/Caddy: those three paths → Kestrel (5119),
   everything else → SSR server. Also set **`Site:PublicOrigin`** (e.g.
   `https://ourdomain.ge`) so the generated sitemap emits public URLs instead of the
   proxy-internal host.
2. **`Jwt:Key`** (≥32 chars) must be set in production config/env — the API refuses to
   start without it (deliberate fail-fast; the dev key lives only in the untracked
   appsettings.Development.json).
3. **`ForwardedHeaders:TrustedProxies`** (array of proxy IPs) must be set behind any
   reverse proxy — otherwise every client shares the proxy's IP and the per-IP rate
   limits (auth 10/min, messages 5/min, tracking/search 60/min) become site-wide.
4. **Migrations do NOT auto-apply outside Development.** Run them explicitly on deploy
   (e.g. `dotnet ef database update` from WeddingPlanner.Infrastructure, or a migration bundle).
   Roles (Couple/Vendor/Admin) DO seed automatically on every startup.
5. **Admin account:** set `Seed:AdminEmail` + `Seed:AdminPassword` (no fallback exists,
   deliberately) or create the admin manually.
6. **Cloudinary** (`Cloudinary:CloudName/ApiKey/ApiSecret`) for photo storage — without
   it the API falls back to local-disk uploads (then set `LocalUploads:PublicBase` to
   the public URL and persist the uploads folder).
7. **`Cors:AllowedOrigins`** = the production origin; **`Google:ClientId`** in BOTH
   backend config and the frontend environment for Google sign-in (omitting it just
   hides the button — password auth still works).

