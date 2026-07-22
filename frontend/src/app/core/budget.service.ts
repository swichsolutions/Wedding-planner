import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** Directory vendor linked to a budget row — enough to build the profile link. */
export interface BudgetVendorRef {
  id: number;
  name: string;
  categorySlug: string;
  citySlug: string;
  slug: string;
}

export interface BudgetItem {
  id: number;
  name: string;
  categorySlug: string | null;
  vendor: BudgetVendorRef | null;
  merchantName: string | null;
  estimate: number | null;
  actualCost: number | null;
  paid: number | null;
  note: string | null;
  reminderDate: string | null; // 'yyyy-MM-dd'
  sortOrder: number;
}

export interface Budget {
  totalBudget: number | null;
  items: BudgetItem[];
}

/** A dated payment reminder — powers the planning page's reminders panel. */
export interface BudgetReminder {
  id: number;
  name: string;
  reminderDate: string; // 'yyyy-MM-dd'
  estimate: number | null;
  actualCost: number | null;
  paid: number | null;
}

/** Full editable row state — the API replaces the row with exactly this. */
export interface BudgetItemUpdate {
  name: string;
  vendorId: number | null;
  merchantName: string | null;
  estimate: number | null;
  actualCost: number | null;
  paid: number | null;
  note: string | null;
  reminderDate: string | null;
}

/** Reminder urgency for a 'yyyy-MM-dd' date: past → overdue, ≤14 days → soon. */
export function reminderStatus(date: string): 'overdue' | 'soon' | 'later' | null {
  const due = new Date(date + 'T00:00:00').getTime();
  if (Number.isNaN(due)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today.getTime()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days <= 14) return 'soon';
  return 'later';
}

/** Couple wedding-budget API (requires Couple role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get(): Observable<Budget> {
    return this.http.get<Budget>(`${this.base}/api/planning/budget`);
  }

  /**
   * Save the total. applyEstimates: rows the couple hasn't hand-edited follow the new
   * total's suggested split. resetEstimates: force ALL seeded rows back to the split.
   */
  updateTotal(
    totalBudget: number | null,
    applyEstimates: boolean,
    resetEstimates = false,
  ): Observable<Budget> {
    return this.http.put<Budget>(`${this.base}/api/planning/budget/total`, {
      totalBudget,
      applyEstimates,
      resetEstimates,
    });
  }

  addItem(payload: {
    name: string;
    categorySlug?: string | null;
    estimate?: number | null;
  }): Observable<BudgetItem> {
    return this.http.post<BudgetItem>(`${this.base}/api/planning/budget/items`, payload);
  }

  updateItem(id: number, payload: BudgetItemUpdate): Observable<BudgetItem> {
    return this.http.put<BudgetItem>(`${this.base}/api/planning/budget/items/${id}`, payload);
  }

  removeItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/budget/items/${id}`);
  }

  /** Dated reminders, soonest first. Never seeds the budget (safe from /planning). */
  reminders(): Observable<BudgetReminder[]> {
    return this.http.get<BudgetReminder[]>(`${this.base}/api/planning/budget/reminders`);
  }

  /** Persist a new display order; itemIds must contain every item exactly once. */
  reorder(itemIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/budget/items/order`, { itemIds });
  }
}
