import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { categoryKey } from './catalog';
import { Vendor, VendorFilter } from './vendor.models';

/** API payload — same shape as Vendor, minus the derived category i18n key. */
type VendorDto = Omit<Vendor, 'categoryKey'>;

/**
 * Vendor data access. The API is the single source of truth: list/getBySlug errors
 * propagate so pages can show a real error state. (The old bundled-mock fallback is
 * gone — it silently rendered fake vendors whose ids collided with real ones, so a
 * mock profile's contact form delivered messages to an unrelated real vendor.)
 */
@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(filter: VendorFilter = {}): Observable<Vendor[]> {
    let params = new HttpParams();
    if (filter.category) params = params.set('category', filter.category);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.maxPrice != null) params = params.set('maxPrice', String(filter.maxPrice));
    if (filter.vip) params = params.set('featured', 'true');

    return this.http
      .get<VendorDto[]>(`${this.base}/api/vendors`, { params })
      .pipe(map((dtos) => dtos.map(toVendor)));
  }

  /** Home-page row — decorative, so it degrades to empty (row hides) on error. */
  featured(limit = 4): Observable<Vendor[]> {
    const params = new HttpParams().set('featured', 'true');
    return this.http.get<VendorDto[]>(`${this.base}/api/vendors`, { params }).pipe(
      map((dtos) => dtos.slice(0, limit).map(toVendor)),
      catchError(() => of([] as Vendor[])),
    );
  }

  /** Most-viewed vendors (lifetime profile views) — the home page "Popular" row. */
  popular(limit = 8): Observable<Vendor[]> {
    const params = new HttpParams().set('sort', 'popular');
    return this.http.get<VendorDto[]>(`${this.base}/api/vendors`, { params }).pipe(
      map((dtos) => dtos.slice(0, limit).map(toVendor)),
      catchError(() => of([] as Vendor[])),
    );
  }

  /**
   * Fire-and-forget engagement pings (VendorStat — the future featured-placement
   * sales tool). Failures are swallowed: telemetry must never break the UX.
   */
  trackView(vendorId: number): void {
    this.http
      .post(`${this.base}/api/vendors/${vendorId}/track-view`, null)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  trackContact(vendorId: number): void {
    this.http
      .post(`${this.base}/api/vendors/${vendorId}/track-contact`, null)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  /** Emits undefined when the vendor doesn't exist (404); other errors propagate. */
  getBySlug(categorySlug: string, citySlug: string, slug: string): Observable<Vendor | undefined> {
    return this.http
      .get<VendorDto>(`${this.base}/api/vendors/${categorySlug}/${citySlug}/${slug}`)
      .pipe(
        map((dto): Vendor | undefined => toVendor(dto)),
        catchError((err: HttpErrorResponse) =>
          err.status === 404 ? of(undefined) : throwError(() => err),
        ),
      );
  }
}

/** API DTO → frontend model: derive the category i18n key from its slug. */
function toVendor(dto: VendorDto): Vendor {
  return {
    ...dto,
    categoryKey: categoryKey(dto.categorySlug),
    // The API sends alt: null when the vendor never wrote one, and a null
    // property binding renders the literal string "null" — fall back to
    // descriptive text (real alt/SEO value, and a name for the thumb buttons).
    photos: dto.photos.map((p) => ({ ...p, alt: p.alt || `${dto.name} — ${dto.city}` })),
  };
}
