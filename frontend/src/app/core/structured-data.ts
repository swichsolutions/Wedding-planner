/**
 * schema.org JSON-LD for the inner public pages: where a page sits (BreadcrumbList) and what it is
 * (WebPage, or CollectionPage for a list). Built from the page's real names and addresses. The
 * addresses stay site-relative ("/fotografi"): server.head.ts makes every "url" and "item" a full
 * address in the server-rendered page, the way it does for the older vendor and landing data.
 */

import { GroupKey, categoryKey, categoryPath, groupOf, groupPath, isCategory } from './catalog';

const CONTEXT = 'https://schema.org';

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

/** Puts `data` in the page's <head> under `id`, replacing what was there. */
export function setJsonLd(doc: Document, id: string, data: unknown): void {
  removeJsonLd(doc, id);
  const script = doc.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  // "<" escaped, so no text (a vendor's name, a title) can close the script tag in the
  // server-rendered HTML; JSON.stringify alone doesn't do this
  script.text = JSON.stringify(data).replace(/</g, '\\u003C');
  doc.head.appendChild(script);
}

export function removeJsonLd(doc: Document, id: string): void {
  doc.getElementById(id)?.remove();
}
