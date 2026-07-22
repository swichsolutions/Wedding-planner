import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface CreateMessage {
  vendorId: number;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  body: string;
}

/** Sends couple → vendor messages to the API (POST /api/messages). */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  send(payload: CreateMessage): Observable<void> {
    return this.http.post<void>(`${this.base}/api/messages`, payload);
  }
}
