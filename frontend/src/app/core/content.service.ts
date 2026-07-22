import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { MOCK_ARTICLES } from './mock-content';
import { ContentArticle } from './content.models';

/**
 * Content access for the guides/journal surface. Mock-backed today; same Observable
 * shape so it can move to an API/CMS later without changing callers.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  list(): Observable<ContentArticle[]> {
    // Newest first (string ISO dates sort lexicographically).
    return of([...MOCK_ARTICLES].sort((a, b) => b.date.localeCompare(a.date)));
  }

  getBySlug(slug: string): Observable<ContentArticle | undefined> {
    return of(MOCK_ARTICLES.find((a) => a.slug === slug));
  }
}
