import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, of, switchMap, tap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { VendorService } from '../../core/vendor.service';
import { Vendor, VendorFilter } from '../../core/vendor.models';
import { CATEGORIES } from '../../core/catalog';
import { LanguageService } from '../../i18n/language.service';

@Component({
  selector: 'app-vendor-browse',
  imports: [TranslatePipe, VendorCard],
  templateUrl: './vendor-browse.html',
  styleUrl: './vendor-browse.scss',
})
export class VendorBrowse {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorService);
  private readonly lang = inject(LanguageService);

  protected readonly categories = CATEGORIES;
  protected readonly priceBuckets = [1000, 2000, 3000, 5000, 10000];

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** Active filter, derived from the URL so browse state is shareable/deep-linkable. */
  protected readonly filter = computed<VendorFilter>(() => {
    const p = this.params();
    // Ignore non-numeric ?maxPrice (e.g. "abc" → NaN) instead of sending it to the API.
    const maxPrice = Number(p.get('maxPrice'));
    return {
      category: p.get('category') ?? undefined,
      city: p.get('city') ?? undefined,
      maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
      vip: p.get('vip') === '1' || undefined,
    };
  });

  protected readonly hasFilters = computed(() => {
    const f = this.filter();
    return !!(f.category || f.city || f.maxPrice || f.vip);
  });

  protected readonly loadError = signal(false);
  /** True until each request answers — the grid shows skeletons, not a false "0 vendors". */
  protected readonly loading = signal(true);
  protected readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7];
  private readonly reload = signal(0);

  // Errors are caught per-request so a failed load can't kill the filter stream —
  // and never silently replaced with mock data (mock ids collide with real ones).
  protected readonly results = toSignal(
    combineLatest([toObservable(this.filter), toObservable(this.reload)]).pipe(
      switchMap(([f]) => {
        this.loading.set(true);
        // Cleared at request start, not on success — the template checks the
        // error branch first, so a lingering flag would make Retry look dead.
        this.loadError.set(false);
        return this.vendorService.list(f).pipe(
          tap(() => this.loading.set(false)),
          catchError(() => {
            this.loading.set(false);
            this.loadError.set(true);
            return of([] as Vendor[]);
          }),
        );
      }),
    ),
    { initialValue: [] as Vendor[] },
  );

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected onFilterChange(key: keyof VendorFilter, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value || null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected formatPrice(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }
}
