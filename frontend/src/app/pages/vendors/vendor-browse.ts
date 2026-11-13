import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { VendorService } from '../../core/vendor.service';
import { Vendor, VendorFilter } from '../../core/vendor.models';
import {
  FEATURES,
  GROUPS,
  GUEST_BUCKETS,
  GroupKey,
  REGIONS,
  SETTINGS,
  VENUE_TYPES,
  categoriesIn,
  categoryKey,
  categoryPath,
  defaultUnit,
  groupBySlug,
  groupOf,
  groupPath,
  isCategory,
  stylesFor,
} from '../../core/catalog';
import { LanguageService } from '../../i18n/language.service';
import { formatGel } from '../../core/money';

/** Max-price options per price unit (a venue's 80 ₾ is per guest; a photographer's 1500 per event). */
const PRICE_BUCKETS: Record<string, number[]> = {
  guest: [50, 80, 120, 200],
  kg: [40, 60, 80, 120],
  event: [500, 1000, 2000, 3000, 5000, 10000],
};

/** Features shown as the group's first filter (the rest sit under „მეტი ფილტრი"). */
const PRIMARY_FEATURES: Partial<Record<GroupKey, string[]>> = {
  attire: ['sale', 'rental'],
  beauty: ['comesToYou'],
};

const csv = (v: string | null): string[] | undefined => (v ? v.split(',').filter(Boolean) : undefined);

/**
 * /vendors — „სივრცეები და მომსახურებები" (guide §4): every category on one page. Picking a
 * group or category changes the results and filters in place; every filter lives in the URL,
 * so any view is shareable and server-rendered. A group and a category have addresses of their
 * own (/foto-da-video, /fotografi: the route's `slug`, since 2026-11-13); the filters are
 * parameters on whichever address is open.
 */
@Component({
  selector: 'app-vendor-browse',
  imports: [TranslatePipe, VendorCard, RouterLink],
  host: { class: 'theme-brand' },
  templateUrl: './vendor-browse.html',
  styleUrl: './vendor-browse.scss',
})
export class VendorBrowse {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorService);
  private readonly lang = inject(LanguageService);
  private readonly t = inject(TranslateService);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly groups = GROUPS;
  protected readonly regions = REGIONS;
  protected readonly guestBuckets = GUEST_BUCKETS;
  protected readonly settings = SETTINGS;
  protected readonly venueTypes = VENUE_TYPES;

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  /** The address's own segment: a group's or a category's. None on /vendors. */
  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug'))), { requireSync: true });

  /** Active filter, derived from the URL so every view is shareable/deep-linkable. */
  protected readonly filter = computed<VendorFilter>(() => {
    const p = this.params();
    const slug = this.slug();
    // Ignore non-numeric ?maxPrice (e.g. "abc" → NaN) instead of sending it to the API.
    const maxPrice = Number(p.get('maxPrice'));
    return {
      // The address names the group or the category. ?group= and ?category= are the old form:
      // known values are redirected to their address, so only unknown ones are still read here.
      group: (isCategory(slug) ? undefined : groupBySlug(slug)) ?? p.get('group') ?? undefined,
      category: (isCategory(slug) ? slug : null) ?? p.get('category') ?? undefined,
      city: p.get('city') ?? undefined,
      region: p.get('region') ?? undefined,
      maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
      styles: csv(p.get('styles')),
      guests: p.get('guests') ?? undefined,
      setting: p.get('setting') ?? undefined,
      venueType: p.get('venueType') ?? undefined,
      features: csv(p.get('features')),
      q: p.get('q') ?? undefined,
      sort: p.get('sort') ?? undefined,
      vip: p.get('vip') === '1' || undefined,
    };
  });

  /** The group in view: the address names it, or names one of its categories (/darbazi). */
  protected readonly group = computed<GroupKey | null>(() => {
    const f = this.filter();
    const g = (f.group as GroupKey | undefined) ?? (f.category ? groupOf(f.category) : undefined);
    return g && GROUPS.includes(g) ? g : null;
  });
  protected readonly subtypes = computed(() => {
    const g = this.group();
    return g ? categoriesIn(g) : [];
  });
  protected readonly styles = computed(() => {
    const g = this.group();
    return g ? stylesFor(g) : [];
  });
  protected readonly primaryFeatures = computed(() => PRIMARY_FEATURES[this.group() ?? 'other'] ?? []);
  protected readonly moreFeatures = computed(() => {
    const g = this.group();
    if (!g) return [];
    const primary = this.primaryFeatures();
    return FEATURES[g].filter((f) => !primary.includes(f));
  });
  /** „მეტი ფილტრი" holds the venue type and the remaining features. */
  protected readonly hasMore = computed(() => this.group() === 'venues' || this.moreFeatures().length > 0);
  protected readonly moreOpen = signal(false);

  protected readonly priceUnit = computed(() => defaultUnit(this.group() ?? undefined));
  protected readonly priceBuckets = computed(() => PRICE_BUCKETS[this.priceUnit()] ?? PRICE_BUCKETS['event']);

  protected readonly hasFilters = computed(() => {
    const f = this.filter();
    return !!(f.category || f.city || f.region || f.maxPrice || f.styles || f.guests || f.setting ||
      f.venueType || f.features || f.q || f.vip);
  });

  protected readonly loadError = signal(false);
  /** True until each request answers — the grid shows skeletons, not a false "0 vendors". */
  protected readonly loading = signal(true);
  protected readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7];
  private readonly reload = signal(0);

  // Errors are caught per-request so a failed load can't kill the filter stream.
  protected readonly results = toSignal(
    combineLatest([toObservable(this.filter), toObservable(this.reload)]).pipe(
      switchMap(([f]) => {
        this.loading.set(true);
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

  constructor() {
    // Title + description follow the category or group in view: each is its own search entry at
    // its own address, so a category must not repeat its group's title.
    effect(() => {
      const g = this.group();
      const c = this.filter().category;
      const brand = this.t.instant('brand.name');
      if (g) {
        const name = this.t.instant(
          c && isCategory(c) ? categoryKey(c).replace('category.', 'categoryPlural.') : `catalog.groups.${g}`,
        );
        this.titleService.setTitle(`${name} | ${brand}`);
        this.meta.updateTag({ name: 'description', content: this.t.instant('vendors.metaGroup', { group: name }) });
      } else {
        this.titleService.setTitle(`${this.t.instant('vendors.title')} | ${brand}`);
        this.meta.updateTag({ name: 'description', content: this.t.instant('vendors.metaAll') });
      }
    });
    // A group, a category or a filtered view with no vendors in it is a thin page: out of the
    // index until it has some. (App clears the tag on every navigation; the list loads again
    // after each one, so this runs again too.)
    effect(() => {
      const empty = !this.loading() && !this.loadError() && this.results().length === 0;
      if (empty && (this.group() || this.hasFilters())) this.meta.updateTag({ name: 'robots', content: 'noindex' });
      else this.meta.removeTag("name='robots'");
    });
    // Open „მეტი ფილტრი" when the URL already uses one of its filters.
    effect(() => {
      const f = this.filter();
      if (f.venueType || f.features?.some((x) => this.moreFeatures().includes(x))) this.moreOpen.set(true);
    });
  }

  /** A group's address (/vendors for all of them). A new group starts clean: its link keeps
   * only the search (searchParams). */
  protected readonly groupPath = groupPath;
  protected readonly searchParams = computed<Params>(() => ({ q: this.filter().q ?? null }));

  /** A category chip's address; the first chip is the group's own. The chips keep the filters
   * that are on (filterParams), so with none of them the links carry no parameters. */
  protected readonly categoryPath = categoryPath;
  protected readonly filterParams = computed<Params>(() => ({ ...this.currentParams(), group: null, category: null }));

  protected setParam(key: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ [key]: value || null });
  }

  protected toggleFeature(feature: string): void {
    const current = this.filter().features ?? [];
    const next = current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature];
    this.navigate({ features: next.length ? next.join(',') : null });
  }

  protected isFeatureOn(feature: string): boolean {
    return this.filter().features?.includes(feature) ?? false;
  }

  protected search(event: Event, value: string): void {
    event.preventDefault();
    this.navigate({ q: value.trim() || null });
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  /** Clears the filters but stays in the current group. */
  protected clearFilters(): void {
    this.router.navigate([groupPath(this.group())]);
  }

  protected formatPrice(amount: number): string {
    return formatGel(amount, this.lang.current());
  }

  private currentParams(): Params {
    const p = this.params();
    return Object.fromEntries(p.keys.map((k) => [k, p.get(k)]));
  }

  private navigate(changes: Params): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: changes, queryParamsHandling: 'merge' });
  }
}
