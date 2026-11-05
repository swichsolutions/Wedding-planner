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
  /** A vendor account manages the profile (false for imported ones nobody has claimed). */
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

/** A vendor account's request to take over an imported profile (A3). */
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

/** A problem in one spreadsheet row or cell; the code is translated under adminImport.issue. */
export interface ImportIssue {
  code: string;
  column: string | null;
  value: string | null;
}

export type ImportAction = 'create' | 'update' | 'skip' | 'error';

export interface VendorImportRow {
  row: number;
  sheetId: string | null;
  name: string | null;
  categorySlug: string | null;
  city: string | null;
  action: ImportAction;
  vendorId: number | null;
  profilePath: string | null;
  packages: number;
  photos: string | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface VendorImportReport {
  applied: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: VendorImportRow[];
  /** Problems with the file itself: nothing is imported while there are any. */
  fileErrors: ImportIssue[];
  fileWarnings: ImportIssue[];
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

  /**
   * The vendor collection spreadsheet (BUILD-PLAN A3). apply=false only checks it; apply=true
   * writes. publish=true makes new and updated profiles public straight away.
   */
  importVendors(file: File, apply: boolean, publish: boolean): Observable<VendorImportReport> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('apply', apply).set('publish', publish);
    return this.http.post<VendorImportReport>(`${this.base}/api/admin/vendors/import`, form, { params });
  }

  toggleFeature(id: number): Observable<{ id: number; isFeatured: boolean }> {
    return this.http.post<{ id: number; isFeatured: boolean }>(
      `${this.base}/api/admin/vendors/${id}/feature`,
      {},
    );
  }
}
