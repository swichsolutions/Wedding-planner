import { Component, PLATFORM_ID, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminClaim, AdminService, AdminVendor, ClaimCodeCreated } from '../../core/admin.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';
import { GROUPS, categoriesIn, categoryKey } from '../../core/catalog';
import { formatDate } from '../../core/dates';
import { AdminContent } from './admin-content';

type AdminTab = 'vendors' | 'content' | 'claims';
const TABS: AdminTab[] = ['vendors', 'content', 'claims'];

@Component({
  selector: 'app-admin',
  imports: [TranslatePipe, RouterLink, ReactiveFormsModule, AdminContent],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  host: { class: 'theme-brand' },
})
export class Admin {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly fb = inject(FormBuilder);

  // ---- Add one vendor by hand ----
  protected readonly groups = GROUPS;
  protected readonly categoriesIn = categoriesIn;
  protected readonly showAdd = signal(false);
  protected readonly adding = signal(false);
  protected readonly addAttempted = signal(false);
  protected readonly addForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    categorySlug: ['', [Validators.required]],
    city: [''],
    phone: [''],
    instagram: [''],
  });

  protected toggleAdd(): void {
    this.showAdd.update((v) => !v);
    this.addAttempted.set(false);
  }

  /** Creates the vendor and opens the editor on it, where photos and the rest are added. */
  protected createVendor(): void {
    if (this.addForm.invalid) {
      this.toast.error('dash.fixErrors');
      this.addAttempted.set(true);
      this.addForm.markAllAsTouched();
      return;
    }
    const v = this.addForm.getRawValue();
    this.adding.set(true);
    this.admin
      .createVendor({
        name: v.name!,
        categorySlug: v.categorySlug!,
        city: v.city || undefined,
        phone: v.phone || undefined,
        instagram: v.instagram || undefined,
      })
      .subscribe({
        next: (created) => this.router.navigate(['/admin/vendors', created.id]),
        error: () => {
          this.adding.set(false);
          this.toast.error('adminPage.addError');
        },
      });
  }

  /** Vendors (moderation), content (editor) or takeover requests; kept in ?tab= so a reload stays put. */
  protected readonly tab = signal<AdminTab>(
    TABS.find((t) => t === this.route.snapshot.queryParamMap.get('tab')) ?? 'vendors',
  );

  private readonly contentEditor = viewChild(AdminContent);

  protected async setTab(tab: AdminTab): Promise<void> {
    // Leaving the content tab destroys its editor: an unsaved article gets the same question as "Back".
    if (this.tab() === 'content' && tab !== 'content') {
      const editor = this.contentEditor();
      if (editor && !(await editor.confirmDiscard())) return;
    }
    this.tab.set(tab);
    if (tab === 'claims' && this.isBrowser) this.loadClaims();
    this.router.navigate([], { queryParams: { tab: tab === 'vendors' ? null : tab }, replaceUrl: true });
  }

  protected readonly vendors = signal<AdminVendor[]>([]);
  protected readonly pendingOnly = signal(true);
  protected readonly loadError = signal(false);
  protected readonly loading = signal(true);
  protected readonly skeletons = [0, 1, 2, 3];
  /** Monotonic request id — a slow response from a superseded filter switch is dropped. */
  private loadSeq = 0;

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('adminPage.title')} | ${t.instant('brand.name')}`);
    // Private: the admin panel.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    if (this.isBrowser) {
      this.load();
      if (this.tab() === 'claims') this.loadClaims();
    }
  }

  protected setPending(pending: boolean): void {
    this.pendingOnly.set(pending);
    this.load();
  }

  protected approve(id: number): void {
    this.admin.approve(id).subscribe({
      next: () => {
        if (this.pendingOnly()) {
          this.vendors.update((list) => list.filter((v) => v.id !== id));
        } else {
          this.vendors.update((list) =>
            list.map((v) => (v.id === id ? { ...v, isApproved: true } : v)),
          );
        }
      },
      error: (err: { status?: number }) =>
        this.toast.error(err.status === 409 ? 'adminPage.approveNoCity' : 'adminPage.saveError'),
    });
  }

  protected toggleFeature(id: number): void {
    this.admin.toggleFeature(id).subscribe({
      next: (res) =>
        this.vendors.update((list) =>
          list.map((v) => (v.id === id ? { ...v, isFeatured: res.isFeatured } : v)),
        ),
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  protected async deleteVendor(v: AdminVendor): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'adminPage.deleteTitle',
      detail: v.name,
      body: v.hasOwner ? 'adminPage.deleteBodyOwner' : 'adminPage.deleteBody',
      confirmLabel: 'adminPage.delete',
      danger: true,
    });
    if (!ok) return;
    this.admin.deleteVendor(v.id).subscribe({
      next: () => {
        this.vendors.update((list) => list.filter((x) => x.id !== v.id));
        this.toast.success('adminPage.deleted');
      },
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  // ---- One-time codes (2026-11-13): the admin sends one to the vendor, who takes the profile with it ----
  /** The code just made, shown under its vendor's row until closed: the API keeps only its hash. */
  protected readonly newCode = signal<(ClaimCodeCreated & { vendorId: number; name: string }) | null>(null);
  private readonly translate = inject(TranslateService);

  protected async createCode(v: AdminVendor): Promise<void> {
    // a new code replaces an open one: the link already sent stops working
    if (v.claimCodeExpiresAt) {
      const ok = await this.confirm.confirm({
        title: 'adminPage.codeReplaceTitle',
        detail: v.name,
        body: 'adminPage.codeReplaceBody',
        confirmLabel: 'adminPage.codeNew',
      });
      if (!ok) return;
    }
    this.admin.createClaimCode(v.id).subscribe({
      next: (c) => {
        this.newCode.set({ ...c, vendorId: v.id, name: v.name });
        this.vendors.update((list) => list.map((x) => (x.id === v.id ? { ...x, claimCodeExpiresAt: c.expiresAt } : x)));
      },
      error: (err: { status?: number }) =>
        this.toast.error(err.status === 409 ? 'adminPage.codeHasOwner' : 'adminPage.saveError'),
    });
  }

  protected async cancelCode(v: AdminVendor): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'adminPage.codeCancelTitle',
      detail: v.name,
      body: 'adminPage.codeCancelBody',
      confirmLabel: 'adminPage.codeCancel',
      danger: true,
    });
    if (!ok) return;
    this.admin.deleteClaimCode(v.id).subscribe({
      next: () => {
        this.vendors.update((list) => list.map((x) => (x.id === v.id ? { ...x, claimCodeExpiresAt: null } : x)));
        if (this.newCode()?.vendorId === v.id) this.newCode.set(null);
      },
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  protected async unlinkOwner(v: AdminVendor): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'adminPage.unlinkTitle',
      detail: `${v.name} · ${v.ownerEmail ?? ''}`,
      body: 'adminPage.unlinkBody',
      confirmLabel: 'adminPage.unlink',
      danger: true,
    });
    if (!ok) return;
    this.admin.unlinkOwner(v.id).subscribe({
      next: () =>
        this.vendors.update((list) => list.map((x) => (x.id === v.id ? { ...x, hasOwner: false, ownerEmail: null } : x))),
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  /** The link in the message: lower case, the site's addresses are (the code itself isn't case-sensitive). */
  protected codeLink(code: string): string {
    const origin = this.isBrowser ? window.location.origin : '';
    return `${origin}/kodi/${code.toLowerCase()}`;
  }

  /** The ready message for Instagram, WhatsApp or SMS, in the panel's language. */
  protected codeMessage(c: ClaimCodeCreated & { name: string }): string {
    return this.translate.instant('adminPage.codeMessage', {
      name: c.name,
      link: this.codeLink(c.code),
      code: c.code,
      date: this.formatDate(c.expiresAt),
    });
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('adminPage.copied');
    } catch {
      this.toast.error('adminPage.copyError');
    }
  }

  // ---- Takeover requests (A3): vendor accounts asking for an admin-added profile ----
  protected readonly claims = signal<AdminClaim[]>([]);
  protected readonly claimsPendingOnly = signal(true);
  protected readonly claimsLoading = signal(false);
  protected readonly claimsError = signal(false);

  protected setClaimsPending(pending: boolean): void {
    this.claimsPendingOnly.set(pending);
    this.loadClaims();
  }

  protected loadClaims(): void {
    this.claimsLoading.set(true);
    this.claimsError.set(false);
    this.admin.listClaims(this.claimsPendingOnly()).subscribe({
      next: (list) => {
        this.claims.set(list);
        this.claimsLoading.set(false);
      },
      error: () => {
        this.claimsLoading.set(false);
        this.claimsError.set(true);
      },
    });
  }

  /** Links the account to the profile (the vendor signs in again afterwards); the list reloads.
   *  It hands a profile to an account, so one click isn't enough: it asks first. */
  protected async approveClaim(c: AdminClaim): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'adminPage.claimApproveTitle',
      detail: `${c.vendorName} · ${c.userEmail}`,
      body: 'adminPage.claimApproveBody',
      confirmLabel: 'adminPage.approve',
    });
    if (!ok) return;
    this.admin.approveClaim(c.id).subscribe({
      next: () => this.loadClaims(),
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  protected async rejectClaim(c: AdminClaim): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'adminPage.claimRejectTitle',
      detail: `${c.vendorName} · ${c.userEmail}`,
      body: 'adminPage.claimRejectBody',
      confirmLabel: 'adminPage.reject',
      danger: true,
    });
    if (!ok) return;
    this.admin.rejectClaim(c.id).subscribe({
      next: () => this.loadClaims(),
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  protected catKey(slug: string): string {
    return categoryKey(slug);
  }

  /** Georgian month names spelled out, the same on server and browser (core/dates). */
  protected formatDate(iso: string): string {
    return formatDate(iso, this.lang.current(), 'medium');
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    this.admin.listVendors(this.pendingOnly()).subscribe({
      // seq check: rapid Pending↔All switches fire overlapping requests, and a
      // slow stale response must not land last and show the wrong list.
      next: (v) => {
        if (seq !== this.loadSeq) return;
        this.vendors.set(v);
        this.loading.set(false);
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }
}
