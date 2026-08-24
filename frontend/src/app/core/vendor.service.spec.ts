import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Vendor } from './vendor.models';
import { VendorService } from './vendor.service';

const DTO = {
  id: 1,
  name: 'სტუდია ნათელი',
  slug: 'studia-nateli',
  categorySlug: 'fotografi',
  city: 'თბილისი',
  citySlug: 'tbilisi',
  priceFrom: 1500,
  bio: 'Wedding photography.',
  photos: [],
};

describe('VendorService (API is the source of truth — no mock fallback)', () => {
  let service: VendorService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VendorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('derives the category i18n key on the returned vendors', () => {
    let result: Vendor[] | undefined;
    service.list({ category: 'fotografi' }).subscribe((r) => (result = r));

    httpMock.expectOne((req) => req.url.endsWith('/api/vendors')).flush([DTO]);

    expect(result![0].categoryKey).toBe('category.photographer');
  });

  it('propagates list errors instead of substituting fake vendors', () => {
    let result: Vendor[] | undefined;
    let error: unknown;
    service.list({ category: 'fotografi' }).subscribe({
      next: (r) => (result = r),
      error: (e) => (error = e),
    });

    httpMock.expectOne((req) => req.url.endsWith('/api/vendors')).error(new ProgressEvent('error'));

    expect(result).toBeUndefined();
    expect(error).toBeDefined();
  });

  it('maps a 404 on getBySlug to undefined (vendor not found)', () => {
    let emitted = false;
    let result: Vendor | undefined;
    service.getBySlug('fotografi', 'tbilisi', 'no-such-vendor').subscribe((r) => {
      emitted = true;
      result = r;
    });

    httpMock
      .expectOne((req) => req.url.includes('/api/vendors/'))
      .flush('not found', { status: 404, statusText: 'Not Found' });

    expect(emitted).toBe(true);
    expect(result).toBeUndefined();
  });

  it('propagates non-404 getBySlug errors (no mock vendor substitution)', () => {
    let result: Vendor | undefined;
    let error: unknown;
    service.getBySlug('fotografi', 'tbilisi', 'studia-nateli').subscribe({
      next: (r) => (result = r),
      error: (e) => (error = e),
    });

    httpMock
      .expectOne((req) => req.url.includes('/api/vendors/'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(result).toBeUndefined();
    expect(error).toBeDefined();
  });

  it('posts engagement pings to the tracking endpoints', () => {
    service.trackView(7);
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/api/vendors/7/track-view')).flush(null);

    service.trackContact(7);
    httpMock
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/api/vendors/7/track-contact'))
      .flush(null);
  });

  it('swallows tracking failures (telemetry must never break the page)', () => {
    service.trackView(7);
    httpMock
      .expectOne((req) => req.url.endsWith('/api/vendors/7/track-view'))
      .error(new ProgressEvent('error'));
    // No unhandled error — verify() in afterEach confirms nothing is left hanging.
  });

  it('returns an empty list when the decorative home rows fail', () => {
    let popular: Vendor[] | undefined;
    service.popular(8).subscribe((r) => (popular = r));
    httpMock.expectOne((req) => req.url.endsWith('/api/vendors')).error(new ProgressEvent('error'));
    expect(popular).toEqual([]);
  });
});
