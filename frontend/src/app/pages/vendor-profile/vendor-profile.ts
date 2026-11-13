import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, map, merge, of, switchMap } from 'rxjs';

import { trapTabKey } from '../../core/a11y';
import { categoryKey } from '../../core/catalog';
import { cityDisplayEn, cityLocativeKa } from '../../core/city-name';
import { breadcrumbList, catalogTrail, webPage } from '../../core/structured-data';
import { LanguageService } from '../../i18n/language.service';
import { AuthService } from '../../core/auth.service';
import { VendorService } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { Review, ReviewService } from '../../core/review.service';
import { ContactForm } from '../../components/contact-form/contact-form';
import { ShareButton } from '../../components/share-button/share-button';
import { BudgetVendorsService } from '../../core/budget-vendors.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { WishlistService } from '../../core/wishlist.service';
import { MARKABLE_CATEGORIES, PlanPhotosService } from '../../core/plan-photos.service';
import { formatGel } from '../../core/money';
import { formatDate } from '../../core/dates';

const JSON_LD_ID = 'vendor-jsonld';

type LoadParams = { category: string; city: string; slug: string };

@Component({
  selector: 'app-vendor-profile',
  imports: [RouterLink, TranslatePipe, ContactForm, ShareButton],
  host: { class: 'theme-brand' },
  templateUrl: './vendor-profile.html',
  styleUrl: './vendor-profile.scss',
})
export class VendorProfile implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly vendorService = inject(VendorService);
  private readonly reviewSvc = inject(ReviewService);
  protected readonly auth = inject(AuthService);
  protected readonly budgetVendors = inject(BudgetVendorsService);
  protected readonly wishlist = inject(WishlistService);
  protected readonly planPhotos = inject(PlanPhotosService);

  /** Couples can mark venue, décor, flower, rental and cake photos for their banner (B7). */
  protected readonly canMark = computed(
    () => this.auth.isCouple() && MARKABLE_CATEGORIES.includes(this.vendor()?.categorySlug ?? ''),
  );

  protected isMarked(photoId: number): boolean {
    return !!this.planPhotos.markedVendorPhoto(photoId);
  }
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** SSR only (null in the browser) — lets a dead URL answer with a real 404. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly vendor = signal<Vendor | undefined>(undefined);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  private lastParams: LoadParams | null = null;
  private readonly retry$ = new Subject<LoadParams>();
  protected readonly activePhoto = signal(0);
  protected readonly lightboxOpen = signal(false);
  protected readonly contactOpen = signal(false);
  private contactTrigger: HTMLElement | null = null;
  /** One ContactClick per profile visit — the first interaction counts, repeats don't inflate. */
  private contactTracked = false;

  // ---- reviews ----
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly reviews = signal<Review[]>([]);
  protected readonly myRating = signal(0);
  protected readonly hoverRating = signal(0);
  protected readonly reviewBody = signal('');
  protected readonly ratingMissing = signal(false);
  protected readonly submitBusy = signal(false);
  protected readonly submitSuccess = signal(false);
  /** i18n key of the review form's failure message, or null. */
  protected readonly submitError = signal<string | null>(null);
  protected readonly myReview = computed(() => this.reviews().find((r) => r.mine));
  /** The account (email, null when signed out) the shown reviews were fetched for. */
  private reviewsFor: string | null = null;

  constructor() {
    // Route params and manual retries feed ONE stream; switchMap cancels the
    // in-flight request whenever either emits, so a slow older response can
    // never land after a newer navigation and write the wrong vendor's
    // title/meta/JSON-LD. paramMap emits synchronously, so SSR still resolves
    // the vendor (and its meta) before serialization.
    merge(
      this.route.paramMap.pipe(
        map((pm) => ({
          category: pm.get('category') ?? '',
          city: pm.get('city') ?? '',
          slug: pm.get('slug') ?? '',
        })),
      ),
      this.retry$,
    )
      .pipe(
        switchMap((params) => {
          this.lastParams = params;
          this.loadError.set(false);
          // Back to the skeleton while fetching — also on vendor→vendor
          // navigation, where the previous vendor's page would otherwise linger.
          this.loaded.set(false);
          this.vendor.set(undefined);
          return this.vendorService.getBySlug(params.category, params.city, params.slug).pipe(
            map((v) => ({ v, failed: false })),
            catchError(() => of({ v: undefined as Vendor | undefined, failed: true })),
          );
        }),
        // retry$ never completes, so without this the subscription outlives the
        // component: a slow response would land after navigation and rewrite the
        // NEXT page's title/meta/JSON-LD (and count a phantom profile view).
        takeUntilDestroyed(),
      )
      .subscribe(({ v, failed }) => {
        this.vendor.set(v);
        this.activePhoto.set(0);
        this.loaded.set(true);
        this.loadError.set(failed);
        this.applySeo(v, failed);
        // Fresh page = fresh review form: without this, vendor→vendor navigation
        // carries the previous vendor's draft/rating/"review saved" state onto
        // the new page (loadReviews re-prefills from the visitor's own review).
        this.myRating.set(0);
        this.hoverRating.set(0);
        this.reviewBody.set('');
        this.ratingMissing.set(false);
        this.submitSuccess.set(false);
        this.submitError.set(null);
        if (v) this.loadReviews(v.id);
        else this.reviews.set([]);
        // Their city changed since this address was shared: send everyone on, permanently.
        if (v && v.citySlug && v.citySlug !== this.lastParams?.city) {
          const to = `/${v.categorySlug}/${v.citySlug}/${v.slug}`;
          if (this.responseInit) {
            this.responseInit.status = 301;
            this.responseInit.headers = { Location: to };
          } else {
            void this.router.navigateByUrl(to, { replaceUrl: true });
          }
          return;
        }
        // Dead URLs must answer 404 so crawlers drop them; a transient API
        // failure is 503 so live pages aren't deindexed over a hiccup.
        if (this.responseInit) this.responseInit.status = failed ? 503 : v ? 200 : 404;
        // Engagement stats: one view per loaded profile, browser only — the SSR
        // pass and crawlers must not count.
        this.contactTracked = false;
        if (v && this.isBrowser) this.vendorService.trackView(v.id);
      });

    // The language switch leaves this page open (a review draft must survive it, see
    // App.redrawPublicPage), so the title and description are written again in the new language.
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.loaded()) this.applySeo(this.vendor(), this.loadError());
    });

    // A couple who signs in through the header window stays on this page, and the reviews
    // were fetched before that: without their own review marked `mine` they would get an
    // empty form for a review they already wrote. Fetch again when the account changes
    // (signing out too: the form must not keep the last couple's review). user() only wakes
    // the effect; the comparison reads sessionUser(), which doesn't blink at hydration.
    effect(() => {
      this.auth.user();
      const v = untracked(this.vendor);
      if (v && this.reviewsFor !== (this.auth.sessionUser()?.email ?? null)) {
        untracked(() => this.loadReviews(v.id));
      }
    });

    // Move focus into the contact dialog when it opens (a11y focus management).
    // setTimeout (macrotask) so the child <app-contact-form> inputs have rendered.
    effect(() => {
      if (!this.isBrowser || !this.contactOpen()) return;
      setTimeout(() => {
        const card = this.host.nativeElement.querySelector('.cmodal');
        // Prefer the first field so the user can type immediately; fall back to the close button.
        const el = (card?.querySelector('#cf-name') ??
          card?.querySelector('.cmodal__close')) as HTMLElement | null;
        el?.focus();
      });
    });
  }

  protected retryLoad(): void {
    if (this.lastParams) this.retry$.next(this.lastParams);
  }

  /** Current app URL for sign-in returnUrl (mirrors the vendor-card save flow). */
  protected currentUrl(): string {
    return this.router.url;
  }

  /** "Up" goes to the vendor's own category×city landing page, not the generic browse. */
  protected backLink(): string {
    const v = this.vendor();
    // no city name, no landing page (it answers 404): back to the catalog then
    return v && v.categorySlug && v.citySlug && v.city.trim() ? `/${v.categorySlug}/${v.citySlug}` : '/vendors';
  }

  protected backLabel(): string {
    const v = this.vendor();
    if (!v || !v.categorySlug || !v.citySlug || !v.city.trim()) return this.translate.instant('profile.backToVendors');
    const plural = this.translate.instant(
      categoryKey(v.categorySlug).replace('category.', 'categoryPlural.'),
    );
    return this.lang.current() === 'en'
      ? `${plural} in ${cityDisplayEn(v.citySlug)}`
      : `${plural} ${cityLocativeKa(v.city)}`;
  }

  // ---- "add to my budget list" ----

  /** Guests see it (it routes to sign-up); a signed-in vendor/admin gets nothing. */
  protected readonly showAddToBudget = computed(() => !this.auth.user() || this.auth.isCouple());

  protected readonly inBudget = computed(() => {
    const v = this.vendor();
    return !!v && this.budgetVendors.hasVendor(v.id);
  });

  /** Guards the whole confirm→add round trip — a double-click (or a double-click on
   *  the confirm dialog's button) must add the vendor once, not twice. */
  protected readonly addingToBudget = signal(false);

  protected addToBudget(): void {
    const v = this.vendor();
    if (!v || this.addingToBudget()) return;

    if (!this.auth.isCouple()) {
      this.router.navigate(['/signup'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.budgetVendors.hasVendor(v.id)) return; // already added — button shows that state

    // A different vendor already occupies this category (e.g. another photographer) —
    // confirm before adding a second one, rather than silently duplicating the slot.
    const existing = this.budgetVendors.itemsInCategory(v.categorySlug);
    if (existing.length > 0) {
      this.addingToBudget.set(true); // held through the confirm dialog too, not just the request
      void this.confirmSvc
        .confirm({
          title: 'profile.addToListConfirmTitle',
          body: 'profile.addToListConfirmBody',
          detail: this.translate.instant(v.categoryKey),
          confirmLabel: 'profile.addToListConfirmBtn',
        })
        .then((ok) => {
          if (ok) this.doAddToBudget(v);
          else this.addingToBudget.set(false);
        });
      return;
    }
    this.addingToBudget.set(true);
    this.doAddToBudget(v);
  }

  private doAddToBudget(v: Vendor): void {
    this.budgetVendors
      // the unit goes along: a per-guest / per-kg / per-hour price is not the whole planned amount
      .addVendor({ id: v.id, name: v.name, categorySlug: v.categorySlug, priceFrom: v.priceFrom, priceUnit: v.priceUnit })
      .subscribe({
        next: () => {
          this.addingToBudget.set(false);
          this.toast.success('profile.addToListDone');
        },
        error: () => {
          this.addingToBudget.set(false);
          this.toast.error('budgetPage.saveError');
        },
      });
  }

  /** Called from every contact affordance (call/WhatsApp/social/map/message). */
  protected trackContact(): void {
    const v = this.vendor();
    if (!v || this.contactTracked || !this.isBrowser) return;
    this.contactTracked = true;
    this.vendorService.trackContact(v.id);
  }

  protected openContact(): void {
    this.trackContact();
    this.contactTrigger = this.doc.activeElement as HTMLElement | null;
    this.contactOpen.set(true);
    this.doc.body.style.overflow = 'hidden'; // lock background scroll
  }

  protected closeContact(): void {
    this.contactOpen.set(false);
    this.doc.body.style.overflow = '';
    this.contactTrigger?.focus(); // restore focus to the trigger (a11y)
    this.contactTrigger = null;
  }

  /** Close when the dimmed backdrop (not the card) is clicked. */
  protected onContactBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeContact();
  }

  protected selectPhoto(i: number): void {
    this.activePhoto.set(i);
  }

  private photoCount(): number {
    return this.vendor()?.photos.length ?? 0;
  }

  protected prev(): void {
    const n = this.photoCount();
    if (n > 1) this.activePhoto.update((i) => (i - 1 + n) % n);
  }

  protected next(): void {
    const n = this.photoCount();
    if (n > 1) this.activePhoto.update((i) => (i + 1) % n);
  }

  private lightboxTrigger: HTMLElement | null = null;

  protected openLightbox(): void {
    if (this.photoCount() === 0) return;
    this.lightboxTrigger = this.doc.activeElement as HTMLElement | null;
    this.lightboxOpen.set(true);
    this.doc.body.style.overflow = 'hidden'; // lock background scroll
    if (this.isBrowser) {
      // setTimeout: the dialog renders after this handler returns.
      setTimeout(() =>
        (this.host.nativeElement.querySelector('.lightbox__close') as HTMLElement | null)?.focus(),
      );
    }
  }

  protected closeLightbox(): void {
    this.lightboxOpen.set(false);
    this.doc.body.style.overflow = '';
    this.lightboxTrigger?.focus(); // back to the zoom button that opened it (a11y)
    this.lightboxTrigger = null;
  }

  /** Keep Tab cycling inside whichever dialog is open (lightbox / contact modal). */
  protected onOverlayKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.contactOpen()) {
      if (event.key === 'Escape') this.closeContact();
      return;
    }
    if (!this.lightboxOpen()) return;
    if (event.key === 'Escape') this.closeLightbox();
    else if (event.key === 'ArrowLeft') this.prev();
    else if (event.key === 'ArrowRight') this.next();
  }

  protected formatPrice(amount: number): string {
    return formatGel(amount, this.lang.current());
  }

  /** „შეინახე ჩემს ქორწილში" (guide §4): saving is a couple-account feature, so anyone else
   * goes to sign-up first and comes back here. Saving never means booked. */
  protected toggleSave(v: Vendor): void {
    if (!this.auth.isCouple()) {
      // Back here after sign-up, with the vendor saved (WishlistService.rememberSave).
      this.wishlist.rememberSave(v.id);
      this.router.navigate(['/signup'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.wishlist.toggle(v.id);
  }

  /** Package "what's included": one item per line. */
  protected lines(text: string | null): string[] {
    return (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  }

  /** The profile's facts block has something to show (region, venue facts, styles…). */
  protected hasDetails(v: Vendor): boolean {
    if (v.floorPlanUrl) return true; // a venue with only its floor plan still gets the section
    return !!(v.region || v.servedRegions.length || v.alsoOffers.length || v.styles.length ||
      v.features.length || v.capacityMax || v.setting || v.venueType);
  }

  protected catKey(slug: string): string {
    return categoryKey(slug);
  }

  /** "სიღნაღი, კახეთი" — but just "თბილისი" when the city and the region are the same. */
  protected cityLabel(v: Vendor): string {
    return this.lang.current() === 'en' && v.citySlug ? cityDisplayEn(v.citySlug) : v.city;
  }

  protected locationLabel(v: Vendor): string {
    const region = v.region ? this.translate.instant(`catalog.regions.${v.region}`) : '';
    const city = v.city ? this.cityLabel(v) : '';
    if (!city) return region;
    return region && region !== v.city ? `${city}, ${region}` : city;
  }

  // ---- reviews ----
  private loadReviews(vendorId: number): void {
    // This subscription lives outside the main switchMap, so a vendor→vendor
    // navigation doesn't cancel it: guard each handler against the vendor that
    // is CURRENTLY shown, or a slow response paints vendor A's reviews (and
    // prefills A's draft) onto vendor B's page.
    this.reviewsFor = this.auth.sessionUser()?.email ?? null;
    this.reviewSvc
      .list(vendorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          if (this.vendor()?.id !== vendorId) return; // stale — a newer page owns the form
          this.reviews.set(list);
          // Prefill the form with the visitor's existing review so resubmit = edit.
          const mine = list.find((r) => r.mine);
          this.myRating.set(mine?.rating ?? 0);
          this.reviewBody.set(mine?.body ?? '');
        },
        error: () => {
          if (this.vendor()?.id !== vendorId) return;
          this.reviews.set([]);
        },
      });
  }

  protected pickRating(star: number): void {
    this.myRating.set(star);
    this.ratingMissing.set(false);
    this.submitSuccess.set(false);
  }

  protected submitReview(): void {
    const v = this.vendor();
    if (!v) return;
    if (!this.myRating()) {
      this.ratingMissing.set(true);
      return;
    }
    this.submitBusy.set(true);
    this.submitSuccess.set(false);
    this.submitError.set(null);
    this.reviewSvc.submit(v.id, { rating: this.myRating(), body: this.reviewBody() || null }).subscribe({
      next: (saved) => {
        // By id as well as by `mine`: a list fetched before signing in has this couple's
        // earlier review without the mark, and it would then show twice.
        this.reviews.update((list) => [saved, ...list.filter((r) => !r.mine && r.id !== saved.id)]);
        this.refreshAggregate();
        this.submitBusy.set(false);
        this.submitSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitBusy.set(false);
        // 429 is the rate limit: "check your connection" would be the wrong advice
        this.submitError.set(err.status === 429 ? 'pwReset.tooMany' : 'reviews.error');
      },
    });
  }

  /** Keep the header ★-average honest after a submit, without a refetch. */
  private refreshAggregate(): void {
    const v = this.vendor();
    if (!v) return;
    const list = this.reviews();
    const count = list.length;
    const rating = count
      ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : null;
    this.vendor.set({ ...v, rating, reviewCount: count });
  }

  protected round(value: number | null | undefined): number {
    return Math.round(value ?? 0);
  }

  /** Georgian month names spelled out, the same on server and browser (core/dates). */
  protected formatDate(iso: string): string {
    return formatDate(iso, this.lang.current());
  }

  /** Build a social URL from a handle or a full URL. */
  protected socialUrl(value: string, base: string): string {
    const v = value.trim();
    return /^https?:\/\//i.test(v) ? v : base + v.replace(/^@/, '');
  }

  /** Ensure a pasted URL has a scheme (for the Google Maps link). */
  protected ensureHttp(value: string): string {
    const v = value.trim();
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }

  // ---- SEO: per-page title/description + schema.org JSON-LD ----
  private applySeo(v: Vendor | undefined, failed = false): void {
    if (!v) {
      // Dead URL: the previous page's description/social card must not linger
      // here, and the page must not be indexed (paired with the 404/503 status).
      // A transient failure is titled as such — "not found" would be a lie
      // about a vendor that exists (the template shows a Retry view).
      const keyBase = failed ? 'profile.loadError' : 'profile.notFound';
      this.title.setTitle(this.translate.instant(`${keyBase}Title`));
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

    const category = this.translate.instant(v.categoryKey);
    const brand = this.translate.instant('brand.name');
    const pageTitle = `${v.name} — ${category}, ${this.cityLabel(v)} | ${brand}`;
    const description = v.bio.length > 155 ? v.bio.slice(0, 152) + '…' : v.bio;
    const image = v.photos[0]?.url ?? '';

    this.title.setTitle(pageTitle);
    // A live profile is public: drop any noindex left by a not-found state
    // (or by a noindex page visited earlier in the same session).
    this.meta.removeTag("name='robots'");
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'profile' });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });
    else this.meta.removeTag("property='og:image'"); // no photos → no borrowed card image

    // Where the profile sits: the catalog down to its category, then its city's page (the
    // profile's own "back" link) when there is one.
    const path = `/${v.categorySlug}/${v.citySlug}/${v.slug}`;
    const tr = (key: string): string => this.translate.instant(key);
    const landing = this.backLink();
    const trail = [
      ...catalogTrail(tr, null, v.categorySlug),
      ...(landing !== '/vendors' ? [{ name: this.backLabel(), path: landing }] : []),
      { name: v.name, path },
    ];

    this.setJsonLd([
      this.businessJsonLd(v),
      webPage('WebPage', { name: v.name, description, path, lang: this.lang.current() }),
      breadcrumbList(trail),
    ]);
  }

  /** The vendor as a schema.org LocalBusiness, from the profile's real data only. */
  private businessJsonLd(v: Vendor) {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: v.name,
      description: v.bio,
      image: v.photos.map((p) => p.url),
      address: {
        '@type': 'PostalAddress',
        addressLocality: v.city,
        addressCountry: 'GE',
      },
      priceRange: v.priceRange,
      telephone: v.phone,
      // Where they work: their own region plus the ones they travel to (real data only).
      ...((v.region || v.servedRegions.length)
        ? {
            areaServed: [v.region, ...v.servedRegions]
              .filter((r): r is string => !!r)
              .map((r) => ({ '@type': 'AdministrativeArea', name: this.translate.instant(`catalog.regions.${r}`) })),
          }
        : {}),
      // Packages as offers, so search engines see what's sold and from what price.
      ...(v.packages.length
        ? {
            makesOffer: v.packages.map((p) => ({
              '@type': 'Offer',
              name: p.name,
              ...(p.price ? { price: p.price, priceCurrency: 'GEL' } : {}),
              ...(p.included ? { description: this.lines(p.included).join('; ') } : {}),
            })),
          }
        : {}),
      ...(v.reviewCount
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: v.rating,
              reviewCount: v.reviewCount,
              bestRating: 5,
            },
          }
        : {}),
    };
  }

  private setJsonLd(data: unknown): void {
    this.removeJsonLd();
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escape "<" so vendor-supplied text (bio, name) can't break out of the
    // script tag in server-rendered HTML — JSON.stringify alone doesn't do this.
    script.text = JSON.stringify(data).replace(/</g, '\\u003C');
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }

  ngOnDestroy(): void {
    // The mobile back button destroys the component while the lightbox or contact
    // modal may still be open — release the body scroll lock or the whole site
    // stays frozen. Also drop this vendor's JSON-LD so it can't describe the next page.
    this.doc.body.style.overflow = '';
    this.removeJsonLd();
  }
}
