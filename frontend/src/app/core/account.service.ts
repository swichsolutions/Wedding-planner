import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface AccountInfo {
  email: string;
  displayName: string | null;
  roles: string[];
  hasPassword: boolean;
}

export interface ChangePasswordPayload {
  currentPassword?: string | null;
  newPassword: string;
}

/** Self-serve account settings for the signed-in user (any role). Token via the interceptor. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getAccount(): Observable<AccountInfo> {
    return this.http.get<AccountInfo>(`${this.base}/api/account/me`);
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/api/account/password`, payload);
  }
}
