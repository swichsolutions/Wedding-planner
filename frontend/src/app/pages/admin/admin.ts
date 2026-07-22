import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService, AdminVendor } from '../../core/admin.service';
import { LanguageService } from '../../i18n/language.service';
import { categoryKey } from '../../core/catalog';

@Component({
  selector: 'app-admin',
  imports: [TranslatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  private readonly admin = inject(AdminService);
  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly vendors = signal<AdminVendor[]>([]);
  protected readonly pendingOnly = signal(true);
  protected readonly loadError = signal(false);

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('adminPage.title')} | ${t.instant('brand.name')}`);
    if (this.isBrowser) this.load();
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
      error: () => {},
    });
  }

  protected toggleFeature(id: number): void {
    this.admin.toggleFeature(id).subscribe({
      next: (res) =>
        this.vendors.update((list) =>
          list.map((v) => (v.id === id ? { ...v, isFeatured: res.isFeatured } : v)),
        ),
      error: () => {},
    });
  }

  protected catKey(slug: string): string {
    return categoryKey(slug);
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  }

  private load(): void {
    this.admin.listVendors(this.pendingOnly()).subscribe({
      next: (v) => this.vendors.set(v),
      error: () => this.loadError.set(true),
    });
  }
}
