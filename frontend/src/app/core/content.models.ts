// Editorial content ("რჩევები და იდეები" + legal pages): shared by the public pages and the
// admin editor. Georgian is primary; English fields are optional and fall back to Georgian.

/** Content kinds as the API names them. */
export type ContentKind = 'article' | 'inspiration' | 'real-wedding' | 'legal';

export const CONTENT_KINDS: ContentKind[] = ['article', 'inspiration', 'real-wedding', 'legal'];

/** Topics per kind (guide §5) — must match ContentRules on the API. */
export const CONTENT_TOPICS: Record<ContentKind, string[]> = {
  article: ['start', 'budget', 'vendors', 'guests', 'day', 'invitation'],
  inspiration: ['colors', 'decor', 'flowers', 'tables', 'lighting', 'cakes', 'invitations'],
  'real-wedding': [],
  legal: [],
};

/** Legal pages live at the top level, so only these slugs exist. */
export const LEGAL_SLUGS = ['terms', 'privacy'];

/** URL section per kind (PROPOSALS.md P11; mirrors ContentRules.PublicPath on the API). */
export const KIND_SECTION: Record<Exclude<ContentKind, 'legal'>, string> = {
  article: '/guides/blog',
  inspiration: '/guides/inspiration',
  'real-wedding': '/guides/real-weddings',
};

/** Public URL of a published page. */
export function contentPath(kind: ContentKind, slug: string): string {
  return kind === 'legal' ? `/${slug}` : `${KIND_SECTION[kind]}/${slug}`;
}

export interface ContentPhoto {
  id: number;
  url: string;
  altKa: string;
  altEn: string | null;
  sortOrder: number;
}

/** A published content card (list pages, related items). */
export interface ContentSummary {
  slug: string;
  type: ContentKind;
  topic: string | null;
  titleKa: string;
  titleEn: string | null;
  excerptKa: string | null;
  excerptEn: string | null;
  coverUrl: string | null;
  coverAltKa: string | null;
  coverAltEn: string | null;
  publishedAt: string | null;
}

export interface PublicCredit {
  name: string;
  roleKa: string;
  roleEn: string | null;
  /** Profile URL while the vendor is listed; null otherwise. */
  vendorPath: string | null;
}

export interface ContentDetail {
  summary: ContentSummary;
  bodyKa: string | null;
  bodyEn: string | null;
  metaDescriptionKa: string | null;
  metaDescriptionEn: string | null;
  actionPath: string | null;
  actionLabelKa: string | null;
  actionLabelEn: string | null;
  updatedAt: string | null;
  photos: ContentPhoto[];
  credits: PublicCredit[];
  related: ContentSummary[];
}
