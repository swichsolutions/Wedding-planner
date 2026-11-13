/**
 * The "We're on WeddingPlanner" badge a vendor puts on their own website: a followed link back to
 * their public profile (that link is the point: it earns the site a backlink). Pure, so
 * badge-snippet.spec.ts can test it. The badge files live in public/badge/.
 */

/** The live site. The snippet goes on someone else's website, so every address in it is absolute. */
export const SITE_ORIGIN = 'https://weddingplanner.ge';

export type BadgeLang = 'ka' | 'en';
export type BadgeTheme = 'light' | 'dark';

/** The size the SVGs are drawn at (public/badge/*.svg). */
export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 56;

/** What the badge says, in its own language (not the dashboard's): it is the image's alt text. */
const BADGE_TEXT: Record<BadgeLang, string> = {
  ka: 'ვართ WeddingPlanner-ზე',
  en: 'Find us on WeddingPlanner',
};

/** The link's tooltip: the vendor's name, then where they are. */
const LINK_TITLE: Record<BadgeLang, (name: string) => string> = {
  ka: (name) => `${name} WeddingPlanner-ზე`,
  en: (name) => `${name} on WeddingPlanner`,
};

export interface BadgeVendor {
  name: string;
  categorySlug: string;
  citySlug: string;
  slug: string;
}

/** The vendor's public profile, as the router builds it: /<category>/<city>/<slug>. */
export function profileUrl(v: BadgeVendor): string {
  return `${SITE_ORIGIN}/${[v.categorySlug, v.citySlug, v.slug].map(encodeURIComponent).join('/')}`;
}

/** The badge file's path on this site (also what the dashboard's preview shows). */
export function badgePath(lang: BadgeLang, theme: BadgeTheme): string {
  return `/badge/badge-${lang}-${theme}.svg`;
}

/** Text placed inside a double-quoted HTML attribute. */
function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The HTML the vendor pastes into their site. No rel="nofollow": the link is meant to count. */
export function badgeSnippet(v: BadgeVendor, lang: BadgeLang, theme: BadgeTheme): string {
  return (
    `<a href="${attr(profileUrl(v))}" title="${attr(LINK_TITLE[lang](v.name.trim()))}">` +
    `<img src="${SITE_ORIGIN}${badgePath(lang, theme)}" alt="${attr(BADGE_TEXT[lang])}" ` +
    `width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"></a>`
  );
}
