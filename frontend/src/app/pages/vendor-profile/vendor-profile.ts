import {
  Component,
  DOCUMENT,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../i18n/language.service';
import { AuthService } from '../../core/auth.service';
import { VendorService } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { Review, ReviewService } from '../../core/review.service';
import { ContactForm } from '../../components/contact-form/contact-form';

const JSON_LD_ID = 'vendor-jsonld';

@Component({
  selector: 'app-vendor-profile',
  imports: [RouterLink, TranslatePipe, ContactForm],
  templateUrl: './vendor-profile.html',
  styleUrl: './vendor-profile.scss',
})
export class VendorProfile {
  private readonly route = inject(ActivatedRoute);
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

  protected readonly vendor = signal<Vendor | undefined>(undefined);
  protected readonly loaded = signal(false);
  protected readonly activePhoto = signal(0);
  protected readonly lightboxOpen = signal(false);
  protected readonly contactOpen = signal(false);
  private contactTrigger: HTMLElement | null = null;

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
    // Resolve on every param change (handles vendor→vendor navigation). of() is
    // synchronous, so this also runs during SSR and sets meta before serialization.
    this.route.paramMap.subscribe((pm) => {
      const category = pm.get('category') ?? '';
      const city = pm.get('city') ?? '';
      const slug = pm.get('slug') ?? '';
      this.vendorService.getBySlug(category, city, slug).subscribe((v) => {
        this.vendor.set(v);
        this.activePhoto.set(0);
        this.loaded.set(true);
        this.applySeo(v);
        if (v) this.loadReviews(v.id);
        else this.reviews.set([]);
      });
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

  protected openContact(): void {
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

  protected openLightbox(): void {
    if (this.photoCount() === 0) return;
    this.lightboxOpen.set(true);
    this.doc.body.style.overflow = 'hidden'; // lock background scroll
  }

  protected closeLightbox(): void {
    this.lightboxOpen.set(false);
    this.doc.body.style.overflow = '';
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
    this.reviewSvc.list(vendorId).subscribe({
      next: (list) => {
        this.reviews.set(list);
        // Prefill the form with the visitor's existing review so resubmit = edit.
        const mine = list.find((r) => r.mine);
        this.myRating.set(mine?.rating ?? 0);
        this.reviewBody.set(mine?.body ?? '');
      },
      error: () => this.reviews.set([]), // e.g. mock-fallback vendor — no review API
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
  private applySeo(v: Vendor | undefined): void {
    if (!v) {
      this.title.setTitle(this.translate.instant('profile.notFoundTitle'));
      this.removeJsonLd();
      return;
    }

    const category = this.translate.instant(v.categoryKey);
    const brand = this.translate.instant('brand.name');
    const pageTitle = `${v.name} — ${category}, ${v.city} | ${brand}`;
    const description = v.bio.length > 155 ? v.bio.slice(0, 152) + '…' : v.bio;
    const image = v.photos[0]?.url ?? '';

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'profile' });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });

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
    script.text = JSON.stringify(data);
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }
}
