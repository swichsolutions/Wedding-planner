import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { BudgetReminder, BudgetService, reminderStatus } from '../../core/budget.service';
import { ChecklistItem, ChecklistService } from '../../core/checklist.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { ContentService } from '../../core/content.service';
import { ContentArticle } from '../../core/content.models';
import { CATEGORIES } from '../../core/catalog';
import { GUEST_RANGES, PLANNING_STAGES } from '../../core/onboarding';
import { nameValidator } from '../../core/forms';
import { trapTabKey } from '../../core/a11y';
import { LanguageService } from '../../i18n/language.service';

interface TipCard {
  slug: string;
  title: string;
  image: string;
  imageAlt: string;
}

@Component({
  selector: 'app-planning',
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe],
  templateUrl: './planning.html',
  styleUrl: './planning.scss',
})
export class Planning {
  private readonly auth = inject(AuthService);
  private readonly checklist = inject(ChecklistService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly toast = inject(ToastService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly doc = inject(DOCUMENT);
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

  // =============================== restart planning ===============================
  // Re-runs onboarding (names/date/stage/needs/guests) and wipes + reseeds the
  // checklist + budget from the new answers. Gated by a destructive-action confirm
  // (ConfirmService) so the couple can't lose their current plan by accident.

  protected readonly restartOpen = signal(false);
  protected readonly restartStep = signal(0);
  protected readonly restartTotalSteps = 5;
  protected readonly restartProgress = computed(
    () => ((this.restartStep() + 1) / this.restartTotalSteps) * 100,
  );
  protected readonly restartLoading = signal(false);
  protected readonly restartAttempted = signal(false);
  protected readonly restartStillDeciding = signal(false);
  protected readonly restartStage = signal<string | null>(null);
  protected readonly restartGuestRange = signal<string | null>(null);
  protected readonly restartNeeded = signal<string[]>([]);

  protected readonly restartCategories = CATEGORIES;
  protected readonly restartStages = PLANNING_STAGES;
  protected readonly restartGuestRanges = GUEST_RANGES;

  private restartTrigger: HTMLElement | null = null;

  protected readonly restartForm = this.fb.group({
    firstName: ['', [nameValidator()]],
    lastName: ['', [nameValidator()]],
    partnerFirstName: ['', [nameValidator()]],
    partnerLastName: ['', [nameValidator()]],
    weddingDate: [''],
  });

  protected restartIsNeeded(slug: string): boolean {
    return this.restartNeeded().includes(slug);
  }

  protected toggleRestartNeeded(slug: string): void {
    this.restartNeeded.update((list) =>
      list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug],
    );
  }

  protected setRestartStillDeciding(checked: boolean): void {
    this.restartStillDeciding.set(checked);
    const c = this.restartForm.controls.weddingDate;
    if (checked) {
      c.setValue('');
      c.disable();
    } else {
      c.enable();
    }
  }

  protected restartStepErrorKey(): string {
    switch (this.restartStep()) {
      case 1: return 'signup.errDate';
      case 2: return 'signup.errStage';
      case 3: return 'signup.errNeeds';
      case 4: return 'signup.errGuests';
      default: return '';
    }
  }

  protected restartStepValid(): boolean {
    const v = this.restartForm.getRawValue();
    switch (this.restartStep()) {
      case 0: {
        const c = this.restartForm.controls;
        return !!(v.firstName?.trim() && v.lastName?.trim() &&
          v.partnerFirstName?.trim() && v.partnerLastName?.trim()) &&
          c.firstName.valid && c.lastName.valid &&
          c.partnerFirstName.valid && c.partnerLastName.valid;
      }
      case 1:
        return this.restartStillDeciding() || !!v.weddingDate;
      case 2:
        return this.restartStage() !== null;
      case 3:
        return this.restartNeeded().length > 0;
      case 4:
        return this.restartGuestRange() !== null;
      default:
        return true;
    }
  }

  protected restartBack(): void {
    if (this.restartStep() > 0) {
      this.restartAttempted.set(false);
      this.restartStep.update((s) => s - 1);
    }
  }

  protected restartSkipNeeds(): void {
    this.restartAttempted.set(false);
    this.restartStep.update((s) => s + 1);
  }

  protected restartPrimary(): void {
    if (this.restartStep() < this.restartTotalSteps - 1) {
      if (!this.restartStepValid()) {
        this.restartAttempted.set(true);
        return;
      }
      this.restartAttempted.set(false);
      this.restartStep.update((s) => s + 1);
      return;
    }
    if (!this.restartStepValid()) {
      this.restartAttempted.set(true);
      return;
    }
    this.submitRestart();
  }

  /** Entry point: confirm the destructive reset before showing the wizard at all. */
  protected confirmRestart(event: Event): void {
    const trigger = event.currentTarget as HTMLElement;
    void this.confirmSvc
      .confirm({
        title: 'planning.restartConfirmTitle',
        body: 'planning.restartConfirmBody',
        confirmLabel: 'planning.restartConfirmBtn',
        danger: true,
      })
      .then((ok) => {
        if (ok) this.openRestart(trigger);
      });
  }

  private openRestart(trigger: HTMLElement): void {
    const c = this.couple();
    this.restartForm.reset({
      firstName: c?.firstName ?? '',
      lastName: c?.lastName ?? '',
      partnerFirstName: c?.partnerFirstName ?? '',
      partnerLastName: c?.partnerLastName ?? '',
      weddingDate: c?.weddingDate ?? '',
    });
    this.restartStillDeciding.set(!c?.weddingDate);
    this.restartStage.set(c?.planningStage ?? null);
    this.restartGuestRange.set(c?.guestCountRange ?? null);
    this.restartNeeded.set(c?.neededCategories ?? []);
    this.restartStep.set(0);
    this.restartAttempted.set(false);
    this.restartTrigger = trigger;
    this.restartOpen.set(true);
    if (this.isBrowser) this.doc.body.style.overflow = 'hidden';
  }

  protected closeRestart(): void {
    this.restartOpen.set(false);
    if (this.isBrowser) this.doc.body.style.overflow = '';
    this.restartTrigger?.focus();
    this.restartTrigger = null;
  }

  protected onRestartBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeRestart();
  }

  protected onRestartOverlayKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
    if (event.key === 'Escape') this.closeRestart();
  }

  private submitRestart(): void {
    this.restartLoading.set(true);
    const v = this.restartForm.getRawValue();
    this.coupleSvc
      .restart({
        firstName: v.firstName?.trim() || null,
        lastName: v.lastName?.trim() || null,
        partnerFirstName: v.partnerFirstName?.trim() || null,
        partnerLastName: v.partnerLastName?.trim() || null,
        weddingDate: this.restartStillDeciding() ? null : v.weddingDate || null,
        planningStage: this.restartStage(),
        guestCountRange: this.restartGuestRange(),
        neededCategories: this.restartNeeded(),
      })
      .subscribe({
        next: (profile) => {
          this.couple.set(profile);
          this.restartLoading.set(false);
          this.closeRestart();
          this.toast.success('planning.restartDone');
          // The old checklist/budget are gone server-side — reload both so this
          // page (and a subsequent /budget visit) shows the freshly reseeded plan.
          this.loaded.set(false);
          this.loadChecklist();
          this.reminders.set([]);
          this.budgetSvc.reminders().subscribe({
            next: (r) => this.reminders.set(r),
            error: () => {},
          });
        },
        error: () => {
          this.restartLoading.set(false);
          this.toast.error('planning.saveError');
        },
      });
  }

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

    // Focus the first field when the restart wizard opens (mirrors the vendor
    // contact modal): the panel renders after this effect runs, hence setTimeout.
    effect(() => {
      if (!this.isBrowser || !this.restartOpen()) return;
      setTimeout(() => {
        (this.host.nativeElement.querySelector('.rmodal input, .rmodal button') as HTMLElement | null)?.focus();
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
