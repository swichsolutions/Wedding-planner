import { Component, ElementRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CATEGORIES, categoryKey } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm.service';
import { todayIso } from '../../core/dates';
import { sizedImage } from '../../core/images';
import {
  PlanService,
  PlanServiceEdit,
  PlanServicesService,
  SERVICE_STATUSES,
  ServiceStatus,
  serviceEdit,
} from '../../core/plan-services.service';
import { ToastService } from '../../core/toast.service';
import { VendorService } from '../../core/vendor.service';
import { WishlistService } from '../../core/wishlist.service';
import { LanguageService } from '../../i18n/language.service';

type Filter = 'all' | ServiceStatus;

/** Sections top to bottom: what's decided first, then the shortlist, then everything saved. */
const SECTION_ORDER: ServiceStatus[] = ['chosen', 'shortlist', 'saved'];

/**
 * „ჩემი მომსახურებები“ (BUILD-PLAN B4, guide §6): every vendor the couple is considering, saved
 * from the catalog with the heart or added by hand, moved from saved → shortlisted → chosen, with
 * how to reach them and what they offered. A chosen vendor's agreed price goes into the budget
 * with the next payment's due date. Shared by both partners.
 */
@Component({
  selector: 'app-services',
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './services.html',
  styleUrl: './services.scss',
  host: { class: 'theme-brand' },
})
export class Services {
  private readonly api = inject(PlanServicesService);
  private readonly vendors = inject(VendorService);
  private readonly wishlist = inject(WishlistService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly items = signal<PlanService[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly filter = signal<Filter>('all');

  /** The form is open: 'new' adds, a number edits that service. */
  protected readonly editing = signal<'new' | number | null>(null);
  protected readonly saving = signal(false);
  /** The "add to budget" panel is open on this service. */
  protected readonly budgeting = signal<number | null>(null);
  protected readonly budgetBusy = signal(false);
  /** Status changes in flight (one at a time per service). */
  private readonly statusBusy = new Set<number>();

  protected readonly statuses = SERVICE_STATUSES;
  protected readonly sectionOrder = SECTION_ORDER;
  protected readonly categories = CATEGORIES;
  protected readonly today = todayIso();

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    categorySlug: [''],
    status: ['shortlist' as ServiceStatus],
    phone: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    instagram: ['', [Validators.maxLength(200)]],
    offer: [null as number | null, [Validators.min(0), Validators.max(999_999_999)]],
    offerNote: ['', [Validators.maxLength(500)]],
    note: ['', [Validators.maxLength(1000)]],
  });

  protected readonly count = computed(() => {
    const by = { saved: 0, shortlist: 0, chosen: 0 } as Record<ServiceStatus, number>;
    for (const s of this.items()) by[s.status]++;
    return by;
  });

  /** The services by status (chosen first), with the filter applied; empty sections drop out. */
  protected readonly sections = computed(() => {
    const f = this.filter();
    const order = new Map(CATEGORIES.map((c, i) => [c.slug, i]));
    return SECTION_ORDER.filter((status) => f === 'all' || f === status)
      .map((status) => ({
        status,
        items: this.items()
          .filter((s) => s.status === status)
          .sort(
            (a, b) =>
              (order.get(a.categorySlug ?? '') ?? 999) - (order.get(b.categorySlug ?? '') ?? 999) ||
              b.createdAt.localeCompare(a.createdAt),
          ),
      }))
      .filter((sec) => sec.items.length > 0 || f !== 'all');
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('services.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.load();
  }

  private load(): void {
    this.loadError.set(false);
    this.api.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected retry(): void {
    this.load();
  }

  // ------------------------------------------------------------------ status

  protected setStatus(s: PlanService, status: ServiceStatus): void {
    if (s.status === status || this.statusBusy.has(s.id)) return;
    this.statusBusy.add(s.id);
    const before = s.status;
    this.patch(s.id, { status });
    this.api.update(s.id, { ...serviceEdit(s), status }).subscribe({
      next: (saved) => {
        this.statusBusy.delete(s.id);
        this.replace(saved);
        // Chosen: offer to put the agreed price into the budget (guide §6).
        if (status === 'chosen' && saved.budgetItemId === null) this.openBudget(saved);
      },
      error: () => {
        this.statusBusy.delete(s.id);
        this.patch(s.id, { status: before });
        this.toast.error('services.saveError');
      },
    });
  }

  // ------------------------------------------------------------------ add / edit / delete

  protected startAdd(): void {
    this.budgeting.set(null);
    this.form.reset({
      name: '', categorySlug: '', status: 'shortlist', phone: '', email: '', instagram: '',
      offer: null, offerNote: '', note: '',
    });
    this.editing.set('new');
    this.focus('#svc-name');
  }

  protected startEdit(s: PlanService): void {
    this.budgeting.set(null);
    this.form.reset({
      name: s.name,
      categorySlug: s.categorySlug ?? '',
      status: s.status,
      phone: s.phone ?? '',
      email: s.email ?? '',
      instagram: s.instagram ?? '',
      offer: s.offer,
      offerNote: s.offerNote ?? '',
      note: s.note ?? '',
    });
    // Catalog vendors: name and contacts come from the profile, so only the rest is checked.
    if (s.fromCatalog) this.form.controls.name.disable();
    else this.form.controls.name.enable();
    this.editing.set(s.id);
    this.focus(s.fromCatalog ? '#svc-offer' : '#svc-name');
  }

  protected cancel(): void {
    this.editing.set(null);
    this.form.controls.name.enable();
  }

  protected editingCatalog(): boolean {
    const id = this.editing();
    return typeof id === 'number' && !!this.items().find((s) => s.id === id)?.fromCatalog;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.host.nativeElement.querySelector('.is-invalid') as HTMLElement | null)?.focus();
      return;
    }
    const v = this.form.getRawValue();
    const t = (x: string | null | undefined) => (x ?? '').trim() || null;
    const body: PlanServiceEdit = {
      name: t(v.name),
      categorySlug: t(v.categorySlug),
      status: v.status ?? 'shortlist',
      phone: t(v.phone),
      email: t(v.email),
      instagram: t(v.instagram),
      offer: v.offer === null || (v.offer as unknown) === '' ? null : Number(v.offer),
      offerNote: t(v.offerNote),
      note: t(v.note),
    };
    const editing = this.editing();
    this.saving.set(true);
    const request = editing === 'new' ? this.api.add({ ...body, name: body.name ?? '' }) : this.api.update(editing as number, body);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.editing.set(null);
        this.form.controls.name.enable();
        if (editing === 'new') {
          this.items.update((list) => [saved, ...list]);
          if (this.filter() !== 'all' && this.filter() !== saved.status) this.filter.set('all');
        } else {
          this.replace(saved);
        }
      },
      error: (err: { status?: number }) => {
        this.saving.set(false);
        this.toast.error(err?.status === 409 ? 'services.full' : 'services.saveError');
      },
    });
  }

  protected async remove(s: PlanService): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'services.deleteTitle',
      detail: s.name,
      body: 'services.deleteBody',
      confirmLabel: 'services.delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(s.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((x) => x.id !== s.id));
        // The heart on its card and profile follows.
        if (s.fromCatalog) this.wishlist.reload();
      },
      error: () => this.toast.error('services.saveError'),
    });
  }

  // ------------------------------------------------------------------ into the budget

  protected openBudget(s: PlanService): void {
    this.editing.set(null);
    this.budgeting.set(s.id);
    this.focus(`#svc-amount-${s.id}`);
  }

  protected toBudget(s: PlanService, amount: HTMLInputElement, due: HTMLInputElement): void {
    const value = Number(amount.value);
    if (amount.value === '' || !(value >= 0)) {
      amount.focus();
      return;
    }
    this.budgetBusy.set(true);
    this.api.toBudget(s.id, value, due.value || null).subscribe({
      next: (r) => {
        this.budgetBusy.set(false);
        this.budgeting.set(null);
        this.patch(s.id, { budgetItemId: r.budgetItemId, offer: s.offer ?? value });
        this.toast.success('services.toBudgetDone');
      },
      error: () => {
        this.budgetBusy.set(false);
        this.toast.error('services.saveError');
      },
    });
  }

  // ------------------------------------------------------------------ view helpers

  protected category(slug: string | null): string {
    return slug ? categoryKey(slug) : 'services.noCategory';
  }

  protected profileLink(s: PlanService): string[] | null {
    const v = s.vendor;
    return v ? ['/', v.categorySlug, v.citySlug, v.slug] : null;
  }

  protected phone(s: PlanService): string | null {
    return s.vendor?.phone ?? s.phone;
  }

  protected instagramUrl(s: PlanService): string | null {
    const raw = (s.vendor?.instagram ?? s.instagram)?.trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : 'https://instagram.com/' + raw.replace(/^@/, '');
  }

  protected instagramLabel(s: PlanService): string {
    const raw = (s.vendor?.instagram ?? s.instagram ?? '').trim();
    const handle = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').replace(/^@/, '');
    return handle ? '@' + handle : 'Instagram';
  }

  /** Contact taps on a catalog vendor count toward its stats (the future featured-placement proof). */
  protected contacted(s: PlanService): void {
    if (s.vendor) this.vendors.trackContact(s.vendor.id);
  }

  /** A thumbnail-sized photo (2× the 96px box). */
  protected thumb(url: string): string {
    return sizedImage(url, 192) ?? url;
  }

  /** The first letter. Latin ones capitalised; Georgian stays as typed (uppercasing it gives
   * Mtavruli code points, and the display face already draws capitals). */
  protected initial(name: string): string {
    const first = [...name.trim()][0];
    return !first ? '·' : /[a-z]/i.test(first) ? first.toUpperCase() : first;
  }

  protected format(n: number | null): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(Math.round(n ?? 0)) + ' ₾';
  }

  private replace(saved: PlanService): void {
    this.items.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
  }

  private patch(id: number, change: Partial<PlanService>): void {
    this.items.update((list) => list.map((x) => (x.id === id ? { ...x, ...change } : x)));
  }

  private focus(selector: string): void {
    setTimeout(() => (this.host.nativeElement.querySelector(selector) as HTMLElement | null)?.focus());
  }
}
