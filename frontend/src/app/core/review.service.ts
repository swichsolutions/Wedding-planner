import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface Review {
  id: number;
  authorName: string;
  rating: number; // 1–5
  body: string | null;
  createdAt: string;
  /** True when this review belongs to the signed-in user. */
  mine: boolean;
}

export interface SubmitReviewPayload {
  rating: number;
  body?: string | null;
}

/** Vendor reviews: public list; couples create/update their own (token via interceptor). */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(vendorId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.base}/api/vendors/${vendorId}/reviews`);
  }

  submit(vendorId: number, payload: SubmitReviewPayload): Observable<Review> {
    return this.http.post<Review>(`${this.base}/api/vendors/${vendorId}/reviews`, payload);
  }
}
