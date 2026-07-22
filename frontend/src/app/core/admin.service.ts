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

  approve(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/api/admin/vendors/${id}/approve`, {});
  }

  toggleFeature(id: number): Observable<{ id: number; isFeatured: boolean }> {
    return this.http.post<{ id: number; isFeatured: boolean }>(
      `${this.base}/api/admin/vendors/${id}/feature`,
      {},
    );
  }
}
