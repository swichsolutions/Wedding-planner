import { Component, DOCUMENT, DestroyRef, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { ContentCard } from '../../components/content-card/content-card';
import { ContentApiService } from '../../core/content-api.service';
import { CONTENT_TOPICS, ContentKind, ContentSummary, GUIDES_PATH, KIND_SECTION } from '../../core/content.models';
import { breadcrumbList, removeJsonLd, setJsonLd, webPage } from '../../core/structured-data';
import { LanguageService } from '../../i18n/language.service';

const JSON_LD_ID = 'section-jsonld';

type ListKind = Exclude<ContentKind, 'legal'>;

/** i18n prefix per section: guides.blogTitle, guides.inspirationLead, guides.realMeta… */
const PREFIX: Record<ListKind, string> = { article: 'blog', inspiration: 'inspiration', 'real-wedding': 'real' };
const CARD: Record<ListKind, 'article' | 'idea' | 'story'> = { article: 'article', inspiration: 'idea', 'real-wedding': 'story' };

/**
 * /rchevebi/blogi, /rchevebi/shtagoneba, /rchevebi/realuri-qortsilebi — everything published in one
 * section, newest first, with topic chips (real links, ?topic=, so crawlers follow them too).
 */
@Component({
  selector: 'app-content-list',
  imports: [RouterLink, TranslatePipe, ContentCard],
  host: { class: 'theme-brand' },
  templateUrl: './content-list.html',
  styleUrl: './guides.scss',
})
export class ContentList {
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);
  private readonly t = inject(TranslateService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly kind = this.route.snapshot.data['kind'] as ListKind;
  protected readonly prefix = PREFIX[this.kind];
  protected readonly card = CARD[this.kind];
  protected readonly section = KIND_SECTION[this.kind];

  private readonly all = signal<ContentSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly topic = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('topic'))), {
    initialValue: this.route.snapshot.queryParamMap.get('topic'),
  });

  /** Only topics that have something published, in the editor's order. */
  protected readonly topics = computed(() => {
    const used = new Set(this.all().map((c) => c.topic).filter(Boolean));
    return CONTENT_TOPICS[this.kind].filter((t) => used.has(t));
  });
  protected readonly items = computed(() => {
    const topic = this.topic();
    return topic ? this.all().filter((c) => c.topic === topic) : this.all();
  });

  constructor() {
    const title = this.t.instant(`guides.${this.prefix}Title`);
    const description = this.t.instant(`guides.${this.prefix}Meta`);
    this.titleService.setTitle(`${title} | ${this.t.instant('brand.name')}`);
    this.meta.updateTag({ name: 'description', content: description });
    const doc = inject(DOCUMENT);
    const lang = inject(LanguageService).current();
    inject(DestroyRef).onDestroy(() => removeJsonLd(doc, JSON_LD_ID));

    inject(ContentApiService)
      .list(this.kind, undefined, 100)
      .subscribe({
        next: (rows) => {
          this.all.set(rows);
          this.loaded.set(true);
          // An empty section is a thin page: out of the index until something is published.
          if (rows.length) this.meta.removeTag('name="robots"');
          else this.meta.updateTag({ name: 'robots', content: 'noindex' });
          // what the page is (a list) and its trail: home → the hub (its visible breadcrumb) → here
          if (rows.length) {
            setJsonLd(doc, JSON_LD_ID, [
              webPage('CollectionPage', { name: title, description, path: this.section, lang }),
              breadcrumbList([
                { name: this.t.instant('nav.home'), path: '/' },
                { name: this.t.instant('guides.hubTitle'), path: GUIDES_PATH },
                { name: title, path: this.section },
              ]),
            ]);
          }
        },
        error: () => {
          this.failed.set(true);
          this.loaded.set(true);
          if (this.responseInit) this.responseInit.status = 503;
          this.meta.updateTag({ name: 'robots', content: 'noindex' });
        },
      });
  }
}
