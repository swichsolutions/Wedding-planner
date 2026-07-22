import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CATEGORIES, img } from '../../core/catalog';
import { focusFirstInvalid, nameValidator, passwordChecks, passwordValidator } from '../../core/forms';

/**
 * Couple onboarding — a multi-step, fun-first wizard (names → wedding date → planning stage →
 * needs → guest count → account). Modelled on Zola/The Knot: low-friction questions first,
 * credentials last, everything but email/password optional. Submits once at the end via
 * AuthService.registerCouple, which creates the account AND persists the profile.
 */
@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  protected readonly totalSteps = 6;
  protected readonly step = signal(0);
  protected readonly progress = computed(() => ((this.step() + 1) / this.totalSteps) * 100);

  // selection answers (text + credentials live in the reactive form)
  protected readonly stillDeciding = signal(false);
  protected readonly planningStage = signal<string | null>(null);
  protected readonly guestRange = signal<string | null>(null);
  protected readonly needed = signal<string[]>([]);

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  /** Set when the user tries to advance an incomplete step — reveals inline validation messages. */
  protected readonly attempted = signal(false);

  protected readonly categories = CATEGORIES;
  protected readonly stages = ['notEngaged', 'engaged', 'planningNoVenue', 'venueBooked', 'almostDone'];
  protected readonly guestRanges = ['0-50', '51-100', '101-150', '151-200', '201-300', '300plus', 'notSure'];

  // One editorial photo per step (Zola/Knot-style side panel). All verified to load.
  private readonly stepPhotos = [
    img('photo-1606800052052-a08af7148866', 900), // 0 names — a couple
    img('photo-1465495976277-4387d4b0b4c6', 900), // 1 date — ceremony
    img('photo-1519741497674-611481863552', 900), // 2 stage — rings
    img('photo-1522673607200-164d1b6ce486', 900), // 3 needs — florals/decor
    img('photo-1519225421980-715cb0215aed', 900), // 4 guests — reception
    img('photo-1470019693664-1d202d2c0907', 900), // 5 account — a toast
  ];
  protected stepPhoto(): string {
    return this.stepPhotos[this.step()] ?? this.stepPhotos[0];
  }
  protected stepCaption(): string {
    return `signup.caption${this.step()}`;
  }

  protected readonly form = this.fb.group({
    firstName: ['', [nameValidator()]],
    lastName: ['', [nameValidator()]],
    partnerFirstName: ['', [nameValidator()]],
    partnerLastName: ['', [nameValidator()]],
    weddingDate: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  /** Live per-rule state for the password requirements checklist (updates as the user types). */
  protected pwChecks() {
    return passwordChecks(this.form.controls.password.value ?? '');
  }

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('signup.title')} | ${t.instant('brand.name')}`);
  }

  /** "Nino & Giorgi", "Nino", or "" — drives the personalized final-step heading. */
  protected greeting(): string {
    const v = this.form.getRawValue();
    const a = (v.firstName || '').trim();
    const b = (v.partnerFirstName || '').trim();
    if (a && b) return `${a} & ${b}`;
    return a || b || '';
  }

  protected isNeeded(slug: string): boolean {
    return this.needed().includes(slug);
  }

  protected toggleNeeded(slug: string): void {
    this.needed.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
  }

  protected setStillDeciding(checked: boolean): void {
    this.stillDeciding.set(checked);
    const c = this.form.controls.weddingDate;
    if (checked) {
      c.setValue('');
      c.disable();
    } else {
      c.enable();
    }
  }

  /** i18n key for the current step's "why can't I continue" message ('' = step 0 uses per-field messages). */
  protected stepErrorKey(): string {
    switch (this.step()) {
      case 1: return 'signup.errDate';
      case 2: return 'signup.errStage';
      case 3: return 'signup.errNeeds';
      case 4: return 'signup.errGuests';
      default: return '';
    }
  }

  private focusFirstIssue(): void {
    const host = this.host.nativeElement as HTMLElement;
    if (this.step() === 0) {
      for (const id of ['s-fn', 's-ln', 's-pfn', 's-pln']) {
        const el = host.querySelector('#' + id) as HTMLInputElement | null;
        if (el && (!el.value.trim() || el.classList.contains('ng-invalid'))) { el.focus(); return; }
      }
    } else if (this.step() === 1 && !this.stillDeciding()) {
      (host.querySelector('#s-date') as HTMLElement | null)?.focus();
    }
  }

  protected back(): void {
    if (this.step() > 0) {
      this.attempted.set(false);
      this.step.update((s) => s - 1);
    }
  }

  /**
   * Is the current step's required input satisfied? Every step is mandatory; the only escape
   * is the Skip button on the "what you'll need" step (3).
   */
  protected stepValid(): boolean {
    const v = this.form.getRawValue();
    switch (this.step()) {
      case 0: {
        const c = this.form.controls;
        return !!(v.firstName?.trim() && v.lastName?.trim() &&
          v.partnerFirstName?.trim() && v.partnerLastName?.trim()) &&
          c.firstName.valid && c.lastName.valid &&
          c.partnerFirstName.valid && c.partnerLastName.valid;
      }
      case 1:
        return this.stillDeciding() || !!v.weddingDate;
      case 2:
        return this.planningStage() !== null;
      case 3:
        return this.needed().length > 0;
      case 4:
        return this.guestRange() !== null;
      default:
        return true;
    }
  }

  /** Advance past the "what you'll need" step without a selection. */
  protected skip(): void {
    this.attempted.set(false);
    this.step.update((s) => s + 1);
  }

  /** Primary action (form submit): advance, or on the last step create the account. */
  protected primary(): void {
    if (this.step() < this.totalSteps - 1) {
      if (!this.stepValid()) {
        this.attempted.set(true); // reveal the inline "what's missing" messages
        this.focusFirstIssue();
        return;
      }
      this.attempted.set(false);
      this.step.update((s) => s + 1);
      return;
    }
    this.submit();
  }

  private submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true); // reveal the inline email/password validation messages
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(false);

    const v = this.form.getRawValue();
    this.auth
      .registerCouple({
        email: v.email!,
        password: v.password!,
        firstName: v.firstName?.trim() || undefined,
        lastName: v.lastName?.trim() || undefined,
        partnerFirstName: v.partnerFirstName?.trim() || undefined,
        partnerLastName: v.partnerLastName?.trim() || undefined,
        weddingDate: this.stillDeciding() ? null : v.weddingDate || null,
        planningStage: this.planningStage(),
        guestCountRange: this.guestRange(),
        neededCategories: this.needed(),
      })
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl || '/planning'),
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
