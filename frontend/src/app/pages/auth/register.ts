import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthService, ClaimableVendor, defaultRouteFor } from '../../core/auth.service';
import { GROUPS, categoriesIn, categoryKey } from '../../core/catalog';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <!-- The same layout as the couple sign-up (2026-11-12): from 1024px a photo on the left
         (the global section.auth split, here the decorated hall) and the white card on the
         right, with the title and description inside the card. The scattered photo collage
         went: one of its prints sat under the title and made it unreadable. -->
    <section class="auth auth--vendor">
      <div class="auth__card">
          <h1>{{ 'auth.registerTitle' | translate }}</h1>
          <p class="auth__intro">{{ 'auth.registerSubtitle' | translate }}</p>
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
