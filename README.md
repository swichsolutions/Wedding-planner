# WeddingPlanner — Georgian Wedding Platform

> **"WeddingPlanner" is a placeholder brand name.** It lives as one i18n key (`brand.name`) in
> `frontend/src/app/i18n/{ka,en}.json` — change it in one place to rebrand.

A Georgian-language, couple-first wedding-planning destination (discover, compare, and
shortlist wedding vendors), modelled on The Knot/Zola. See **`CLAUDE.md`** for the product
brief and strategy, and **`STATE.md`** for current build status.

---

## Stack & architecture

Monorepo with two apps:

```
Wedding planner/
  frontend/      Angular 21 (standalone) + SSR, SCSS, @ngx-translate
  backend/       .NET 8 — WeddingPlanner.Api / WeddingPlanner.Domain / WeddingPlanner.Infrastructure (EF Core + Npgsql)
  db/            00_setup_dev_db.sql (dev database + role)
  design-system/ MASTER.md (design spec) + pages/ (per-page overrides)
  CLAUDE.md      product brief / working rules
  STATE.md       current status, decisions, blockers
```

- **Frontend:** Angular 21, standalone components, **SSR** (`@angular/ssr`, Express), SCSS
  design tokens, runtime i18n (Georgian primary, English secondary).
- **Backend:** .NET 8 Web API, EF Core 8 + Npgsql (pinned to 8.0.x — 10.x is .NET-10-only).
- **DB:** PostgreSQL 17.

## Prerequisites

- Node 20+ (built on 24), npm
- .NET 8 SDK
- PostgreSQL 17 running locally
- `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)

---

## First-time setup

### 1. Database

Create the dev database + low-privilege app role (run once, as the postgres superuser):

```bash
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -f "db\00_setup_dev_db.sql"
```

This creates database `ipsum_dev` and role `ipsum_app`. The dev connection string (with the
app password) lives in `backend/src/WeddingPlanner.Api/appsettings.Development.json` (gitignored).

**First time on a new machine:** copy `appsettings.Development.json.example` (same folder) to
`appsettings.Development.json` and fill in the values — the API refuses to start without
`Jwt:Key`, and every DB request 500s without a connection string.

### 2. Backend

```bash
cd backend
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/WeddingPlanner.Api
```

On dev startup it **auto-applies EF migrations and seeds** categories, style tags, and a
starter set of vendors. (Guarded — the API still boots if the DB is down.)

- API: `http://localhost:5119` (https `7148`)
- Swagger: `http://localhost:5119/swagger`
- Health: `GET /health`

To apply migrations manually:
```bash
cd backend
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update \
  --project src/WeddingPlanner.Infrastructure --startup-project src/WeddingPlanner.Api
```

### 3. Frontend

```bash
cd frontend
npm install
npm start            # ng serve → http://localhost:4200
```

The frontend calls the API at `environment.apiBaseUrl` (dev: `http://localhost:5119`).
**If the API is down, it falls back to bundled mock data** so the UI always works.

---

## API endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/vendors` | List approved vendors. Query: `category`, `city`, `style`, `maxPrice`, `featured` |
| GET | `/api/vendors/{category}/{city}/{slug}` | Single vendor by SEO URL parts |
| POST | `/api/messages` | Couple → vendor message; increments `VendorStat` (silent engagement tracking) |
| GET | `/health` | Liveness |

CORS allows the Angular dev origin (`Cors:AllowedOrigins` in appsettings).

## Frontend routes

`/` home · `/vendors` browse (filters in query params) · `/budget` budget planner ·
`/saved` wishlist · `/guides` + `/guides/{slug}` content · `/{category}/{city}/{slug}` vendor
profile · `**` → redirects home (temporary safety net for unbuilt links).

---

## Key conventions

- **i18n:** Georgian is default. UI strings are keys in `frontend/src/app/i18n/{ka,en}.json`,
  used via the `translate` pipe. Vendor/article *content* is bilingual data (ka/en fields).
  Brand name = `brand.name` (and marked `translate="no"` in markup).
- **Design system:** consume CSS custom properties from `frontend/src/styles/_tokens.scss`
  (never raw hex/px in components). Breakpoints via `@use 'breakpoints' as bp;`. Spec in
  `design-system/MASTER.md`. Build UI with the `frontend-design` skill; review separately with
  `web-design-guidelines` + `impeccable` (see `CLAUDE.md` design rules).
- **SEO/SSR:** every route is server-rendered (`RenderMode.Server`) — full crawlable HTML per
  request. Per-page `<title>`, meta, and schema.org JSON-LD (LocalBusiness on profiles, Article
  on guides). Semantic HTML, descriptive alt text, lazy images with reserved aspect ratios.
- **Data access:** `VendorService` / `ContentService` / `MessageService` return Observables;
  `VendorService` already calls the API with a mock fallback.

## Build & test

```bash
# frontend
cd frontend && npm run build          # SSR production build → dist/frontend
npm run serve:ssr:frontend            # run the SSR server (PORT, default 4000)
npm test                              # vitest (watch)
npx ng test --watch=false             # vitest, one-shot (CI)

# backend
cd backend && dotnet build WeddingPlanner.sln
```

---

## ⚠️ Going to production (read before deploy)

1. **`allowedHosts`** — set `frontend` → `architect.build.options.security.allowedHosts` in
   `angular.json` to your real domain(s). Angular 21 rejects unknown hosts and silently falls
   back to client-side rendering (kills SEO). Currently localhost only.
2. **Absolute `apiBaseUrl`** — set `frontend/src/environments/environment.ts` `apiBaseUrl` to the
   real API origin. A relative/empty value fails during SSR (server-side fetch has no origin) and
   degrades to mock data.
3. **Secrets** — `appsettings.Development.json` (gitignored) holds the dev DB password; use a real
   secret store / env vars in production.
4. **Brand name** — replace the `WeddingPlanner` placeholder in `i18n/{ka,en}.json`.
5. **Real data** — replace seeded/mock vendors and articles with real content.

## What's built / what's next

See **`STATE.md`**. In short: the couple-facing discovery MVP (landing, browse, profile + contact
form, budget planner, guides, wishlist) **plus** auth (ASP.NET Identity + JWT), the vendor
self-serve dashboard/inbox, and admin moderation are all built and SSR-ready. Auth + dashboard +
admin are **not yet run against a live DB** (login/persistence unverified until `ipsum_dev` exists).
Dev admin: `admin@weddingplanner.ge` / `Admin!2026_dev`. Remaining: couple accounts (optional — wishlist +
messaging already work without them) and go-live. Set a real `Jwt:Key` secret before production.
