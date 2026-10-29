import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { ContentDetail, ContentKind, ContentSummary } from './content.models';

/** Published editorial content from the API (the admin editor writes it). */
@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/content`;

  list(type?: ContentKind, topic?: string, limit?: number): Observable<ContentSummary[]> {
    const params: Record<string, string> = {};
    if (type) params['type'] = type;
    if (topic) params['topic'] = topic;
    if (limit) params['limit'] = String(limit);
    return this.http.get<ContentSummary[]>(this.base, { params });
  }

  /** null when there's no such published page (404); other failures still error. */
  get(type: ContentKind, slug: string): Observable<ContentDetail | null> {
    return this.http.get<ContentDetail>(`${this.base}/${type}/${encodeURIComponent(slug)}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }
}
