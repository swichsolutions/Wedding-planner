// Cloudflare Workers entry for the live site (weddingplanner.ge). The Express server in
// server.ts stays for the Docker image on Render; this file is picked by the `cloudflare` build
// configuration in angular.json (ssr.entry + a platform-neutral server bundle).
//
// Files in dist/frontend/browser are served by Workers Static Assets before this code runs,
// so only page requests reach the handler below, plus the videos that need byte ranges
// (server.video.ts). Rendered pages are reused from the edge (server.edge.ts). See wrangler.jsonc
// and docs/DEPLOY.md.
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

import { EdgeContext, browserRenderedShell, withEdgeCache } from './server.edge';
import { APEX, redirectFor } from './server.redirects';
import { AssetFetcher, isVideoPath, serveVideo } from './server.video';

const angularApp = new AngularAppEngine({
  // Hosts the engine renders for; any other Host header falls back to client-side rendering.
  // `localhost` is `wrangler dev`, `*.workers.dev` the preview deploy. Keep in sync with the
  // `cloudflare` configuration's security.allowedHosts in angular.json.
  allowedHosts: ['localhost', APEX, `www.${APEX}`, '*.workers.dev'],
  // Only Cloudflare's edge can call a Worker, so its x-forwarded-* headers are trustworthy.
  // Left at the default, an unexpected x-forwarded-for would silently turn SSR off.
  trustProxyHeaders: true,
});

/** Request handler used by the Angular CLI (dev-server and during build) and by the Worker. */
export const reqHandler = createRequestHandler(async (req) => {
  const redirect = redirectFor(req);
  if (redirect) {
    return redirect;
  }
  const res = await angularApp.handle(req);
  return res ?? new Response('Not found', { status: 404 });
});

/** Cloudflare's edge cache. DOM's CacheStorage has no `default`, hence the cast. */
const edgeCache = () => (caches as unknown as { default: Cache }).default;

export default {
  async fetch(req: Request, env: { ASSETS: AssetFetcher }, ctx: EdgeContext) {
    if (isVideoPath(new URL(req.url).pathname)) return serveVideo(req, env.ASSETS);

    // A request killed for CPU mid-render never runs Angular's cleanup, which leaves its "inside a
    // reactive context" flag set for the whole isolate: every later request then dies with NG0600
    // until the isolate is replaced (the outage of 2026-11-06). No reactive work spans requests, so
    // starting clean is safe.
    setActiveConsumer(null);

    return withEdgeCache(req, edgeCache(), ctx, async () => {
      try {
        return (await reqHandler(req)) ?? new Response('Not found', { status: 404 });
      } catch (err) {
        console.error('Server render failed; serving the browser-rendered shell.', err);
        return browserRenderedShell(req, env.ASSETS);
      }
    });
  },
};
