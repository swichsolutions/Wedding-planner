import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CATEGORIES, img } from '../../core/catalog';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';

interface ScatterPhoto {
  src: string;
  left: string;
  top: string;
  size: number;
  rot: number;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="vreg">
      <!-- decorative scattered vendor photos (desktop only) -->
      <div class="vreg__scatter" aria-hidden="true">
        @for (p of photos; track p.src) {
          <img class="vreg__photo" [src]="p.src" alt="" loading="lazy"
            [style.left]="p.left" [style.top]="p.top" [style.width.px]="p.size"
            [style.transform]="'rotate(' + p.rot + 'deg)'" />
        }
      </div>

      <div class="auth vreg__form">
        <h1>{{ 'auth.registerTitle' | translate }}</h1>
        <p class="auth__intro">{{ 'auth.registerSubtitle' | translate }}</p>
        <div class="auth__card">
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="auth__field">
              <label for="r-name">{{ 'auth.vendorName' | translate }}</label>
              <input id="r-name" type="text" formControlName="vendorName" autocomplete="organization" aria-required="true" />
            </div>
            <div class="auth__field">
              <label for="r-cat">{{ 'auth.category' | translate }}</label>
              <select id="r-cat" formControlName="categorySlug" aria-required="true">
                <option value="">{{ 'auth.selectCategory' | translate }}</option>
                @for (c of categories; track c.slug) {
                  <option [value]="c.slug">{{ c.key | translate }}</option>
                }
              </select>
            </div>
            <div class="auth__field">
              <label for="r-email">{{ 'auth.email' | translate }}</label>
              <input id="r-email" type="email" formControlName="email" autocomplete="email" spellcheck="false" aria-required="true"
                [class.is-invalid]="attempted() && form.controls.email.invalid"
                [attr.aria-invalid]="attempted() && form.controls.email.invalid ? 'true' : null" />
              @if (attempted() && form.controls.email.hasError('required')) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              } @else if (attempted() && form.controls.email.hasError('email')) {
                <span class="auth__err">{{ 'auth.emailInvalid' | translate }}</span>
              }
            </div>
            <div class="auth__field">
              <label for="r-pass">{{ 'auth.password' | translate }}</label>
              <input id="r-pass" type="password" formControlName="password" autocomplete="new-password" aria-required="true"
                aria-describedby="r-pass-reqs"
                [class.is-invalid]="attempted() && form.controls.password.invalid"
                [attr.aria-invalid]="attempted() && form.controls.password.invalid ? 'true' : null" />
              @if (attempted() && form.controls.password.hasError('required')) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              } @else if (attempted() && form.controls.password.hasError('password')) {
                <span class="auth__err">{{ 'auth.pwReqNotMet' | translate }}</span>
              }
              <ul id="r-pass-reqs" class="pw-reqs" aria-live="polite"
                [class.is-checking]="attempted() && form.controls.password.hasError('password')">
                <li class="pw-req" [class.is-met]="pwChecks().length">{{ 'auth.pwReqLength' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().upper">{{ 'auth.pwReqUpper' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().lower">{{ 'auth.pwReqLower' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().digit">{{ 'auth.pwReqDigit' | translate }}</li>
              </ul>
            </div>
            @if (error()) {
              <p class="auth__error" role="alert">{{ 'auth.registerError' | translate }}</p>
            }
            <button class="btn btn--pink" type="submit" [disabled]="loading()">
              {{ 'auth.signUp' | translate }}
            </button>
          </form>
          <p class="auth__alt">
            {{ 'auth.haveAccount' | translate }} <a routerLink="/login">{{ 'auth.login' | translate }}</a>
          </p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly categories = CATEGORIES;
  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  /** Set on a failed submit — reveals the inline email/password validation messages. */
  protected readonly attempted = signal(false);

  // Scattered vendor snapshots thrown into the margins around the form — deliberately
  // asymmetric (varied position, size, rotation). Kept to the left/right gutters so they
  // never sit under the form; hidden on mobile (see register.scss).
  protected readonly photos: ScatterPhoto[] = [
    { src: img('photo-1587750059638-e7e8c43b99fc', 600), left: '1%', top: '30%', size: 338, rot: -9 }, // classic Chevy (left)
    { src: img('photo-1519167758481-83f550bb49b3', 600), left: '8%', top: '3%', size: 263, rot: 7 }, // venue (left)
    { src: img('photo-1560066984-138dadb4c035', 600), left: '3%', top: '61%', size: 285, rot: 5 }, // hair (left)
    { src: img('photo-1519225421980-715cb0215aed', 600), left: '44%', top: '1%', size: 278, rot: -5 }, // reception (center-top, behind title)
    { src: img('photo-1507504031003-b417219a0fde', 600), left: '42%', top: '90%', size: 248, rot: 6 }, // flowers (center-bottom, below card)
    { src: img('photo-1606216794074-735e91aa2c92', 600), left: '74%', top: '6%', size: 315, rot: 8 }, // couple (right)
    { src: img('photo-1519741497674-611481863552', 600), left: '80%', top: '33%', size: 240, rot: -10 }, // rings (right)
    { src: img('photo-1535254973040-607b474cb50d', 600), left: '72%', top: '56%', size: 330, rot: 4 }, // cake (right)
  ];

  protected readonly form = this.fb.group({
    vendorName: ['', [Validators.required, Validators.minLength(2)]],
    categorySlug: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('auth.registerTitle')} | ${t.instant('brand.name')}`);
  }

  /** Live per-rule state for the password requirements checklist (updates as the user types). */
  protected pwChecks() {
    return passwordChecks(this.form.controls.password.value ?? '');
  }

  protected submit(): void {
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
      .registerVendor({
        email: v.email!,
        password: v.password!,
        vendorName: v.vendorName!,
        categorySlug: v.categorySlug!,
      })
      .subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
