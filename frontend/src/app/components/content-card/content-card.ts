import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ContentSummary, contentPath } from '../../core/content.models';
import { sizedImage } from '../../core/images';
import { LanguageService } from '../../i18n/language.service';

/**
 * A Tips & ideas card: photo, topic, title, short description. "idea" cards are photo-led
 * (inspiration is visual), the others show the description too.
 */
@Component({
  selector: 'app-content-card',
  imports: [RouterLink, TranslatePipe],
  template: `
    <a class="ccard" [class.ccard--idea]="variant() === 'idea'" [routerLink]="path()">
      <span class="ccard__media">
        @if (image()) {
          <img [src]="image()" [alt]="alt()" [attr.loading]="eager() ? null : 'lazy'" width="800" height="600" />
        }
      </span>
      <span class="ccard__body">
        @if (item().topic) {
          <span class="ccard__topic">{{ 'guides.topics.' + item().topic | translate }}</span>
        }
        <span class="ccard__title">{{ title() }}</span>
        @if (excerpt() && variant() !== 'idea') {
          <span class="ccard__excerpt">{{ excerpt() }}</span>
        }
      </span>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }

    .ccard {
      display: grid;
      gap: var(--space-3);
      color: var(--ink);
      text-decoration: none;

      &:hover .ccard__title {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      &:hover img {
        transform: scale(1.03);
      }
    }

    .ccard__media {
      display: block;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      border-radius: var(--radius-lg);
      background: var(--paper-deep);

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--dur-base) var(--ease-out);
      }
    }

    .ccard--idea .ccard__media {
      aspect-ratio: 4 / 5;
    }

    .ccard__body {
      display: grid;
      gap: var(--space-1);
    }

    // Peach: small callouts only (CLAUDE.md brand rules).
    .ccard__topic {
      justify-self: start;
      padding: 2px var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--peach);
      font-size: var(--fs-caption);
      line-height: 1.4;
      color: var(--ink);
    }

    .ccard__title {
      font-family: var(--font-body);
      font-size: 1.125rem;
      font-weight: var(--fw-medium);
      line-height: 1.4;
    }

    .ccard__excerpt {
      font-size: var(--fs-small, 0.9375rem);
      line-height: 1.5;
      color: var(--ink-700);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    @media (prefers-reduced-motion: reduce) {
      .ccard__media img {
        transition: none;
      }

      .ccard:hover img {
        transform: none;
      }
    }
  `,
})
export class ContentCard {
  private readonly lang = inject(LanguageService);

  readonly item = input.required<ContentSummary>();
  readonly variant = input<'article' | 'idea' | 'story'>('article');
  /** In the first row of a page: it shouldn't wait. */
  readonly eager = input(false);

  private readonly en = computed(() => this.lang.current() === 'en');
  protected readonly path = computed(() => contentPath(this.item().type, this.item().slug));
  protected readonly title = computed(() => (this.en() && this.item().titleEn) || this.item().titleKa);
  protected readonly excerpt = computed(() => (this.en() && this.item().excerptEn) || this.item().excerptKa);
  protected readonly image = computed(() => sizedImage(this.item().coverUrl, 800));
  protected readonly alt = computed(
    () => (this.en() && this.item().coverAltEn) || this.item().coverAltKa || '',
  );
}
