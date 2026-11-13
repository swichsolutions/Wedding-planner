import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { DAY_SCHEDULES, local } from '../../core/day-schedules';
import { LanguageService } from '../../i18n/language.service';

/** How many rows a card previews before „ნახე განრიგი“. */
const PREVIEW_ROWS = 4;

/**
 * The example day schedules as cards (home section 5 and /ganrigebi, guide §3): a short
 * description and the start of the timeline, and the full schedule in a dialog. The dialogs are
 * native <dialog> elements in the server-rendered HTML, so every schedule is in the page source
 * for crawlers; the browser handles focus and Esc. No page per example (BUILD-PLAN B2).
 */
@Component({
  selector: 'app-day-schedules',
  imports: [TranslatePipe],
  templateUrl: './day-schedules.html',
  styleUrl: './day-schedules.scss',
})
export class DaySchedules {
  private readonly doc = inject(DOCUMENT);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  /** Card titles are h3 under the home chapter's h2, h2 on the /ganrigebi page. */
  readonly headingLevel = input<2 | 3>(3);

  protected readonly schedules = computed(() => {
    const lang = this.lang.current();
    return DAY_SCHEDULES.map((s) => ({
      key: s.key,
      title: local(s.title, lang),
      summary: local(s.summary, lang),
      note: local(s.note, lang),
      first: s.rows[0].time,
      last: s.rows[s.rows.length - 1].time,
      count: s.rows.length,
      preview: s.rows.slice(0, PREVIEW_ROWS).map((r) => ({ time: r.time, activity: local(r.activity, lang) })),
      more: Math.max(0, s.rows.length - PREVIEW_ROWS),
      rows: s.rows.map((r) => ({
        time: r.time,
        activity: local(r.activity, lang),
        note: local(r.note, lang),
        who: local(r.who, lang),
      })),
    }));
  });

  protected open(dialog: HTMLDialogElement): void {
    dialog.showModal();
    this.doc.body.style.overflow = 'hidden'; // the page behind stays put
  }

  protected close(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  /** Esc, the close button or a click outside: the dialog's own close event. */
  protected onClosed(): void {
    this.doc.body.style.overflow = '';
  }

  /**
   * „გამოიყენე ეს განრიგი“ (guide §3): a couple goes to their wedding day, which takes the example
   * (?use=); anyone signed out signs up (or in) first and lands there with the choice kept.
   */
  protected use(key: string, dialog: HTMLDialogElement): void {
    dialog.close();
    const target = `/planning/day?use=${encodeURIComponent(key)}`;
    if (this.auth.isCouple()) void this.router.navigateByUrl(target);
    else void this.router.navigate(['/signup'], { queryParams: { returnUrl: target } });
  }

  /** A click on the backdrop lands on the <dialog> itself (its content box is the inner panel). */
  protected onDialogClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) dialog.close();
  }
}
