// Redirects the live site answers before Angular sees the request. Pure (no Angular imports) so
// server.redirects.spec.ts can test them; `wrangler dev` rewrites the host to 127.0.0.1, which
// makes the www rule impossible to observe locally.
import { movedAddress } from './app/core/old-addresses';

/** The canonical host of the live site. */
export const APEX = 'weddingplanner.ge';

/** A redirect response for `req`, or null when the request should be rendered. */
export function redirectFor(req: Request): Response | null {
  const url = new URL(req.url);

  // www → apex, permanently: one canonical host for search engines and shared links. The Host
  // header counts too, for proxies that keep the original host there.
  const host = req.headers.get('host')?.split(':')[0];
  if (url.hostname === `www.${APEX}` || host === `www.${APEX}`) {
    url.hostname = APEX;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  // Addresses from before 2026-11-13 (/guides…, /schedules, /vendors?group=…, /vendors?category=…)
  // → the Georgian ones, same rule as the Express server.ts and the router. Permanent, so search
  // engines carry the old address's standing over, and in one hop: an old /guides/<slug> goes
  // straight to /rchevebi/blogi/<slug>, where a missing article still ends as a plain 404.
  const moved = movedAddress(url.pathname + url.search);
  if (moved) return Response.redirect(new URL(moved, url.origin).toString(), 301);

  return null;
}
