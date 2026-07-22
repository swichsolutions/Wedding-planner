import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface DashboardPhoto {
  url: string;
  alt: string | null;
  isRealWedding: boolean;
}

export interface VendorDashboard {
  id: number;
  name: string;
  slug: string;
  categorySlug: string;
  city: string;
  citySlug: string;
  isApproved: boolean;
  isFeatured: boolean;
  bio: string | null;
  priceMin: number | null;
  priceRange: string | null;
  instagram: string | null;
  facebook: string | null;
  phone: string | null;
  mapUrl: string | null;
  areasServed: string | null;
  photos: DashboardPhoto[];
}

export interface VendorEdit {
  name: string;
  city?: string | null;
  bio?: string | null;
  priceMin?: number | null;
  priceRange?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  phone?: string | null;
  mapUrl?: string | null;
  areasServed?: string | null;
}

export interface InboxMessage {
  id: number;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface VendorStats {
  totalViews: number;
  totalContacts: number;
  totalMessages: number;
  unreadMessages: number;
}

export interface VendorPhotoAdmin {
  id: number;
  url: string;
  alt: string | null;
  isRealWedding: boolean;
  sortOrder: number;
}

/** Authenticated vendor self-serve dashboard API (requires Vendor role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getMyVendor(): Observable<VendorDashboard> {
    return this.http.get<VendorDashboard>(`${this.base}/api/vendor/me`);
  }

  updateMyVendor(dto: VendorEdit): Observable<VendorDashboard> {
    return this.http.put<VendorDashboard>(`${this.base}/api/vendor/me`, dto);
  }

  getMessages(): Observable<InboxMessage[]> {
    return this.http.get<InboxMessage[]>(`${this.base}/api/vendor/me/messages`);
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/api/vendor/me/messages/${id}/read`, {});
  }

  getStats(): Observable<VendorStats> {
    return this.http.get<VendorStats>(`${this.base}/api/vendor/me/stats`);
  }

  // ---- photos ----
  getPhotos(): Observable<VendorPhotoAdmin[]> {
    return this.http.get<VendorPhotoAdmin[]>(`${this.base}/api/vendor/me/photos`);
  }

  uploadPhoto(file: File): Observable<VendorPhotoAdmin> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<VendorPhotoAdmin>(`${this.base}/api/vendor/me/photos`, form);
  }

  updatePhoto(id: number, payload: { alt: string | null; isRealWedding: boolean }): Observable<void> {
    return this.http.put<void>(`${this.base}/api/vendor/me/photos/${id}`, payload);
  }

  reorderPhotos(ids: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/api/vendor/me/photos/order`, { ids });
  }

  deletePhoto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/vendor/me/photos/${id}`);
  }
}
