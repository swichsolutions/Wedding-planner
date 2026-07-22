// Frontend-facing vendor models (camelCase). These mirror the backend domain entities
// (CLAUDE.md §7) but only carry what the UI needs. The mock service returns these today;
// an HTTP service will return the same shapes from the API later.

export interface VendorPhoto {
  url: string;
  alt: string;
  isRealWedding?: boolean;
}

export interface Vendor {
  id: number;
  name: string;
  slug: string;
  categorySlug: string;
  categoryKey: string;
  city: string;
  citySlug: string;
  areasServed?: string;
  priceFrom: number;
  priceRange?: string;
  bio: string;
  instagram?: string;
  facebook?: string;
  phone?: string;
  mapUrl?: string;
  styleSlugs: string[];
  photos: VendorPhoto[];
  isFeatured?: boolean;
}

/** Filters accepted by the browse page (and mirrored to URL query params). */
export interface VendorFilter {
  category?: string;
  city?: string;
  maxPrice?: number;
  style?: string;
}
