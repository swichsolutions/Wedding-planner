import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type GuestRelationship =
  | 'none'
  | 'person1_family'
  | 'person1_friend'
  | 'person1_family_friend'
  | 'person2_family'
  | 'person2_friend'
  | 'person2_family_friend'
  | 'both_friend';

export type GuestInvitedStatus = 'definitely' | 'maybe';

/** Whether the party is coming (B5). "no" frees their seats. */
export type GuestAttendance = 'pending' | 'yes' | 'no';
export const ATTENDANCES: GuestAttendance[] = ['yes', 'pending', 'no'];

/** A family on the guest list (D9): the guests invited together (one RSVP link each in B6). */
export interface GuestFamily {
  id: number;
  name: string;
  /** When the family last answered on the invitation (B6); null = not yet. */
  rsvpAt: string | null;
  rsvpMessage: string | null;
  rsvpAnswer: string | null;
}

export interface Guest {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  relationship: GuestRelationship;
  invitedStatus: GuestInvitedStatus;
  hasPlusOne: boolean;
  plusOneFirstName: string | null;
  plusOneLastName: string | null;
  plusOneNameUnknown: boolean;
  hasChild: boolean;
  childFirstName: string | null;
  childLastName: string | null;
  childNameUnknown: boolean;
  sortOrder: number;
  attendance: GuestAttendance;
  dietaryNeeds: string | null;
  familyId: number | null;
  /** When this guest's attendance was last set on the invitation (B6); null = never. */
  rsvpAt: string | null;
  /** Message and answer to the couple's question, when the guest answered on their own link. */
  rsvpMessage: string | null;
  rsvpAnswer: string | null;
}

export interface GuestPayload {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: GuestRelationship;
  invitedStatus?: GuestInvitedStatus;
  hasPlusOne?: boolean;
  plusOneFirstName?: string | null;
  plusOneLastName?: string | null;
  plusOneNameUnknown?: boolean;
  hasChild?: boolean;
  childFirstName?: string | null;
  childLastName?: string | null;
  childNameUnknown?: boolean;
  attendance?: GuestAttendance;
  dietaryNeeds?: string | null;
  familyId?: number | null;
  /** Updates only: the `rsvpAt` this client last saw. When the guest has answered on the invitation
   * since, the server keeps their answer (attendance, dietary needs, plus-one) over this payload. */
  rsvpAt?: string | null;
}

/** How many people a guest row stands for (the guest, plus-one, child). */
export function partySize(g: Pick<Guest, 'hasPlusOne' | 'hasChild'>): number {
  return 1 + (g.hasPlusOne ? 1 : 0) + (g.hasChild ? 1 : 0);
}

/** Couple guest list API (requires Couple role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class GuestService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<Guest[]> {
    return this.http.get<Guest[]>(`${this.base}/api/planning/guests`);
  }

  add(payload: GuestPayload): Observable<Guest> {
    return this.http.post<Guest>(`${this.base}/api/planning/guests`, payload);
  }

  /** Gives back the row as the server now holds it (which may keep a guest's own newer answer). */
  update(id: number, payload: GuestPayload): Observable<Guest | null> {
    return this.http.put<Guest | null>(`${this.base}/api/planning/guests/${id}`, payload);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/guests/${id}`);
  }

  // ---- families (D9) ----

  families(): Observable<GuestFamily[]> {
    return this.http.get<GuestFamily[]>(`${this.base}/api/planning/guests/families`);
  }

  addFamily(name: string): Observable<GuestFamily> {
    return this.http.post<GuestFamily>(`${this.base}/api/planning/guests/families`, { name });
  }

  renameFamily(id: number, name: string): Observable<GuestFamily> {
    return this.http.put<GuestFamily>(`${this.base}/api/planning/guests/families/${id}`, { name });
  }

  /** Removes the family only; its guests stay, ungrouped. */
  removeFamily(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/guests/families/${id}`);
  }

  /** Put guests into a family, or take them out of one (familyId null). */
  setFamily(guestIds: number[], familyId: number | null): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/guests/family`, { guestIds, familyId });
  }
}
