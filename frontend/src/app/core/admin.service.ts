import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface AdminVendor {
  id: number;
  name: string;
  categorySlug: string;
  city: string;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
  slug: string;
  citySlug: string;
  /** A vendor account manages the profile (false for admin-added ones nobody has claimed). */
  hasOwner: boolean;
  photoCount: number;
}

/** One vendor added by hand from the admin panel. */
export interface AdminCreateVendor {
  name: string;
  categorySlug: string;
  city?: string;
  phone?: string;
  instagram?: string;
}

/** A vendor account's request to take over an admin-added profile (A3). */
export interface AdminClaim {
  id: number;
  vendorId: number;
  vendorName: string;
  categorySlug: string;
  city: string;
  userEmail: string;
  /** The sign-up email equals the listing's contact email: a hint, not proof. */
  emailMatches: boolean;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  decidedAt: string | null;
}

/** Authenticated admin moderation API (requires Admin role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listVendors(pendingOnly: boolean): Observable<AdminVendor[]> {
    let params = new HttpParams();
    if (pendingOnly) params = params.set('pending', 'true');
    return this.http.get<AdminVendor[]>(`${this.base}/api/admin/vendors`, { params });
  }

  /** Creates an unapproved, ownerless vendor; the caller opens the editor on the returned id. */
  createVendor(dto: AdminCreateVendor): Observable<AdminVendor> {
    return this.http.post<AdminVendor>(`${this.base}/api/admin/vendors`, dto);
  }

  listClaims(pendingOnly: boolean): Observable<AdminClaim[]> {
    let params = new HttpParams();
    if (pendingOnly) params = params.set('pending', 'true');
    return this.http.get<AdminClaim[]>(`${this.base}/api/admin/claims`, { params });
  }

  approveClaim(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/api/admin/claims/${id}/approve`, {});
  }

  rejectClaim(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/api/admin/claims/${id}/reject`, {});
  }

  approve(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/api/admin/vendors/${id}/approve`, {});
  }

  /** Permanent: the profile, its photos, packages, reviews and messages. */
  deleteVendor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/admin/vendors/${id}`);
  }

  toggleFeature(id: number): Observable<{ id: number; isFeatured: boolean }> {
    return this.http.post<{ id: number; isFeatured: boolean }>(
      `${this.base}/api/admin/vendors/${id}/feature`,
      {},
    );
  }
}
