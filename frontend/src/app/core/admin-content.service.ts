import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ContentKind, ContentPhoto } from './content.models';

export interface ContentCredit {
  vendorId: number | null;
  name: string;
  roleKa: string;
  roleEn: string | null;
}

export interface AdminContentRow {
  id: number;
  type: ContentKind;
  slug: string;
  topic: string | null;
  titleKa: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  photoCount: number;
}

export interface AdminContent {
  id: number;
  type: ContentKind;
  slug: string;
  topic: string | null;
  titleKa: string;
  titleEn: string | null;
  excerptKa: string | null;
  excerptEn: string | null;
  bodyKa: string | null;
  bodyEn: string | null;
  metaDescriptionKa: string | null;
  metaDescriptionEn: string | null;
  actionPath: string | null;
  actionLabelKa: string | null;
  actionLabelEn: string | null;
  consentNote: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  photos: ContentPhoto[];
  credits: ContentCredit[];
  publicPath: string;
}

export interface SaveContent {
  type: ContentKind;
  slug: string | null;
  topic: string | null;
  titleKa: string;
  titleEn: string | null;
  excerptKa: string | null;
  excerptEn: string | null;
  bodyKa: string | null;
  bodyEn: string | null;
  metaDescriptionKa: string | null;
  metaDescriptionEn: string | null;
  actionPath: string | null;
  actionLabelKa: string | null;
  actionLabelEn: string | null;
  consentNote: string | null;
  isPublished: boolean;
  credits: ContentCredit[];
}

/** Admin content editor API (Admin role; token via interceptor). Errors carry `{ code }`. */
@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/admin/content`;

  list(): Observable<AdminContentRow[]> {
    return this.http.get<AdminContentRow[]>(this.base);
  }

  get(id: number): Observable<AdminContent> {
    return this.http.get<AdminContent>(`${this.base}/${id}`);
  }

  create(body: SaveContent): Observable<AdminContent> {
    return this.http.post<AdminContent>(this.base, body);
  }

  update(id: number, body: SaveContent): Observable<AdminContent> {
    return this.http.put<AdminContent>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadPhoto(id: number, file: File): Observable<ContentPhoto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ContentPhoto>(`${this.base}/${id}/photos`, form);
  }

  updatePhoto(id: number, photoId: number, altKa: string, altEn: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/photos/${photoId}`, { altKa, altEn });
  }

  reorderPhotos(id: number, ids: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/photos/order`, { ids });
  }

  deletePhoto(id: number, photoId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/photos/${photoId}`);
  }
}
