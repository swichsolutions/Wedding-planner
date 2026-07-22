import { Component, DOCUMENT, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from './i18n/language.service';
import { LangCode } from './i18n/languages';
import { WishlistService } from './core/wishlist.service';
import { AuthService } from './core/auth.service';
import { AuthModalService } from './core/auth-modal.service';
import { NotificationService } from './core/notification.service';
import { LoginModal } from './components/login-modal/login-modal';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { Toasts } from './components/toasts/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LoginModal, ConfirmDialog, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly authModal = inject(AuthModalService);
  protected readonly lang = inject(LanguageService);
  protected readonly wishlist = inject(WishlistService);
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly year = new Date().getFullYear();

  /** "My profile" destination by role: vendors manage their business listing (dashboard);
   * everyone else (couples, admins) lands on account settings. */
  protected readonly profileLink = computed(() => (this.auth.isVendor() ? '/dashboard' : '/account'));

  // Public wedding sites (/w/{slug}) render chromeless — a couple's invitation page
  // shouldn't carry the planner's header and footer.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly chromeless = computed(() => this.currentUrl().startsWith('/w/'));

  /** Condense the header once the page is scrolled (browser-only; SSR renders the tall state). */
  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  /** Skip-to-content. A bare href="#main" is rewritten by <base href="/"> to /#main
   * (navigates home), so move focus to <main> in code instead. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    const main = this.doc.getElementById('main');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  }

  protected openLogin(): void {
    this.authModal.open();
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.menuOpen.set(false);
    this.router.navigateByUrl('/');
  }

  protected setLang(code: LangCode): void {
    this.lang.use(code);
    this.menuOpen.set(false);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
