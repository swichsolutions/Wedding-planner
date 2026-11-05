// Cloudflare Workers entry for the live site (weddingplanner.ge). The Express server in
// server.ts stays for the Docker image on Render; this file is picked by the `cloudflare` build
// configuration in angular.json (ssr.entry + a platform-neutral server bundle).
//
// Files in dist/frontend/browser are served by Workers Static Assets before this code runs,
// so only page requests reach the handler below, plus the videos that need byte ranges
// (server.video.ts). See wrangler.jsonc and docs/DEPLOY.md.
import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

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

export default {
  fetch(req: Request, env: { ASSETS: AssetFetcher }) {
    return isVideoPath(new URL(req.url).pathname) ? serveVideo(req, env.ASSETS) : reqHandler(req);
  },
};
