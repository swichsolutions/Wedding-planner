// Redirects the live site answers before Angular sees the request. Pure (no Angular imports) so
// server.redirects.spec.ts can test them; `wrangler dev` rewrites the host to 127.0.0.1, which
// makes the www rule impossible to observe locally.
import { movedAddress } from './app/core/old-addresses';

/** The canonical host of the live site. */
export const APEX = 'weddingplanner.ge';

/**
 * Paths whose letters are left as they came: a couple's invitation (/w/<slug>/<family code>) and a
 * partner invitation token can carry capitals that mean something, and files (the build's
 * chunk-AB12.js, /media/…, /pdfjs/…, /fonts/…, anything whose last part has a dot) are named
 * exactly. The API's /api and /uploads never reach this server in production, but stay safe too.
 */
const KEEPS_CASE = /^\/(?:w|partner|media|pdfjs|fonts|api|uploads)(?:\/|$)|\.[^/]*$/i;

/**
 * One spelling for every page's address, so search engines see one page, not several:
 * "//a///b" → "/a/b", "/a/" → "/a", "/a/index.html" → "/a", "/Fotografi" → "/fotografi".
 * Percent-escapes (%E1%83%90, a Georgian letter) keep their capitals: lowering them would name
 * the same address and send every such link round a needless redirect.
 */
export function cleanPath(pathname: string): string {
  let path = pathname.replace(/\/{2,}/g, '/').replace(/\/index\.html$/i, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (!KEEPS_CASE.test(path)) path = path.replace(/%[0-9a-f]{2}|[A-Z]+/gi, (m) => (m[0] === '%' ? m : m.toLowerCase()));
  return path;
}

/**
 * Where an address ("/path?query", as requested) should be instead, or null when it is fine:
 * the clean spelling above and the move from a pre-2026-11-13 address (core/old-addresses.ts)
 * together, so a visitor and a crawler get one redirect, never a chain. The query is kept (the
 * old addresses only drop the parameter that became part of the path).
 */
export function cleanAddress(address: string): string | null {
  const queryAt = address.indexOf('?');
  const path = queryAt === -1 ? address : address.slice(0, queryAt);
  const clean = cleanPath(path) + (queryAt === -1 ? '' : address.slice(queryAt));
  const target = movedAddress(clean) ?? clean;
  return target === address ? null : target;
}

/** A redirect response for `req`, or null when the request should be rendered. */
export function redirectFor(req: Request): Response | null {
  const url = new URL(req.url);

  // www → apex, permanently: one canonical host for search engines and shared links. The Host
  // header counts too, for proxies that keep the original host there.
  const host = req.headers.get('host')?.split(':')[0];
  const www = url.hostname === `www.${APEX}` || host === `www.${APEX}`;
  if (www) {
    url.hostname = APEX;
    url.port = '';
  }

  // The address's own spelling and the old addresses (/guides…, /schedules, /vendors?group=…),
  // permanent so search engines carry the old address's standing over. Static files never get
  // here on the live site (Workers Static Assets answers them first).
  const target = cleanAddress(url.pathname + url.search);
  if (target) return Response.redirect(new URL(target, url.origin).toString(), 301);
  return www ? Response.redirect(url.toString(), 301) : null;
}
