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
import { switchMap } from 'rxjs';

import { LanguageService } from '../../i18n/language.service';
import { ContentService } from '../../core/content.service';
import { ContentArticle } from '../../core/content.models';

const JSON_LD_ID = 'article-jsonld';

@Component({
  selector: 'app-guide-article',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './guide-article.html',
  styleUrl: './guide-article.scss',
})
export class GuideArticle implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  /** SSR only (null in the browser) — lets a dead URL answer with a real 404. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly article = signal<ContentArticle | undefined>(undefined);
  protected readonly loaded = signal(false);

  private get ka(): boolean {
    return this.lang.current() === 'ka';
  }

  protected readonly headline = computed(() => {
    const a = this.article();
    return a ? (this.ka ? a.titleKa : a.titleEn) : '';
  });

  protected readonly paragraphs = computed<string[]>(() => {
    const a = this.article();
    return a ? (this.ka ? a.bodyKa : a.bodyEn) : [];
  });

  constructor() {
    // switchMap so rapid article→article navigation cancels the older lookup —
    // a stale response must not write the wrong article's title/meta/JSON-LD.
    // takeUntilDestroyed: a response landing after the user left this page must
    // not rewrite the NEXT page's SEO either.
    this.route.paramMap
      .pipe(
        switchMap((pm) => this.content.getBySlug(pm.get('slug') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe((a) => {
        this.article.set(a);
        this.loaded.set(true);
        this.applySeo(a);
        // Dead URLs must answer 404 so crawlers drop them instead of indexing
        // an HTTP-200 "not found" page.
        if (this.responseInit) this.responseInit.status = a ? 200 : 404;
      });
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    // 'T00:00:00' parses the date-only string as LOCAL midnight (codebase
    // convention) — bare parsing is UTC and shows the previous day in
    // UTC-negative zones, and a different date on SSR than after hydration.
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(iso + 'T00:00:00'),
    );
  }

  private applySeo(a: ContentArticle | undefined): void {
    if (!a) {
      // Dead URL: the previous page's description/social card must not linger
      // here, and the page must not be indexed (paired with the 404 status).
      this.title.setTitle(this.translate.instant('guides.notFoundTitle'));
      this.meta.updateTag({
        name: 'description',
        content: this.translate.instant('guides.notFoundBody'),
      });
      this.meta.removeTag("property='og:title'");
      this.meta.removeTag("property='og:description'");
      this.meta.removeTag("property='og:type'");
      this.meta.removeTag("property='og:image'");
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      this.removeJsonLd();
      return;
    }

    const lang = this.lang.current();
    const brand = this.translate.instant('brand.name');
    const headline = lang === 'ka' ? a.titleKa : a.titleEn;
    const description = lang === 'ka' ? a.metaKa : a.metaEn;

    this.title.setTitle(`${headline} | ${brand}`);
    // A live article is public: drop any noindex left by a not-found state.
    this.meta.removeTag("name='robots'");
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: headline });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ property: 'og:image', content: a.image });

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      description,
      image: a.image,
      datePublished: a.date,
      inLanguage: lang,
      author: { '@type': 'Organization', name: brand },
      publisher: { '@type': 'Organization', name: brand },
    });
  }

  private setJsonLd(data: unknown): void {
    this.removeJsonLd();
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escape "<" so article text can't break out of the script tag in
    // server-rendered HTML — JSON.stringify alone doesn't do this.
    script.text = JSON.stringify(data).replace(/</g, '\\u003C');
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }

  ngOnDestroy(): void {
    // Drop this article's JSON-LD so it doesn't describe whatever page comes next.
    this.removeJsonLd();
  }
}
