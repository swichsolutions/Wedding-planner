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
  whatsapp: string | null;
  mapUrl: string | null;
  areasServed: string | null;
  photos: DashboardPhoto[];
  // ---- catalog attributes (PROPOSALS.md P2–P5) ----
  group: string;
  priceUnit: string | null;
  region: string | null;
  servedRegions: string[];
  alsoOffers: string[];
  styles: string[];
  features: string[];
  capacityMin: number | null;
  capacityMax: number | null;
  setting: string | null;
  venueType: string | null;
  depositTerms: string | null;
  cancellationTerms: string | null;
  travelPolicy: string | null;
  bookingLeadTime: string | null;
  packages: VendorPackageEdit[];
}

export interface VendorPackageEdit {
  name: string;
  price: number | null;
  priceUnit: string | null;
  included: string | null;
  duration: string | null;
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
  whatsapp?: string | null;
  mapUrl?: string | null;
  priceUnit?: string | null;
  region?: string | null;
  servedRegions?: string[];
  alsoOffers?: string[];
  styles?: string[];
  features?: string[];
  capacityMin?: number | null;
  capacityMax?: number | null;
  setting?: string | null;
  venueType?: string | null;
  depositTerms?: string | null;
  cancellationTerms?: string | null;
  travelPolicy?: string | null;
  bookingLeadTime?: string | null;
  packages?: VendorPackageEdit[];
}

/** The signed-in vendor's takeover request (A3), for an account that has no vendor yet. */
export interface MyVendorClaim {
  vendorId: number;
  vendorName: string;
  categorySlug: string;
  city: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
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

/**
 * Authenticated vendor self-serve dashboard API (requires Vendor role; token via interceptor).
 * The profile and photo calls take an optional vendorId: an admin editing a vendor, typically an
 * imported profile nobody owns yet, goes through /api/admin/vendors/{id} instead of /api/vendor/me.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private root(vendorId?: number): string {
    return vendorId == null ? `${this.base}/api/vendor/me` : `${this.base}/api/admin/vendors/${vendorId}`;
  }

  getMyVendor(vendorId?: number): Observable<VendorDashboard> {
    return this.http.get<VendorDashboard>(this.root(vendorId));
  }

  /** 404 when the account has no takeover request. */
  getMyClaim(): Observable<MyVendorClaim> {
    return this.http.get<MyVendorClaim>(`${this.base}/api/vendor/me/claim`);
  }

  updateMyVendor(dto: VendorEdit, vendorId?: number): Observable<VendorDashboard> {
    return this.http.put<VendorDashboard>(this.root(vendorId), dto);
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
  getPhotos(vendorId?: number): Observable<VendorPhotoAdmin[]> {
    return this.http.get<VendorPhotoAdmin[]>(`${this.root(vendorId)}/photos`);
  }

  uploadPhoto(file: File, vendorId?: number): Observable<VendorPhotoAdmin> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<VendorPhotoAdmin>(`${this.root(vendorId)}/photos`, form);
  }

  updatePhoto(
    id: number,
    payload: { alt: string | null; isRealWedding: boolean },
    vendorId?: number,
  ): Observable<void> {
    return this.http.put<void>(`${this.root(vendorId)}/photos/${id}`, payload);
  }

  reorderPhotos(ids: number[], vendorId?: number): Observable<void> {
    return this.http.put<void>(`${this.root(vendorId)}/photos/order`, { ids });
  }

  deletePhoto(id: number, vendorId?: number): Observable<void> {
    return this.http.delete<void>(`${this.root(vendorId)}/photos/${id}`);
  }
}
