import { Component, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ContentApiService } from '../../core/content-api.service';
import { ContentDetail } from '../../core/content.models';
import { formatDate } from '../../core/dates';
import { renderMarkdown } from '../../core/markdown';
import { LanguageService } from '../../i18n/language.service';
import { NotFound } from '../not-found/not-found';

/**
 * /terms and /privacy. The text is written in the admin content editor (type "legal");
 * until it's published the URL is an honest 404 rather than a placeholder page.
 */
@Component({
  selector: 'app-legal-page',
  imports: [TranslatePipe, NotFound],
  host: { class: 'theme-brand' },
  styleUrl: './legal-page.scss',
  template: `
    @if (missing()) {
      <app-not-found />
    } @else if (failed()) {
      <section class="static-page static-page--center">
        <p role="alert">{{ 'legal.loadError' | translate }}</p>
      </section>
    } @else if (page()) {
      <article class="static-page legal">
        <h1>{{ title() }}</h1>
        @if (updated()) {
          <p class="legal__updated">{{ 'legal.updated' | translate }} {{ updated() }}</p>
        }
        <div class="prose" [innerHTML]="html()"></div>
      </article>
    }
  `,
})
export class LegalPage {
  private readonly lang = inject(LanguageService);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly t = inject(TranslateService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly page = signal<ContentDetail | null>(null);
  protected readonly missing = signal(false);
  protected readonly failed = signal(false);

  private readonly en = computed(() => this.lang.current() === 'en');
  protected readonly title = computed(() => {
    const s = this.page()?.summary;
    return s ? (this.en() && s.titleEn) || s.titleKa : '';
  });
  protected readonly html = computed(() => {
    const p = this.page();
    return p ? renderMarkdown((this.en() && p.bodyEn) || p.bodyKa) : '';
  });
  protected readonly updated = computed(() => {
    const p = this.page();
    return formatDate(p?.updatedAt ?? p?.summary.publishedAt, this.lang.current());
  });

  constructor() {
    const slug = inject(ActivatedRoute).snapshot.data['slug'] as string;
    inject(ContentApiService)
      .get('legal', slug)
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.missing.set(!p); // NotFound sets the 404 status and noindex itself
          if (p) this.applySeo(p);
        },
        error: () => {
          this.failed.set(true);
          // A hiccup is 503, so a live page isn't dropped from the index over it.
          if (this.responseInit) this.responseInit.status = 503;
          this.meta.updateTag({ name: 'robots', content: 'noindex' });
        },
      });
  }

  private applySeo(p: ContentDetail): void {
    const en = this.en();
    const s = p.summary;
    this.titleService.setTitle(`${(en && s.titleEn) || s.titleKa} | ${this.t.instant('brand.name')}`);
    const description =
      (en && (p.metaDescriptionEn || s.excerptEn)) || p.metaDescriptionKa || s.excerptKa;
    if (description) this.meta.updateTag({ name: 'description', content: description });
    // A real page is indexable, whatever an earlier page in this session set.
    this.meta.removeTag('name="robots"');
  }
}
