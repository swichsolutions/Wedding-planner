/**
 * schema.org JSON-LD for the inner public pages: where a page sits (BreadcrumbList) and what it is
 * (WebPage, or CollectionPage for a list). Built from the page's real names and addresses. The
 * builders take site-relative addresses ("/fotografi"); setJsonLd writes them out as full ones.
 * (Until 2026-11-16 only server.head.ts did that, on the server's HTML: once the page's script ran
 * it wrote the data again with "/fotografi", which is what Google's renderer read, and Search
 * Console reported "Invalid URL in field id (in itemListElement.item)".)
 */

import { GroupKey, categoryKey, categoryPath, groupOf, groupPath, isCategory } from './catalog';

const CONTEXT = 'https://schema.org';

/** The live site: structured data names it, on every host (same as ORIGIN in server.head.ts). */
export const SITE_ORIGIN = 'https://weddingplanner.ge';

/** Keys whose value is an address: a site-relative one ("/x", not "//x") becomes a full one. */
const ADDRESS_KEYS = new Set(['url', 'item', '@id', 'image', 'logo', 'mainEntityOfPage']);

function absoluteAddresses(key: string, value: unknown): unknown {
  if (typeof value === 'string' && ADDRESS_KEYS.has(key) && value.startsWith('/') && !value.startsWith('//')) {
    return SITE_ORIGIN + value;
  }
  if (Array.isArray(value) && ADDRESS_KEYS.has(key)) {
    return value.map((v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? SITE_ORIGIN + v : v));
  }
  return value;
}

/** One step of a page's trail: its name and its address on this site. */
export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbList(crumbs: Crumb[]) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.path })),
  };
}

/**
 * The catalog's trail, the way its menu goes: home → „სივრცეები და მომსახურებები" → the group →
 * the category (plural, as its page is titled). `tr` is the page's translate.instant.
 */
export function catalogTrail(tr: (key: string) => string, group: GroupKey | null, category?: string | null): Crumb[] {
  const crumbs: Crumb[] = [
    { name: tr('nav.home'), path: '/' },
    { name: tr('vendors.title'), path: '/vendors' },
  ];
  const g = group ?? (category ? groupOf(category) : undefined);
  if (g) crumbs.push({ name: tr(`catalog.groups.${g}`), path: groupPath(g) });
  if (category && isCategory(category)) {
    crumbs.push({ name: tr(categoryKey(category).replace('category.', 'categoryPlural.')), path: categoryPath(category) });
  }
  return crumbs;
}

export function webPage(
  type: 'WebPage' | 'CollectionPage',
  page: { name: string; description: string; path: string; lang: string },
) {
  return {
    '@context': CONTEXT,
    '@type': type,
    name: page.name,
    ...(page.description ? { description: page.description } : {}),
    url: page.path,
    inLanguage: page.lang,
    isPartOf: { '@type': 'WebSite', name: 'WeddingPlanner', url: '/' },
  };
}

/** The script text for `data`: full addresses, and "<" escaped. */
export function jsonLdText(data: unknown): string {
  // "<" escaped, so no text (a vendor's name, a title) can close the script tag in the
  // server-rendered HTML; JSON.stringify alone doesn't do this
  return JSON.stringify(data, absoluteAddresses).replace(/</g, '\\u003C');
}

/**
 * Puts `data` in the page's <head> under `id`, replacing what was there. Every page's JSON-LD goes
 * through here, so the addresses are full ones in the browser too, not only in the server's HTML.
 */
export function setJsonLd(doc: Document, id: string, data: unknown): void {
  removeJsonLd(doc, id);
  const script = doc.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.text = jsonLdText(data);
  doc.head.appendChild(script);
}

export function removeJsonLd(doc: Document, id: string): void {
  doc.getElementById(id)?.remove();
}
