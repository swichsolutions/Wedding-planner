import { WritableSignal, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { WishlistService } from './wishlist.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * The wishlist is now server-backed and couple-gated. We fake AuthService.isCouple so we
 * can exercise both the guest (no-op) and couple (sync to /api/planning/saved) paths.
 */
describe('WishlistService (server-backed, couple-gated)', () => {
  const url = `${environment.apiBaseUrl}/api/planning/saved`;
  let isCouple: WritableSignal<boolean>;
  let user: WritableSignal<{ email: string; roles: string[] } | null>;
  let httpMock: HttpTestingController;

  function setup(couple: boolean): WishlistService {
    isCouple = signal(couple);
    // The service keys its load effect on the account identity (user()?.email),
    // not just the role boolean — the fake must provide both.
    user = signal(couple ? { email: 'couple@test.ge', roles: ['Couple'] } : null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isCouple, user } },
      ],
    });
    const service = TestBed.inject(WishlistService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick(); // flush the load-on-sign-in effect
    return service;
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('stays empty and makes no request for a guest', () => {
    const service = setup(false);
    expect(service.count()).toBe(0);
    httpMock.expectNone(url);
  });

  it('loads saved ids from the server for a couple', () => {
    const service = setup(true);
    httpMock.expectOne(url).flush([3, 7]);
    expect(service.count()).toBe(2);
    expect(service.isSaved(7)).toBe(true);
  });

  it('ignores toggle for a guest (no request, no state change)', () => {
    const service = setup(false);
    service.toggle(5);
    expect(service.isSaved(5)).toBe(false);
    httpMock.expectNone(() => true);
  });

  it('optimistically saves and POSTs the vendor id for a couple', () => {
    const service = setup(true);
    httpMock.expectOne(url).flush([]);

    service.toggle(9);
    expect(service.isSaved(9)).toBe(true); // optimistic, before the response

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ vendorId: 9 });
    req.flush(null);
    expect(service.isSaved(9)).toBe(true);
  });

  it('optimistically removes and DELETEs for a couple', () => {
    const service = setup(true);
    httpMock.expectOne(url).flush([4]);

    service.toggle(4);
    expect(service.isSaved(4)).toBe(false); // optimistic

    const req = httpMock.expectOne(`${url}/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.isSaved(4)).toBe(false);
  });

  it('rolls back an optimistic save when the server call fails', () => {
    const service = setup(true);
    httpMock.expectOne(url).flush([]);

    service.toggle(2);
    expect(service.isSaved(2)).toBe(true);

    httpMock.expectOne(url).error(new ProgressEvent('error'));
    expect(service.isSaved(2)).toBe(false); // rolled back
  });
});
