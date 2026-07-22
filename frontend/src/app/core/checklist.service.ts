import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ChecklistItem {
  id: number;
  title: string;
  isDone: boolean;
  sortOrder: number;
}

/** Couple planning checklist API (requires Couple role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ChecklistItem[]> {
    return this.http.get<ChecklistItem[]>(`${this.base}/api/planning/checklist`);
  }

  add(title: string): Observable<ChecklistItem> {
    return this.http.post<ChecklistItem>(`${this.base}/api/planning/checklist`, { title });
  }

  update(id: number, payload: { title?: string; isDone: boolean }): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/checklist/${id}`, payload);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/checklist/${id}`);
  }
}
