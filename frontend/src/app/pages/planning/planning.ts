import { Component, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { ContentApiService } from '../../core/content-api.service';
import { ContentSummary, contentPath } from '../../core/content.models';
import { sizedImage } from '../../core/images';
import { CATEGORIES } from '../../core/catalog';
import { GUEST_RANGES, PLANNING_STAGES } from '../../core/onboarding';
import { nameValidator } from '../../core/forms';
import { trapTabKey } from '../../core/a11y';
import { LanguageService } from '../../i18n/language.service';
import { CoupleOverview } from './couple-overview/couple-overview';

interface TipCard {
  path: string;
  title: string;
  image: string | null;
  imageAlt: string;
}

@Component({
  selector: 'app-planning',
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe, CoupleOverview],
  templateUrl: './planning.html',
  styleUrl: './planning.scss',
  host: { class: 'theme-brand' },
})
export class Planning {
  private readonly auth = inject(AuthService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly toast = inject(ToastService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly doc = inject(DOCUMENT);
  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;
  /** Signed in, but not as a couple (vendor / admin): the notice the tool pages show, no sign-up. */
  protected readonly otherRole = computed(() => !!this.auth.user() && !this.auth.isCouple());
  protected readonly roleNoticeKey = computed(() =>
    this.auth.isAdmin() ? 'featureLanding.signedInAdmin' : 'featureLanding.signedInVendor',
  );
  private coupleLoadStarted = false;

  protected logout(): void {
    this.auth.logout();
  }

  // couple profile → the overview's names, date and countdown (and the restart wizard's defaults)
  protected readonly couple = signal<CoupleProfile | null>(null);
  /** Bumped after "start over" so the overview reads the reseeded plan. */
  protected readonly reloadTick = signal(0);

  // Guide cards on the explainer: the 3 newest published articles (the section hides
  // while there are none, or if the content API is down).
  private readonly articles = toSignal(
    inject(ContentApiService)
      .list('article', undefined, 3)
      .pipe(catchError(() => of([] as ContentSummary[]))),
    { initialValue: [] as ContentSummary[] },
  );
  protected readonly tips = computed<TipCard[]>(() => {
    const en = this.lang.current() === 'en';
    return this.articles().map((a) => ({
      path: contentPath(a.type, a.slug),
      title: (en && a.titleEn) || a.titleKa,
      image: sizedImage(a.coverUrl, 700),
      imageAlt: (en && a.coverAltEn) || a.coverAltKa || '',
    }));
  });
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
          // The old checklist/budget are gone server-side: the overview reads the reseeded plan.
          this.reloadTick.update((n) => n + 1);
        },
        error: () => {
          this.restartLoading.set(false);
          this.toast.error('planning.saveError');
        },
      });
  }

  constructor() {
    const t = inject(TranslateService);
    // title and description for the search the page answers (SEO round, 2026-11-13); both keys
    // are used here only
    inject(Title).setTitle(`${t.instant('planning.seoTitle')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: t.instant('planning.seoMeta') });

    // Load when isCouple() BECOMES true, not only when it already is at construction: a guest
    // who signs in via the navbar modal on this page (or a signed-in user whose auth state
    // settles after hydration) must get their plan without a refresh. The latch keeps it one load.
    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.coupleLoadStarted) return;
      this.coupleLoadStarted = true;
      this.coupleSvc.me().subscribe({
        next: (c) => this.couple.set(c),
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

    // Leaving the page with the wizard open (browser Back) must not leave the next page locked.
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser && this.restartOpen()) this.doc.body.style.overflow = '';
    });
  }
}
