import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { BUDGET_CATEGORIES, suggestedAllocation } from '../../core/budget';
import {
  Budget,
  BudgetItem,
  BudgetItemUpdate,
  BudgetService,
  BudgetVendorRef,
  reminderStatus,
} from '../../core/budget.service';
import { CATEGORIES } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Vendor } from '../../core/vendor.models';
import { VendorService } from '../../core/vendor.service';
import { WishlistService } from '../../core/wishlist.service';
import { LanguageService } from '../../i18n/language.service';

type DrawerKind = 'vendor' | 'details';
type DetailsTrigger = 'bell' | 'note';
type MoneyField = 'estimate' | 'actualCost' | 'paid';

const DRAG_HINT_KEY = 'ipsum.budget.dragHintSeen';

/**
 * Wedding budget planner. Two modes:
 * - Guest: the SEO-facing estimator (total → suggested split, Georgian norms) + signup CTA.
 * - Couple: the real tracker — server-backed line items (estimate / actual / paid), each
 *   linkable to a directory vendor or a free-text merchant, with notes + payment reminders.
 */
@Component({
  selector: 'app-budget-planner',
  imports: [
    RouterLink,
    TranslatePipe,
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
  ],
  templateUrl: './budget-planner.html',
  styleUrl: './budget-planner.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class BudgetPlanner {
  private readonly auth = inject(AuthService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly vendorSvc = inject(VendorService);
  private readonly wishlist = inject(WishlistService);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;

  // ---- tracker state (couple) ----
  protected readonly total = signal<number | null>(null);
  protected readonly items = signal<BudgetItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);

  protected readonly sumEstimate = computed(() => this.sum('estimate'));
  protected readonly sumActual = computed(() => this.sum('actualCost'));
  protected readonly sumPaid = computed(() => this.sum('paid'));
  protected readonly overBudget = computed(() => {
    const t = this.total();
    return t !== null && t > 0 && this.sumActual() > t;
  });

  // One open drawer at a time — either the vendor picker or the note/reminder details.
  // `src` remembers which icon opened the details drawer, so clicking the *other* icon
  // switches instead of closing (bell → note must not slam the drawer shut).
  protected readonly drawer = signal<{ id: number; kind: DrawerKind; src?: DetailsTrigger } | null>(
    null,
  );

  // One-time coach mark for drag-to-reorder; dismissed state persists per device.
  protected readonly dragHintDismissed = signal(true); // hidden until read from localStorage (SSR-safe)

  // Row detail popup (Zola-style) — resolved live from items() so edits stay in sync.
  protected readonly modalId = signal<number | null>(null);
  protected readonly modalItem = computed(() => {
    const id = this.modalId();
    return id === null ? null : (this.items().find((i) => i.id === id) ?? null);
  });

  // ---- vendor picker ----
  protected readonly pickerVendors = signal<Vendor[]>([]);
  protected readonly pickerLoading = signal(false);
  protected readonly pickerQuery = signal('');
  protected readonly pickerResults = computed(() => {
    const q = this.pickerQuery().trim().toLowerCase();
    const saved = this.wishlist.ids();
    return this.pickerVendors()
      .filter((v) => !q || v.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        const aSaved = saved.includes(a.id);
        const bSaved = saved.includes(b.id);
        if (aSaved !== bSaved) return aSaved ? -1 : 1;
        if (!!a.isFeatured !== !!b.isFeatured) return a.isFeatured ? -1 : 1;
        return 0;
      })
      .slice(0, 6);
  });

  // ---- add-item form ----
  protected readonly showAdd = signal(false);
  protected readonly addBusy = signal(false);
  protected readonly vendorCategories = CATEGORIES;

  // ---- guest estimator (kept — the public SEO tool) ----
  protected readonly estCategories = BUDGET_CATEGORIES;
  protected readonly estTotal = signal(30000);
  protected readonly estAmounts = signal<number[]>(suggestedAllocation(30000));
  protected readonly estAllocated = computed(() =>
    this.estAmounts().reduce((a, b) => a + b, 0),
  );
  protected readonly estRemaining = computed(() => this.estTotal() - this.estAllocated());

  constructor() {
    const brand = this.translate.instant('brand.name');
    inject(Title).setTitle(`${this.translate.instant('budgetPage.title')} | ${brand}`);
    inject(Meta).updateTag({
      name: 'description',
      content: this.translate.instant('budgetPage.subtitle'),
    });

    if (this.isBrowser && this.isCouple()) {
      this.dragHintDismissed.set(localStorage.getItem(DRAG_HINT_KEY) === '1');
      this.budgetSvc.get().subscribe({
        next: (b) => this.apply(b),
        error: () => this.loadError.set(true),
      });
    }
  }

  protected dismissDragHint(): void {
    this.dragHintDismissed.set(true);
    if (this.isBrowser) localStorage.setItem(DRAG_HINT_KEY, '1');
  }

  // =============================== tracker ===============================

  private apply(b: Budget): void {
    this.total.set(b.totalBudget);
    this.items.set(b.items);
    this.loaded.set(true);
  }

  // Total budget edits apply live (meters react per keystroke) and autosave after a pause.
  private totalSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private totalSavedTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly totalSaved = signal(false); // brief "saved ✓" confirmation

  protected onTotalInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Math.max(0, Number(raw) || 0);
    this.total.set(value); // summary meters update immediately
    this.totalSaved.set(false);
    if (this.totalSaveTimer) clearTimeout(this.totalSaveTimer);
    this.totalSaveTimer = setTimeout(() => this.persistTotal(value), 700);
  }

  private persistTotal(value: number | null): void {
    this.totalSaveTimer = null;
    // Estimates follow the total live — the server updates only rows the couple hasn't
    // hand-edited; tuned rows keep their numbers (the reset button is the explicit path).
    this.budgetSvc.updateTotal(value, true).subscribe({
      next: (b) => {
        this.apply(b);
        this.totalSaved.set(true);
        if (this.totalSavedTimer) clearTimeout(this.totalSavedTimer);
        this.totalSavedTimer = setTimeout(() => this.totalSaved.set(false), 2500);
      },
      error: () => this.toast.error('budgetPage.saveError'),
    });
  }

  protected recalcEstimates(): void {
    if (this.totalSaveTimer) {
      clearTimeout(this.totalSaveTimer);
      this.totalSaveTimer = null;
    }
    const t = this.total();
    if (t === null) return;
    this.budgetSvc.updateTotal(t, false, true).subscribe({
      next: (b) => this.apply(b),
      error: () => this.toast.error('budgetPage.saveError'),
    });
  }

  // In-flight PUT count per row — only the LAST response may replace the optimistic row,
  // otherwise an earlier response would clobber a newer edit.
  private readonly pendingSaves = new Map<number, number>();

  /**
   * Save one field change. Optimistic: the row updates immediately (so rapid edits build on
   * each other, not on stale snapshots) and the full-row payload is built from current state.
   * On failure we re-fetch the whole budget — the server is the source of truth.
   */
  private patch(
    item: BudgetItem,
    changes: Partial<BudgetItemUpdate>,
    vendorRef?: BudgetVendorRef | null,
  ): void {
    const id = item.id;
    const current = this.items().find((i) => i.id === id) ?? item;

    const payload: BudgetItemUpdate = {
      name: current.name,
      vendorId: current.vendor?.id ?? null,
      merchantName: current.merchantName,
      estimate: current.estimate,
      actualCost: current.actualCost,
      paid: current.paid,
      note: current.note,
      reminderDate: current.reminderDate,
      ...changes,
    };

    // Scalar fields map 1:1 onto the row; the vendor ref (not derivable from vendorId
    // alone) is supplied by callers that change the link.
    const { vendorId: _vendorId, ...scalar } = changes;
    const optimistic = {
      ...current,
      ...scalar,
      ...(vendorRef !== undefined ? { vendor: vendorRef } : {}),
    } as BudgetItem;
    this.items.update((list) => list.map((i) => (i.id === id ? optimistic : i)));

    this.pendingSaves.set(id, (this.pendingSaves.get(id) ?? 0) + 1);
    this.budgetSvc.updateItem(id, payload).subscribe({
      next: (updated) => {
        const left = (this.pendingSaves.get(id) ?? 1) - 1;
        if (left <= 0) {
          this.pendingSaves.delete(id);
          this.items.update((list) => list.map((i) => (i.id === id ? updated : i)));
        } else {
          this.pendingSaves.set(id, left);
        }
      },
      error: () => {
        this.pendingSaves.delete(id);
        this.toast.error('budgetPage.saveError');
        this.resync();
      },
    });
  }

  /** Reload the budget after a failed save so the UI matches the server again. */
  private resync(): void {
    this.budgetSvc.get().subscribe({
      next: (b) => this.apply(b),
      error: () => {},
    });
  }

  protected commitName(item: BudgetItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) {
      input.value = item.name; // empty name is invalid — restore what's saved
      return;
    }
    if (value === item.name) return;
    this.patch(item, { name: value });
  }

  protected commitMoney(item: BudgetItem, field: MoneyField, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Math.max(0, Number(raw) || 0);
    if (value === item[field]) return;
    this.patch(item, { [field]: value });
  }

  protected commitReminder(item: BudgetItem, event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    if (value === item.reminderDate) return;
    this.patch(item, { reminderDate: value });
  }

  protected commitNote(item: BudgetItem, textarea: HTMLTextAreaElement): void {
    const value = textarea.value.trim() || null;
    if (value === item.note) return;
    this.patch(item, { note: value });
  }

  /** A row carries amounts + note + reminder + vendor link — confirm before losing it. */
  protected askRemove(item: BudgetItem): void {
    void this.confirmSvc
      .confirm({
        title: 'budgetPage.deleteItem',
        detail: item.name,
        body: 'budgetPage.deleteConfirm',
        confirmLabel: 'budgetPage.delete',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.budgetSvc.removeItem(item.id).subscribe({
          next: () => {
            this.items.update((list) => list.filter((i) => i.id !== item.id));
            if (this.drawer()?.id === item.id) this.drawer.set(null);
            if (this.modalId() === item.id) this.modalId.set(null);
            this.toast.success('budgetPage.deletedToast');
          },
          error: () => this.toast.error('budgetPage.saveError'),
        });
      });
  }

  // ---- row detail popup ----

  /** Open the popup when the click landed on the row itself, not on one of its controls. */
  protected openRow(item: BudgetItem, event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, select, textarea, label, .brow__grip')) return;
    this.drawer.set(null);
    this.modalId.set(item.id);
  }

  protected closeModal(): void {
    this.modalId.set(null);
    this.drawer.set(null);
  }

  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  protected onEscape(): void {
    // The shared confirm dialog handles its own Escape.
    if (this.modalId() !== null) this.closeModal();
    else this.drawer.set(null);
  }

  protected addItem(
    name: HTMLInputElement,
    category: HTMLSelectElement,
    estimate: HTMLInputElement,
  ): void {
    const title = name.value.trim();
    if (!title || this.addBusy()) return;
    this.addBusy.set(true);
    this.budgetSvc
      .addItem({
        name: title,
        categorySlug: category.value || null,
        estimate: estimate.value === '' ? null : Math.max(0, Number(estimate.value) || 0),
      })
      .subscribe({
        next: (item) => {
          this.items.update((list) => [...list, item]);
          name.value = '';
          category.value = '';
          estimate.value = '';
          this.showAdd.set(false);
          this.addBusy.set(false);
        },
        error: () => {
          this.addBusy.set(false);
          this.toast.error('budgetPage.saveError');
        },
      });
  }

  /** Drag-and-drop reorder (pointer + touch); persists the new order, resyncs on failure. */
  protected drop(event: CdkDragDrop<BudgetItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = this.items().slice();
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.items.set(list);
    this.budgetSvc.reorder(list.map((i) => i.id)).subscribe({
      error: () => {
        this.toast.error('budgetPage.saveError');
        this.resync();
      },
    });
  }

  // ---- drawers (vendor picker / note+reminder) ----

  protected isDrawerOpen(item: BudgetItem, kind: DrawerKind): boolean {
    const d = this.drawer();
    return d?.id === item.id && d.kind === kind;
  }

  protected toggleDrawer(item: BudgetItem, kind: DrawerKind): void {
    if (this.isDrawerOpen(item, kind)) {
      this.drawer.set(null);
      return;
    }
    this.drawer.set({ id: item.id, kind });
    if (kind === 'vendor') this.loadPicker(item);
  }

  /** Bell/note share the details drawer: same icon toggles, the other icon switches. */
  protected toggleDetails(item: BudgetItem, src: DetailsTrigger): void {
    const d = this.drawer();
    if (d?.id === item.id && d.kind === 'details' && d.src === src) {
      this.drawer.set(null);
      return;
    }
    this.drawer.set({ id: item.id, kind: 'details', src });
  }

  private loadPicker(item: BudgetItem): void {
    this.pickerQuery.set('');
    this.pickerLoading.set(true);
    this.pickerVendors.set([]);
    // No mock fallback here — picking writes a vendor id to the server, and mock ids
    // could silently link the wrong real vendor when the API is unreachable.
    this.vendorSvc
      .list(item.categorySlug ? { category: item.categorySlug } : {}, { mockFallback: false })
      .subscribe({
        next: (vendors) => {
          // Ignore stale responses if the drawer moved to another row meanwhile.
          if (this.drawer()?.id !== item.id) return;
          this.pickerVendors.set(vendors);
          this.pickerLoading.set(false);
        },
        error: () => this.pickerLoading.set(false),
      });
  }

  protected setPickerQuery(event: Event): void {
    this.pickerQuery.set((event.target as HTMLInputElement).value);
  }

  protected chooseVendor(item: BudgetItem, vendor: Vendor): void {
    const ref: BudgetVendorRef = {
      id: vendor.id,
      name: vendor.name,
      categorySlug: vendor.categorySlug,
      citySlug: vendor.citySlug,
      slug: vendor.slug,
    };
    this.patch(item, { vendorId: vendor.id, merchantName: null }, ref);
    this.drawer.set(null);
  }

  protected clearVendor(item: BudgetItem): void {
    this.patch(item, { vendorId: null }, null);
  }

  protected saveMerchant(item: BudgetItem, input: HTMLInputElement): void {
    // Empty input clears the merchant — otherwise a typed name could never be removed.
    const value = input.value.trim();
    this.patch(item, { vendorId: null, merchantName: value || null }, null);
    this.drawer.set(null);
  }

  protected isSaved(vendorId: number): boolean {
    return this.wishlist.isSaved(vendorId);
  }

  // ---- reminders ----

  /** 'overdue' | 'soon' (≤14 days) | 'later' | null — drives the bell badge. */
  protected reminderState(item: BudgetItem): 'overdue' | 'soon' | 'later' | null {
    return item.reminderDate ? reminderStatus(item.reminderDate) : null;
  }

  // ---- row status signals ----

  /** Fully settled: an actual cost exists and the paid amount covers it. */
  protected isPaidUp(item: BudgetItem): boolean {
    return (
      item.actualCost !== null &&
      item.actualCost > 0 &&
      item.paid !== null &&
      item.paid >= item.actualCost
    );
  }

  /** The actual cost has exceeded the estimate (both known). */
  protected isOverEstimate(item: BudgetItem): boolean {
    return item.estimate !== null && item.actualCost !== null && item.actualCost > item.estimate;
  }

  /** One-click "mark paid in full": target is the actual cost, or the estimate before one exists. */
  protected canPayFull(item: BudgetItem): boolean {
    const target = item.actualCost ?? item.estimate;
    return target !== null && target > 0 && (item.paid === null || item.paid < target);
  }

  protected markPaidFull(item: BudgetItem): void {
    const target = item.actualCost ?? item.estimate;
    if (target === null || target <= 0) return;
    this.patch(item, { paid: target });
  }

  // =============================== guest estimator ===============================

  protected setEstTotal(event: Event): void {
    const v = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    this.estTotal.set(v);
    this.estAmounts.set(suggestedAllocation(v));
  }

  protected setEstAmount(i: number, event: Event): void {
    const v = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    const next = this.estAmounts().slice();
    next[i] = v;
    this.estAmounts.set(next);
  }

  protected resetEst(): void {
    this.estAmounts.set(suggestedAllocation(this.estTotal()));
  }

  protected estShare(i: number): number {
    const t = this.estTotal();
    return t > 0 ? (this.estAmounts()[i] / t) * 100 : 0;
  }

  protected estSharePct(i: number): number {
    return Math.round(this.estShare(i));
  }

  // =============================== shared ===============================

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected format(n: number | null): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(Math.round(n ?? 0)) + ' ₾';
  }

  /** Width (0–100) of a summary meter bar relative to the total budget. */
  protected meterPct(value: number): number {
    const t = this.total();
    if (t === null || t <= 0) return 0;
    return Math.min(100, (value / t) * 100);
  }

  private sum(field: MoneyField): number {
    return this.items().reduce((acc, i) => acc + (i[field] ?? 0), 0);
  }
}
