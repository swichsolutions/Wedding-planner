import { Component, DestroyRef, RESPONSE_INIT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PublicSite, WebsiteService } from '../../core/website.service';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';
import { RsvpForm } from '../../components/rsvp-form/rsvp-form';

/** The public invitation at /w/{slug}, and a party's personal copy with its reply form at
 * /w/{slug}/{code} (B6). */
@Component({
  selector: 'app-site-view',
  imports: [RouterLink, TranslatePipe, WeddingSiteView, RsvpForm],
  templateUrl: './site-view.html',
  styleUrl: './site-view.scss',
})
export class SiteView {
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly sites = inject(WebsiteService);
  private readonly destroyRef = inject(DestroyRef);
  // SSR only (null in the browser) — lets a dead slug answer with a real 404.
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly site = signal<PublicSite | null>(null);
  protected readonly notFound = signal(false);
  /** The request failed for another reason (connection, rate limit): the invitation may well
   * exist, so the page offers to try again instead of saying "not found". */
  protected readonly loadFailed = signal(false);
  protected readonly slug: string;
  /** The party's code on a personal link; null on the general one. */
  protected readonly code: string | null;

  constructor() {
    const params = inject(ActivatedRoute).snapshot.paramMap;
    this.slug = params.get('slug') ?? '';
    this.code = params.get('code');
    // A couple's invitation is for their guests, never for search results (the owner's decision,
    // 2026-11-13; robots.txt says the same): noindex from the first render, whatever loads.
    // server.head.ts then adds no canonical or hreflang to it.
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    this.load();
  }

  /** Also the "try again" button of the failed state. */
  protected load(): void {
    const meta = this.meta;
    const responseInit = this.responseInit;
    this.loadFailed.set(false);
    this.sites
      .publicSite(this.slug)
      // A slow response landing after navigation must not retitle the next
      // page or stamp noindex onto it.
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.site.set(s);
          const names = [s.firstName, s.partnerFirstName].filter(Boolean).join(' & ');
          this.title.setTitle(
            names
              ? `${names} — ${this.translate.instant('wsite.eyebrow')}`
              : this.translate.instant('wsite.eyebrow'),
          );
          meta.updateTag({
            name: 'description',
            content: s.message ?? this.translate.instant('wsite.defaultMessage'),
          });
        },
        error: (err: unknown) => {
          // Only a 404 means the invitation is gone. Anything else (a dropped connection,
          // the rate limit) gets its own words and a retry.
          const missing = err instanceof HttpErrorResponse && err.status === 404;
          const keyBase = missing ? 'website.notFound' : 'website.viewError';
          this.notFound.set(missing);
          this.loadFailed.set(!missing);
          this.title.setTitle(this.translate.instant(`${keyBase}Title`));
          // Dead URL: no lingering description/social card from an earlier
          // page, no indexing — and a real 404 status instead of a soft-404.
          // Non-404 failures answer 503 so a live site isn't deindexed over
          // one API hiccup.
          meta.updateTag({
            name: 'description',
            content: this.translate.instant(`${keyBase}Body`),
          });
          meta.removeTag("property='og:title'");
          meta.removeTag("property='og:description'");
          meta.removeTag("property='og:type'");
          meta.removeTag("property='og:image'");
          meta.updateTag({ name: 'robots', content: 'noindex' });
          if (responseInit) responseInit.status = missing ? 404 : 503;
        },
      });
  }
}
