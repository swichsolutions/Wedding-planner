import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ContactInquiry {
  name: string;
  email: string;
  phone?: string;
  message: string;
  /** Honeypot: stays empty for people; the API drops the inquiry when it is filled. */
  website?: string;
}

/** Sends the inquiry form on /contact to the API (POST /api/contact), which mails it to the site inbox. */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  send(payload: ContactInquiry): Observable<void> {
    return this.http.post<void>(`${this.base}/api/contact`, payload);
  }
}
