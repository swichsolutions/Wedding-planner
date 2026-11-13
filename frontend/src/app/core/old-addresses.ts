import { GROUPS, GroupKey, groupPath, isCategory } from './catalog';
import { GUIDES_PATH, KIND_SECTION } from './content.models';
import { SCHEDULES_PATH, schedulePath } from './schedule-addresses';

/**
 * Addresses from before 2026-11-13 and where each one lives now. The site moved to Georgian
 * addresses without parameters (/vendors?category=fotografi → /fotografi, /guides → /rchevebi,
 * /schedules?s=… → /ganrigebi/…). Old links are still out there: in search results, in shared
 * messages, in couples' saved tasks and in article texts. One pure function, so the live Worker
 * (server.redirects.ts), the Express server (server.ts) and the router (app.routes.ts) all send
 * an old address to the same place.
 */

/** The old /guides sections → today's. */
const GUIDE_SECTIONS = new Map([
  ['blog', KIND_SECTION.article],
  ['inspiration', KIND_SECTION.inspiration],
  ['real-weddings', KIND_SECTION['real-wedding']],
]);

/**
 * The new address of an old one ("/path?query", as written in a link), or null when the address
 * has not moved. The parameter that became part of the path is dropped and every other one is
 * kept. A value that names nothing (/vendors?group=zzz) leaves the address as it is.
 */
export function movedAddress(address: string): string | null {
  const hashAt = address.indexOf('#');
  const hash = hashAt === -1 ? '' : address.slice(hashAt);
  const beforeHash = hashAt === -1 ? address : address.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const rawPath = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const query = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));

  const at = (newPath: string, ...moved: string[]): string => {
    for (const name of moved) query.delete(name);
    const rest = query.toString();
    return newPath + (rest ? `?${rest}` : '') + hash;
  };

  if (path === '/guides') return at(GUIDES_PATH);
  const guide = path.match(/^\/guides\/([^/]+)(?:\/([^/]+))?$/);
  if (guide) {
    const [, first, slug] = guide;
    const section = GUIDE_SECTIONS.get(first);
    if (section) return at(slug ? `${section}/${slug}` : section);
    // /guides/<slug> is an article from before the sections existed (PROPOSALS.md P11): straight
    // to its place in the blog, in one hop.
    return slug ? null : at(`${KIND_SECTION.article}/${first}`);
  }

  if (path === '/schedules') {
    const to = schedulePath(query.get('s'));
    return to === SCHEDULES_PATH ? at(to) : at(to, 's');
  }

  if (path === '/vendors') {
    const category = query.get('category');
    // ?group= beside a category only ever named that category's own group
    if (isCategory(category)) return at(`/${category}`, 'category', 'group');
    const group = query.get('group') as GroupKey;
    if (GROUPS.includes(group)) return at(groupPath(group), 'group');
  }

  return null;
}
