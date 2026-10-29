import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmService } from '../../core/confirm.service';
import { CoupleProfile, CoupleService, PlanInviteCreated } from '../../core/couple.service';
import { formatDate } from '../../core/dates';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';
import { PlanDetailsFields, patchPlanDetails, planDetailsForm, toPlanDetails } from './plan-details-fields';

/**
 * „პარამეტრები“ (guide §6): the plan's details (names, date, place, guest estimate) and partner
 * access (D8) — one invitation link at a time, shown once when made, optionally emailed; with two
 * people on the plan, either can remove the other or leave.
 */
@Component({
  selector: 'app-plan-settings',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, PlanDetailsFields],
  templateUrl: './plan-settings.html',
  styleUrl: './plan-settings.scss',
  host: { class: 'theme-brand' },
})
export class PlanSettings {
  private readonly fb = inject(FormBuilder);
  private readonly couple = inject(CoupleService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);

  protected readonly plan = signal<CoupleProfile | null>(null);
  protected readonly loadError = signal(false);
  protected readonly form = planDetailsForm(this.fb);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  // ---- partner access ----
  protected readonly inviteForm = this.fb.group({ email: ['', [Validators.email, Validators.maxLength(256)]] });
  protected readonly inviting = signal(false);
  /** The link just made: shown once (the server keeps only its hash). */
  protected readonly created = signal<PlanInviteCreated | null>(null);
  protected readonly copied = signal(false);

  protected readonly partner = computed(() => this.plan()?.members?.find((m) => !m.isMe) ?? null);
  protected readonly me = computed(() => this.plan()?.members?.find((m) => m.isMe) ?? null);

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('plan.settingsTitle')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    this.form.valueChanges.subscribe(() => this.saved.set(false));
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.load();
  }

  private load(): void {
    this.couple.me().subscribe({
      next: (p) => this.apply(p),
      error: () => this.loadError.set(true),
    });
  }

  private apply(p: CoupleProfile): void {
    this.plan.set(p);
    patchPlanDetails(this.form, p, true);
    this.form.markAsPristine();
    this.saved.set(false);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.couple.update(toPlanDetails(this.form)).subscribe({
      next: (p) => {
        this.apply(p);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('plan.saveError');
      },
    });
  }

  // ------------------------------------------------------------------ partner access

  protected invite(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    const email = this.plan()?.emailInvites ? this.inviteForm.getRawValue().email?.trim() || null : null;
    this.inviting.set(true);
    this.copied.set(false);
    this.couple.createInvite(email, this.lang.current()).subscribe({
      next: (c) => {
        this.created.set(c);
        this.inviting.set(false);
        this.inviteForm.reset();
        this.couple.me().subscribe({ next: (p) => this.plan.set(p), error: () => {} });
      },
      error: (err: HttpErrorResponse) => {
        this.inviting.set(false);
        this.toast.error(err.status === 409 ? 'plan.inviteFull' : 'plan.inviteError');
      },
    });
  }

  protected async copyLink(): Promise<void> {
    const link = this.created()?.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
    } catch {
      // No clipboard (http, old browser): the link is selectable in the field.
      this.toast.error('plan.copyError');
    }
  }

  protected async revoke(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'plan.revokeTitle',
      body: 'plan.revokeBody',
      confirmLabel: 'plan.revoke',
      danger: true,
    });
    if (!ok) return;
    this.couple.revokeInvite().subscribe({
      next: () => {
        this.created.set(null);
        this.plan.update((p) => (p ? { ...p, invite: null } : p));
      },
      error: () => this.toast.error('plan.inviteError'),
    });
  }

  protected async removePartner(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'plan.removeTitle',
      body: 'plan.removeBody',
      detail: this.partner()?.name ?? this.partner()?.email ?? undefined,
      confirmLabel: 'plan.remove',
      danger: true,
    });
    if (!ok) return;
    this.couple.removePartner().subscribe({
      next: () => this.load(),
      error: () => this.toast.error('plan.inviteError'),
    });
  }

  protected async leave(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'plan.leaveTitle',
      body: 'plan.leaveBody',
      confirmLabel: 'plan.leave',
      danger: true,
    });
    if (!ok) return;
    this.couple.leave().subscribe({
      // A fresh, empty plan of their own from here on.
      next: () => {
        this.created.set(null);
        this.load();
        this.toast.success('plan.leftToast');
      },
      error: () => this.toast.error('plan.inviteError'),
    });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.lang.current());
  }
}
