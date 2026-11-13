// The catalog's taxonomy and vendor attributes (design-system/PROPOSALS.md P1–P5, approved
// 2026-10-21). Mirrors CategoryCatalog + CatalogRules in the API. Labels are i18n keys.

/** Build a stable Unsplash placeholder URL. Replace with real imagery later. */
export const img = (id: string, w: number): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** The 9 catalog groups — the catalog's navigation. */
export type GroupKey = 'venues' | 'photo' | 'decor' | 'music' | 'cake' | 'attire' | 'accessories' | 'beauty' | 'other';
export const GROUPS: GroupKey[] = ['venues', 'photo', 'decor', 'music', 'cake', 'attire', 'accessories', 'beauty', 'other'];

export interface CategoryRef {
  slug: string;
  key: string; // i18n key, e.g. 'category.photographer'
  group: GroupKey;
  img?: string;
}

export interface CityRef {
  name: string; // Georgian display name
  slug: string;
}

/** Every category (sub-type), in the catalog's order. Existing slugs are live URLs — never change them. */
export const CATEGORIES: CategoryRef[] = [
  { slug: 'darbazi', key: 'category.venue', group: 'venues', img: img('photo-1519167758481-83f550bb49b3', 600) },
  { slug: 'keiteringi', key: 'category.catering', group: 'venues' },
  { slug: 'fotografi', key: 'category.photographer', group: 'photo', img: img('photo-1606216794074-735e91aa2c92', 600) },
  { slug: 'videografi', key: 'category.videographer', group: 'photo', img: img('photo-1492691527719-9d1e07e534b4', 600) },
  { slug: 'dekori', key: 'category.decor', group: 'decor', img: img('photo-1478146896981-b80fe463b330', 600) },
  { slug: 'floristi', key: 'category.florist', group: 'decor', img: img('photo-1507504031003-b417219a0fde', 600) },
  { slug: 'inventari', key: 'category.rental', group: 'decor' },
  { slug: 'musika', key: 'category.music', group: 'music', img: img('photo-1511671782779-c97d3d27a1d4', 600) },
  { slug: 'tamada', key: 'category.tamada', group: 'music' },
  { slug: 'tsamqvani', key: 'category.host', group: 'music' },
  { slug: 'gasartobi', key: 'category.entertainment', group: 'music' },
  { slug: 'torti', key: 'category.cake', group: 'cake', img: img('photo-1535254973040-607b474cb50d', 600) },
  { slug: 'tkbileuli', key: 'category.desserts', group: 'cake' },
  { slug: 'kaba', key: 'category.dress', group: 'attire', img: img('photo-1594552072238-b8a33785b261', 600) },
  { slug: 'kostiumi', key: 'category.suit', group: 'attire', img: img('photo-1507679799987-c73779587ccf', 600) },
  { slug: 'pekhsatsmeli', key: 'category.shoes', group: 'attire' },
  { slug: 'aksesuarebi', key: 'category.accessories', group: 'accessories' },
  { slug: 'bechdebi', key: 'category.rings', group: 'accessories', img: img('photo-1515934751635-c81c6bc9a2d8', 600) },
  { slug: 'makiaji', key: 'category.makeup', group: 'beauty', img: img('photo-1487412947147-5cebf100ffc2', 600) },
  { slug: 'tmis-stili', key: 'category.hair', group: 'beauty', img: img('photo-1560066984-138dadb4c035', 600) },
  { slug: 'manikiuri', key: 'category.nails', group: 'beauty', img: img('photo-1632345031435-8727f6897d53', 600) },
  { slug: 'saloni', key: 'category.salon', group: 'beauty' },
  { slug: 'movla', key: 'category.care', group: 'beauty' },
  { slug: 'transporti', key: 'category.transport', group: 'other', img: img('photo-1533473359331-0135ef1b58bf', 600) },
  { slug: 'bechduri-mosatsvevebi', key: 'category.printedInvitations', group: 'other' },
  { slug: 'koordinatori', key: 'category.coordinator', group: 'other' },
];

export const CITIES: CityRef[] = [
  { name: 'თბილისი', slug: 'tbilisi' },
  { name: 'ბათუმი', slug: 'batumi' },
  { name: 'ქუთაისი', slug: 'kutaisi' },
  { name: 'რუსთავი', slug: 'rustavi' },
  { name: 'თელავი', slug: 'telavi' },
];

/** Tbilisi + regions (P4). Labels: catalog.regions.<key>. */
export const REGIONS = [
  'tbilisi', 'kakheti', 'mtskheta-mtianeti', 'imereti', 'adjara', 'kvemo-kartli', 'shida-kartli',
  'samtskhe-javakheti', 'samegrelo-zemo-svaneti', 'guria', 'racha-lechkhumi',
];

/** What a price is for (P2). Labels: catalog.units.<key> (long) and catalog.per.<key> (after a price). */
export type PriceUnit = 'event' | 'guest' | 'hour' | 'kg' | 'item';
export const PRICE_UNITS: PriceUnit[] = ['event', 'guest', 'hour', 'kg', 'item'];

/** Styles (P3) — photo/video and decor only; "documentary" is photo/video only. */
export const STYLES = ['classic', 'modern', 'minimalist', 'rustic', 'traditional', 'romantic', 'boho', 'documentary'];
export const STYLE_GROUPS: GroupKey[] = ['photo', 'decor'];
export const stylesFor = (group: GroupKey): string[] =>
  STYLE_GROUPS.includes(group) ? STYLES.filter((s) => s !== 'documentary' || group === 'photo') : [];

/** Group-specific features (P2). Labels: catalog.features.<key>. */
export const FEATURES: Record<GroupKey, string[]> = {
  venues: ['accommodation', 'parking'],
  photo: ['drone', 'album', 'sameDayEdit'],
  decor: [],
  music: ['folk', 'pop', 'jazz', 'classical', 'electronic'],
  cake: ['delivery'],
  attire: ['sale', 'rental'],
  accessories: [],
  beauty: ['comesToYou'],
  other: [],
};

export const SETTINGS = ['indoor', 'outdoor', 'both'];
export const VENUE_TYPES = ['restaurant', 'hall', 'openAir', 'winery', 'hotel'];
export const TRAVEL_POLICIES = ['included', 'extra', 'none'];
/** Guest-capacity buckets for the venue filter (keys the API understands). */
export const GUEST_BUCKETS = ['100', '200', '350', '350plus'];

/**
 * Each group's page address (2026-11-13): one segment, the group's Georgian name in Latin letters
 * with the letter table of the API's Slugs.cs, e.g. /foto-da-video (ფ is "f", as in the category
 * slugs fotografi and floristi). The catalog root stays /vendors and a category's page is /<its
 * slug>. Live URLs: never change one without a redirect. The API's sitemap lists the same nine
 * (SiteAddresses.cs): keep the two equal.
 */
export const GROUP_SLUGS: Record<GroupKey, string> = {
  venues: 'sivrtseebi-da-kveba',
  photo: 'foto-da-video',
  decor: 'dekori-da-qvavilebi',
  music: 'musika-da-gartoba',
  cake: 'torti-da-tkbileuli',
  attire: 'samosi',
  accessories: 'aqsesuarebi',
  beauty: 'silamaze-da-momzadeba',
  other: 'skhva-momsakhurebebi',
};

export const groupBySlug = (slug: string | null | undefined): GroupKey | undefined =>
  GROUPS.find((g) => GROUP_SLUGS[g] === slug);

export const isCategory = (slug: string | null | undefined): boolean => CATEGORIES.some((c) => c.slug === slug);

/** A group's page; the whole catalog without one. */
export const groupPath = (group: GroupKey | null | undefined): string =>
  group && GROUP_SLUGS[group] ? `/${GROUP_SLUGS[group]}` : '/vendors';

/** A category's page; the whole catalog for a slug that has none (retired, or a couple's own budget line). */
export const categoryPath = (slug: string | null | undefined): string =>
  slug && isCategory(slug) ? `/${slug}` : '/vendors';

export const categoriesIn = (group: GroupKey): CategoryRef[] => CATEGORIES.filter((c) => c.group === group);

export const groupOf = (slug: string): GroupKey | undefined => CATEGORIES.find((c) => c.slug === slug)?.group;

/** Categories taken out of the catalog; older saved services and budget rows still name them. */
const RETIRED: Record<string, string> = { gantavseba: 'category.accommodation' };

export const categoryKey = (slug: string): string =>
  CATEGORIES.find((c) => c.slug === slug)?.key ?? RETIRED[slug] ?? slug;

export const cityName = (slug: string): string =>
  CITIES.find((c) => c.slug === slug)?.name ?? slug;

/** Venues and catering price per guest, cakes per kilo, everyone else per event (API default too). */
export const defaultUnit = (group: GroupKey | undefined): PriceUnit =>
  group === 'venues' ? 'guest' : group === 'cake' ? 'kg' : 'event';
