// Cloudflare Workers entry for the live site (weddingplanner.ge). The Express server in
// server.ts stays for the Docker image on Render; this file is picked by the `cloudflare` build
// configuration in angular.json (ssr.entry + a platform-neutral server bundle).
//
// Files in dist/frontend/browser are served by Workers Static Assets before this code runs,
// so only page requests reach the handler below, plus the videos that need byte ranges
// (server.video.ts) and /sitemap.xml, which is fetched from the API. Rendered pages are reused
// from the edge (server.edge.ts). See wrangler.jsonc and docs/DEPLOY.md.
import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

import { environment } from './environments/environment';
import { EdgeContext, browserRenderedShell, sitemapFromApi, withEdgeCache } from './server.edge';
import { withFinishedHead } from './server.head';
import { hasMarkdown, pageAsMarkdown } from './server.markdown';
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
  // CF_VERSION_METADATA: the deploy's version id (wrangler.jsonc), so the edge never serves a page
  // rendered by an earlier deploy, whose script files are gone
  async fetch(req: Request, env: { ASSETS: AssetFetcher; CF_VERSION_METADATA?: { id: string } }, ctx: EdgeContext) {
    const { pathname } = new URL(req.url);
    if (isVideoPath(pathname)) return serveVideo(req, env.ASSETS);
    // The sitemap is the API's, served from this domain (robots.txt points here).
    if (pathname === '/sitemap.xml') return sitemapFromApi(req, environment.apiBaseUrl, edgeCache(), ctx);

    // A page asked for as Markdown (AI agents): an article, a legal page, the home page, a day
    // schedule. Answered before the edge cache, which stores one copy per address and would hand
    // such a reader the HTML page. The home page's text is the site's own llms.txt.
    const markdown = await pageAsMarkdown(req, environment.apiBaseUrl, undefined, (url) => env.ASSETS.fetch(new Request(url)));
    if (markdown) return markdown;

    const page = await withEdgeCache(req, edgeCache(), ctx, async () => {
      try {
        const res = (await reqHandler(req)) ?? new Response('Not found', { status: 404 });
        // also adds the Link header (sitemap, llms.txt) to HTML pages
        return await withFinishedHead(res, req.url);
      } catch (err) {
        console.error('Server render failed; serving the browser-rendered shell.', err);
        return browserRenderedShell(req, env.ASSETS);
      }
    }, Date.now, env.CF_VERSION_METADATA?.id);
    // Such an address answers in two forms, so caches between here and the reader must keep
    // them apart. Said on the way out, so the copy stored at the edge stays as it was.
    if (hasMarkdown(pathname) && (page.headers.get('content-type') ?? '').includes('text/html')) {
      page.headers.append('vary', 'Accept');
    }
    return page;
  },
};
