import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { CoupleService, PlanInvitePreview } from '../../core/couple.service';
import { ToastService } from '../../core/toast.service';
import { GoldRing } from '../../components/gold-ring/gold-ring';

/**
 * The page a partner invitation link opens (/partner/:token, BUILD-PLAN B1, D8). Shows whose plan
 * it is; signed out, it offers sign-up (which comes straight back here) or sign-in; signed in as a
 * couple, it joins — asking first if that means leaving a plan of their own.
 */
@Component({
  selector: 'app-partner-invite',
  imports: [RouterLink, TranslatePipe, GoldRing],
  templateUrl: './partner-invite.html',
  styleUrl: './partner-invite.scss',
  host: { class: 'theme-brand' },
})
export class PartnerInvite {
  private readonly couple = inject(CoupleService);
  private readonly authModal = inject(AuthModalService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';
  protected readonly preview = signal<PlanInvitePreview | null>(null);
  protected readonly loadError = signal(false);
  protected readonly joining = signal(false);
  /** Joining means leaving the plan they have now: they confirm first. */
  protected readonly confirmLeave = signal<{ shared: boolean } | null>(null);
  protected readonly joinError = signal(false);

  protected readonly here = computed(() => `/partner/${this.token}`);

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('partner.title')} | ${t.instant('brand.name')}`);
    // A personal link: never indexed.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.couple.previewInvite(this.token).subscribe({
        next: (p) => this.preview.set(p),
        error: () => this.loadError.set(true),
      });
    }
  }

  protected signIn(): void {
    this.authModal.open();
  }

  protected join(replace = false): void {
    this.joining.set(true);
    this.joinError.set(false);
    this.couple.acceptInvite(this.token, replace).subscribe({
      next: () => {
        this.toast.success('partner.joinedToast');
        void this.router.navigateByUrl('/planning');
      },
      error: (err: HttpErrorResponse) => {
        this.joining.set(false);
        const code = err.error?.code as string | undefined;
        if (err.status === 409 && code === 'hasPlan') {
          this.confirmLeave.set({ shared: !!err.error?.shared });
        } else if (err.status === 409 && (code === 'used' || code === 'expired' || code === 'full')) {
          this.preview.update((p) => ({ status: code, names: p?.names ?? null }));
        } else {
          this.joinError.set(true);
        }
      },
    });
  }
}
