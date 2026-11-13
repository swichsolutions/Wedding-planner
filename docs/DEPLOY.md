# Going live — weddingplanner.ge

How the live site is hosted, what has to be set up once, and how to ship an update.

## Layout

| Piece | Where | Config in repo |
|---|---|---|
| Site: `weddingplanner.ge` (and `www`, redirected to the apex) | Cloudflare Workers: Angular SSR + static assets at the edge | `frontend/wrangler.jsonc`, `frontend/src/server.cloudflare.ts`, the `cloudflare` + `live` build configurations in `frontend/angular.json` |
| API: `api.weddingplanner.ge` | Render web service (Docker, Starter plan, Frankfurt) | `render.yaml`, `backend/Dockerfile` |
| Database | Neon Postgres (Frankfurt) | — (the connection string lives in Render) |
| Photos | Cloudinary | `Cloudinary__*` env vars on the API |
| Outgoing e-mail (password reset) | Resend SMTP, or any SMTP relay | `Email__*` env vars on the API |
| DNS, TLS, CDN | Cloudflare (nameservers set at Magticom) | — |

Why the split: the .NET API and Postgres cannot run on Workers (Cloudflare Containers is still
beta), so the API stays on Render where it already lives, upgraded so it never sleeps. The
frontend moves to Workers: free, no cold starts, served from Cloudflare's edge.

Costs: Cloudflare Free (Workers: 100k requests/day), Render Starter ≈ $7/month, Neon Free
(0.5 GB, pauses after inactivity; Launch plan if that bites), Cloudinary Free, Resend Free
(3k mails/month), domain 30 GEL/year at Magticom.

## Status

Done on 2026-11-05: zone `weddingplanner.ge` added to the swichsolutions@gmail.com Cloudflare account (Free plan); nameservers at Magticom switched to `aryanna.ns.cloudflare.com` / `koa.ns.cloudflare.com` (the .ge registry already shows them; the zone activates once Cloudflare's check sees them); SSL mode Full; Always Use HTTPS on; DNS record `api` CNAME → `weddingplanner-api.onrender.com`, DNS only. Also done on 2026-11-05: Neon project `weddingplanner-prod` (Frankfurt, Postgres 18, database `neondb`) created next to the demo project `Wedding`; Render `weddingplanner-api` has the custom domain `api.weddingplanner.ge` (verified, certificate issued, `/health` answers 200 over HTTPS) and the Production environment variables from `render.yaml` (`Cors__AllowedOrigins__2=https://weddingplanner-web.onrender.com` keeps the old demo frontend working meanwhile; `LocalUploads__PublicBase` removed). The service is Blueprint-managed and linked to GitHub `main`, so a merge to `main` with `plan: starter` in `render.yaml` may apply the plan change by itself.
Later on 2026-11-05: `main` fast-forwarded to 67e0ca5 and deployed on Render; instance type Starter; `ConnectionStrings__Default` switched to the new Neon database (migrations ran, vendor list empty); zone active on Cloudflare; Wrangler logged in on Beka's laptop (OAuth, swichsolutions account); `npm run deploy:preview` → https://weddingplanner-web-preview.swichsolutions.workers.dev and `npm run deploy:live` → https://weddingplanner.ge + www (DNS records and certificate created by the deploy).
Still open: Cloudinary, Resend SMTP, Google OAuth origin, Search Console, and deleting the old Render demo frontend `weddingplanner-web` (then drop `Cors__AllowedOrigins__2`).

## One-time setup (dashboard work, in this order)

Everything here needs the account owner; nothing in the repo changes.

1. **Cloudflare account → Add a domain → `weddingplanner.ge` → Free plan.** Cloudflare lists
   two nameservers (`*.ns.cloudflare.com`). Let it import existing records, then delete any `A`,
   `AAAA` or `CNAME` it found for `@` and `www`: the Worker deploy creates its own and refuses
   while other records exist.
2. **Magticom panel → `weddingplanner.ge` → „NS მისამართები"** → replace both nameservers with
   Cloudflare's. The zone turns **Active** in Cloudflare after minutes to a few hours (e-mail).
3. **Cloudflare → SSL/TLS → Overview → Full**, and **Edge Certificates → Always Use HTTPS: on**.
4. **Render → `weddingplanner-api`:**
   - *Settings → Instance type:* **Starter** (the free tier sleeps after 15 min idle).
   - *Settings → Custom domains:* add `api.weddingplanner.ge`. Render shows the CNAME target
     (`weddingplanner-api.onrender.com`).
   - *Environment:* set the variables exactly as `render.yaml` lists them. The changes from the
     demo: `ASPNETCORE_ENVIRONMENT=Production`, `Database__MigrateOnStartup=true`,
     `Cors__AllowedOrigins__0=https://weddingplanner.ge`,
     `Cors__AllowedOrigins__1=https://www.weddingplanner.ge`,
     `Site__PublicOrigin=https://weddingplanner.ge`. Drop the old `LocalUploads__PublicBase`.
   - *Database:* decide between the demo Neon database (has demo vendors and test accounts)
     and a fresh one. Recommended: a new Neon project for production → its `.NET` connection
     string into `ConnectionStrings__Default`. On first start the API runs the migrations, seeds
     roles + categories, and creates `Seed__AdminEmail` with `Seed__AdminPassword` if that
     user is missing.
5. **Cloudflare → DNS → Add record:** `CNAME` `api` → `weddingplanner-api.onrender.com`,
   proxy **DNS only** at first. When Render shows the certificate for `api.weddingplanner.ge` as
   issued, the record may be switched to **Proxied** (Render supports it with SSL mode Full).
   Check: `https://api.weddingplanner.ge/health` → `{"status":"ok"}`.
6. **Cloudinary** (cloudinary.com, free) → Dashboard → cloud name, API key, API secret → Render
   `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret`. Without them uploads
   land on the container disk and vanish on every deploy.
7. **Resend** (resend.com, free) → Domains → add `weddingplanner.ge` → add the DNS records it
   shows in Cloudflare (DKIM, SPF for its `send` subdomain, DMARC) → create an API key. SMTP
   settings for Render: `Email__Smtp__Host=smtp.resend.com`, `Email__Smtp__Port=587`,
   `Email__Smtp__Username=resend`, `Email__Smtp__Password=<the API key>`,
   `Email__From=no-reply@weddingplanner.ge`. Any other SMTP relay (Brevo, Mailgun) works the same.
   The form on `/contact` mails each inquiry to `Email__ContactTo` (default
   `info@weddingplanner.ge`) and stores nothing, so that mailbox must exist and be read; replying
   to such a mail answers the visitor. Without SMTP the form tells the visitor it could not send.
8. **Google sign-in:** Google Cloud Console → the OAuth client used in
   `frontend/src/environments/environment.live.ts` → *Authorized JavaScript origins* add
   `https://weddingplanner.ge`; put the same client id in Render `Google__ClientId`. Until then
   the Google button fails; set `googleClientId: ''` in `environment.live.ts` to hide it instead.
9. Optional: **Cloudflare → Email → Email Routing** gives `info@weddingplanner.ge` /
   `admin@weddingplanner.ge` forwarding to a Gmail inbox for free (receiving only).
10. After the first deploy: **Google Search Console** → add `weddingplanner.ge` (DNS
    verification, a TXT record in Cloudflare) → submit `https://weddingplanner.ge/sitemap.xml`.

## Deploying the frontend (from `frontend/`)

```bash
npx wrangler login          # once per machine: opens the browser, grants wrangler access
npm run deploy:preview      # build for the live API + deploy to weddingplanner-web-preview.<account>.workers.dev
npm run deploy:live         # build + deploy to weddingplanner.ge and www.weddingplanner.ge
```

- `deploy:preview` is for checking a build before it goes on the real domain. It talks to the
  real API (`api.weddingplanner.ge`), so the API must be up first.
- `deploy:live` creates the DNS records and certificates for both hostnames on the first run
  (`env.live.routes` with `custom_domain` in `wrangler.jsonc`). It fails until the zone is Active and
  while `@`/`www` still have other DNS records.
- `npm run preview:cf` builds against the local API (`http://localhost:5119`) and serves the
  Worker at `http://localhost:8787` with `wrangler dev`: the way to test SSR changes locally.
  (`wrangler dev` rewrites the host to 127.0.0.1, so host checks and the www redirect can only
  be seen on the real domain, or with `curl -H "Host: www.weddingplanner.ge"`.)
- What the build does: `production,cloudflare,live` = optimised bundle, the Workers entry
  (`src/server.cloudflare.ts`, platform-neutral server), hosts `weddingplanner.ge` /
  `www.weddingplanner.ge` / `*.workers.dev` allowed for SSR, and `environment.live.ts` swapped
  in (`apiBaseUrl: https://api.weddingplanner.ge`). The Express `src/server.ts` is untouched and
  still used by `frontend/Dockerfile`.
- Later, optionally: Cloudflare → Workers → `weddingplanner-web` → Settings → Builds → connect
  the GitHub repo (root directory `frontend`, build command `npm run build:live`, deploy command
  `npx wrangler deploy`) for a deploy on every push to `main`.

## Deploying the API

Push to `main` → Render deploys (`autoDeployTrigger: commit`, needs the GitHub connection on the
service) or Render → `weddingplanner-api` → **Manual Deploy → Deploy latest commit**.
As of 2026-11-13 the push alone does NOT deploy (every deploy in Render's list is "Manual"): after
pushing, press Manual Deploy, then check `POST /api/...` behaviour or the API sitemap changed. Migrations
run on startup (`Database__MigrateOnStartup`). Watch the first deploy's logs for
`DB migrate/seed skipped`: that means the connection string is wrong.

## Go-live checklist

- `https://weddingplanner.ge` → view source contains the Georgian page text (SSR on). If it only
  contains the app shell, the Worker logs (Cloudflare → Workers → `weddingplanner-web` → Logs)
  show an `allowedHosts` or `x-forwarded-*` warning.
- `https://www.weddingplanner.ge/vendors` → 301 to the apex.
  The addresses from before 2026-11-13 → 301 to the Georgian ones, in one hop
  (`frontend/src/app/core/old-addresses.ts`): `/guides/<old-slug>` → `/rchevebi/blogi/<old-slug>`,
  `/vendors?category=fotografi` → `/fotografi`, `/vendors?group=venues` → `/sivrtseebi-da-kveba`,
  `/schedules?s=one-venue` → `/ganrigebi/khelis-motsera`.
- `https://weddingplanner.ge/sitemap.xml` and `/robots.txt` answer. The sitemap is the API's,
  fetched by the Worker, which keeps its copy for 10 minutes; its URLs start with
  `https://weddingplanner.ge`, and `robots.txt` points at it. When page addresses change, deploy
  the frontend first and the API right after: an API that lists new addresses the site does not
  have yet sends crawlers to 404s, while old addresses in the sitemap only redirect.
- Sign up a couple, log in, upload a vendor photo (lands on Cloudinary), request a password
  reset (the mail arrives), Google sign-in.
- Admin login with `Seed__AdminEmail`.
- The old demo on `weddingplanner-web.onrender.com` was deleted on 2026-11-05; Render now hosts only the API.

## Keeping the Worker up

A render costs 45–120 ms of CPU (up to about 1 s from cold), and the Workers free plan allows 10 ms per request. Cloudflare tolerates some of that; when it doesn't, the request fails with error 1102 (`exceededResources` in analytics, at 10 ms). So `src/server.edge.ts` reuses a public page from the edge for 5 minutes (`x-edge-cache: HIT`; edits can take that long to show), a failed render falls back to the browser-rendered shell (`x-rendered-by-browser`), and `src/main.server.ts` clears the flag a killed render leaves behind. The real cure is the $5 Workers Paid plan (30 s of CPU per request): take it before promoting the site. Don't crawl the live site quickly while on the free plan.
**Taken on 2026-11-13.** That morning's deploy showed why: a deploy invalidates every stored page
(each one is stored with the Worker version that rendered it), a quick check of all sitemap pages
used up the free plan's tolerance, and every page not yet re-stored answered 503 (error 1102,
`exceededCpu` in `npx wrangler tail --env live`) until the plan was switched.
