import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { SILENT_AUTH_401 } from './auth.interceptor';
import { AuthService } from './auth.service';
import { Budget, BudgetItem } from './budget.service';

interface BudgetVendorSlot {
  itemId: number;
  categorySlug: string | null;
  vendorId: number | null;
}

/**
 * Lightweight read of the couple's budget — just enough (vendor ids + their
 * category) to power "already in your list" badges on vendor cards and the
 * duplicate-category warning on the profile's "Add to my list" button, without
 * every card pulling the full budget itself. Mirrors WishlistService's pattern.
 */
@Injectable({ providedIn: 'root' })
export class BudgetVendorsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = environment.apiBaseUrl;

  private readonly _slots = signal<BudgetVendorSlot[]>([]);
  readonly loaded = signal(false);

  private loadSeq = 0;
  private readonly reloadTick = signal(0);

  /** Re-run the load (call after adding a vendor elsewhere so cards refresh). */
  reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  readonly vendorIds = computed(() => {
    const set = new Set<number>();
    for (const s of this._slots()) if (s.vendorId !== null) set.add(s.vendorId);
    return set;
  });

  constructor() {
    effect(() => {
      const isCouple = this.auth.isCouple();
      void this.auth.user()?.email; // a couple→couple account switch must refetch
      this.reloadTick();
      if (!this.isBrowser) return;
      const seq = ++this.loadSeq;
      if (!isCouple) {
        this._slots.set([]);
        this.loaded.set(true);
        return;
      }
      this.loaded.set(false);
      this.http
        .get<Budget>(`${this.base}/api/planning/budget`, {
          context: new HttpContext().set(SILENT_AUTH_401, true),
        })
        .subscribe({
          next: (b) => {
            if (seq !== this.loadSeq) return;
            this._slots.set(
              b.items.map((i) => ({ itemId: i.id, categorySlug: i.categorySlug, vendorId: i.vendor?.id ?? null })),
            );
            this.loaded.set(true);
          },
          error: () => {
            if (seq !== this.loadSeq) return;
            this._slots.set([]);
            this.loaded.set(true);
          },
        });
    });
  }

  hasVendor(id: number): boolean {
    return this.vendorIds().has(id);
  }

  /** Existing items in this category (any vendor, or none) — null category never "collides". */
  itemsInCategory(categorySlug: string | null): BudgetVendorSlot[] {
    if (!categorySlug) return [];
    return this._slots().filter((s) => s.categorySlug === categorySlug);
  }

  /** Add a vendor as a new budget item; refreshes the local slot list on success. */
  addVendor(vendor: { id: number; name: string; categorySlug: string; priceFrom: number }): Observable<BudgetItem> {
    return this.http
      .post<BudgetItem>(`${this.base}/api/planning/budget/items`, {
        name: vendor.name,
        categorySlug: vendor.categorySlug,
        estimate: vendor.priceFrom,
        vendorId: vendor.id,
      })
      .pipe(
        tap((item) => {
          this._slots.update((list) => [
            ...list,
            { itemId: item.id, categorySlug: item.categorySlug, vendorId: item.vendor?.id ?? null },
          ]);
        }),
      );
  }
}
