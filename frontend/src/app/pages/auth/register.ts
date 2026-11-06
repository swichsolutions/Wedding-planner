import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthService, ClaimableVendor, defaultRouteFor } from '../../core/auth.service';
import { GROUPS, categoriesIn, categoryKey, img } from '../../core/catalog';
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
              <input id="r-name" type="text" formControlName="vendorName" autocomplete="organization" aria-required="true"
                [class.is-invalid]="attempted() && form.controls.vendorName.invalid"
                [attr.aria-invalid]="attempted() && form.controls.vendorName.invalid ? 'true' : null" />
              @if (attempted() && form.controls.vendorName.invalid) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              }
            </div>
            <!-- A3 takeover: listings the platform added that match the typed name -->
            @if (claim(); as c) {
              <div class="auth__claim" role="status">
                <span>{{ 'auth.claimChosen' | translate }} <strong>{{ c.name }}</strong>
                  · {{ categoryKey(c.categorySlug) | translate }}@if (c.city) { · {{ c.city }} }</span>
                <button type="button" class="auth__claim-btn" (click)="clearClaim()">{{ 'auth.claimChange' | translate }}</button>
                <p class="auth__claim-note">{{ 'auth.claimNote' | translate }}</p>
              </div>
            } @else if (matches().length) {
              <div class="auth__claims">
                <p class="auth__claims-title">{{ 'auth.claimPrompt' | translate }}</p>
                <ul class="auth__claims-list" role="list">
                  @for (m of matches(); track m.id) {
                    <li>
                      <span>{{ m.name }}
                        <span class="auth__claims-sub">· {{ categoryKey(m.categorySlug) | translate }}@if (m.city) { · {{ m.city }} }</span>
                      </span>
                      <button type="button" class="auth__claim-btn" (click)="pickClaim(m)">{{ 'auth.claimThis' | translate }}</button>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (!claim()) {
            <div class="auth__field">
              <label for="r-cat">{{ 'auth.category' | translate }}</label>
              <select id="r-cat" formControlName="categorySlug" aria-required="true"
                [class.is-invalid]="attempted() && form.controls.categorySlug.invalid"
                [attr.aria-invalid]="attempted() && form.controls.categorySlug.invalid ? 'true' : null">
                <option value="">{{ 'auth.selectCategory' | translate }}</option>
                @for (g of groups; track g) {
                  <optgroup [label]="'catalog.groups.' + g | translate">
                    @for (c of categoriesIn(g); track c.slug) {
                      <option [value]="c.slug">{{ c.key | translate }}</option>
                    }
                  </optgroup>
                }
              </select>
              @if (attempted() && form.controls.categorySlug.invalid) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              }
            </div>
            }
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
            <button class="btn btn--primary" type="submit" [disabled]="loading()">
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
  host: { class: 'theme-brand' },
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly groups = GROUPS;
  protected readonly categoriesIn = categoriesIn;
  protected readonly categoryKey = categoryKey;
  /** Admin-added listings matching the typed business name, and the one the vendor says is theirs. */
  protected readonly matches = signal<ClaimableVendor[]>([]);
  protected readonly claim = signal<ClaimableVendor | null>(null);
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
    // A sign-up form has nothing to rank for.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Signed-in users have no business on the vendor registration form. Without this,
    // a couple who signs in via the navbar modal while on this page could still submit
    // it and silently overwrite their session with a brand-new vendor account.
    // Skipped while our own request is in flight — submit() navigates itself.
    effect(() => {
      const user = this.auth.user();
      if (user && !this.loading()) this.router.navigateByUrl(defaultRouteFor(user));
    });

    // As the name is typed, offer admin-added listings with that name (A3 takeover). Quiet on
    // failure: the form still works as a plain sign-up.
    this.form.controls.vendorName.valueChanges
      .pipe(
        map((v) => (v ?? '').trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) =>
          q.length < 2 || this.claim() ? of([]) : this.auth.claimableVendors(q).pipe(catchError(() => of([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.matches.set(list));
  }

  /** The vendor picked an admin-added listing as theirs: no category to choose, the listing has one. */
  protected pickClaim(v: ClaimableVendor): void {
    this.claim.set(v);
    this.matches.set([]);
    this.form.controls.vendorName.setValue(v.name);
    this.form.controls.categorySlug.clearValidators();
    this.form.controls.categorySlug.updateValueAndValidity();
  }

  protected clearClaim(): void {
    this.claim.set(null);
    this.form.controls.categorySlug.setValidators([Validators.required]);
    this.form.controls.categorySlug.updateValueAndValidity();
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
    const claim = this.claim();
    this.auth
      .registerVendor({
        email: v.email!,
        password: v.password!,
        vendorName: v.vendorName!,
        ...(claim ? { claimVendorId: claim.id } : { categorySlug: v.categorySlug! }),
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
