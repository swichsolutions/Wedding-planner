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

  update(id: number, payload: GuestPayload): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/guests/${id}`, payload);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/guests/${id}`);
  }
}
