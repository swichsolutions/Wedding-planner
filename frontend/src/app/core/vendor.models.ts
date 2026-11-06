// Frontend-facing vendor models (camelCase), as the API returns them.

import { GroupKey, PriceUnit } from './catalog';

export interface VendorPhoto {
  /** Couples mark portfolio photos for their banner by it (B7). */
  id: number;
  url: string;
  alt: string;
  isRealWedding?: boolean;
}

/** One of a vendor's packages (PROPOSALS.md P5). */
export interface VendorPackage {
  name: string;
  price: number | null;
  priceUnit: PriceUnit;
  /** One item per line. */
  included: string | null;
  duration: string | null;
}

/** The vendor's terms — information only; payments stay between couple and vendor. */
export interface VendorTerms {
  deposit: string | null;
  cancellation: string | null;
  travelPolicy: string | null;
  bookingLeadTime: string | null;
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
  /** Normalized digits with country code — profile renders a wa.me button. */
  whatsapp?: string;
  mapUrl?: string;
  photos: VendorPhoto[];
  isFeatured?: boolean;
  /** Average review rating (1 decimal), null/absent until the first review. */
  rating?: number | null;
  reviewCount?: number;
  // ---- catalog attributes (P1–P5) ----
  group: GroupKey;
  priceUnit: PriceUnit;
  region: string | null;
  servedRegions: string[];
  alsoOffers: string[];
  styles: string[];
  features: string[];
  capacityMin: number | null;
  capacityMax: number | null;
  setting: string | null;
  venueType: string | null;
  /** Profile only: the venue's floor plan image, when it has one. */
  floorPlanUrl: string | null;
  /** Profile only. */
  terms: VendorTerms | null;
  /** Profile only. */
  packages: VendorPackage[];
  /** Profile only: false for an admin-added profile nobody manages yet (no message form). */
  acceptsMessages: boolean;
}

/** Catalog filters — mirrored to URL query params, so every view is shareable. */
export interface VendorFilter {
  group?: string;
  category?: string;
  city?: string;
  region?: string;
  maxPrice?: number;
  styles?: string[];
  guests?: string;
  setting?: string;
  venueType?: string;
  features?: string[];
  q?: string;
  sort?: string;
  /** Only VIP (paid-placement) vendors — the home VIP row's "view all". */
  vip?: boolean;
}
