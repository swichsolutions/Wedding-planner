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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, map, merge, of, switchMap } from 'rxjs';

import { trapTabKey } from '../../core/a11y';
import { LanguageService } from '../../i18n/language.service';
import { AuthService } from '../../core/auth.service';
import { VendorService } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { Review, ReviewService } from '../../core/review.service';
import { ContactForm } from '../../components/contact-form/contact-form';

const JSON_LD_ID = 'vendor-jsonld';

type LoadParams = { category: string; city: string; slug: string };

@Component({
  selector: 'app-vendor-profile',
  imports: [RouterLink, TranslatePipe, ContactForm],
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
  protected readonly submitError = signal(false);
  protected readonly myReview = computed(() => this.reviews().find((r) => r.mine));

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
        this.submitError.set(false);
        if (v) this.loadReviews(v.id);
        else this.reviews.set([]);
        // Dead URLs must answer 404 so crawlers drop them; a transient API
        // failure is 503 so live pages aren't deindexed over a hiccup.
        if (this.responseInit) this.responseInit.status = failed ? 503 : v ? 200 : 404;
        // Engagement stats: one view per loaded profile, browser only — the SSR
        // pass and crawlers must not count.
        this.contactTracked = false;
        if (v && this.isBrowser) this.vendorService.trackView(v.id);
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
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }

  // ---- reviews ----
  private loadReviews(vendorId: number): void {
    // This subscription lives outside the main switchMap, so a vendor→vendor
    // navigation doesn't cancel it: guard each handler against the vendor that
    // is CURRENTLY shown, or a slow response paints vendor A's reviews (and
    // prefills A's draft) onto vendor B's page.
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
    this.submitError.set(false);
    this.reviewSvc.submit(v.id, { rating: this.myRating(), body: this.reviewBody() || null }).subscribe({
      next: (saved) => {
        this.reviews.update((list) => [saved, ...list.filter((r) => !r.mine)]);
        this.refreshAggregate();
        this.submitBusy.set(false);
        this.submitSuccess.set(true);
      },
      error: () => {
        this.submitBusy.set(false);
        this.submitError.set(true);
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

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
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
    const pageTitle = `${v.name} — ${category}, ${v.city} | ${brand}`;
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

    this.setJsonLd({
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
    });
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
