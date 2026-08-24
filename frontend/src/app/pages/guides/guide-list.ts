import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../i18n/language.service';
import { ContentService } from '../../core/content.service';
import { ContentArticle } from '../../core/content.models';

interface ArticleVm {
  slug: string;
  type: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  date: string;
}

@Component({
  selector: 'app-guide-list',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './guide-list.html',
  styleUrl: './guide-list.scss',
})
export class GuideList {
  private readonly lang = inject(LanguageService);
  private readonly articles = toSignal(inject(ContentService).list(), {
    initialValue: [] as ContentArticle[],
  });

  constructor() {
    // The guides hub is a first-class SEO surface (CLAUDE.md §5) — without its
    // own title/description it inherits whatever the previous page set.
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('guides.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: t.instant('guides.metaDescription') });
  }

  protected readonly items = computed<ArticleVm[]>(() => {
    const ka = this.lang.current() === 'ka';
    return this.articles().map((a) => ({
      slug: a.slug,
      type: a.type,
      title: ka ? a.titleKa : a.titleEn,
      excerpt: ka ? a.excerptKa : a.excerptEn,
      image: a.image,
      imageAlt: a.imageAlt,
      date: a.date,
    }));
  });

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    // 'T00:00:00' parses the date-only string as LOCAL midnight (codebase
    // convention) — bare parsing is UTC and shows the previous day in
    // UTC-negative zones, and a different date on SSR than after hydration.
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(iso + 'T00:00:00'),
    );
  }
}
