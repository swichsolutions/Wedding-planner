import {
  Component,
  DOCUMENT,
  OnDestroy,
  RESPONSE_INIT,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, forkJoin, map, merge, of, switchMap } from 'rxjs';

import { LanguageService } from '../../i18n/language.service';
import { VendorCard } from '../../components/vendor-card/vendor-card';
import { VendorService, Pairing } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { CATEGORIES, categoryKey, cityName } from '../../core/catalog';
import { cityDisplayEn, cityLocativeKa } from '../../core/city-name';

const JSON_LD_ID = 'landing-jsonld';

type LoadParams = { category: string; city: string };

/**
 * Category×city SEO landing page (/fotografi/tbilisi) — the search-facing front
 * door for "wedding photographers in Tbilisi"-shaped queries. Editorial opener
 * (overline → display H1 → data-built standfirst) over the standard photo grid,
 * with pairing cross-links as the internal-linking backbone. Empty or unknown
 * pairings answer a real 404 + noindex: thin doorway pages must not be indexed.
 */
@Component({
  selector: 'app-category-city',
  imports: [RouterLink, TranslatePipe, VendorCard],
  templateUrl: './category-city.html',
  styleUrl: './category-city.scss',
})
export class CategoryCity implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly vendorService = inject(VendorService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  private readonly doc = inject(DOCUMENT);
  /** SSR only (null in the browser) — dead pairings answer with a real 404. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly vendors = signal<Vendor[]>([]);
  protected readonly pairings = signal<Pairing[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly categorySlug = signal('');
  protected readonly citySlug = signal('');
  protected readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7];

  private lastParams: LoadParams | null = null;
  private readonly retry$ = new Subject<LoadParams>();

  // ---- derived facts (the standfirst/meta are built from REAL data) ----

  /** Lowest non-zero starting price, or null when no vendor lists one. */
  protected readonly fromPrice = computed(() => {
    const priced = this.vendors().map((v) => v.priceFrom).filter((p) => p > 0);
    return priced.length ? Math.min(...priced) : null;
  });

  private readonly rated = computed(() => this.vendors().filter((v) => v.rating != null));

  /** Mean rating (1 decimal) — only shown once ≥3 vendors carry ratings. */
  protected readonly avgRating = computed(() => {
    const rated = this.rated();
    if (rated.length < 3) return null;
    return Math.round((rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length) * 10) / 10;
  });

  /** Best-rated vendor (review count breaks ties) — woven into the standfirst. */
  protected readonly topVendor = computed(() => {
    const rated = this.rated();
    if (!rated.length) return null;
    return [...rated].sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    )[0];
  });

  // ---- display strings (computed so a language switch re-renders them) ----

  private pluralKey(): string {
    return categoryKey(this.categorySlug()).replace('category.', 'categoryPlural.');
  }

  /** Georgian city display name — from the data itself, catalog as fallback. */
  private cityKa(): string {
    return this.vendors()[0]?.city || cityName(this.citySlug());
  }

  protected readonly h1 = computed(() => {
    const en = this.lang.current() === 'en';
    const plural = this.translate.instant(this.pluralKey());
    return en
      ? `${plural} in ${cityDisplayEn(this.citySlug())}`
      : `${plural} ${cityLocativeKa(this.cityKa())}`;
  });

  /** 1–3 data-driven sentences — the page's unique intro AND its meta description. */
  protected readonly standfirst = computed(() => {
    void this.lang.current();
    const count = this.vendors().length;
    if (!count) return '';
    const parts: string[] = [];
    if (count === 1) {
      parts.push(this.translate.instant('landing.standfirstOne', { name: this.vendors()[0].name }));
    } else {
      parts.push(this.translate.instant('landing.standfirstCount', { count }));
    }
    const price = this.fromPrice();
    if (price !== null) {
      parts.push(this.translate.instant('landing.standfirstPrice', { price: this.formatPrice(price) }));
    }
    const rating = this.avgRating();
    const top = this.topVendor();
    if (count > 1 && rating !== null && top) {
      parts.push(this.translate.instant('landing.standfirstRated', { rating, top: top.name }));
    }
    return parts.join(' ');
  });

  protected readonly otherCitiesHeading = computed(() => {
    void this.lang.current();
    return this.translate.instant('landing.otherCities', {
      category: this.translate.instant(this.pluralKey()),
    });
  });

  protected readonly moreInCityHeading = computed(() => {
    void this.lang.current();
    const city =
      this.lang.current() === 'en'
        ? cityDisplayEn(this.citySlug())
        : cityLocativeKa(this.cityKa());
    return this.translate.instant('landing.moreInCity', { city });
  });

  // ---- cross-links (the internal-linking backbone; hidden rows when empty) ----

  protected readonly crossCities = computed(() => {
    void this.lang.current();
    const en = this.lang.current() === 'en';
    return this.pairings()
      .filter((p) => p.categorySlug === this.categorySlug() && p.citySlug !== this.citySlug())
      .map((p) => ({
        link: `/${p.categorySlug}/${p.citySlug}`,
        label: en ? cityDisplayEn(p.citySlug) : p.city,
        count: p.count,
      }));
  });

  protected readonly crossCategories = computed(() => {
    void this.lang.current();
    return this.pairings()
      .filter(
        (p) =>
          p.citySlug === this.citySlug() &&
          p.categorySlug !== this.categorySlug() &&
          CATEGORIES.some((c) => c.slug === p.categorySlug),
      )
      .map((p) => ({
        link: `/${p.categorySlug}/${p.citySlug}`,
        label: this.translate.instant(
          categoryKey(p.categorySlug).replace('category.', 'categoryPlural.'),
        ),
        count: p.count,
      }));
  });

  constructor() {
    // Params + retries feed one switchMap so a slow older response can't write a
    // stale page (same contract as vendor-profile); takeUntilDestroyed keeps a
    // late response from retitling the NEXT page. paramMap emits synchronously,
    // so SSR resolves data + meta before serialization.
    merge(
      this.route.paramMap.pipe(
        map((pm) => ({ category: pm.get('category') ?? '', city: pm.get('city') ?? '' })),
      ),
      this.retry$,
    )
      .pipe(
        switchMap((params) => {
          this.lastParams = params;
          this.categorySlug.set(params.category);
          this.citySlug.set(params.city);
          this.loadError.set(false);
          this.loaded.set(false);
          this.vendors.set([]);
          // Unknown category slug → straight to the 404 state, no API round-trip.
          if (!CATEGORIES.some((c) => c.slug === params.category)) {
            return of({ vendors: [] as Vendor[], pairs: [] as Pairing[], failed: false });
          }
          return forkJoin({
            vendors: this.vendorService.list({ category: params.category, city: params.city }),
            // Cross-links are enrichment — their failure must not sink the page.
            pairs: this.vendorService.pairings().pipe(catchError(() => of([] as Pairing[]))),
          }).pipe(
            map((r) => ({ ...r, failed: false })),
            catchError(() => of({ vendors: [] as Vendor[], pairs: [] as Pairing[], failed: true })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ vendors, pairs, failed }) => {
        this.vendors.set(vendors);
        this.pairings.set(pairs);
        this.loaded.set(true);
        this.loadError.set(failed);
        this.applySeo(vendors, failed);
        // Empty pairing = thin doorway page → 404 so crawlers drop it; transient
        // API failure = 503 so a live page isn't deindexed over a hiccup.
        if (this.responseInit) this.responseInit.status = failed ? 503 : vendors.length ? 200 : 404;
      });
  }

  protected retryLoad(): void {
    if (this.lastParams) this.retry$.next(this.lastParams);
  }

  protected formatPrice(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }

  // ---- SEO ----
  private applySeo(vendors: Vendor[], failed: boolean): void {
    const brand = this.translate.instant('brand.name');

    if (failed || !vendors.length) {
      const keyBase = failed ? 'vendors.loadError' : 'landing.notFound';
      this.title.setTitle(`${this.translate.instant(`${keyBase}Title`)} | ${brand}`);
      this.meta.updateTag({
        name: 'description',
        content: this.translate.instant(`${keyBase}Body`),
      });
      this.meta.removeTag("property='og:title'");
      this.meta.removeTag("property='og:description'");
      this.meta.removeTag("property='og:type'");
      this.meta.removeTag("property='og:image'");
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      this.removeJsonLd();
      return;
    }

    const count = vendors.length;
    const countStr =
      count === 1
        ? this.translate.instant('landing.titleCountOne')
        : this.translate.instant('landing.titleCountMany', { count });
    const price = this.fromPrice();
    const priceStr =
      price !== null ? `, ${this.translate.instant('landing.titleFrom', { price: this.formatPrice(price) })}` : '';
    const pageTitle = `${this.h1()} — ${countStr}${priceStr} | ${brand}`;
    const standfirst = this.standfirst();
    const description = standfirst.length > 158 ? standfirst.slice(0, 155) + '…' : standfirst;
    const image = vendors[0].photos[0]?.url ?? '';

    this.title.setTitle(pageTitle);
    // A stocked landing page is public: drop any noindex a prior state left behind.
    this.meta.removeTag("name='robots'");
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });
    else this.meta.removeTag("property='og:image'");

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: this.h1(),
      numberOfItems: count,
      itemListElement: vendors.map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: v.name,
        url: `/${v.categorySlug}/${v.citySlug}/${v.slug}`,
      })),
    });
  }

  private setJsonLd(data: unknown): void {
    this.removeJsonLd();
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escape "<" so vendor-supplied names can't break out of the script tag in
    // server-rendered HTML — JSON.stringify alone doesn't do this.
    script.text = JSON.stringify(data).replace(/</g, '\\u003C');
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }

  ngOnDestroy(): void {
    // This pairing's ItemList must not describe whatever page comes next.
    this.removeJsonLd();
  }
}
