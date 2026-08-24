import { Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { BudgetReminder, BudgetService, reminderStatus } from '../../core/budget.service';
import { ChecklistItem, ChecklistService } from '../../core/checklist.service';
import { ToastService } from '../../core/toast.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { ContentService } from '../../core/content.service';
import { ContentArticle } from '../../core/content.models';
import { LanguageService } from '../../i18n/language.service';

interface TipCard {
  slug: string;
  title: string;
  image: string;
  imageAlt: string;
}

@Component({
  selector: 'app-planning',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './planning.html',
  styleUrl: './planning.scss',
})
export class Planning {
  private readonly auth = inject(AuthService);
  private readonly checklist = inject(ChecklistService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;
  private coupleLoadStarted = false;

  // couple profile → personalized greeting + wedding countdown
  protected readonly couple = signal<CoupleProfile | null>(null);
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

  // Guide cards on the explainer (pulled from real content; top 3).
  private readonly articles = toSignal(inject(ContentService).list(), {
    initialValue: [] as ContentArticle[],
  });
  protected readonly tips = computed<TipCard[]>(() => {
    const ka = this.lang.current() === 'ka';
    return this.articles()
      .slice(0, 3)
      .map((a) => ({
        slug: a.slug,
        title: ka ? a.titleKa : a.titleEn,
        image: a.image,
        imageAlt: a.imageAlt,
      }));
  });
  protected readonly items = signal<ChecklistItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly adding = signal(false);

  protected readonly doneCount = computed(() => this.items().filter((i) => i.isDone).length);

  // Upcoming budget payment reminders (soonest first from the API); panel shows the top 5.
  protected readonly reminders = signal<BudgetReminder[]>([]);
  protected readonly visibleReminders = computed(() => this.reminders().slice(0, 5));

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('planning.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: t.instant('planning.subtitle') });

    // Load when isCouple() BECOMES true, not only when it already is at
    // construction — a guest who signs in via the navbar modal on this page
    // (or a signed-in user whose auth state settles after hydration) must see
    // their checklist, not an empty one inviting duplicate re-adds. The latch
    // keeps it a one-time load.
    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.coupleLoadStarted) return;
      this.coupleLoadStarted = true;
      this.loadChecklist();
      this.coupleSvc.me().subscribe({
        next: (c) => this.couple.set(c),
        error: () => {},
      });
      this.budgetSvc.reminders().subscribe({
        next: (r) => this.reminders.set(r),
        error: () => {},
      });
    });
  }

  private loadChecklist(): void {
    this.loadError.set(false);
    this.checklist.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected retryLoad(): void {
    this.loadChecklist();
  }

  // ---- reminder panel helpers ----

  protected reminderBadge(r: BudgetReminder): 'overdue' | 'soon' | null {
    const s = reminderStatus(r.reminderDate);
    return s === 'overdue' || s === 'soon' ? s : null;
  }

  /** What's still to pay on the item: (actual, falling back to estimate) minus paid. */
  protected outstanding(r: BudgetReminder): number {
    return Math.max(0, (r.actualCost ?? r.estimate ?? 0) - (r.paid ?? 0));
  }

  protected formatDate(date: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(date + 'T00:00:00'),
    );
  }

  protected formatMoney(n: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(Math.round(n)) + ' ₾';
  }

  protected addItem(input: HTMLInputElement): void {
    const title = input.value.trim();
    if (!title) return;
    this.adding.set(true);
    this.checklist.add(title).subscribe({
      next: (item) => {
        this.items.update((list) => [...list, item]);
        input.value = '';
        this.adding.set(false);
      },
      error: () => {
        this.adding.set(false);
        this.toast.error('planning.saveError');
      },
    });
  }

  protected toggle(item: ChecklistItem, event: Event): void {
    const next = !item.isDone;
    this.checklist.update(item.id, { title: item.title, isDone: next }).subscribe({
      next: () =>
        this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, isDone: next } : i))),
      error: () => {
        // The USER flipped the DOM checkbox, so the [checked] binding (whose bound
        // value never changed) won't rewrite it — reset the element directly.
        (event.target as HTMLInputElement).checked = item.isDone;
        this.toast.error('planning.saveError');
      },
    });
  }

  protected remove(id: number): void {
    this.checklist.remove(id).subscribe({
      next: () => this.items.update((list) => list.filter((i) => i.id !== id)),
      error: () => this.toast.error('planning.saveError'),
    });
  }
}
