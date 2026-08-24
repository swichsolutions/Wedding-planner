import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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
import { trapTabKey } from '../../core/a11y';
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
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;
  private coupleLoadStarted = false;

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

  // Modal dialog contract state: the row that opened the popup (focus returns there),
  // and the body overflow value the scroll lock replaced (null = no lock held).
  private rowTrigger: HTMLElement | null = null;
  private prevBodyOverflow: string | null = null;
  private modalWasOpen = false;

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

    // Load when isCouple() BECOMES true, not only when it already is at
    // construction — a guest who signs in via the navbar modal on this page
    // (or a signed-in user whose auth state settles after hydration) must get
    // the tracker without a refresh. The latch keeps it a one-time load.
    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.coupleLoadStarted) return;
      this.coupleLoadStarted = true;
      this.dragHintDismissed.set(localStorage.getItem(DRAG_HINT_KEY) === '1');
      this.budgetSvc.get().subscribe({
        next: (b) => this.apply(b),
        error: () => this.loadError.set(true),
      });
    });

    // Modal dialog contract, driven by presence (not just closeModal()) so every
    // close path — Esc, overlay, Done, delete, the item vanishing on a resync —
    // releases the scroll lock and returns focus to the opening row.
    effect(() => {
      const open = this.modalItem() !== null;
      if (!this.isBrowser || open === this.modalWasOpen) return;
      this.modalWasOpen = open;
      if (open) {
        // Save what the lock replaces so nesting with other dialogs can't strand it.
        this.prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // setTimeout: the panel renders after this effect runs.
        setTimeout(() =>
          (this.host.nativeElement.querySelector('.bmodal__close') as HTMLElement | null)?.focus(),
        );
      } else {
        document.body.style.overflow = this.prevBodyOverflow ?? '';
        this.prevBodyOverflow = null;
        if (this.rowTrigger?.isConnected) this.rowTrigger.focus(); // row may be deleted
        this.rowTrigger = null;
      }
    });

    // Leaving the page with the popup open (e.g. mobile back button) must not
    // leave the site frozen behind a stranded scroll lock.
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser && this.prevBodyOverflow !== null) {
        document.body.style.overflow = this.prevBodyOverflow;
      }
    });
  }

  protected dismissDragHint(): void {
    this.dragHintDismissed.set(true);
    if (this.isBrowser) localStorage.setItem(DRAG_HINT_KEY, '1');
  }

  // =============================== tracker ===============================

  private apply(b: Budget): void {
    this.total.set(b.totalBudget);
    // Rows with a save in flight keep their optimistic state: a full payload
    // (total autosave / resync after another row's failure) landing mid-edit
    // must not roll them back — each pending row's own PUT settle decides it.
    this.items.set(
      b.items.map((row) => {
        if (!this.pendingSaves.has(row.id)) return row;
        return this.items().find((i) => i.id === row.id) ?? row;
      }),
    );
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
            if (this.modalId() === item.id) this.closeModal();
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
    this.rowTrigger = event.currentTarget as HTMLElement; // focus returns here on close
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

  /** Keep Tab cycling inside the open popup (aria-modal contract). */
  protected onModalKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  protected onEscape(): void {
    // While the shared confirm dialog is open, that Esc belongs to it alone —
    // the row popup underneath must survive until its own, later Esc.
    if (this.confirmSvc.request() !== null) return;
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

  /** Drag-and-drop reorder (pointer + touch). */
  protected drop(event: CdkDragDrop<BudgetItem[]>): void {
    this.reorderRows(event.previousIndex, event.currentIndex);
  }

  /** Keyboard fallback for the drag handle: Arrow Up/Down moves the row one position. */
  protected onGripKeydown(item: BudgetItem, event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault(); // arrows must move the row, not scroll the page
    const from = this.items().findIndex((i) => i.id === item.id);
    if (from === -1) return;
    const to = event.key === 'ArrowUp' ? from - 1 : from + 1;
    if (to < 0 || to >= this.items().length) return;
    this.reorderRows(from, to);
    // Re-render moves the row's DOM node, which drops focus — put it back on the
    // same handle so repeated presses keep walking the row up/down.
    const grip = event.currentTarget as HTMLElement;
    setTimeout(() => {
      if (grip.isConnected) grip.focus();
    });
  }

  /** Shared by drag and keyboard: applies the move, then queues the persist. */
  private reorderRows(from: number, to: number): void {
    if (from === to) return;
    const list = this.items().slice();
    moveItemInArray(list, from, to);
    this.items.set(list);
    this.queueReorder(list.map((i) => i.id));
  }

  // Reorder PUTs are serialized (same pattern as the dashboard photo grid): at
  // most one in flight; while it runs only the NEWEST pending order is kept, so
  // rapid drags / held arrow keys coalesce and the server can't apply them out
  // of order. A failure only resyncs when nothing newer superseded it.
  private reorderInFlight = false;
  private pendingOrder: number[] | null = null;

  private queueReorder(ids: number[]): void {
    this.pendingOrder = ids;
    if (!this.reorderInFlight) this.sendReorder();
  }

  private sendReorder(): void {
    const ids = this.pendingOrder;
    if (!ids) return;
    this.pendingOrder = null;
    this.reorderInFlight = true;
    this.budgetSvc.reorder(ids).subscribe({
      next: () => this.finishReorder(false),
      error: () => this.finishReorder(true),
    });
  }

  private finishReorder(failed: boolean): void {
    this.reorderInFlight = false;
    if (this.pendingOrder) {
      this.sendReorder(); // a newer order supersedes this outcome either way
      return;
    }
    if (failed) {
      this.toast.error('budgetPage.saveError');
      this.resync();
    }
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
    if (kind === 'vendor') {
      this.loadPicker(item);
      this.focusDrawer('.bpicker__search');
    }
  }

  /** Bell/note share the details drawer: same icon toggles, the other icon switches. */
  protected toggleDetails(item: BudgetItem, src: DetailsTrigger): void {
    const d = this.drawer();
    if (d?.id === item.id && d.kind === 'details' && d.src === src) {
      this.drawer.set(null);
      return;
    }
    this.drawer.set({ id: item.id, kind: 'details', src });
    // Land on the field the icon promised: bell → reminder date, note → textarea.
    this.focusDrawer(src === 'bell' ? `#bd-reminder-${item.id}` : `#bd-note-${item.id}`);
  }

  /** The drawer is a non-modal inline panel — move focus in, no trap/restore needed. */
  private focusDrawer(selector: string): void {
    if (!this.isBrowser) return;
    setTimeout(() =>
      (this.host.nativeElement.querySelector(selector) as HTMLElement | null)?.focus(),
    );
  }

  private loadPicker(item: BudgetItem): void {
    this.pickerQuery.set('');
    this.pickerLoading.set(true);
    this.pickerVendors.set([]);
    this.vendorSvc
      .list(item.categorySlug ? { category: item.categorySlug } : {})
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
