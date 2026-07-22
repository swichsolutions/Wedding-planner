import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { VendorService } from '../../core/vendor.service';
import { Vendor, VendorFilter } from '../../core/vendor.models';
import { CATEGORIES, STYLE_TAGS } from '../../core/catalog';
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
  protected readonly styles = STYLE_TAGS;
  protected readonly priceBuckets = [1000, 2000, 3000, 5000, 10000];

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** Active filter, derived from the URL so browse state is shareable/deep-linkable. */
  protected readonly filter = computed<VendorFilter>(() => {
    const p = this.params();
    const maxPrice = p.get('maxPrice');
    return {
      category: p.get('category') ?? undefined,
      city: p.get('city') ?? undefined,
      style: p.get('style') ?? undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    };
  });

  protected readonly hasFilters = computed(() => {
    const f = this.filter();
    return !!(f.category || f.city || f.style || f.maxPrice);
  });

  protected readonly results = toSignal(
    toObservable(this.filter).pipe(switchMap((f) => this.vendorService.list(f))),
    { initialValue: [] as Vendor[] },
  );

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
