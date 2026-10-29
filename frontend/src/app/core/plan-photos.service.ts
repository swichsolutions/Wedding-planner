import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { SILENT_AUTH_401 } from './auth.interceptor';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** A photo the couple marked for their wedding (B7): it goes on their overview banner. */
export interface PlanPhoto {
  id: number;
  url: string;
  kind: 'decor' | 'flowers' | 'cake' | 'tables';
  vendorPhotoId: number | null;
  contentPhotoId: number | null;
  /** The vendor's name or the idea's title (Georgian; En when there is one). */
  sourceName: string | null;
  sourceNameEn: string | null;
  sourcePath: string | null;
}

/** Vendor categories whose portfolio photos can be marked — must match BannerRules.KindForCategory. */
export const MARKABLE_CATEGORIES = ['darbazi', 'inventari', 'dekori', 'floristi', 'torti', 'tkbileuli'];

/** Inspiration topics whose photos can be marked — must match BannerRules.KindForTopic. */
export const MARKABLE_TOPICS = ['decor', 'colors', 'lighting', 'flowers', 'tables', 'cakes'];

/**
 * The couple's marked photos, shared by the vendor profile, inspiration pages and the overview
 * banner. Loaded once per signed-in couple, browser only (the server render has no session).
 */
@Injectable({ providedIn: 'root' })
export class PlanPhotosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = `${environment.apiBaseUrl}/api/planning/photos`;

  private readonly _photos = signal<PlanPhoto[]>([]);
  readonly photos = this._photos.asReadonly();
  readonly busy = signal(false);
  private loadSeq = 0;

  constructor() {
    effect(() => {
      const isCouple = this.auth.isCouple();
      void this.auth.user()?.email;
      if (!this.isBrowser) return;
      const seq = ++this.loadSeq;
      if (!isCouple) {
        this._photos.set([]);
        return;
      }
      this.http
        .get<PlanPhoto[]>(this.base, { context: new HttpContext().set(SILENT_AUTH_401, true) })
        .subscribe({
          next: (list) => seq === this.loadSeq && this._photos.set(list),
          error: () => seq === this.loadSeq && this._photos.set([]),
        });
    });
  }

  markedVendorPhoto(id: number): PlanPhoto | undefined {
    return this._photos().find((p) => p.vendorPhotoId === id);
  }

  markedContentPhoto(id: number): PlanPhoto | undefined {
    return this._photos().find((p) => p.contentPhotoId === id);
  }

  /** Mark or unmark a vendor's portfolio photo / an inspiration photo. */
  toggle(source: { vendorPhotoId: number } | { contentPhotoId: number }): void {
    if (this.busy()) return;
    const existing =
      'vendorPhotoId' in source
        ? this.markedVendorPhoto(source.vendorPhotoId)
        : this.markedContentPhoto(source.contentPhotoId);
    if (existing) {
      this.unmark(existing.id);
      return;
    }
    this.busy.set(true);
    this.http.post<PlanPhoto[]>(this.base, source).subscribe({
      next: (list) => {
        this._photos.set(list);
        this.busy.set(false);
        this.toast.show('planPhotos.marked', 'success', 5000);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const full = err instanceof HttpErrorResponse && err.status === 409;
        this.toast.error(full ? 'planPhotos.full' : 'planPhotos.error');
      },
    });
  }

  unmark(id: number): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.http.delete<PlanPhoto[]>(`${this.base}/${id}`).subscribe({
      next: (list) => {
        this._photos.set(list);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('planPhotos.error');
      },
    });
  }
}
