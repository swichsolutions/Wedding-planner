import { Component, inject, signal } from '@angular/core';
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
          meta.updateTag({
            name: 'description',
            content: s.message ?? this.translate.instant('wsite.defaultMessage'),
          });
        },
        error: () => {
          this.notFound.set(true);
          this.title.setTitle(this.translate.instant('website.notFoundTitle'));
          meta.updateTag({ name: 'robots', content: 'noindex' });
        },
      });
  }
}
