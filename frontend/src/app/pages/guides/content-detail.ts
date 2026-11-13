import {
  Component,
  DOCUMENT,
  OnDestroy,
  RESPONSE_INIT,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, map, of, switchMap } from 'rxjs';

import { ContentCard } from '../../components/content-card/content-card';
import { ContentDetail as Detail, ContentKind, KIND_SECTION } from '../../core/content.models';
import { AuthService } from '../../core/auth.service';
import { ContentApiService } from '../../core/content-api.service';
import { formatDate } from '../../core/dates';
import { sizedImage } from '../../core/images';
import { renderMarkdown } from '../../core/markdown';
import { movedAddress } from '../../core/old-addresses';
import { MARKABLE_TOPICS, PlanPhotosService } from '../../core/plan-photos.service';
import { LanguageService } from '../../i18n/language.service';
import { NotFound } from '../not-found/not-found';

type DetailKind = Exclude<ContentKind, 'legal'>;
const PREFIX: Record<DetailKind, string> = { article: 'blog', inspiration: 'inspiration', 'real-wedding': 'real' };
const JSON_LD_ID = 'content-jsonld';

/**
 * One article, inspiration idea or real-wedding story (guide §5 "ცალკე გვერდი"):
 * title + intro → the full material (text, photos) → one related action → related items.
 * Vendors credited in a story link to their profiles when they're on the platform.
 */
@Component({
  selector: 'app-content-detail',
  imports: [RouterLink, TranslatePipe, ContentCard, NotFound],
  host: { class: 'theme-brand' },
  templateUrl: './content-detail.html',
  styleUrl: './guides.scss',
})
export class ContentDetailPage implements OnDestroy {
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly t = inject(TranslateService);
  private readonly doc = inject(DOCUMENT);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContentApiService);
  private readonly auth = inject(AuthService);
  protected readonly planPhotos = inject(PlanPhotosService);

  protected readonly kind = this.route.snapshot.data['kind'] as DetailKind;
  protected readonly prefix = PREFIX[this.kind];
  protected readonly section = KIND_SECTION[this.kind];

  protected readonly page = signal<Detail | null>(null);
  protected readonly missing = signal(false);
  protected readonly failed = signal(false);

  private readonly en = computed(() => this.lang.current() === 'en');
  private pick(ka: string | null | undefined, en: string | null | undefined): string {
    return (this.en() && en) || ka || '';
  }

  protected readonly title = computed(() => {
    const s = this.page()?.summary;
    return s ? this.pick(s.titleKa, s.titleEn) : '';
  });
  protected readonly excerpt = computed(() => {
    const s = this.page()?.summary;
    return s ? this.pick(s.excerptKa, s.excerptEn) : '';
  });
  protected readonly date = computed(() => formatDate(this.page()?.summary.publishedAt, this.lang.current()));
  protected readonly html = computed(() => {
    const p = this.page();
    return p ? renderMarkdown(this.pick(p.bodyKa, p.bodyEn)) : '';
  });
  /** Photos sized for the page; the first is the cover. */
  protected readonly photos = computed(() =>
    (this.page()?.photos ?? []).map((ph) => ({
      id: ph.id,
      src: sizedImage(ph.url, 1200)!,
      alt: this.pick(ph.altKa, ph.altEn),
    })),
  );
  protected readonly cover = computed(() => this.photos()[0] ?? null);
  /** Couples can mark an idea's photos for their banner (B7) when its topic belongs there. */
  protected readonly canMark = computed(
    () => this.kind === 'inspiration' && this.auth.isCouple() && MARKABLE_TOPICS.includes(this.page()?.summary.topic ?? ''),
  );

  protected isMarked(photoId: number): boolean {
    return !!this.planPhotos.markedContentPhoto(photoId);
  }
  /** Inspiration is a gallery of every photo; a story shows the rest after its cover. */
  protected readonly gallery = computed(() =>
    this.kind === 'inspiration' ? this.photos() : this.kind === 'real-wedding' ? this.photos().slice(1) : [],
  );
  protected readonly credits = computed(() =>
    (this.page()?.credits ?? []).map((c) => ({ ...c, role: this.pick(c.roleKa, c.roleEn) })),
  );
  /** The related action as a router target ("/budget?view=overview" → path + query). A page
   * saved with an address from before 2026-11-13 ("/vendors?category=x") links to today's. */
  protected readonly action = computed<{ tree: UrlTree; label: string } | null>(() => {
    const p = this.page();
    if (!p?.actionPath) return null;
    const path = movedAddress(p.actionPath) ?? p.actionPath;
    return { tree: this.router.parseUrl(path), label: this.pick(p.actionLabelKa, p.actionLabelEn) };
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('slug') ?? ''),
        switchMap((slug) =>
          this.api.get(this.kind, slug).pipe(
            map((p) => ({ p, failed: false })),
            catchError(() => of({ p: null as Detail | null, failed: true })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ p, failed }) => {
        this.page.set(p);
        this.failed.set(failed);
        this.missing.set(!failed && !p); // NotFound answers 404 + noindex itself
        if (failed) {
          if (this.responseInit) this.responseInit.status = 503;
          this.meta.updateTag({ name: 'robots', content: 'noindex' });
          this.removeJsonLd();
        } else if (p) {
          this.applySeo(p);
        } else {
          this.removeJsonLd();
        }
      });
  }

  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  private applySeo(p: Detail): void {
    const brand = this.t.instant('brand.name');
    const headline = this.title();
    const description =
      this.pick(p.metaDescriptionKa, p.metaDescriptionEn) || this.excerpt() || this.t.instant(`guides.${this.prefix}Meta`);
    this.titleService.setTitle(`${headline} | ${brand}`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: headline });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    const image = p.photos[0]?.url;
    if (image) this.meta.updateTag({ property: 'og:image', content: sizedImage(image, 1200)! });
    else this.meta.removeTag("property='og:image'");
    this.meta.removeTag('name="robots"');

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      description,
      ...(image ? { image: sizedImage(image, 1200) } : {}),
      ...(p.summary.publishedAt ? { datePublished: p.summary.publishedAt } : {}),
      ...(p.updatedAt ? { dateModified: p.updatedAt } : {}),
      inLanguage: this.en() ? 'en' : 'ka',
      author: { '@type': 'Organization', name: brand },
      publisher: { '@type': 'Organization', name: brand },
    });
  }

  private setJsonLd(data: unknown): void {
    this.removeJsonLd();
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escape "<" so content can't close the script tag in server-rendered HTML.
    script.text = JSON.stringify(data).replace(/</g, '\\u003C');
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
  }
}
