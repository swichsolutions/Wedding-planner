# STATE.md — Ipsum (Georgian Wedding Platform)

> "Ipsum" is a **placeholder brand name** (to be replaced later). It lives as a single
> i18n key `brand.name` in frontend/src/app/i18n/{ka,en}.json — change it in one place.

## Status: full MVP built AND VERIFIED end-to-end against the live DB ✅

## Done
- **Repo layout:** monorepo — `/frontend` (Angular 21 + SSR) and `/backend` (.NET 8).
- **Backend scaffold** (`backend/Ipsum.sln`):
  - Projects: `Ipsum.Api` (web API), `Ipsum.Domain` (entities), `Ipsum.Infrastructure` (EF Core).
  - EF Core 8.0.10 + Npgsql 8.0.10 (pinned to 8.x — newest targets .NET 10, incompatible with net8.0).
  - **All 10 domain entities** from CLAUDE.md §7 implemented (Vendor, VendorPhoto, Category,
    StyleTag, VendorStyleTag, Couple, SavedVendor, Message, VendorStat, Availability, ContentPage).
  - `AppDbContext` with keys, unique indexes (incl. SEO slug uniqueness per category+city), relationships.
  - `Program.cs`: Npgsql DbContext, CORS for the Angular dev server, `/health` endpoint, Swagger.
  - **InitialCreate migration generated** (`backend/src/Ipsum.Infrastructure/Data/Migrations`). Builds clean.
- **Frontend scaffold** (`frontend/`):
  - Angular 21 standalone + SSR (`@angular/ssr`, Express server).
  - **i18n wired (Georgian default, English secondary)** via `@ngx-translate/core` v17 with a
    **static-import loader** (translations bundled, SSR-safe — no HTTP fetch).
  - `LanguageService` persists choice + syncs `<html lang>`; brand key for "Ipsum".
  - Environment files + `fileReplacements` (dev API = http://localhost:5119).
  - **SSR verified**: prerendered HTML contains Georgian content + `lang="ka"` (SEO requirement met).
  - Minimal unstyled app shell + home route (placeholder — real UI comes after the design system).
- `.gitignore` added (excludes bin/obj, node_modules, dist, and appsettings.Development.json secret).
- **Design system generated (once)** — "Editorial Georgian" direction:
  - Tokens: `frontend/src/styles/_tokens.scss` (color/type/space/radius/elevation/motion as CSS
    custom properties + dark scaffold), `_breakpoints.scss` (`respond-to` mixin), `_base.scss` (reset).
  - Wired into `styles.scss`; **Georgian-capable fonts** (Noto Serif Georgian + Noto Sans Georgian)
    loaded in `index.html` (preconnect + display=swap); `<html lang="ka">`, brand title + ka meta desc.
  - Spec doc: `design-system/MASTER.md` (+ `pages/` for per-page overrides). Frontend builds clean.
  - NOTE: ui-ux-pro-max CLI helper (scripts/data) are broken Windows symlinks → unusable; authored the
    system from the loaded SKILL.md framework + brief instead. Same deliverable (saved tokens file).

- **Landing / home page built** (frontend-design, "Editorial Georgian"):
  - Real app shell: sticky header (brand + nav + ka/en toggle + mobile dropdown) + dark footer
    (`app.html/ts/scss`). Skip link, focus-visible, RouterLinkActive.
  - Home sections (`pages/home/*`): asymmetric photo hero + category/city search, browse-by-category
    grid, featured **vendor cards** (mock data — the reusable card pattern), garnet budget-teaser band
    with decorative allocation viz, guides/real-weddings strip.
  - Shared primitives in `styles/_components.scss` (.btn variants, .link-arrow, .num tabular).
  - All copy via ka/en i18n (real Georgian). Imagery = Unsplash placeholders w/ reserved aspect-ratio.
  - Wildcard route redirects not-yet-built links (/vendors,/budget,…) to home (temporary).
  - Builds clean (raised anyComponentStyle budget to 10/16kB); SSR renders Georgian content.

- **Review pass on landing page** (separate from building, per design rules):
  - `web-design-guidelines` (a11y/UX): applied theme-color + Unsplash preconnect, brand `translate="no"`,
    `aria-controls` + nav id, focusable `#main` w/ scroll-margin, `touch-action`/tap-highlight,
    `color-scheme`, hover states on lang/menu buttons, select name/autocomplete, locale-aware Intl price
    (nbsp), long-content clamping.
  - `impeccable` (anti-slop): removed the eyebrow-on-every-section AI tell (kept ONE deliberate "journal"
    masthead); fixed vendor-card muted-text contrast (→ text-secondary, ≥4.5:1). Flagged but NOT changed
    (committed-identity wins): warm-ivory canvas sits in the 2026 "cream" AI-default band — conscious call.
  - Build clean after fixes.

- **Vendor data layer** (`frontend/src/app/core/`): `vendor.models.ts`, `catalog.ts`
  (CATEGORIES/CITIES/STYLE_TAGS shared), `mock-vendors.ts` (10 vendors, real ka bios for SEO),
  `vendor.service.ts` (Observable API — swap to HttpClient when backend is up, callers unchanged).
- **Reusable `VendorCard`** component (`components/vendor-card/`) — extracted from home; used on home + browse.
  Shared `.vendor-grid` moved to `_components.scss` (breakpoint-free auto-fill).
- **Vendor browse** `/vendors` (`pages/vendors/`): category/city/style/price filters **synced to URL query
  params** (deep-linkable), reactive results, count, empty state.
- **Vendor profile** `/{category}/{city}/{slug}` (`pages/vendor-profile/`): gallery (main + thumbs,
  real-wedding badge), info rail (sticky on desktop) w/ price, areas, style tags, contact CTAs
  (tel/instagram), about, portfolio grid, not-found state. **Per-page SEO**: dynamic `<title>` + meta +
  og tags + **schema.org JSON-LD LocalBusiness** (injected into head; SSR-verified).
- **Server render modes** (`app.routes.server.ts`): `''` + `vendors` Prerendered; profiles + rest
  `RenderMode.Server` (on-demand SSR — full crawlable HTML w/o enumerating vendor URLs).
- **SSR host allowlist** set in `angular.json` (`build.options.security.allowedHosts`) — Angular 21
  rejects unknown hosts and falls back to CSR (bad for SEO). Currently localhost only.
  ⚠️ **Production: add the real domain to allowedHosts** or profiles degrade to CSR.

- **Review pass on browse + profile** (a11y + anti-slop): replaced the dead "Send a message"
  primary CTA with a real **Call (`tel:`)** action (fits phone-driven sourcing; message-form CTA
  returns when that feature is built), added gallery-thumb `aria-controls`, bumped fact-label
  contrast, locale-formatted price options. Anti-slop: uniform browse/portfolio grids are
  legitimate here (results/gallery). SSR re-verified.

- **Vendor API (.NET)** — `VendorsController`: `GET /api/vendors` (filters category/city/style/maxPrice/
  featured) + `GET /api/vendors/{category}/{city}/{slug}`; `VendorDto`/`VendorPhotoDto` (camelCase JSON
  matching the Angular model, minus categoryKey which the frontend derives from slug). `DbSeeder`
  (8 categories, 5 style tags, 6 vendors w/ photos — mirrors the mock). Program.cs auto-migrates +
  seeds on **dev** startup (guarded so the API boots even if DB is down). Backend builds clean.
- **Frontend `VendorService` → HttpClient** with **mock fallback** (`catchError → MOCK_VENDORS`):
  when the API is up it serves real data; when down (now), the UI keeps working on mock. DTO→model
  maps categoryKey from catalog. SSR verified (home/browse/profile render via fallback, filters work).
- **Server render modes** changed to **all `RenderMode.Server`** (no prerender) — pages are data-driven,
  so build-time prerender can't call the live API. SSR still emits full crawlable HTML per request.
  ⚠️ **Production SSR needs an ABSOLUTE `apiBaseUrl`** (relative '' fails server-side → silently falls
  back to mock). Set `environment.ts` apiBaseUrl to the real API origin at deploy.

## ⚠️ To go live with real data (when ipsum_dev DB exists — other chat)
1. User runs `db/00_setup_dev_db.sql` (creates ipsum_app role + ipsum_dev DB).
2. Start API: `cd backend && ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/Ipsum.Api`
   → auto-applies migration + seeds. (Or `dotnet ef database update` first.)
3. `cd frontend && npm start` → dev uses apiBaseUrl http://localhost:5119 → real data; mock fallback gone.

- **Budget planner** `/budget` (`pages/budget/`): total-budget input → editable per-category
  allocation using Georgian norms (venue/catering 40% etc., sums to 100), live allocated/remaining
  with over-budget state, bar viz, reset-to-suggested. Locale-aware currency, per-page SEO title/meta.
  No DB. SSR-verified. Reviewed (added aria-live on summary, autocomplete=off on inputs, contrast bumps).

- **Content/guides surface** (`pages/guides/` + `core/content.*`): `ContentArticle` model, mock
  (4 bilingual articles — guide/checklist/realWedding, real ka bodies), `ContentService` (Observable,
  HTTP-ready). `/guides` list (article cards) + `/guides/{slug}` article (reading-width layout, drop-cap,
  per-page SEO title/meta/og + **Article JSON-LD**, not-found). Locale-aware dates. SSR-verified.
  Reviewed (date contrast bumped; otherwise clean).

- **Wishlist (saved vendors)** (`core/wishlist.service.ts` + `pages/saved/`): `WishlistService`
  (signal-backed, localStorage-persisted, SSR-safe). Save hearts on `VendorCard` now toggle + show
  saved state (aria-pressed). `/saved` page (grid + empty state). Header nav count badge. No auth/DB
  needed (client-side); ready to sync to backend when couple accounts exist. SSR-verified.

- **Contact / message form** (`components/contact-form/` + `core/message.service.ts` + backend
  `MessagesController`): reactive form (name + message required, phone-or-email required, email/state
  validation, sending/sent/error states) on the vendor profile `#contact` section; profile primary CTA
  jumps to it. Backend `POST /api/messages` validates, saves a `Message`, and **increments VendorStat
  (silent engagement tracking)**. Builds clean; form SSR-verified. Send path persists once DB/API live.
  Reviewed: added required indicators + aria-required, focus-first-invalid on submit, role=alert on
  the phone-or-email error. Wishlist reviewed — clean (aria-pressed/aria-label already present).

- **`README.md`** — dev/handoff doc: architecture, prerequisites, first-time setup (DB → backend →
  frontend), API endpoints, routes, conventions (i18n/design/SEO/data), build & test, and a
  production go-live checklist (allowedHosts, absolute apiBaseUrl, secrets, brand, real data).

- **Public info pages + SEO hygiene**: `/for-vendors` (supply-side acquisition — hero + 3-step
  "how it works", free-listing CTA), `/about`, `/contact` (mailto) — all bilingual w/ per-page titles.
  Shared `.static-page` prose style. **Proper 404** page (`noindex`) now backs the `**` wildcard
  (replaced the soft-404 redirect-home; dead footer links resolve). `public/robots.txt` added.
  NOTE: 404 currently returns HTTP 200 (Angular SSR status-code wiring not added) — mitigated by
  `noindex`; set a real 404 status at the SSR server layer before launch.

- **Auth + vendor dashboard + admin** (ASP.NET Identity + JWT):
  - **Backend**: `AppDbContext` → `IdentityDbContext<AppUser>` (AppUser has DisplayName + VendorId);
    JWT bearer + `TokenService`; `AuthController` (`POST /api/auth/register/vendor` creates an
    unapproved Vendor + Vendor-role user; `POST /api/auth/login`); `IdentitySeeder` (roles +
    dev admin admin@ipsum.ge); `VendorDashboardController` (`GET/PUT /api/vendor/me`, inbox,
    mark-read, stats) `[Authorize(Vendor)]`; `AdminController` (`GET /api/admin/vendors`,
    approve, toggle-feature) `[Authorize(Admin)]`. **AddIdentity migration** generated.
    Added `AppDbContextFactory` (design-time) — EF migrations now run from the Infrastructure
    project alone (works around a Windows App-Control block on loading the API dll).
  - **Frontend**: `AuthService` (JWT in localStorage, role signals), `authInterceptor`, `roleGuard`
    (enforces on client; allows SSR render of noindex private pages). `/login`, `/register` (vendor),
    guarded `/dashboard` (stats + profile-edit form + inbox w/ mark-read) and `/admin` (moderation:
    approve + feature toggle). Header shows Dashboard/Admin/Logout vs Login by role. All SSR-verified
    (200s; private pages render a loading shell server-side, hydrate with data on the client).
  - Dev admin: admin@ipsum.ge / Admin!2026_dev (config in appsettings.Development.json `Seed`).
  - ⚠️ **Not yet run against a live DB** — login/registration/persistence unverified until ipsum_dev
    exists; JWT key in appsettings is a dev placeholder (set a real secret in production).
  - Reviewed (a11y + anti-slop): `aria-required` across login/register/dashboard forms,
    focus-to-first-invalid on submit (shared `core/forms.ts`), admin feature-toggle `aria-pressed`;
    dashboard/admin confirmed appropriate as utility surfaces. Build clean.

- **Frontend unit tests** (vitest, 18 passing across 4 files): `catalog.spec` (slug uniqueness +
  key/name lookups), `budget.spec` (extracted pure `core/budget.ts` — pct sum=100, full allocation,
  zero-guard, venue largest), `wishlist.service.spec` (toggle/count/persist via TestBed),
  `vendor.service.spec` (mock fallback + categoryKey derivation via HttpTestingController).
  Run one-shot: `npx ng test --watch=false`. Refactored budget allocation into `core/budget.ts`.
  NOTE: backend has no test project yet — the Windows App-Control block on loading Ipsum.Api.dll
  may also affect a test host, so deferred (try an xUnit project + EF InMemory when DB/env allows).

- **END-TO-END VERIFIED against live ipsum_dev** (2026-06-26): both migrations applied; seed loaded
  (6 vendors, roles, admin). Confirmed working: public list/detail/filter/404; admin login (JWT/role);
  vendor registration (unapproved vendor + token + vendorId); `/vendor/me`; messaging to APPROVED
  vendors → 201 + **VendorStat increment**; inbox/stats/mark-read; admin approve (vendor goes public)
  + feature toggle; authorization (no-token 401, wrong-role 403, bad login 401, dup email 409);
  and the **frontend SSR renders live API data** (8 `<app-vendor-card>` = 8 public vendors; live-only
  test vendors present, mock-only absent — fallback not used). Note: messaging requires the vendor to
  be approved (correct — couples message directory-visible vendors).
  Test artifacts: created vendors test-studio-7, approved-studio-8, edit-test-9 (id9 unapproved).

- **City selection removed** from home search, browse filters, and vendor registration (city is no
  longer chosen in advance). Backend registration city now optional; vendors set City later via a
  text field in the dashboard. Header reworked: couple-clean nav; **Log in** + **List your business**
  (→ /for-vendors → /register) to the right of the Ka/EN toggle (mobile: in the dropdown).
  Fixed stale /for-vendors "Add your business" link (was → /contact, now → /register).
- **Vendor photo upload (Cloudinary)** — `IPhotoStorage` abstraction (`CloudinaryPhotoStorage` +
  `LocalPhotoStorage` dev fallback; chosen by config). `VendorPhoto.StorageId` column + migration
  `AddPhotoStorageId`. `VendorPhotosController` (`/api/vendor/me/photos`): upload (multipart, 8MB,
  jpg/png/webp, max 20), list, delete (removes from Cloudinary), update alt+realWedding, reorder —
  all `[Authorize(Vendor)]`. Dashboard **Photos** manager: multi-upload, alt text (SEO), real-wedding
  toggle, ↑↓ reorder, delete. **Verified end-to-end against live Cloudinary** (upload→CDN URL, list,
  delete, 401 unauth). Cloudinary keys live in appsettings.Development.json (gitignored, cloud dlh5clywq).
  Cloudinary auto-delivers WebP/auto-quality. For prod: set Cloudinary keys in prod secrets.

- **Gallery upgrade** (vendor profile): prev/next arrow buttons on the main image (when >1 photo) +
  click-to-open **fullscreen lightbox** (prev/next, counter, close, Esc + ←/→ keys, scrim-click to
  close, background scroll lock). Thumbnails retained. SSR-safe.

- **Contact/social links + visible phone**: added `Vendor.Facebook` + `Vendor.MapUrl` (entity +
  migration `AddVendorSocialLinks` + public/dashboard/edit DTOs). Dashboard Edit profile now has
  Facebook + Google Maps link fields (Instagram + Phone already there). Public profile contact section
  redesigned: shows the **phone number** (was only a "Call" button), Instagram, Facebook, and a
  Google Maps — with URL normalization (handles or full URLs both work). Verified e2e.
  Instagram/Facebook/Maps render as round **brand icon buttons** (monochrome, brand-color on hover);
  phone shows as the number + phone icon.
  Note: phone/social are set in the dashboard, not at registration; existing vendors with no phone
  show none until set.

- **Color scheme reworked** (warm-ivory background kept): brand ramp repurposed garnet→**bright pink**
  (`--color-brand-500 #ff3fa4`); `--color-action` is now **black/ink** (default buttons + links);
  garnet fully retired. Button system: `.btn--primary` = black, `.btn--pink` = solid pink (sign in/out,
  hero "Let's do this!", login/register submit, profile "Send a message" + contact submit, dashboard
  Save/Add photos), `.btn--pink-outline` = pink border (List your business, Browse vendors),
  `.btn--white` = white bg + pink border (budget band "Start planning"). Pink accents: link hover,
  saved heart, saved-count badge, focus rings. Budget band → black. Landing hero redesigned: centered
  "Wedding planning starts here" + subtitle + "Let's do this!" (→/register) + full-bleed image (no
  search dropdown). NOTE: solid-pink buttons use white text on bright pink (low contrast — user's
  chosen look; revisit with dark text if accessibility needed).

- **Planning Tool + couple accounts** (couples now have logins — previously only vendor/admin):
  - Backend: `POST /api/auth/register/couple` (role Couple); `ChecklistItem` entity + migration
    `AddChecklist`; `ChecklistController` `[Authorize(Couple)]` (`/api/planning/checklist` GET/POST/PUT/
    DELETE) — GET seeds 10 default Georgian wedding tasks on first access. Verified e2e (seed, add,
    toggle, 403 for admin, 401 no-token).
  - Frontend: `AuthService.registerCouple` + `isCouple`; `ChecklistService`; `/join` couple signup
    page; `/planning` page = **explainer + Sign up/Log in for guests**, **checklist for logged-in
    couples** (add/check/delete, progress count). Login redirects couples → /planning. Navbar
    **Guides → Planning Tool** (Guides still in footer). SSR renders the explainer (public/indexable).
  - Future: guest list + saved-vendors checklist tabs; couple register-page redesign.
  - **Planning explainer redesigned** (Knot-style, guest view): photo hero + sign-up, "covered" band,
    "make it easy" cream band w/ image, two feature cards (→ vendors, → budget), **guide cards pulled
    from ContentService → /guides/{slug}**, FAQ accordion (native details/summary), black final CTA band.
    All bilingual; Unsplash placeholder imagery. Logged-in couple view unchanged (checklist).
  - Planning explainer **refined**: covered band removed (was redundant 3rd sign-up); hero + final CTA
    are now **full-bleed photo backgrounds with overlaid white text** (scrim); pink dialed back (only
    hero+final pink, covered/easy black, cards neutral ghost); `.section` re-declared in planning.scss
    (was scoped to home → fixed cramped spacing). New btn `.btn--ghost-light` (white outline on photos).
- **Navbar redesigned**: "Saved" removed from nav links → heart icon in header actions (`.icon-link`,
  count badge, fills pink when wishlist non-empty); nav links get an animated pink underline (hover +
  active); pink signature dot after the "Ipsum" wordmark; scroll-condensing header (76px→58px, border +
  shadow on `.is-scrolled` via `scrolled` signal + `@HostListener('window:scroll')`). Saved still in
  footer. Verified desktop top/scrolled + mobile (no overflow) via Playwright.
- **Playwright** added as devDependency for in-session visual verification (screenshots/computed styles).

- **Saved gated behind couple accounts** (wishlist moved off localStorage → server-backed):
  - Navbar heart icon + footer "Saved" nav link now render **only when `auth.isCouple()`**
    (hidden for guests/vendors/admin).
  - New `SavedVendorsController` `/api/planning/saved` — `GET` (vendor ids, newest-first),
    `POST {vendorId}`, `DELETE {vendorId}`, `[Authorize(Roles=Couple)]`; mirrors ChecklistController.
    POST/DELETE are **idempotent**. `SavedVendor` entity re-keyed from CoupleId → **UserId
    (AppUser.Id)**, like ChecklistItem (couples are AppUsers with the Couple role — no Couple row
    is created at registration, so CoupleId was unusable). Migration `AddSavedVendorUser`.
    Removed the now-unused `Couple.SavedVendors` navigation.
  - `WishlistService` rewritten: server-backed, syncs on sign-in via an `effect`, optimistic
    toggle with rollback on error, SSR-safe (browser-only). Same `ids`/`count`/`isSaved`/`toggle`
    surface, so VendorCard/Saved/navbar callers are unchanged.
  - Guests tapping a card save-heart go to **/join?reason=save&returnUrl=…** (save-context
    subtitle; returns them to the page after signup). `/saved` page shows a couple sign-up prompt
    for non-couples.
  - Wishlist unit spec rewritten for the new behavior — **20 FE tests pass**. Backend + frontend
    build clean. **Verified e2e against live ipsum_dev**: save/list/delete, idempotency,
    newest-first ordering, 404 (unknown vendor), 400 (vendorId=0), 401 (no token), 403 (Admin).
    **Verified in-browser** (Playwright, 13/13): guest gating, guest→/join redirect, couple save
    → badge/aria-pressed, `/saved` list, and persistence across reload (proves server-backed).

- **Couple sign-up promoted to the primary CTA; navbar auth restructured** (couples are the
  priority audience — CLAUDE.md §3). Built with `frontend-design` inside the existing Editorial
  Georgian system (no new fonts/colors; reused `.btn--pink`, existing header link styles):
  - New **`/signup`** route — started as a placeholder; **now the full onboarding wizard (see next entry).**
    The old couple form still lives at **/join** but is **unlinked** from the UI (kept in code).
  - **Navbar** (user-approved "Sign up primary, vendor quiet" layout): guest actions right of the
    Ka/EN toggle are now `List your business` (small de-emphasized vendor link, `.site-header__vendor`)
    · `Sign in` (text link, `.site-header__login`) · **`Sign up`** (primary pink button → /signup).
    Mobile dropdown mirrors it (Sign up pink, Sign in outline, List your business link).
  - **Every couple sign-up CTA now points to /signup**: home hero "Let's do this!" (was → /register
    — the couple→vendor mismatch, fixed), planning explainer ×3, the /saved guest prompt, the login
    page "no account" link, and the vendor-card save-heart guest prompt (keeps `returnUrl`).
    Vendor sign-up unchanged (/for-vendors → /register).
  - New i18n `nav.signUp` + `signup.*` (ka/en). Build clean; **20 FE tests pass**. Verified
    in-browser (Playwright, **11/11** + screenshots): navbar hierarchy/order, /signup renders,
    all couple CTAs → /signup, guest heart → /signup?returnUrl, mobile dropdown, and no /join links left.

- **Couple onboarding wizard built on `/signup`** (replaces the placeholder), modelled on
  Zola/The Knot — fun-first, credentials-last, every step skippable (built with `frontend-design`
  in the Editorial Georgian system; reuses `.auth__field`, `.btn--pink`, tokens):
  - **6 steps**: names (you + partner) → wedding date (+ "still deciding") → planning stage →
    what you'll need (multi-select over the 8 catalog categories) → guest-count range → account
    (email + password, with a personalized "We're so excited, X & Y" heading). Slim progress bar,
    Back/Continue, one reactive form + signals, honours `?returnUrl=`.
  - **Backend**: `Couple` entity restructured into an onboarding profile keyed by `UserId`
    (AppUser.Id, unique) — added First/Last/PartnerFirst/PartnerLast names, PlanningStage,
    GuestCountRange, NeededCategories (Postgres **`text[]`** via Npgsql); migration `AddCoupleOnboarding`.
    `POST /api/auth/register/couple` now persists the profile with the account. New
    `GET /api/planning/couple` (Couple role) returns it.
  - **Data is used, not dead**: the Planning page greets the couple by name and shows a live
    **wedding countdown** ("{n} days to go") from the stored date. (Deeper uses — date-anchored
    checklist timeline, budget from guest count, category-personalized browse — are now unlocked
    for later; the data is captured.)
  - Full ka/en i18n. Build clean; **20 FE tests pass**. **Verified e2e** (live DB, 10/10): full-profile
    round-trip incl. `text[]` + date, minimal (all-skipped) sign-up, 401/403, dup-email 409.
    **Verified in-browser** (Playwright): 6-step walkthrough, progress bar, Back, personalized final
    heading, and greeting + 349-day countdown on `/planning`.

- **Category taxonomy expanded 8 → 14** (completes CLAUDE.md §1) + needs-step gating:
  - Added **Hair, Nails, Wedding dress, Groom's suit, Rings & jewelry, Transport** everywhere
    categories appear — frontend `catalog.ts` (slugs `tmis-stili`/`manikiuri`/`kaba`/`kostiumi`/
    `bechdebi`/`transporti`, with verified Unsplash images), ka/en `category.*`, and the backend seeder.
    `DbSeeder` made **idempotent** (`EnsureCategoriesAsync` adds any categories missing by slug) so the
    already-seeded live DB picked up the 6 new ones on restart (originals keep SortOrder 1–8, new = 9–14).
    They now show in the home grid, browse filters, vendor registration, and the signup "what you'll need" step.
  - Signup **"What will you need?" step now requires ≥1 pill to Continue**, with an explicit **Skip**
    button as the escape (per request): Continue is disabled until a pill is picked; Skip advances anyway.
  - Build clean; 20 FE tests pass. **Verified**: live DB has all 14 categories (direct SQL query);
    Playwright 10/10 — home grid shows 14 tiles + all 6 new images load, 14 pills incl. the new ones,
    Continue gated with no selection, Skip advances.

- **All signup steps mandatory, with clear validation feedback** (replaced the silent disabled
  button — users couldn't tell why Continue "didn't work"): Continue is now always clickable, and
  submitting an incomplete step reveals inline messages and focuses the first gap. Names step shows
  **per-field "Required" + red borders** (Zola-style); other steps show a step-level message
  ("Pick a date or check 'still deciding'", "Please choose one", etc.). Required: all four names,
  a date **or** "still deciding", a planning stage, ≥1 need (keeps its **Skip**), a guest range;
  Enter key guarded; messages clear live as fields are fixed. Account validates email+password on
  submit. New i18n `signup.required`/`errDate`/`errStage`/`errNeeds`/`errGuests` (ka/en). Build clean;
  20 FE tests pass; Playwright verified (4→2→0 field messages, step messages, advance-when-complete).

- **Signup wizard given a photo panel** (Zola/Knot-style, from user-provided screenshots): a wedding
  photo + editorial caption now sits beside the form — a **side panel on desktop** (`.ob` becomes a
  2-col grid), a **slim banner above the card on mobile**. Photo + caption **change per step**
  (6 verified Unsplash images; captions `signup.caption0..5` ka/en); "Ipsum" wordmark overlaid top,
  caption bottom, dark scrim for legibility. NOTE: fixed a CSS bug — `bottom: var(--space-7)` used an
  **undefined token** (the scale skips 7/9/11) which reset `bottom` to `auto` and pinned the caption
  to the top; switched to `--space-8`. Only `/signup` got this (the flow matching the references);
  `/login` + `/register` (vendor) unchanged. Build clean; 20 FE tests pass; Playwright 9/9
  (desktop panel + mobile banner, images load, photo/caption change per step).

- **Vendor register (`/register`) given a scattered photo collage** (per request — "throw them
  somewhere, not symmetrically"): 8 small white-framed vendor prints (classic Chevy, venue, hair,
  flowers, couple, rings, cake, reception table) absolutely positioned around the form at varied
  positions/sizes/rotations, **overlapping in loose piles** (not tidy 4-and-4 columns); the form
  stays centered on top (`z-index`), photos are `pointer-events:none` + `aria-hidden`, collage
  **hidden on mobile**. Refined per feedback: swapped the modern car → an **elegant black classic
  Chevy Impala** and the woman/makeup shot → a **reception table** (both chosen by downloading
  candidates and viewing them, since a URL doesn't reveal content). Then enlarged ~**1.5×** and
  **gated to `xl` (≥1280)** — the bigger prints only fit the side gutters on wide screens (hidden
  below xl, clean form). Per "move some to the center": **2 photos now sit in the center column**
  (reception peeks behind the title top, flowers peek below the card bottom) while 6 frame the
  sides; the opaque form card floats on top so inputs stay fully usable. Minor decorative edge-bleed
  at exactly 1280 (rotated bounding boxes, clipped by `overflow:hidden` — no scroll); clean at 1440+.
  Component moved to a `styleUrl` (`register.scss`). All 8 images verified to load; **no overlap**
  with the form card; no horizontal overflow. Build clean; Playwright **8/8** (desktop collage +
  form usable + mobile hidden). Only `/register` got this; `/login` still the plain card.
  NOTE: had to **restart the `ng serve` dev server** — its Windows file-watcher didn't pick up the
  new `register.scss` (kept serving the old inline-template bundle); `ng build` compiled fine throughout.

- **Sign-in converted to a popup modal** (Zola/Knot-style, from user screenshots): navbar "Sign in"
  (desktop + mobile) now opens a centered modal over a dimmed backdrop instead of navigating to
  `/login`. `AuthModalService` (signal) + `LoginModal` component mounted once at app root. Contents:
  email + password (same `AuthService.login` — **one login for couples & vendors**), **"Continue
  with Google"** button (no Apple), "Sign up" → **/signup** (couple onboarding), and "Are you a
  vendor? **Start here**" → **/register**. Backdrop-click + Esc close, body scroll-lock, focus email
  on open, `role=dialog`/`aria-modal`, fade/rise animation. On success: admin→/admin, vendor→/dashboard,
  couples stay on the current page. `/login` page kept as a fallback (direct URL + roleGuard redirects).
  ⚠️ **Google is a placeholder** — click shows "coming soon"; real OAuth still needs a Google client id
  + a backend verify endpoint (NOT built). Build clean; 20 FE tests pass; Playwright **13/13**
  (open/close/Esc/backdrop, links → /signup + /register, Google note, **real admin login → /admin**, mobile).

- **Home page remade** (3 user requests, frontend-design):
  1. **Hero → full-bleed photo background**: text ("Wedding planning starts here" + subtitle +
     Let's do this!) now overlays the photo (white text, bottom-weighted dark scrim, min-height
     ~74svh) instead of ivory-band-then-photo. **Hero image swapped** to a warm backlit
     couple-with-bouquet shot (photo-1519741497674) — the old one (photo-1465495976277) cropped
     to a bright hands/watch macro at viewport ratios, hurting text legibility. Chosen by
     downloading 4 candidates and viewing them. Image is now decorative (alt="" aria-hidden;
     h1 carries content).
  2. **Vendor cards → photo-first editorial** (shared component, so home + browse + saved all
     updated): removed the bordered white box; the rounded photo IS the card, text breathes
     below on the canvas; hover = image zoom + shadow lift + name underline. Save heart unchanged.
  3. **Budget band → light + real data**: dark ink band + fake decorative chart bars replaced
     with `--color-surface-sunken` cream band + a white "allocation preview" card computed from
     the REAL budget model (`core/budget.ts` top-5 categories on a sample 20,000 ₾: labels via
     budgetCat.*, locale-formatted amounts, proportional pink bars scaled to the largest share,
     "…and 5 more categories" footer). CTA `.btn--white` → `.btn--pink` (white variant was for
     the dark band). New i18n keys `budgetTeaser.sample` (w/ {{amount}} param) + `budgetTeaser.more`.
  - Build clean; 20 FE tests pass; Playwright **18/18** (hero layering/scrim/white title/image
    loads, cards box-free + rounded, band light, 5 real rows w/ venue 8,000 ₾, no overflow
    desktop+mobile) + screenshots reviewed desktop & mobile.
  - NOTE: user's long-running `ng serve` on :4200 served stale bundles again (known Windows
    watcher issue) — verification ran on a fresh :4300 server (since stopped). **Restart the
    :4200 dev server to see the changes.**
  - Review pass (web-design-guidelines / impeccable) not yet run on the remade sections.

- **Account settings page** (`/account`) — self-serve account management for ALL signed-in
  users (couple/vendor/admin), which didn't exist before (navbar only had Sign out; the vendor
  dashboard edits the business listing, not the user account):
  - **Backend** `AccountController` (`api/account`, `[Authorize]` any role): `GET /me`
    (`AccountDto`: email, displayName, roles, **hasPassword**) + `POST /password`
    (`ChangePasswordDto`). Change path uses `UserManager.ChangePasswordAsync`; for a
    **passwordless Google account** (`!HasPasswordAsync`) it uses `AddPasswordAsync` so the
    user can set a first password and then also log in with email. Returns a short error
    **code** the FE localizes: `current_incorrect` (wrong current pw → 400),
    `weak_password`, `current_required`. `AccountDtos.cs`. **No migration** (no schema change).
  - **Frontend**: `core/account.service.ts` (getAccount/changePassword); `pages/account/`
    (overview card: email + name + sign-in method; change/set-password card reusing the shared
    `.pw-reqs` live checklist + `passwordValidator`; new+confirm match validator; success/error
    banners; Sign out). `/account` route guarded by **`roleGuard()`** (no role arg → any
    authenticated user; SSR renders a noindex loading shell, loads on client). Navbar shows an
    **Account link** (desktop `site-header__auth` + mobile `site-nav__auth`) when authenticated.
  - i18n: `nav.account` + full `account.*` block (ka/en).
  - **Tests/build/verify**: FE build clean (`account` chunk); **23 FE unit tests pass**
    (+3 `account.service.spec`). Backend builds clean (0 warnings). **Live-DB e2e** (throwaway
    couple, non-destructive): register→200; `GET /account/me`→200 (email/hasPassword=true/role
    Couple); wrong current→**400 `current_incorrect`**; weak new→**400 `weak_password`**
    (bodies confirmed via HttpClient); change→204; **old pw login→401, new pw login→200**;
    unauth `/account/me`→401. **Playwright UI 14/14** (guard redirects signed-out→/login; real
    admin login; navbar Account link desktop+mobile; page renders admin email + 3 pw fields +
    4-rule checklist; empty submit shows 3 inline required errors + no navigation; no overflow
    desktop/mobile) + screenshots reviewed (ka).
  - Scope note: deliberately **did NOT** build email-change (needs JWT/Identity re-issue care)
    or delete-account (destructive, needs confirm flow) — flagged as follow-ups. Design-review
    pass (web-design-guidelines/impeccable) not yet run (utility surface; a11y mirrors the
    already-reviewed login/register — aria-required/invalid/describedby, role=alert/status,
    focus-first-invalid, labels, aria-live checklist).
  - ⚠️ **Verification env note**: had to restart the API myself (the previously-running instance
    was PID 24868; new build has the new controller). Ran it from `src/Ipsum.Api` so the content
    root finds `appsettings.Development.json` (running the exe from the `backend/` dir gave an
    empty connection string → 500s). The verification API instance was started with an extra CORS
    origin (`Cors__AllowedOrigins__1=http://localhost:4300`) via env var for a throwaway :4300
    frontend; that FE server is stopped. **The API is left running on :5119** (new build). The
    user's own long-running :4200 frontend still serves STALE bundles (recurring Windows watcher
    issue) — **restart it to see the account page + the earlier home-page remake.**

- **Navbar "My profile" merged** (per user: one profile button for everyone, not a separate
  "Account"): the standalone "Account" link (desktop + mobile actions) is **removed**. The
  existing **"My profile"** main-nav link (was vendor-only → `/dashboard`) now shows for **all
  authenticated users** with a **role-aware destination** via `App.profileLink` computed:
  **vendors → `/dashboard`** (their business listing is their profile), **couples/admins →
  `/account`** (account settings). Admins keep their separate "Admin" link. Label reuses the
  existing `auth.dashboard` key ("My profile" / "ჩემი პროფილი"); the now-unused `nav.account`
  i18n key was removed (ka/en).
  - So vendors don't lose password access after dropping the nav "Account" link, the **vendor
    dashboard header now has an "Account settings →" link** (`.dash__account-link`, reuses
    `account.title` + global `.link-arrow`, `margin-left:auto`) → `/account`. Dashboard got
    `RouterLink` in its imports.
  - Build clean (account + dashboard chunks). **Playwright 11/11** against live API: guest
    `/account`→`/login`; **couple** nav "My profile"→`/account` (no `/dashboard` link, no
    standalone Account link in actions), click lands on `/account`; **vendor** nav "My
    profile"→`/dashboard` (no `/account` nav link) + **dashboard has the account-settings
    link**→`/account`; **admin** nav "My profile"→`/account` + Admin link still present.
    Screenshots reviewed (couple account page + vendor dashboard w/ the new header link).
  - Verified on a throwaway :4300 frontend (now stopped) against the API on :5119 (still running
    with the extra 4300 CORS origin). User's :4200 server still serves stale bundles — restart it.

- **Vendor dashboard ("My profile") fully redesigned** (frontend-design, Editorial Georgian
  tokens) — user felt the old page was disconnected (bare stats + form + inbox + photos + a tiny
  account link "standing alone"). Rebuilt as **one cohesive dashboard shell**:
  - **Left sidebar** (`.dash-side`, sticky on lg, card): **identity** (avatar = first photo or
    name initial, name, category via `categoryKey()` catalog lookup), **status chip**
    (pending/published w/ dot), **section tabs** (`role=tablist`: Overview / Edit profile /
    Photos [count] / Messages [unread count]), a divider, then prominent **links**:
    **"Account & password"** (→ `/account`, with icon — this replaces the tiny header link the
    user disliked) and **"View public profile"** (→ public vendor URL, only when approved).
  - **Main area** = tabbed panels (`@switch activeSection` signal; `role=tabpanel`):
    **Overview** (4 stat cards + a new **Profile-strength** card: pink progress bar + `done/total`
    + checklist of bio/price/photos/contact, undone items are buttons that jump to the relevant
    tab; "looks great" message at 100%), **Edit profile** (the existing form, unchanged logic),
    **Photos** (existing manager), **Messages** (existing inbox). All existing methods/logic
    reused — only presentation reorganized + `activeSection`/`unreadCount`/`strength` computeds
    added. `.dash__account-link` (old header link) removed.
  - New i18n `dash.tabOverview/accountSettings/viewPublic/strengthTitle/strengthBio/strengthPrice/
    strengthPhotos/strengthContact/strengthDone` (ka/en). Tab labels reuse editTitle/photosTitle/
    inboxTitle.
  - Build clean. **Playwright 18/18** against live API (data-rich approved vendor set up via API:
    profile PUT for bio+price+phone → strength 3/4, admin-approved for the public link): sidebar
    identity/status/4 tabs/account+view-public links; overview default w/ 4 stats + strength bar
    reading 3/4; tab switching (profile shows form + hides stats, aria-selected); account link →
    `/account`; no overflow desktop/mobile. Screenshots reviewed (overview, profile, mobile —
    sidebar collapses to a top card, content below).
  - Verified on throwaway :4300 FE (stopped) against API :5119 (still running). Restart the
    :4200 dev server to see it.

- **"Areas served" field removed from the UI** (per user): dropped the input from the vendor
  dashboard **Edit profile** form (+ its form control, patchValue, and save payload in
  dashboard.ts) and the display from the **public vendor profile** (the `info__facts` row + the
  `areaServed` property in the schema.org JSON-LD). Left **dormant** (no migration, non-destructive,
  reversible): the `Vendor.AreasServed` DB column + backend DTO/controller/seeder, the frontend
  `Vendor.areasServed?` model field + mock data, and the now-unused `dash.areasServed` /
  `profile.areasServed` i18n keys. Backend not rebuilt (unchanged). Build clean; **Playwright 4/4**
  (edit form no longer has `#d-areas` or the label; name/bio/phone still present; a seeded vendor
  that HAS areas data in the DB renders no areas label on its public profile).

- **Photo reorder → drag-and-drop** (dashboard Photos tab; replaces the clunky ↑/↓-only UX):
  - Added **`@angular/cdk` (21.2.14)** and used CDK DragDrop. The `.photo-grid` is now a
    `cdkDropList` with `cdkDropListOrientation="mixed"` (wrapping grid); each `.photo-card` is a
    `cdkDrag`; drag starts from a **grip handle** (`cdkDragHandle`, 6-dot chip on the image
    top-left) so the alt input / checkbox / buttons stay clickable. `drop()` = `moveItemInArray`
    + existing `reorderPhotos` API. Touch-friendly (grip has `touch-action:none`).
  - **Cover badge** ("Cover" / "მთავარი", pink) on the first photo — gives ordering meaning
    (first = public cover image; also drives the sidebar avatar). Reorder **hint** line shown
    when >1 photo. **↑/↓ arrow buttons kept** as the keyboard-accessible fallback (relabeled
    `.photo-card__nudge`); drag UI (handle/cover/arrows/hint) only renders when >1 photo.
  - Drag states styled: faded `.cdk-drag-placeholder` slot + smooth reflow/settle in
    dashboard.scss; the body-teleported `.cdk-drag-preview` (shadow + radius) is **global** in
    `styles/_components.scss` (component-scoped CSS can't reach it). New i18n
    `dash.dragHint/dragHandle/cover` (ka/en).
  - Dashboard lazy chunk grew ~31kB→~96kB raw (~22kB transfer) from CDK — acceptable: it's a
    lazy, private (noindex) route, not the initial/SEO bundle.
  - Build clean. **Playwright 9/9** against live API (approved vendor + 3 generated solid-color
    PNGs uploaded via the real multipart endpoint): 3 cards w/ grip handles, cover badge only on
    first, hint shown; a real pointer drag of card #3→front reorders the DOM, the **cover badge
    follows** the new first card, and the order **persists across reload** (reorder API saved).
    Screenshots reviewed (before: red/green/blue w/ handles + cover on red; after: blue first
    w/ cover). Verified on throwaway :4300 FE (stopped); API :5119 still running.

- **Contact-vendor flow fixed + reworked into a modal** (user-reported bug + UX request):
  - **BUG ROOT CAUSE**: `<base href="/">` (index.html) rewrites bare `#fragment` links to
    `/#fragment` → the profile "Send a message" `<a href="#contact">` navigated to the **home
    page** instead of scrolling. Same class of bug hit the a11y **skip link** (`href="#main"`)
    on any non-home page.
  - **Fix + rework**: profile "Send a message" is now a `<button (click)="openContact()">` that
    opens the message form in a **modal dialog** (mirrors the LoginModal pattern: fixed dimmed
    backdrop + blur, `role=dialog`/`aria-modal`, Esc + backdrop-click close, body scroll-lock,
    focus moved to the name field on open via `effect`+`setTimeout`, focus restored to the
    trigger on close). The old inline `#contact` `<section>` (+ its `.contact` scss) was removed.
    New i18n `contact.modalTitle` ("Message {{name}}") + `contact.replyHint`.
    NOTE: `querySelector('a, b')` returns DOM-order-first, not first-selector-first — focus the
    name field via `card.querySelector('#cf-name') ?? …close`, not a comma selector.
  - **Contact form UI/UX**: full-width submit (fits the modal), a persistent **reply hint**
    under phone/email (swaps to the "add phone or email" error when both empty), and a polished
    **success state** (green check-circle icon, centered). `ContactForm` logic unchanged.
  - **Skip link fixed**: `app.ts` `skipToMain($event)` preventDefaults and moves focus to
    `#main` in code (injected `DOCUMENT`), instead of relying on the base-href-broken anchor.
  - Build clean; **23 FE tests pass**. **Playwright 15/15** against live API (approved vendor):
    clicking Send-a-message no longer navigates (stays on profile, not `/#contact`/home); modal
    opens with the vendor-named title; focus lands in the name field; Esc + backdrop close;
    a real message **sends → success state**; **skip link no longer navigates home** and focuses
    `<main>`; modal opens on mobile with no overflow. Screenshots reviewed (modal + success, ka).
    Verified on throwaway :4300 FE (stopped); API :5119 still running.

- **Contact modal "need two clicks to close ✕ after validation" bug fixed**: the modal was
  vertically centered (`place-items: center`), so when an empty submit added validation errors
  the card grew and the whole card — incl. the ✕ — **shifted upward** (measured **−25px at
  900px, −15px at 700px**; off-screen on very short viewports). The user clicked where they saw
  the ✕, hit the card body instead → first click absorbed, second click needed. (Playwright's
  synthetic clicks recompute the element position each click, so they never reproduced it — had
  to measure the boundingBox shift to find it.) **Fix**: top-anchor the modal
  (`display:flex; align-items:flex-start; justify-content:center` + top padding; card
  `margin:0 auto`) so the card's top and the ✕ stay put as content grows; overflow scrolls if
  taller than the viewport. **Playwright 8/8**: capturing the ✕ spot before submit then clicking
  that exact spot after errors now closes in one click at 900/768/700px; regression (open, name
  focus, errors show, ✕ one-click close, real send→success) green. Build clean. API :5119 still
  up; verified on throwaway :4300 (stopped).

- **Vendor notification badge in the navbar** (unread messages; user picked the icon+badge over
  a number-on-"My profile"): a **bell `.icon-link`** now sits in `site-header__actions` for
  signed-in vendors (mirrors the couple Saved-heart), with the existing `.icon-link__badge`
  showing the unread-message count and a new **`.icon-link.is-alert`** (pink outline, color-only
  so it doesn't fill the stroked bell) when unread > 0. Clicking it → `/dashboard?tab=messages`.
  - New **`core/notification.service.ts`**: `unread` signal, refreshed via `GET /api/vendor/me/stats`
    (`unreadMessages`) when the user becomes a vendor (effect on `auth.isVendor()`, mirrors the
    WishlistService sign-in pattern), cleared on sign-out; browser-only; **no polling** (real-time
    is out of MVP scope, messages aren't second-critical).
  - **Dashboard** wired to keep it exact: reads a `?tab=` query param → opens that section (so the
    bell lands on Messages); `getMessages` sets the shared count from the authoritative list;
    `markRead` calls `notif.markOneRead()` so the badge drops as messages are read.
  - i18n `nav.notifications` (en "Messages" / ka "შეტყობინებები"). Build clean; **23 FE tests
    pass**. **Playwright 12/12** (live API, vendor seeded with 2 messages): bell shows w/ badge=2
    + pink alert; click → `/dashboard?tab=messages` (Messages tab active, 2 in inbox); reading
    one → badge 1; reading both → badge hidden + alert off; a zero-message vendor shows the bell
    with no badge; a couple sees **no** bell. Screenshot reviewed. Verified on throwaway :4300 FE
    (stopped); API :5119 still up.
  - (Deferred, from the same chat: user also asked about custom subagents — gave an assessment;
    offered to set up a code-reviewer/design-review agent if wanted. Not built.)

- **Code-reviewer subagent added**: `.claude/agents/code-reviewer.md` — read-only reviewer tuned
  to this project (SSR guards, base-href fragment trap, dual-locale i18n, design tokens, modal/a11y
  rules; no git here → point it at files/dirs). NOTE: Claude Code loads custom agents at **startup**,
  so it's only invocable as `subagent_type: code-reviewer` **after a session reload** (`/agents` or
  restart). Smoke-tested via the general-purpose agent on the notification feature.

---

## SESSION 2026-07 (budget tracker, planning reminders, wedding website builder, shared dialogs)

Everything below builds clean, **23 FE unit tests pass**, backend builds clean, and each feature
was smoke-tested against the live `ipsum_dev` DB (migrations applied). The website builder's
color flow was also verified in a real browser via Playwright.

- **Budget planner rebuilt into a Zola-style tracker** (was a static estimator):
  - Backend: `BudgetItem` entity (UserId-owned like ChecklistItem; name, categorySlug, VendorId
    FK `SetNull`, merchantName, estimate/actualCost/paid, note, reminderDate, defaultPct,
    **EstimateEdited** flag, sortOrder). Migrations `AddBudgetItems` + `AddBudgetEstimateEdited`.
    `BudgetController` `/api/planning/budget` `[Authorize(Couple)]`: `GET` seeds **14 Georgian-norm
    line items** (pcts sum to 100, mirrors `core/budget.ts`); `PUT total` (applyEstimates =
    non-hand-edited rows follow the total live; resetEstimates = force all seeded rows back to the
    split); item `POST/PUT/DELETE`; `GET reminders` (dated payment reminders, **never seeds**);
    `PUT items/order` (permutation-validated reorder). `BudgetDtos.cs`.
  - Frontend `core/budget.service.ts` + rebuilt `/budget`: couples get the **table** (item name,
    vendor/merchant, estimate/actual/paid, reminder/note/delete icons, add-item, totals footer,
    summary meters); guests keep the estimator + signup CTA. Vendor column links into the directory
    — inline **picker** (saved+featured first, searchable, "top matches" opens the picker not a
    redirect) or free-text merchant. **Row-click detail popup** (Zola-style; edit everything in one
    place). **Drag-to-reorder** rows (CDK, grip handle, one-time coach mark). **Live total→estimates**
    (hand-edited rows protected; autosave with "saved ✓" flash). ₾ suffixes, "mark as paid" pill,
    over-estimate/paid-up signals, "Other" category option, mobile card layout.
- **Planning-page reminders panel**: `/planning` (couple view) shows up to 5 upcoming budget
  payment reminders (soonest first, overdue=red / due-soon≤14d=amber, outstanding amount, link to
  /budget), fed by the seed-safe `GET /api/planning/budget/reminders`.
- **Auth-aware home hero CTA**: signed-in couples→/planning, vendors→/dashboard, admins→/admin;
  guests still →/signup. (`Home.heroCta` computed; i18n `home.ctaCouple/ctaVendor/ctaAdmin`.)
- **Shared ConfirmDialog + ToastService** (extracted; replaces the native `window.confirm` and
  inline error banners): `core/confirm.service.ts` (promise-based `confirm({title,detail,body,
  confirmLabel,danger})`), `core/toast.service.ts` (`success/error/show`, SSR-safe), rendered once
  in the app root via `components/confirm-dialog/` + `components/toasts/`. Budget page migrated onto
  both (delete → styled danger dialog + "deleted" toast; all save failures → error toasts).
  i18n `confirm.*`, `common.dismiss`, `budgetPage.deletedToast`.
- **Wedding website builder** (The Knot-style — new nav item **"Website"** after Budget):
  - Backend `WeddingSite` entity (one per couple, UserId-owned; slug, templateKey, names, date,
    place, message, **inkColor/accentColor** `#rrggbb`, photoUrl/StorageId, isPublished). Migrations
    `AddWeddingSites` + `AddWeddingSiteColors`. `WebsiteController` `/api/planning/website` (GET/PUT
    upsert / photo upload+delete (8MB jpg/png/webp) / publish / unpublish); slug minted **once on
    first publish** from **Georgian→Latin transliterated** names + year, stays stable after
    (collisions get -2/-3…). `PublicSitesController` `GET /api/sites/{slug}` (published only).
    `WebsiteDtos.cs`.
  - Frontend `core/website.service.ts`; **`components/wedding-site/`** = one shared renderer used by
    the builder preview, the public page, and the gallery thumbs. **10 designs that differ
    structurally**: 5 layout archetypes (classic / banner=photo-hero / split=editorial 2-col /
    arch=wedding-arch photo / monogram=initials-seal + polaroid), 2 themes each, **per-theme Georgian
    typography** (Noto Serif/Sans Georgian loaded as **variable fonts** — wght 100–900 + Sans width
    axis — plus **Mtavruli** capitals via text-transform), and **custom text/accent colors**.
  - `pages/website/website-builder.ts` — pick design → add info (prefilled from couple profile) →
    live edit (sticky panel: design swatches, **Colors** section w/ curated dots + native picker +
    reset + WCAG contrast warning, details, photo upload) → **publish dialog** with copyable
    `/w/{slug}` URL. `pages/website/site-view.ts` — public **`/w/:slug`** page, server-rendered,
    **chromeless** (app shell hides header/footer on `/w/` via `App.chromeless`). Full ka/en i18n
    (`wsite.*`, `wsTemplate.*`, `website.*`).
  - ⚠️ **Custom colors are applied imperatively** (`Renderer2.setStyle(..., DashCase)`) in
    `wedding-site.ts`, NOT via template binding: `[style.--custom-prop]` is ignored by Angular and
    `[attr.style]` gets cleared by the styling runtime client-side. Also the names `<h1>` sets
    `color: var(--wsink)` **explicitly** — the global `h1{color:var(--color-text)}` rule otherwise
    beats inheritance. (Both were real bugs found via Playwright.)
- **Playwright** now installed in the session scratchpad (`playwright-core` + system Edge `msedge`
  channel) for real-browser verification — used to catch the two color bugs above.


- **[UNFIXED] Two notification-badge bugs** the code-reviewer found (feature works; these are edge
  cases — user was deciding whether to fix):
  1. Race in `core/notification.service.ts` `refresh()` — a slow `GET /api/vendor/me/stats` can land
     AFTER a `markOneRead()` and `unread.set(...)` clobbers it back to the stale higher count (until
     reload). Fix: version/invalidate a pending refresh once a local mutation happens.
  2. Double-clicking "Mark read" in `pages/dashboard/dashboard.ts` double-decrements the navbar badge
     (no re-entrancy guard; the button stays until the response). Fix: optimistic `isRead=true` before
     the request, or guard in-flight ids.
  (Also non-blocking: bell count not in the SR `aria-label` — same as the existing heart; and en
  `nav.notifications`="Messages" vs ka="შეტყობინებები" wording differ — align if desired.)
- **Open question**: whether to add more custom subagents beyond code-reviewer (e.g. design-review).

## Handoff notes (session ending)
- All code changes are saved to disk; this state.md is current. Nothing needs manual saving.
- **Running dev servers will stop when this session exits.** To resume in a new chat:
  - Frontend: `cd frontend && npm start` (→ :4200).
  - API: run from the project dir so the connection string is found — see memory
    [[api-startup-content-root]] (`cd backend/src/Ipsum.Api`, set ASPNETCORE_ENVIRONMENT=Development
    + ASPNETCORE_URLS=http://localhost:5119, run the exe) — or `dotnet run --project src/Ipsum.Api`.
    CORS defaults to allowing :4200; the extra :4300 origin used for verification was env-only.

## In progress
- (nothing actively — at a checkpoint)

## Next up (from this session)
- **Optional follow-ups now that onboarding lands data:** wire `WeddingDate` into a date-anchored
  checklist timeline; feed `GuestCountRange` into the budget planner; personalize browse via
  `NeededCategories`; add a profile-edit screen (PUT `/api/planning/couple`). Add Google/Apple OAuth
  if desired. Delete the orphaned `/join` route/page once you're happy with `/signup`.

## Next up
- **[BLOCKED ON USER] Apply DB migration.** First run the setup script (see below), then:
  `cd backend && ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project src/Ipsum.Infrastructure --startup-project src/Ipsum.Api`
- **Generate the design system once** with `ui-ux-pro-max` → save tokens file. (CLAUDE.md design rules)
- Then BUILD UI with `frontend-design`: landing page, vendor browse/profile, budget planner.
- Vendor model → admin CRUD + couple-facing profile pages (SEO URLs).
- Seed Categories + StyleTags; then 30–50 real vendor profiles.

## Decisions made (that aren't in CLAUDE.md yet)
- **Monorepo** `/frontend` + `/backend` (vs flat) — cleaner for a solo build.
- **Dedicated DB role** `ipsum_app` owning `ipsum_dev` (vs using postgres superuser) — least privilege.
- **EF Core/Npgsql pinned to 8.0.10** — 10.x is .NET-10-only.
- **i18n = @ngx-translate (runtime) with a static bundled loader**, NOT Angular compile-time
  @angular/localize. Reason: runtime language toggle + SSR renders translated HTML server-side
  (good for SEO) + simpler than per-locale builds. Revisit if per-locale URL builds become needed.
- Dev DB password for `ipsum_app` is in `backend/src/Ipsum.Api/appsettings.Development.json` (gitignored).

## Open questions / blockers
- **DB not yet created.** User must run (password stays with user):
  `& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -f "db\00_setup_dev_db.sql"`
- Validating couple demand before over-investing (CLAUDE.md §3) — still open, strategic.
- Real brand name TBD (using "Ipsum").
