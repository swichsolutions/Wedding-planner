import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AccountInfo, AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs the account overview from /api/account/me', () => {
    const payload: AccountInfo = {
      email: 'a@b.ge',
      displayName: 'A',
      roles: ['Couple'],
      hasPassword: true,
    };
    let result: AccountInfo | undefined;
    service.getAccount().subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/account/me'));
    expect(req.request.method).toBe('GET');
    req.flush(payload);

    expect(result).toEqual(payload);
  });

  it('POSTs a password change to /api/account/password with the payload', () => {
    service.changePassword({ currentPassword: 'Old12345', newPassword: 'New12345' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/account/password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'Old12345', newPassword: 'New12345' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('omits the current password when setting one for the first time (null)', () => {
    service.changePassword({ currentPassword: null, newPassword: 'New12345' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/account/password'));
    expect(req.request.body).toEqual({ currentPassword: null, newPassword: 'New12345' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
