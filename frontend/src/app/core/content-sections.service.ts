import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { ContentApiService } from './content-api.service';
import { ContentKind } from './content.models';

const SECTIONS: ContentKind[] = ['article', 'inspiration', 'real-wedding'];

/**
 * Which „რჩევები და იდეები“ sections have something published. Links to a section show only once
 * it does, so publishing the first article or idea in the admin editor is all it takes. Asked once
 * per visit. A section that can't be checked counts as empty: a missing link is the smaller harm.
 */
@Injectable({ providedIn: 'root' })
export class ContentSections {
  private readonly published = signal<ReadonlySet<ContentKind>>(new Set());

  constructor() {
    const api = inject(ContentApiService);
    forkJoin(
      SECTIONS.map((kind) =>
        api.list(kind, undefined, 1).pipe(
          map((rows) => (rows.length ? kind : null)),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe((kinds) => this.published.set(new Set(kinds.filter((k): k is ContentKind => k !== null))));
  }

  has(kind: ContentKind): boolean {
    return this.published().has(kind);
  }
}
