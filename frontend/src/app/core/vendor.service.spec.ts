import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Vendor } from './vendor.models';
import { VendorService } from './vendor.service';

describe('VendorService (mock fallback when API errors)', () => {
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

  it('falls back to filtered mock data when the list API errors', () => {
    let result: Vendor[] | undefined;
    service.list({ category: 'fotografi' }).subscribe((r) => (result = r));

    httpMock.expectOne((req) => req.url.endsWith('/api/vendors')).error(new ProgressEvent('error'));

    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
    expect(result!.every((v) => v.categorySlug === 'fotografi')).toBe(true);
  });

  it('derives the category i18n key on the returned vendors', () => {
    let result: Vendor[] | undefined;
    service.list({ category: 'fotografi' }).subscribe((r) => (result = r));
    httpMock.expectOne((req) => req.url.endsWith('/api/vendors')).error(new ProgressEvent('error'));

    expect(result![0].categoryKey).toBe('category.photographer');
  });

  it('falls back to a mock vendor on getBySlug when the API errors', () => {
    let result: Vendor | undefined;
    service.getBySlug('fotografi', 'tbilisi', 'studia-nateli').subscribe((r) => (result = r));

    httpMock
      .expectOne((req) => req.url.includes('/api/vendors/'))
      .error(new ProgressEvent('error'));

    expect(result?.slug).toBe('studia-nateli');
  });
});
