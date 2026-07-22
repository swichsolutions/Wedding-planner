import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

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
  private readonly all = toSignal(inject(VendorService).list(), {
    initialValue: [] as Vendor[],
  });

  /** Saved vendors, in the order they appear in the directory. */
  protected readonly saved = computed(() => {
    const ids = new Set(this.wishlist.ids());
    return this.all().filter((v) => ids.has(v.id));
  });
}
