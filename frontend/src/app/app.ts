import { Component, DOCUMENT, HostListener, computed, effect, inject, signal } from '@angular/core';

/** One entry of a header dropdown. `link`s marked "(pending)" in REDESIGN-PLAN.md point at
 * the nearest existing page until the real page is built. */
interface NavItem {
  key: string;
  link: string;
  query?: Record<string, string>;
}

interface NavGroup {
  key: string;
  link: string;
  items: NavItem[];
}
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
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly menuOpen = signal(false);
  /** Which header dropdown is open (desktop: hover/click; phone sheet: accordion). */
  protected readonly openGroup = signal<string | null>(null);

  /** Header = four dropdowns (sitemap §02: short menu, details on hover). The fourth,
   * "ჩემი ქორწილი", is the organizer and is where the older tool pages live. */
  protected readonly navGroups: NavGroup[] = [
    {
      key: 'plan',
      link: '/planning',
      items: [
        { key: 'start', link: '/planning' },
        { key: 'stages', link: '/planning' },
        { key: 'templates', link: '/planning' },
        { key: 'organizer', link: '/planning' },
      ],
    },
    {
      key: 'vendors',
      link: '/vendors',
      items: [
        { key: 'venues', link: '/vendors', query: { category: 'darbazi' } },
        { key: 'photo', link: '/vendors', query: { category: 'fotografi' } },
        { key: 'decor', link: '/vendors', query: { category: 'dekori' } },
        { key: 'music', link: '/vendors', query: { category: 'musika' } },
        { key: 'cake', link: '/vendors', query: { category: 'torti' } },
        { key: 'attire', link: '/vendors', query: { category: 'kaba' } },
        { key: 'beauty', link: '/vendors', query: { category: 'makiaji' } },
        { key: 'other', link: '/vendors', query: { category: 'transporti' } },
        { key: 'all', link: '/vendors' },
      ],
    },
    {
      key: 'guides',
      link: '/guides',
      items: [
        { key: 'tips', link: '/guides' },
        { key: 'inspiration', link: '/guides' },
        { key: 'real', link: '/guides' },
      ],
    },
    {
      key: 'mine',
      link: '/planning',
      items: [
        { key: 'overview', link: '/planning' },
        { key: 'tasks', link: '/planning' },
        { key: 'budget', link: '/budget' },
        { key: 'guests', link: '/guests' },
        { key: 'seating', link: '/seating' },
        { key: 'website', link: '/website' },
      ],
    },
  ];
  protected readonly scrolled = signal(false);
  /** Hide-on-scroll (Revolut): the bar slides away as the page scrolls down and comes
   * back on the first scroll up — except while the landing stage's cards are on screen,
   * where it stays away; the very top of the page always shows it. */
  protected readonly hidden = signal(false);
  private lastY = 0;
  protected readonly year = new Date().getFullYear();

  /** The header CTA after sign-in (sitemap: "დაიწყე დაგეგმვა" becomes "ჩემი ქორწილი").
   * Couples go to their organizer; vendors to their listing; admins to the admin panel. */
  protected readonly myLink = computed<{ link: string; key: string }>(() => {
    if (this.auth.isVendor()) return { link: '/dashboard', key: 'nav.myProfile' };
    if (this.auth.isAdmin()) return { link: '/admin', key: 'auth.admin' };
    return { link: '/planning', key: 'nav.myWedding' };
  });

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

  /** On the landing page the header sits transparently over the full-screen hero photo
   * until the page is scrolled; everywhere else it is the normal paper bar. */
  protected readonly overlay = computed(
    () => this.currentUrl().split(/[?#]/)[0] === '/' && !this.scrolled(),
  );

  constructor() {
    // noindex must not leak across client-side navigations (the site finder,
    // account page, and not-found/error states all set it). Pages assert robots
    // in constructors or load handlers — both run after NavigationStart — so
    // clearing here lets every destination start indexable and re-assert as needed.
    const meta = inject(Meta);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) meta.removeTag("name='robots'");
    });

    // The mobile menu is a full-screen sheet: lock page scroll while it is open.
    effect(() => {
      const open = this.menuOpen();
      if (this.doc.body) this.doc.body.classList.toggle('menu-open', open);
    });
  }

  /** Condense the header once the page is scrolled (browser-only; SSR renders the tall state). */
  @HostListener('window:scroll')
  protected onScroll(): void {
    // Hysteresis, not one threshold: condensing shrinks the header, which shifts the
    // page and can push scrollY back across a single cutoff — the header then
    // oscillates. Separate enter/exit points make the toggle one-way in each direction.
    const y = window.scrollY;
    if (y > 32) this.scrolled.set(true);
    else if (y < 4) this.scrolled.set(false);

    const dy = y - this.lastY;
    this.lastY = y;
    if (y < 8) {
      this.hidden.set(false);
      return;
    }
    // The landing hero's stage (the three cards) runs for the hero's extra height; the
    // bar stays hidden until the next section has mostly taken over the screen.
    const stage = document.querySelector<HTMLElement>('.hero.is-staged');
    if (stage && y < stage.offsetHeight - window.innerHeight * 0.75) {
      this.hidden.set(true);
      return;
    }
    if (dy > 2) this.hidden.set(true);
    else if (dy < -2) this.hidden.set(false);
  }

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    if (this.openGroup()) this.openGroup.set(null);
    else if (this.menuOpen()) this.menuOpen.set(false);
  }

  /** Pointer devices open a dropdown on hover; touch devices only on tap (otherwise the
   * synthetic mouseenter before a tap would open it and the tap would close it again). */
  protected hoverGroup(key: string | null): void {
    if (window.matchMedia('(hover: hover)').matches) this.openGroup.set(key);
  }

  protected toggleGroup(key: string): void {
    this.openGroup.update((k) => (k === key ? null : key));
  }

  /** Close a dropdown when keyboard focus leaves it. */
  protected onGroupBlur(event: FocusEvent, key: string): void {
    const next = event.relatedTarget as Node | null;
    const host = event.currentTarget as HTMLElement;
    if (!next || !host.contains(next)) {
      if (this.openGroup() === key) this.openGroup.set(null);
    }
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
  }

  /** Desktop bar: a plain text control that names the language you would switch TO
   * (the usual Georgian-site pattern: "EN" on the Georgian page, "KA" on the English one). */
  protected readonly otherLang = computed(() => {
    const codes = this.lang.supported.map((l) => l.code);
    const i = codes.indexOf(this.lang.current());
    return codes[(i + 1) % codes.length];
  });

  protected toggleLang(): void {
    this.lang.use(this.otherLang());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.openGroup.set(null);
  }
}
