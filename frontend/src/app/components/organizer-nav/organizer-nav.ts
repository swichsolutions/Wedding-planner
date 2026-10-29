import { Component } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** One organizer page. */
interface OrganizerLink {
  key: string;
  link: string;
  match: IsActiveMatchOptions;
}

const SAME_PAGE: IsActiveMatchOptions = {
  paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
};

/**
 * „ჩემი ქორწილი" inner menu (guide §6): one tab per working page, all nine of the guide. It
 * replaces the header's old organizer dropdown (decision D2).
 */
@Component({
  selector: 'app-organizer-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  host: { class: 'theme-brand' },
  template: `
    <nav class="onav" [attr.aria-label]="'orgNav.label' | translate">
      <ul class="onav__list container">
        @for (l of links; track l.key) {
          <li>
            <a class="onav__link" [routerLink]="l.link"
              routerLinkActive="is-active" [routerLinkActiveOptions]="l.match"
              ariaCurrentWhenActive="page">
              {{ 'orgNav.' + l.key | translate }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      background: var(--paper);
      border-bottom: 1px solid var(--paper-line);
    }

    .onav__list {
      display: flex;
      gap: var(--space-5);
      margin: 0 auto;
      padding-block: 0;
      list-style: none;
      // Phones: the row scrolls sideways instead of wrapping.
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .onav__link {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
      border-bottom: 2px solid transparent;
      font-family: var(--font-body);
      font-size: 1rem;
      line-height: 1.4;
      color: var(--ink-700);
      text-decoration: none;
      white-space: nowrap;

      &:hover {
        color: var(--ink);
      }

      &.is-active {
        color: var(--ink);
        border-bottom-color: var(--ink);
      }
    }
  `,
})
export class OrganizerNav {
  protected readonly links: OrganizerLink[] = [
    { key: 'overview', link: '/planning', match: SAME_PAGE },
    { key: 'tasks', link: '/planning/tasks', match: SAME_PAGE },
    { key: 'budget', link: '/budget', match: SAME_PAGE },
    { key: 'services', link: '/planning/services', match: SAME_PAGE },
    { key: 'guests', link: '/guests', match: SAME_PAGE },
    { key: 'seating', link: '/seating', match: SAME_PAGE },
    { key: 'weddingDay', link: '/planning/day', match: SAME_PAGE },
    { key: 'invitation', link: '/planning/invitation', match: SAME_PAGE },
    { key: 'settings', link: '/planning/settings', match: SAME_PAGE },
  ];
}

/** Paths that show the inner menu (the organizer's working pages). */
export const ORGANIZER_PATHS = [
  '/planning', '/planning/tasks', '/budget', '/planning/services', '/guests', '/seating', '/planning/invitation',
  '/planning/day', '/planning/settings',
];
