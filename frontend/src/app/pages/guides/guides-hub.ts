import { Component, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { ContentCard } from '../../components/content-card/content-card';
import { AuthService } from '../../core/auth.service';
import { ContentApiService } from '../../core/content-api.service';
import { ContentSummary, KIND_SECTION } from '../../core/content.models';

/**
 * /rchevebi — „რჩევები და იდეები" hub (guide §5): a short intro, then a few items from each
 * section with a link to the full list. A section with nothing published stays hidden
 * (real weddings appear only once real stories exist); an empty hub is kept out of search.
 */
@Component({
  selector: 'app-guides-hub',
  imports: [RouterLink, TranslatePipe, ContentCard],
  host: { class: 'theme-brand' },
  templateUrl: './guides-hub.html',
  styleUrl: './guides.scss',
})
export class GuidesHub {
  private readonly auth = inject(AuthService);
  private readonly meta = inject(Meta);
  private readonly t = inject(TranslateService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /** Each section's full list. */
  protected readonly sections = KIND_SECTION;

  protected readonly articles = signal<ContentSummary[]>([]);
  protected readonly ideas = signal<ContentSummary[]>([]);
  protected readonly stories = signal<ContentSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly empty = computed(
    () => this.loaded() && !this.articles().length && !this.ideas().length && !this.stories().length,
  );

  /** Guide §5: the intro leads to registration; signed-in couples go to their plan instead. */
  protected readonly cta = computed(() =>
    this.auth.isAuthenticated() ? { link: '/planning', key: 'nav.myPlan' } : { link: '/signup', key: 'nav.start' },
  );

  constructor() {
    inject(Title).setTitle(`${this.t.instant('guides.hubTitle')} | ${this.t.instant('brand.name')}`);
    this.meta.updateTag({ name: 'description', content: this.t.instant('guides.hubMeta') });

    const api = inject(ContentApiService);
    let errors = 0;
    const safe = (o: Observable<ContentSummary[]>) =>
      o.pipe(catchError(() => (errors++, of([] as ContentSummary[]))));
    forkJoin([
      safe(api.list('article', undefined, 3)),
      safe(api.list('inspiration', undefined, 4)),
      safe(api.list('real-wedding', undefined, 3)),
    ]).subscribe(([a, i, s]) => {
      this.articles.set(a);
      this.ideas.set(i);
      this.stories.set(s);
      this.loaded.set(true);
      this.failed.set(errors === 3);
      if (errors === 3 && this.responseInit) this.responseInit.status = 503;
      // Nothing published yet → a thin page: keep it out of the index until there is.
      if (this.failed() || this.empty()) this.meta.updateTag({ name: 'robots', content: 'noindex' });
      else this.meta.removeTag('name="robots"');
    });
  }
}
