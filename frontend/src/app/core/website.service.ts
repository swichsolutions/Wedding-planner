import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

/** The 10 design theme keys — must match WebsiteController.TemplateKeys. */
export const WEDDING_TEMPLATES = [
  'glow',
  'calligraphy',
  'garnet',
  'forest',
  'seaside',
  'minimal',
  'blush',
  'vineyard',
  'midnight',
  'sunrise',
] as const;

export type WeddingTemplateKey = (typeof WEDDING_TEMPLATES)[number];

/** What the site renderer needs — shared by the builder preview and the public page. */
export interface WeddingSiteData {
  firstName: string | null;
  partnerFirstName: string | null;
  weddingDate: string | null; // 'yyyy-MM-dd'
  place: string | null;
  message: string | null;
  inkColor: string | null; // '#rrggbb'; null = the design's own text color
  accentColor: string | null; // '#rrggbb'; null = the design's own accent
  photoUrl: string | null;
}

/** The couple's own site — full editable state + publish status. */
export interface WeddingSite extends WeddingSiteData {
  templateKey: string;
  lastName: string | null;
  partnerLastName: string | null;
  isPublished: boolean;
  slug: string | null;
}

export interface WeddingSiteUpdate {
  templateKey: string;
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string | null;
  place: string | null;
  message: string | null;
  inkColor: string | null;
  accentColor: string | null;
}

export interface PublicSite extends WeddingSiteData {
  templateKey: string;
}

/** Couple wedding-website API + the anonymous public read side. */
@Injectable({ providedIn: 'root' })
export class WebsiteService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** The couple's site, or null when they haven't started one (API replies 204). */
  get(): Observable<WeddingSite | null> {
    return this.http
      .get<WeddingSite | null>(`${this.base}/api/planning/website`)
      .pipe(map((s) => s ?? null));
  }

  update(payload: WeddingSiteUpdate): Observable<WeddingSite> {
    return this.http.put<WeddingSite>(`${this.base}/api/planning/website`, payload);
  }

  uploadPhoto(file: File): Observable<WeddingSite> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/photo`, form);
  }

  removePhoto(): Observable<WeddingSite> {
    return this.http.delete<WeddingSite>(`${this.base}/api/planning/website/photo`);
  }

  publish(): Observable<WeddingSite> {
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/publish`, {});
  }

  unpublish(): Observable<WeddingSite> {
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/unpublish`, {});
  }

  /** A published site by public slug (anonymous). */
  publicSite(slug: string): Observable<PublicSite> {
    return this.http.get<PublicSite>(`${this.base}/api/sites/${encodeURIComponent(slug)}`);
  }
}
