import { Component, RESPONSE_INIT, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PublicSite, WebsiteService } from '../../core/website.service';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';

/** Public wedding site at /w/{slug} — the page guests open from the shared link. */
@Component({
  selector: 'app-site-view',
  imports: [RouterLink, TranslatePipe, WeddingSiteView],
  templateUrl: './site-view.html',
  styleUrl: './site-view.scss',
})
export class SiteView {
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);

  protected readonly site = signal<PublicSite | null>(null);
  protected readonly notFound = signal(false);

  constructor() {
    const slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
    const meta = inject(Meta);
    // SSR only (null in the browser) — lets a dead slug answer with a real 404.
    const responseInit = inject(RESPONSE_INIT, { optional: true });

    inject(WebsiteService)
      .publicSite(slug)
      .subscribe({
        next: (s) => {
          this.site.set(s);
          const names = [s.firstName, s.partnerFirstName].filter(Boolean).join(' & ');
          this.title.setTitle(
            names
              ? `${names} — ${this.translate.instant('wsite.eyebrow')}`
              : this.translate.instant('wsite.eyebrow'),
          );
          // The site finder sets noindex and never removes it — a live site
          // reached from there must not inherit the tag.
          meta.removeTag("name='robots'");
          meta.updateTag({
            name: 'description',
            content: s.message ?? this.translate.instant('wsite.defaultMessage'),
          });
        },
        error: (err: unknown) => {
          this.notFound.set(true);
          this.title.setTitle(this.translate.instant('website.notFoundTitle'));
          // Dead URL: no lingering description/social card from an earlier
          // page, no indexing — and a real 404 status instead of a soft-404.
          // Non-404 failures answer 503 so a live site isn't deindexed over
          // one API hiccup.
          meta.updateTag({
            name: 'description',
            content: this.translate.instant('website.notFoundBody'),
          });
          meta.removeTag("property='og:title'");
          meta.removeTag("property='og:description'");
          meta.removeTag("property='og:type'");
          meta.removeTag("property='og:image'");
          meta.updateTag({ name: 'robots', content: 'noindex' });
          if (responseInit) {
            responseInit.status =
              err instanceof HttpErrorResponse && err.status === 404 ? 404 : 503;
          }
        },
      });
  }
}
