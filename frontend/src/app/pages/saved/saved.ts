import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of, switchMap, tap } from 'rxjs';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { VendorService } from '../../core/vendor.service';
import { WishlistService } from '../../core/wishlist.service';
import { AuthService } from '../../core/auth.service';
import { Vendor } from '../../core/vendor.models';

@Component({
  selector: 'app-saved',
  imports: [RouterLink, TranslatePipe, VendorCard],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved {
  private readonly wishlist = inject(WishlistService);
  protected readonly auth = inject(AuthService);
  private readonly vendorSvc = inject(VendorService);

  protected readonly loadError = signal(false);
  /** True until the directory answers — skeletons, not a false "nothing saved yet". */
  protected readonly loading = signal(true);
  protected readonly skeletons = [0, 1, 2, 3];
  private readonly reload = signal(0);

  // On error show a real error state — an empty directory here would masquerade
  // as "nothing saved yet", which is a lie when the API is down.
  private readonly all = toSignal(
    toObservable(this.reload).pipe(
      switchMap(() => {
        this.loading.set(true);
        // Cleared at request start so Retry visibly returns to the skeleton.
        this.loadError.set(false);
        return this.vendorSvc.list().pipe(
          tap(() => this.loading.set(false)),
          catchError(() => {
            this.loading.set(false);
            this.loadError.set(true);
            return of([] as Vendor[]);
          }),
        );
      }),
    ),
    { initialValue: [] as Vendor[] },
  );

  protected retry(): void {
    this.reload.update((n) => n + 1);
    // A failed saved-ids GET is part of this page's error state too.
    if (this.wishlist.loadError()) this.wishlist.reload();
  }

  // The page's state folds in the WISHLIST fetch too: while the saved-ids GET
  // is unresolved (or failed), rendering `saved()` as [] would masquerade as
  // "nothing saved yet" — the exact false-empty this page was fixed to avoid.
  protected readonly showLoading = computed(
    () => this.loading() || (this.auth.isCouple() && !this.wishlist.loaded()),
  );
  protected readonly showError = computed(() => this.loadError() || this.wishlist.loadError());

  /** Saved vendors, in the order they appear in the directory. */
  protected readonly saved = computed(() => {
    const ids = new Set(this.wishlist.ids());
    return this.all().filter((v) => ids.has(v.id));
  });
}
