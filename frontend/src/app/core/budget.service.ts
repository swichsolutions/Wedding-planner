import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { safeSessionGet, safeSessionRemove, safeSessionSet } from './auth.service';

const GUEST_DRAFT_KEY = 'weddingplanner.budget.guestDraft';

/**
 * The guest estimator's total budget, saved right before a guest is sent to /signup
 * (from the budget page's CTA) so it isn't silently lost. Signup applies it to the
 * couple's freshly-seeded tracker right after the account is created, then clears it.
 */
export function saveGuestBudgetDraft(total: number): void {
  safeSessionSet(GUEST_DRAFT_KEY, JSON.stringify({ total }));
}

export function takeGuestBudgetDraft(): { total: number } | null {
  const raw = safeSessionGet(GUEST_DRAFT_KEY);
  if (!raw) return null;
  safeSessionRemove(GUEST_DRAFT_KEY);
  try {
    const parsed = JSON.parse(raw) as { total?: number };
    return typeof parsed.total === 'number' && parsed.total > 0 ? { total: parsed.total } : null;
  } catch {
    return null;
  }
}

/** Directory vendor linked to a budget row — enough to build the profile link. */
export interface BudgetVendorRef {
  id: number;
  name: string;
  categorySlug: string;
  citySlug: string;
  slug: string;
}

/** One payment on a line: a deposit, an instalment or the rest. */
export interface BudgetPayment {
  id: number;
  amount: number;
  paidOn: string; // 'yyyy-MM-dd'
  note: string | null;
}

export interface BudgetItem {
  id: number;
  name: string;
  categorySlug: string | null;
  vendor: BudgetVendorRef | null;
  merchantName: string | null;
  estimate: number | null;
  actualCost: number | null;
  /** The sum of `payments` (read-only: record a payment to change it). */
  paid: number | null;
  note: string | null;
  reminderDate: string | null; // 'yyyy-MM-dd'
  sortOrder: number;
  payments: BudgetPayment[];
}

/** What's left to pay on a line: the agreed cost minus what's paid (0 when there's no agreed cost). */
export function leftToPay(item: Pick<BudgetItem, 'actualCost' | 'paid'>): number {
  return Math.max(0, (item.actualCost ?? 0) - (item.paid ?? 0));
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
    vendorId?: number | null;
  }): Observable<BudgetItem> {
    return this.http.post<BudgetItem>(`${this.base}/api/planning/budget/items`, payload);
  }

  updateItem(id: number, payload: BudgetItemUpdate): Observable<BudgetItem> {
    return this.http.put<BudgetItem>(`${this.base}/api/planning/budget/items/${id}`, payload);
  }

  removeItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/budget/items/${id}`);
  }

  /** Record a payment; returns the line with its new paid total. paidOn defaults to today. */
  addPayment(itemId: number, payment: { amount: number; paidOn?: string | null; note?: string | null }): Observable<BudgetItem> {
    return this.http.post<BudgetItem>(`${this.base}/api/planning/budget/items/${itemId}/payments`, payment);
  }

  removePayment(itemId: number, paymentId: number): Observable<BudgetItem> {
    return this.http.delete<BudgetItem>(`${this.base}/api/planning/budget/items/${itemId}/payments/${paymentId}`);
  }

  /** Dated reminders, soonest first. Never seeds the budget (safe from /planning). */
  reminders(): Observable<BudgetReminder[]> {
    return this.http.get<BudgetReminder[]>(`${this.base}/api/planning/budget/reminders`);
  }

  /** Persist a new display order; itemIds must contain every item exactly once. */
  reorder(itemIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/budget/items/order`, { itemIds });
  }

  // ---- per-category target budgets (guided planner's scoped calculator) ----

  categoryBudgets(): Observable<{ categorySlug: string; amount: number }[]> {
    return this.http.get<{ categorySlug: string; amount: number }[]>(
      `${this.base}/api/planning/budget/category-budgets`,
    );
  }

  setCategoryBudget(categorySlug: string, amount: number): Observable<{ categorySlug: string; amount: number }> {
    return this.http.put<{ categorySlug: string; amount: number }>(
      `${this.base}/api/planning/budget/category-budgets/${encodeURIComponent(categorySlug)}`,
      { amount },
    );
  }

  clearCategoryBudget(categorySlug: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/api/planning/budget/category-budgets/${encodeURIComponent(categorySlug)}`,
    );
  }
}
