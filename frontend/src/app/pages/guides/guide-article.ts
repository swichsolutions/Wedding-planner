import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
export class GuideArticle {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

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
    this.route.paramMap.subscribe((pm) => {
      const slug = pm.get('slug') ?? '';
      this.content.getBySlug(slug).subscribe((a) => {
        this.article.set(a);
        this.loaded.set(true);
        this.applySeo(a);
      });
    });
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(iso),
    );
  }

  private applySeo(a: ContentArticle | undefined): void {
    if (!a) {
      this.title.setTitle(this.translate.instant('guides.notFoundTitle'));
      this.removeJsonLd();
      return;
    }

    const lang = this.lang.current();
    const brand = this.translate.instant('brand.name');
    const headline = lang === 'ka' ? a.titleKa : a.titleEn;
    const description = lang === 'ka' ? a.metaKa : a.metaEn;

    this.title.setTitle(`${headline} | ${brand}`);
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
    script.text = JSON.stringify(data);
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }
}
