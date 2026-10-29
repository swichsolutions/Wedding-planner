import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { PlanPhoto } from './plan-photos.service';

/** The organizer overview's summary of every tool, in one read (B7). */
export interface Overview {
  budget: {
    total: number | null;
    planned: number;
    agreed: number;
    paid: number;
    left: number;
    nextPayments: { id: number; name: string; date: string; left: number }[];
  };
  services: {
    saved: number;
    shortlist: number;
    chosen: number;
    chosenList: { name: string; categorySlug: string | null }[];
  };
  guests: {
    parties: number;
    people: number;
    yes: number;
    pending: number;
    no: number;
    dietary: number;
    /** Personal invitation links (families and guests invited alone). */
    invitees: number;
    replied: number;
    recent: { name: string; yes: number; no: number; message: string | null; at: string }[];
  };
  seating: { tables: number; seats: number; seated: number; toSeat: number };
  invitation: { status: 'none' | 'draft' | 'published'; slug: string | null; rsvpDeadline: string | null };
  day: { items: number; first: { time: string | null; activity: string }[]; lastTime: string | null };
  banner: {
    venueName: string | null;
    venuePhotoUrl: string | null;
    paletteKey: string | null;
    photos: PlanPhoto[];
  };
}

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/planning/overview`;

  get(): Observable<Overview> {
    return this.http.get<Overview>(this.base);
  }

  /** null clears the palette. */
  setPalette(key: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/palette`, { key });
  }
}
