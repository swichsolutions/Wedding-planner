import { Component, PLATFORM_ID, computed, inject, input, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { categoryKey, img } from '../../../core/catalog';
import { Budget, BudgetItem, BudgetService } from '../../../core/budget.service';
import { ChecklistItem } from '../../../core/checklist.service';
import { CoupleProfile } from '../../../core/couple.service';
import { Guest, GuestService } from '../../../core/guest.service';
import { SeatingState, SeatingService } from '../../../core/seating.service';
import { WishlistService } from '../../../core/wishlist.service';
import { WeddingSite, WebsiteService } from '../../../core/website.service';
import { LanguageService } from '../../../i18n/language.service';

/**
 * "ჩემი ქორწილი → მიმოხილვა" (sitemap §06): the top of the organizer. A full-bleed
 * photo with the couple's names, date and countdown, the one most useful next step,
 * and a status card per planning area. Built by Rati as the signed-in home page;
 * moved here so `/` stays one public page for everyone.
 *
 * The parent planning page already loads the couple profile and the checklist, so
 * those come in as inputs (ticking a task updates the progress card live). The other
 * areas are fetched here, once, in the browser only.
 */
@Component({
  selector: 'app-couple-overview',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './couple-overview.html',
  styleUrl: './couple-overview.scss',
})
export class CoupleOverview {
  readonly couple = input<CoupleProfile | null>(null);
  readonly checklistItems = input<ChecklistItem[]>([]);
  /** The pencil on the photo. There is no partial edit yet, so the parent opens its
   * restart wizard (behind the destructive-action confirm). */
  readonly editDetails = output<Event>();

  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly budgetSvc = inject(BudgetService);
  private readonly websiteSvc = inject(WebsiteService);
  private readonly guestSvc = inject(GuestService);
  private readonly seatingSvc = inject(SeatingService);
  protected readonly wishlist = inject(WishlistService);

  protected readonly greetingNames = computed(() => {
    const c = this.couple();
    if (!c) return '';
    const a = (c.firstName || '').trim();
    const b = (c.partnerFirstName || '').trim();
    if (a && b) return `${a} & ${b}`;
    return a || b || '';
  });
  protected readonly daysToWedding = computed<number | null>(() => {
    const date = this.couple()?.weddingDate;
    if (!date) return null;
    const wedding = new Date(date + 'T00:00:00').getTime();
    if (Number.isNaN(wedding)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((wedding - today.getTime()) / 86_400_000);
  });

  protected readonly checklistDone = computed(
    () => this.checklistItems().filter((i) => i.isDone).length,
  );

  protected readonly budget = signal<Budget | null>(null);
  protected readonly budgetStarted = computed(() => this.budget()?.totalBudget != null);
  protected readonly budgetPaid = computed(() =>
    (this.budget()?.items ?? []).reduce((sum, i) => sum + (i.paid ?? 0), 0),
  );
  protected readonly budgetScale = computed(() => {
    const total = this.budget()?.totalBudget;
    if (!total) return 0;
    return Math.min(100, Math.round((this.budgetPaid() / total) * 100));
  });

  protected readonly site = signal<WeddingSite | null>(null);
  protected readonly siteStatus = computed<'none' | 'draft' | 'published'>(() => {
    const s = this.site();
    if (!s) return 'none';
    return s.isPublished ? 'published' : 'draft';
  });

  // The hero always shows a real photo — their own wedding-site upload once
  // they have one, the same editorial stock shot the rest of the site uses
  // until then. Never an empty placeholder box.
  protected readonly heroPhoto = computed(
    () => this.site()?.photoUrl ?? img('photo-1583939003579-730e3918a45a', 1200),
  );

  protected readonly guests = signal<Guest[]>([]);
  protected readonly guestCount = computed(() => this.guests().length);

  protected readonly seating = signal<SeatingState | null>(null);
  protected readonly seatingStarted = computed(() => (this.seating()?.tables.length ?? 0) > 0);
  protected readonly seatedCount = computed(() => this.seating()?.assignments.length ?? 0);
  protected readonly seatingComplete = computed(
    () => this.guestCount() > 0 && this.seatedCount() >= this.guestCount(),
  );

  // The single most useful next action, in the order a couple actually plans a
  // Georgian wedding: budget first (it shapes every other choice), then who's
  // coming, then the day-to-day checklist, then the two "nice to have, once the
  // basics are set" tools. Each check is on REAL state — nothing here is a guess.
  // The checklist sits further down this same page, hence the fragment.
  protected readonly nextStep = computed<{ link: string; fragment?: string; key: string } | null>(() => {
    if (!this.budgetStarted()) return { link: '/budget', key: 'planning.ov.nextBudget' };
    if (this.guestCount() === 0) return { link: '/guests', key: 'planning.ov.nextGuests' };
    if (this.checklistDone() === 0 && this.checklistItems().length > 0) {
      return { link: '/planning', fragment: 'checklist', key: 'planning.ov.nextChecklist' };
    }
    if (this.siteStatus() === 'none') return { link: '/website', key: 'planning.ov.nextWebsite' };
    if (!this.seatingStarted()) return { link: '/seating', key: 'planning.ov.nextSeating' };
    return null;
  });

  // What the couple has actually settled, by category — read straight off their
  // real budget rows. Every category is auto-seeded with a suggested estimate on
  // signup (Georgian-norm split), so an estimate alone doesn't count — only a
  // linked vendor, a typed merchant, or a real cost/payment means the couple
  // actually settled something for that category.
  protected readonly chosenVendors = computed(() => {
    const rows: { slug: string; categoryKey: string; name: string }[] = [];
    for (const item of this.budget()?.items ?? []) {
      if (!item.categorySlug || rows.some((r) => r.slug === item.categorySlug)) continue;
      const hasRealProgress =
        item.vendor != null || !!item.merchantName || (item.actualCost ?? 0) > 0 || (item.paid ?? 0) > 0;
      if (hasRealProgress) {
        rows.push({
          slug: item.categorySlug,
          categoryKey: categoryKey(item.categorySlug),
          name: this.chosenLabel(item),
        });
      }
    }
    return rows;
  });

  private chosenLabel(item: BudgetItem): string {
    return item.vendor?.name ?? item.merchantName ?? item.name;
  }

  constructor() {
    // The parent renders this only for a signed-in couple; fetch once, browser only.
    if (!this.isBrowser) return;
    this.budgetSvc.get().subscribe({ next: (b) => this.budget.set(b), error: () => {} });
    this.websiteSvc.get().subscribe({ next: (s) => this.site.set(s), error: () => {} });
    this.guestSvc.list().subscribe({ next: (g) => this.guests.set(g), error: () => {} });
    this.seatingSvc.load().subscribe({ next: (s) => this.seating.set(s), error: () => {} });
  }

  protected formatFullDate(date: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(date + 'T00:00:00'),
    );
  }

  protected formatGel(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }
}
