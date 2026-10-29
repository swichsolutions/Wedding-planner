import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** One activity of the couple's wedding day. */
export interface DayItem {
  id: number;
  /** "HH:mm", or null when not set yet. */
  time: string | null;
  activity: string;
  note: string | null;
  /** Who's responsible (free text). */
  who: string | null;
  /** How to reach them (free text, usually a phone). */
  contact: string | null;
  sortOrder: number;
}

export type DayItemEdit = Omit<DayItem, 'id' | 'sortOrder'>;

/**
 * Minutes into the wedding day for sorting: hours before 05:00 come after midnight (the
 * "00:00 end" follows "23:30 cake"); no time goes last. Same rule as the API.
 */
export function dayTimeKey(time: string | null): number {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return Number.MAX_SAFE_INTEGER;
  const [h, m] = time.split(':').map(Number);
  return (h < 5 ? h + 24 : h) * 60 + m;
}

/** „ქორწილის დღე“ API (BUILD-PLAN B2; Couple role, token via interceptor). Shared by both partners. */
@Injectable({ providedIn: 'root' })
export class WeddingDayService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/planning/day`;

  list(): Observable<DayItem[]> {
    return this.http.get<DayItem[]>(this.base);
  }

  create(item: DayItemEdit): Observable<DayItem> {
    return this.http.post<DayItem>(this.base, item);
  }

  update(id: number, item: DayItemEdit): Observable<DayItem> {
    return this.http.put<DayItem>(`${this.base}/${id}`, item);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  clear(): Observable<void> {
    return this.http.delete<void>(this.base);
  }

  reorder(ids: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/order`, { ids });
  }

  /** „გამოიყენე ეს განრიგი“: add an example's rows, or replace the schedule with them. */
  useTemplate(rows: DayItemEdit[], replace: boolean): Observable<DayItem[]> {
    return this.http.post<DayItem[]>(`${this.base}/template`, { rows, replace });
  }
}
