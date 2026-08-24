import { Component, DOCUMENT, HostListener, computed, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { PlatformLocation } from '@angular/common';
import { Meta } from '@angular/platform-browser';
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
    // NOT router.url: that's still '/' at client bootstrap, so the first
    // hydrating render of /w/{slug} would grow a header/footer the server never
    // serialized (NG0500 + a chrome flash on the couple's shared link). The
    // platform location knows the real path on both server and browser.
    { initialValue: inject(PlatformLocation).pathname },
  );
  protected readonly chromeless = computed(() => this.currentUrl().startsWith('/w/'));

  constructor() {
    // noindex must not leak across client-side navigations (the site finder,
    // account page, and not-found/error states all set it). Pages assert robots
    // in constructors or load handlers — both run after NavigationStart — so
    // clearing here lets every destination start indexable and re-assert as needed.
    const meta = inject(Meta);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) meta.removeTag("name='robots'");
    });
  }

  /** Condense the header once the page is scrolled (browser-only; SSR renders the tall state). */
  @HostListener('window:scroll')
  protected onScroll(): void {
    // Hysteresis, not one threshold: condensing shrinks the header by ~18px, which
    // shifts the page and can push scrollY back across a single cutoff — the header
    // then oscillates ("shivers"). Separate enter/exit points wider than the height
    // delta make the toggle one-way in each direction.
    const y = window.scrollY;
    if (y > 32) this.scrolled.set(true);
    else if (y < 4) this.scrolled.set(false);
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
