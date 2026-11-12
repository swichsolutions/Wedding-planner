import { Component, DOCUMENT, HostListener, computed, effect, inject, signal } from '@angular/core';

/** One entry of a header dropdown. Items whose page isn't built yet point at the nearest
 * existing page (listed under "Temporary links" in design-system/BUILD-PLAN.md). */
interface NavItem {
  /** Shown only once this content section has something published. */
  content?: ContentKind;
  key: string;
  link: string;
  query?: Record<string, string>;
  fragment?: string;
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
import { ContentSections } from './core/content-sections.service';
import { ContentKind } from './core/content.models';
import { AuthModalService } from './core/auth-modal.service';
import { NotificationService } from './core/notification.service';
import { LoginModal } from './components/login-modal/login-modal';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { Toasts } from './components/toasts/toasts';
import { ORGANIZER_PATHS, OrganizerNav } from './components/organizer-nav/organizer-nav';

/** Public routes (as written in app.routes.ts) that the language switch must not reopen: the
 * account forms, the contact form, and a vendor's page with its review draft. Reopening empties
 * them. Their text follows the language by itself, and they set their own title again
 * (core/page-title.ts; VendorProfile does it with its other search tags). */
const KEEPS_ITS_FORM = [
  'login',
  'signup',
  'register',
  'forgot-password',
  'reset-password',
  'contact',
  ':category/:city/:slug',
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LoginModal, ConfirmDialog, Toasts, OrganizerNav],
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

  /** Header = three sections (guide §1). Each title opens its page (home, the catalog, the
   * tips hub); the dropdown holds the details. The organizer is reached through the CTA and
   * has its own inner menu (OrganizerNav) — no "ჩემი ქორწილი" group here (decision D2). */
  private readonly allNavGroups: NavGroup[] = [
    {
      key: 'plan',
      link: '/',
      items: [
        { key: 'schedules', link: '/schedules' },
        { key: 'invitations', link: '/invitations' },
      ],
    },
    {
      key: 'vendors',
      link: '/vendors',
      items: [
        { key: 'venues', link: '/vendors', query: { group: 'venues' } },
        { key: 'photo', link: '/vendors', query: { group: 'photo' } },
        { key: 'decor', link: '/vendors', query: { group: 'decor' } },
        { key: 'music', link: '/vendors', query: { group: 'music' } },
        { key: 'cake', link: '/vendors', query: { group: 'cake' } },
        { key: 'attire', link: '/vendors', query: { group: 'attire' } },
        { key: 'accessories', link: '/vendors', query: { group: 'accessories' } },
        { key: 'beauty', link: '/vendors', query: { group: 'beauty' } },
        { key: 'other', link: '/vendors', query: { group: 'other' } },
        { key: 'all', link: '/vendors' },
      ],
    },
    {
      key: 'guides',
      link: '/guides',
      items: [
        { key: 'blog', link: '/guides/blog', content: 'article' },
        { key: 'inspiration', link: '/guides/inspiration', content: 'inspiration' },
        { key: 'real', link: '/guides/real-weddings', content: 'real-wedding' },
      ],
    },
  ];
  private readonly contentSections = inject(ContentSections);
  /** The menu as shown: no empty content sections, and no group left with nothing in it. */
  protected readonly navGroups = computed(() =>
    this.allNavGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => !it.content || this.contentSections.has(it.content)) }))
      .filter((g) => g.items.length),
  );
  protected readonly scrolled = signal(false);
  /** Hide-on-scroll (Revolut): the bar slides away as the page scrolls down and comes
   * back on the first scroll up. The very top of the page always shows it, and so does the
   * landing page's pinned opening stage (see introPinned). */
  protected readonly hidden = signal(false);
  private lastY = 0;
  /** Scrolled, but the landing page's opening stage is still pinned (hero → "where do I
   * start?", pages/home): the photo has not moved, so the bar stays as it is over it. */
  private readonly introPinned = signal(false);
  /** True while a dark section (`data-nav="dark"`) sits under the bar: the bar's
   * translucent paper then reads as dark grey over it, and the text goes light. */
  protected readonly navDark = signal(false);
  protected readonly year = new Date().getFullYear();

  /** The header CTA after sign-in: "დაიწყე დაგეგმვა" becomes "ჩემი გეგმა" (Beka,
   * 2026-10-12; confirmed as decision D1 on 2026-10-21 over the guide's "ჩემი ქორწილი").
   * Couples go to their organizer; vendors to their listing; admins to the admin panel. */
  protected readonly myLink = computed<{ link: string; key: string }>(() => {
    if (this.auth.isVendor()) return { link: '/dashboard', key: 'nav.myProfile' };
    if (this.auth.isAdmin()) return { link: '/admin', key: 'auth.admin' };
    return { link: '/planning', key: 'nav.myPlan' };
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
  /** On one of the organizer's working pages (shows its inner menu to couples). */
  protected readonly inOrganizer = computed(() =>
    ORGANIZER_PATHS.includes(this.currentUrl().split(/[?#]/)[0]),
  );

  /** The landing page: its header sits over the full-screen hero photo (see overlay). */
  protected readonly onHome = computed(() => this.currentUrl().split(/[?#]/)[0] === '/');

  /** On the landing page the header sits transparently over the full-screen hero photo
   * until the page is scrolled past it (the pinned opening stage counts as not scrolled:
   * the photo is still there); everywhere else it is the normal paper bar. */
  protected readonly overlay = computed(() => this.onHome() && (!this.scrolled() || this.introPinned()));

  constructor() {
    // noindex must not leak across client-side navigations (the site finder,
    // account page, and not-found/error states all set it). Pages assert robots
    // in constructors or load handlers — both run after NavigationStart — so
    // clearing here lets every destination start indexable and re-assert as needed.
    // Likewise the description: a page that doesn't set its own gets the site's default
    // (index.html's), not the one the previous page left behind.
    const meta = inject(Meta);
    const defaultDescription = meta.getTag("name='description'")?.content ?? '';
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationStart)) return;
      meta.removeTag("name='robots'");
      if (defaultDescription) meta.updateTag({ name: 'description', content: defaultDescription });
    });

    // Every page is on the brand theme (CLAUDE.md), so it sits on <body>: pages, overlays and
    // CDK drag previews (appended to body) all get it. A couple's invitation (/w/…) has its own
    // design and fonts, so it stays off there.
    effect(() => {
      this.doc.body?.classList.toggle('theme-brand', !this.chromeless());
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

    this.readSectionUnderBar();

    const dy = y - this.lastY;
    this.lastY = y;
    // The landing page's opening stage is pinned for its extra height (the hero's words
    // give way to the second section's, the photo stays): the bar stays too, unchanged.
    // Two release points, 32px apart, not one: leaving the pinned state condenses the bar
    // by 12px, which shifts the page and would carry scrollY back across a single cutoff,
    // and the bar would then flip between its two states for as long as the page rests there.
    const stage = document.querySelector<HTMLElement>('.intro.is-staged');
    const release = stage ? stage.offsetHeight - window.innerHeight : 0;
    const pinned = !!stage && y < release + (this.introPinned() ? 16 : -16);
    this.introPinned.set(pinned);
    if (y < 8 || pinned) {
      this.hidden.set(false);
      return;
    }
    if (dy > 2) this.hidden.set(true);
    else if (dy < -2) this.hidden.set(false);
  }

  /** What is under the bar's lower edge: a `data-nav="dark"` section flips the bar's
   * text to light (the bar's own translucency does the background). Sampled on scroll. */
  private readSectionUnderBar(): void {
    const bar = document.querySelector<HTMLElement>('.hdr');
    if (!bar) return;
    const y = Math.max(1, bar.offsetHeight - 2);
    const under = document
      .elementsFromPoint(window.innerWidth / 2, y)
      .find((el) => !bar.contains(el));
    this.navDark.set(!!under?.closest('[data-nav="dark"]'));
  }

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    const open = this.openGroup();
    if (open) {
      const item = this.doc.getElementById(`nav-${open}`)?.closest('.hdr__item');
      // Focus inside the closing menu would otherwise fall back to the page's start.
      if (item?.contains(this.doc.activeElement)) item.querySelector<HTMLElement>('.hdr__chev-btn')?.focus();
      this.openGroup.set(null);
    }
    else if (this.menuOpen()) this.menuOpen.set(false);
  }

  /** On the desktop bar, a mouse opens a dropdown on hover. Never on touch (the synthetic
   * mouseenter before a tap would open it and the tap would close it again), and never in the
   * phone sheet, which a narrow laptop window shows too: there hover opened the section and
   * the click on its arrow closed it again. Matches the xl breakpoint in app.scss. */
  protected hoverGroup(key: string | null): void {
    if (window.matchMedia('(hover: hover) and (min-width: 1280px)').matches) this.openGroup.set(key);
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

  /** Every language control ends here (the bar's toggle, the phone menu's and the footer's
   * buttons), so each of them also puts the page's title into the new language. */
  protected setLang(code: LangCode): void {
    if (code === this.lang.current()) return;
    void this.lang.use(code).then(() => this.redrawPublicPage());
  }

  /** Desktop bar: a plain text control that names the language you would switch TO
   * (the usual Georgian-site pattern: "EN" on the Georgian page, "KA" on the English one). */
  protected readonly otherLang = computed(() => {
    const codes = this.lang.supported.map((l) => l.code);
    const i = codes.indexOf(this.lang.current());
    return codes[(i + 1) % codes.length];
  });

  protected toggleLang(): void {
    this.setLang(this.otherLang());
  }

  /** Pages set their title once, when they open, so a public page is reopened in the new language.
   * Not the working pages (organizer, dashboard, admin), and not the public pages that hold a form
   * (KEEPS_ITS_FORM): a half-filled form must survive the switch. */
  private redrawPublicPage(): void {
    const path = this.currentUrl().split(/[?#]/)[0];
    if (this.inOrganizer() || /^\/(admin|dashboard|account|planning|partner|w)(\/|$)/.test(path)) return;
    const route = this.router.routerState.snapshot.root.firstChild?.routeConfig?.path ?? '';
    if (KEEPS_ITS_FORM.includes(route)) return;
    const y = window.scrollY;
    const strategy = this.router.routeReuseStrategy;
    const reuse = strategy.shouldReuseRoute;
    strategy.shouldReuseRoute = () => false;
    void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload', replaceUrl: true }).finally(() => {
      strategy.shouldReuseRoute = reuse;
      setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }));
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.openGroup.set(null);
  }
}
