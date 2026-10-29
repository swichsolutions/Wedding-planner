import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** Someone working on the plan (at most two: the couple). */
export interface PlanMember {
  name: string | null;
  email: string | null;
  isMe: boolean;
  /** Joined by invitation: their name is the plan's partner* fields. */
  isPartner: boolean;
  joinedAt: string;
}

/** The plan's open partner invitation (its link is only shown once, when made). */
export interface PlanInvite {
  email: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * The couple's shared plan (BUILD-PLAN B1, D8): both partners see and edit the same one. Its
 * details come from the start form after sign-up and the settings page.
 */
export interface CoupleProfile {
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string | null; // 'yyyy-MM-dd'
  planningStage: string | null;
  guestCountRange: string | null;
  neededCategories: string[];
  city?: string | null;
  region?: string | null;
  totalBudget?: number | null;
  /** The signed-in person is the partner* name. */
  iAmPartner?: boolean;
  members?: PlanMember[];
  invite?: PlanInvite | null;
  /** Room for a partner (one person on the plan so far). */
  canInvite?: boolean;
  /** Mail is really sent, so an invitation can also be emailed. */
  emailInvites?: boolean;
}

/** What the start form and settings save. Null = not known yet. */
export interface PlanDetails {
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string | null;
  city: string | null;
  region: string | null;
  guestCountRange: string | null;
}

export interface PlanInviteCreated {
  link: string;
  expiresAt: string;
  emailed: boolean;
}

/** What an invitation link leads to. */
export interface PlanInvitePreview {
  status: 'ok' | 'used' | 'expired' | 'full' | 'invalid';
  names: string | null;
}

/** The shared plan API (/api/plan; Couple role, token via interceptor — except the preview). */
@Injectable({ providedIn: 'root' })
export class CoupleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/plan`;

  me(): Observable<CoupleProfile> {
    return this.http.get<CoupleProfile>(this.base);
  }

  update(details: PlanDetails): Observable<CoupleProfile> {
    return this.http.put<CoupleProfile>(this.base, details);
  }

  /** Start over with new answers — wipes and reseeds the checklist + budget, for both partners. */
  restart(payload: CoupleProfile): Observable<CoupleProfile> {
    return this.http.put<CoupleProfile>(`${this.base}/restart`, payload);
  }

  // ---- partner access ----

  /** A new invitation link (replacing any open one); emailed too when an address is given. */
  createInvite(email: string | null, lang: string): Observable<PlanInviteCreated> {
    return this.http.post<PlanInviteCreated>(`${this.base}/invite`, { email, lang });
  }

  revokeInvite(): Observable<void> {
    return this.http.delete<void>(`${this.base}/invite`);
  }

  previewInvite(token: string): Observable<PlanInvitePreview> {
    return this.http.get<PlanInvitePreview>(`${this.base}/invites/${encodeURIComponent(token)}`);
  }

  /** Join. 409 { code: 'hasPlan' } asks the joiner to confirm leaving their own plan (replace). */
  acceptInvite(token: string, replace: boolean): Observable<CoupleProfile> {
    return this.http.post<CoupleProfile>(`${this.base}/invites/${encodeURIComponent(token)}/accept`, { replace });
  }

  leave(): Observable<void> {
    return this.http.post<void>(`${this.base}/leave`, {});
  }

  removePartner(): Observable<void> {
    return this.http.delete<void>(`${this.base}/partner`);
  }
}
