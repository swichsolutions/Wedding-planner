import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminClaim, AdminService, AdminVendor } from '../../core/admin.service';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';
import { categoryKey } from '../../core/catalog';
import { formatDate } from '../../core/dates';
import { AdminContent } from './admin-content';
import { AdminImport } from './admin-import';

type AdminTab = 'vendors' | 'content' | 'import' | 'claims';
const TABS: AdminTab[] = ['vendors', 'content', 'import', 'claims'];

@Component({
  selector: 'app-admin',
  imports: [TranslatePipe, RouterLink, AdminContent, AdminImport],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  host: { class: 'theme-brand' },
})
export class Admin {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Vendors (moderation), content (editor), the vendor import or takeover requests; kept in ?tab= so a reload stays put. */
  protected readonly tab = signal<AdminTab>(
    TABS.find((t) => t === this.route.snapshot.queryParamMap.get('tab')) ?? 'vendors',
  );

  protected setTab(tab: AdminTab): void {
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
      error: () => this.toast.error('adminPage.saveError'),
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

  // ---- Takeover requests (A3): vendor accounts asking for an imported profile ----
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

  /** Links the account to the profile (the vendor signs in again afterwards); the list reloads. */
  protected approveClaim(id: number): void {
    this.admin.approveClaim(id).subscribe({
      next: () => this.loadClaims(),
      error: () => this.toast.error('adminPage.saveError'),
    });
  }

  protected rejectClaim(id: number): void {
    this.admin.rejectClaim(id).subscribe({
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
