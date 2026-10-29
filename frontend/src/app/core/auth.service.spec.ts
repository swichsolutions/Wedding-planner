import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService, afterSignUpRoute, safeReturnUrl } from './auth.service';

describe('AuthService password reset', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('POSTs the email and language to /api/auth/forgot-password', () => {
    let done = false;
    service.requestPasswordReset('a@b.ge', 'en').subscribe(() => (done = true));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/auth/forgot-password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.ge', lang: 'en' });
    req.flush(null, { status: 202, statusText: 'Accepted' });

    expect(done).toBe(true);
    expect(service.sessionUser()).toBeNull(); // asking for a link signs nobody in
  });

  it('POSTs the reset and signs the user in with the returned session', () => {
    service.resetPassword('user-1', 'tok', 'New12345').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/auth/reset-password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'user-1', token: 'tok', newPassword: 'New12345' });
    req.flush({ token: 'jwt', email: 'a@b.ge', roles: ['Couple'], vendorId: null });

    expect(service.token).toBe('jwt');
    expect(service.sessionUser()).toEqual({ email: 'a@b.ge', roles: ['Couple'], vendorId: null });
  });

  it('keeps the session empty when the link is rejected', () => {
    let failed = false;
    service.resetPassword('user-1', 'bad', 'New12345').subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne((r) => r.url.endsWith('/api/auth/reset-password'))
      .flush({ code: 'invalid_token' }, { status: 400, statusText: 'Bad Request' });

    expect(failed).toBe(true);
    expect(service.token).toBeNull();
  });
});

describe('safeReturnUrl', () => {
  it('never returns to the password-reset pages', () => {
    expect(safeReturnUrl('/forgot-password')).toBeNull();
    expect(safeReturnUrl('/reset-password?uid=1&token=x')).toBeNull();
    expect(safeReturnUrl('/planning')).toBe('/planning');
  });
});

describe('afterSignUpRoute', () => {
  it('sends a new couple to the start form, carrying where they were going', () => {
    expect(afterSignUpRoute(null)).toBe('/planning/start');
    expect(afterSignUpRoute('/fotografi/tbilisi/studio-1')).toBe('/planning/start?returnUrl=%2Ffotografi%2Ftbilisi%2Fstudio-1');
  });

  it('sends someone invited by a partner straight back to the invitation', () => {
    expect(afterSignUpRoute('/partner/abc_123')).toBe('/partner/abc_123');
  });
});
