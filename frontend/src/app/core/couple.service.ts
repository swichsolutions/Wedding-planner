import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** The signed-in couple's onboarding profile (captured at sign-up). */
export interface CoupleProfile {
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string | null; // 'yyyy-MM-dd'
  planningStage: string | null;
  guestCountRange: string | null;
  neededCategories: string[];
}

/** Couple profile API (requires Couple role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class CoupleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  me(): Observable<CoupleProfile> {
    return this.http.get<CoupleProfile>(`${this.base}/api/planning/couple`);
  }

  /** Re-run onboarding with new answers — wipes and reseeds the checklist + budget. */
  restart(payload: CoupleProfile): Observable<CoupleProfile> {
    return this.http.put<CoupleProfile>(`${this.base}/api/planning/couple/restart`, payload);
  }
}
