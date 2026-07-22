import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { categoryKey } from './catalog';
import { MOCK_VENDORS } from './mock-vendors';
import { Vendor, VendorFilter } from './vendor.models';

/** API payload — same shape as Vendor, minus the derived category i18n key. */
type VendorDto = Omit<Vendor, 'categoryKey'>;

/**
 * Vendor data access. Calls the .NET API; if it's unreachable (DB/API not up yet) it
 * falls back to the bundled mock so the UI keeps working. Remove the fallback once the
 * backend is the source of truth.
 */
@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /**
   * List vendors. `mockFallback: false` disables the offline mock — required for write
   * paths (e.g. linking a vendor to a budget row), where a mock id must never be persisted.
   */
  list(filter: VendorFilter = {}, options: { mockFallback?: boolean } = {}): Observable<Vendor[]> {
    let params = new HttpParams();
    if (filter.category) params = params.set('category', filter.category);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.style) params = params.set('style', filter.style);
    if (filter.maxPrice != null) params = params.set('maxPrice', String(filter.maxPrice));

    const request$ = this.http
      .get<VendorDto[]>(`${this.base}/api/vendors`, { params })
      .pipe(map((dtos) => dtos.map(toVendor)));

    return options.mockFallback === false
      ? request$
      : request$.pipe(catchError(() => of(this.mockList(filter))));
  }

  featured(limit = 4): Observable<Vendor[]> {
    const params = new HttpParams().set('featured', 'true');
    return this.http.get<VendorDto[]>(`${this.base}/api/vendors`, { params }).pipe(
      map((dtos) => dtos.slice(0, limit).map(toVendor)),
      catchError(() => of(MOCK_VENDORS.filter((v) => v.isFeatured).slice(0, limit))),
    );
  }

  getBySlug(categorySlug: string, citySlug: string, slug: string): Observable<Vendor | undefined> {
    return this.http
      .get<VendorDto>(`${this.base}/api/vendors/${categorySlug}/${citySlug}/${slug}`)
      .pipe(
        map(toVendor),
        catchError(() =>
          of(
            MOCK_VENDORS.find(
              (v) => v.categorySlug === categorySlug && v.citySlug === citySlug && v.slug === slug,
            ),
          ),
        ),
      );
  }

  // ---- mock fallback (filtering mirrors the API) ----
  private mockList(filter: VendorFilter): Vendor[] {
    let result = MOCK_VENDORS.slice();
    if (filter.category) result = result.filter((v) => v.categorySlug === filter.category);
    if (filter.city) result = result.filter((v) => v.citySlug === filter.city);
    if (filter.style) result = result.filter((v) => v.styleSlugs.includes(filter.style!));
    if (filter.maxPrice != null) result = result.filter((v) => v.priceFrom <= filter.maxPrice!);
    result.sort((a, b) => {
      if (!!a.isFeatured !== !!b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.name.localeCompare(b.name, 'ka');
    });
    return result;
  }
}

/** API DTO → frontend model: derive the category i18n key from its slug. */
function toVendor(dto: VendorDto): Vendor {
  return { ...dto, categoryKey: categoryKey(dto.categorySlug) };
}
