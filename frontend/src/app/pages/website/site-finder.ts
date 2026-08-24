import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SiteSearchResult, WebsiteService } from '../../core/website.service';
import { LanguageService } from '../../i18n/language.service';

/**
 * Guest-facing "find a couple's website" search (Zola-style). Deliberately NOT a
 * browsable directory: the API requires first name + last name + year, so guests
 * only find couples they already know.
 */
@Component({
  selector: 'app-site-finder',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './site-finder.html',
  styleUrl: './site-finder.scss',
})
export class SiteFinder {
  private readonly websiteSvc = inject(WebsiteService);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly year = signal('');
  protected readonly month = signal(0); // 0 = any month

  protected readonly missingFields = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly searched = signal(false);
  protected readonly results = signal<SiteSearchResult[]>([]);
  /** The "N matches for X" line echoes what was actually searched, not the live inputs. */
  protected readonly searchedName = signal('');

  // This year ± a realistic booking horizon.
  protected readonly years = (() => {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1, now + 2, now + 3];
  })();

  protected readonly months = computed(() => {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    const format = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: format.format(new Date(2026, i, 1)),
    }));
  });

  constructor() {
    inject(Title).setTitle(
      `${this.translate.instant('siteFinder.title')} | ${this.translate.instant('brand.name')}`,
    );
    // Query-driven utility page — nothing for search engines to index.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  protected search(): void {
    const first = this.firstName().trim();
    const last = this.lastName().trim();
    const year = Number(this.year());
    if (!first || !last || !year) {
      this.missingFields.set(true);
      return;
    }
    this.missingFields.set(false);
    this.busy.set(true);
    this.failed.set(false);
    this.websiteSvc.findSites(first, last, year, this.month() || undefined).subscribe({
      next: (list) => {
        this.results.set(list);
        this.searchedName.set(`${first} ${last}`);
        this.searched.set(true);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
        // A failed search must not leave the PREVIOUS search's table under the
        // error banner — that reads as if this search produced those rows.
        this.searched.set(false);
        this.results.set([]);
      },
    });
  }

  protected coupleLine(r: SiteSearchResult): string {
    const a = [r.firstName, r.lastName].filter(Boolean).join(' ');
    const b = [r.partnerFirstName, r.partnerLastName].filter(Boolean).join(' ');
    return a && b ? `${a} & ${b}` : a || b;
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso + 'T00:00:00'));
  }
}
