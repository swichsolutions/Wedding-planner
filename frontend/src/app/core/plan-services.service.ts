import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { PriceUnit } from './catalog';

/** saved → shortlisted → chosen (guide §6). */
export type ServiceStatus = 'saved' | 'shortlist' | 'chosen';
export const SERVICE_STATUSES: ServiceStatus[] = ['saved', 'shortlist', 'chosen'];

/** The catalog side of a service: its card and how to reach the vendor. */
export interface PlanServiceVendor {
  id: number;
  slug: string;
  categorySlug: string;
  citySlug: string;
  city: string;
  photoUrl: string | null;
  priceFrom: number | null;
  priceUnit: PriceUnit;
  phone: string | null;
  instagram: string | null;
  whatsapp: string | null;
}

/** A vendor in „ჩემი მომსახურებები“: saved from the catalog, or added by hand. */
export interface PlanService {
  id: number;
  name: string;
  categorySlug: string | null;
  status: ServiceStatus;
  /** Contacts typed in by the couple (vendors added by hand). */
  phone: string | null;
  email: string | null;
  instagram: string | null;
  offer: number | null;
  offerNote: string | null;
  note: string | null;
  /** Saved from the catalog: name and contacts come from the profile. */
  fromCatalog: boolean;
  /** The catalog profile, while it's listed. */
  vendor: PlanServiceVendor | null;
  /** A budget line already carries this vendor. */
  budgetItemId: number | null;
  createdAt: string;
}

/** The whole service as edited (name, category and contacts count for hand-added ones only). */
export interface PlanServiceEdit {
  name?: string | null;
  categorySlug?: string | null;
  status: ServiceStatus;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  offer: number | null;
  offerNote: string | null;
  note: string | null;
}

/** The edit payload that keeps everything as it is (a status change sends this with the new status). */
export function serviceEdit(s: PlanService): PlanServiceEdit {
  return {
    name: s.name,
    categorySlug: s.categorySlug,
    status: s.status,
    phone: s.phone,
    email: s.email,
    instagram: s.instagram,
    offer: s.offer,
    offerNote: s.offerNote,
    note: s.note,
  };
}

/** Couple's services API (Couple role; shared by both partners). */
@Injectable({ providedIn: 'root' })
export class PlanServicesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/planning/services`;

  list(): Observable<PlanService[]> {
    return this.http.get<PlanService[]>(this.base);
  }

  add(body: PlanServiceEdit & { name: string }): Observable<PlanService> {
    return this.http.post<PlanService>(this.base, body);
  }

  update(id: number, body: PlanServiceEdit): Observable<PlanService> {
    return this.http.put<PlanService>(`${this.base}/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** The agreed price into the budget, with the next payment's due date. */
  toBudget(id: number, amount: number, dueDate: string | null): Observable<{ budgetItemId: number; budgetItemName: string; created: boolean }> {
    return this.http.post<{ budgetItemId: number; budgetItemName: string; created: boolean }>(
      `${this.base}/${id}/budget`,
      { amount, dueDate },
    );
  }
}
