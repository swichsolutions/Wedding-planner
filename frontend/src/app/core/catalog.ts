// Shared catalog constants — categories, cities, style tags. Single source consumed by
// the home page, browse filters, and the mock vendor service. When the real API lands,
// categories/styles come from the backend; this stays as the slug↔i18n-key map.

/** Build a stable Unsplash placeholder URL. Replace with real imagery later. */
export const img = (id: string, w: number): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export interface CategoryRef {
  slug: string;
  key: string; // i18n key, e.g. 'category.photographer'
  img: string;
}

export interface CityRef {
  name: string; // Georgian display name
  slug: string;
}

export interface StyleTagRef {
  slug: string;
  key: string; // i18n key, e.g. 'style.classic'
}

export const CATEGORIES: CategoryRef[] = [
  { slug: 'fotografi', key: 'category.photographer', img: img('photo-1606216794074-735e91aa2c92', 600) },
  { slug: 'darbazi', key: 'category.venue', img: img('photo-1519167758481-83f550bb49b3', 600) },
  { slug: 'dekori', key: 'category.decor', img: img('photo-1478146896981-b80fe463b330', 600) },
  { slug: 'floristi', key: 'category.florist', img: img('photo-1507504031003-b417219a0fde', 600) },
  { slug: 'makiaji', key: 'category.makeup', img: img('photo-1487412947147-5cebf100ffc2', 600) },
  { slug: 'tmis-stili', key: 'category.hair', img: img('photo-1560066984-138dadb4c035', 600) },
  { slug: 'manikiuri', key: 'category.nails', img: img('photo-1632345031435-8727f6897d53', 600) },
  { slug: 'videografi', key: 'category.videographer', img: img('photo-1492691527719-9d1e07e534b4', 600) },
  { slug: 'torti', key: 'category.cake', img: img('photo-1535254973040-607b474cb50d', 600) },
  { slug: 'musika', key: 'category.music', img: img('photo-1511671782779-c97d3d27a1d4', 600) },
  { slug: 'kaba', key: 'category.dress', img: img('photo-1594552072238-b8a33785b261', 600) },
  { slug: 'kostiumi', key: 'category.suit', img: img('photo-1507679799987-c73779587ccf', 600) },
  { slug: 'bechdebi', key: 'category.rings', img: img('photo-1515377905703-c4788e51af15', 600) },
  { slug: 'transporti', key: 'category.transport', img: img('photo-1533473359331-0135ef1b58bf', 600) },
];

export const CITIES: CityRef[] = [
  { name: 'თბილისი', slug: 'tbilisi' },
  { name: 'ბათუმი', slug: 'batumi' },
  { name: 'ქუთაისი', slug: 'kutaisi' },
  { name: 'რუსთავი', slug: 'rustavi' },
  { name: 'თელავი', slug: 'telavi' },
];

export const STYLE_TAGS: StyleTagRef[] = [
  { slug: 'classic', key: 'style.classic' },
  { slug: 'modern', key: 'style.modern' },
  { slug: 'traditional', key: 'style.traditional' },
  { slug: 'minimal', key: 'style.minimal' },
  { slug: 'rustic', key: 'style.rustic' },
];

export const categoryKey = (slug: string): string =>
  CATEGORIES.find((c) => c.slug === slug)?.key ?? slug;

export const cityName = (slug: string): string =>
  CITIES.find((c) => c.slug === slug)?.name ?? slug;
