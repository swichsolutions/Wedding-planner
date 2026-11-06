import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { roleGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'vendors',
    loadComponent: () => import('./pages/vendors/vendor-browse').then((m) => m.VendorBrowse),
  },
  {
    path: 'budget',
    loadComponent: () => import('./pages/budget/budget-planner').then((m) => m.BudgetPlanner),
  },
  {
    path: 'guests',
    loadComponent: () => import('./pages/guest-list/guest-list').then((m) => m.GuestList),
  },
  {
    path: 'seating',
    loadComponent: () => import('./pages/seating-chart/seating-chart').then((m) => m.SeatingChart),
  },
  {
    // „მოსაწვევები“ (B6, P11): what the invitation does, design examples, „შექმენი მოსაწვევი“.
    path: 'invitations',
    loadComponent: () => import('./pages/invitations/invitations').then((m) => m.Invitations),
  },
  {
    // Guest-facing invitation search (name + year required — not a directory).
    path: 'invitations/find',
    loadComponent: () => import('./pages/website/site-finder').then((m) => m.SiteFinder),
  },
  // The wedding-website builder grew into the invitation (D7) and moved into the organizer.
  { path: 'website', pathMatch: 'full', redirectTo: '/planning/invitation' },
  { path: 'website/find', pathMatch: 'full', redirectTo: '/invitations/find' },
  {
    // The invitation — the couple's shareable /w/{slug} link.
    path: 'w/:slug',
    loadComponent: () => import('./pages/website/site-view').then((m) => m.SiteView),
  },
  {
    // A family's personal copy with its reply form (D9). Three segments, so it must stay above
    // the vendor profile's /{category}/{city}/{slug}.
    path: 'w/:slug/:code',
    loadComponent: () => import('./pages/website/site-view').then((m) => m.SiteView),
  },
  {
    // The old saved-vendors page grew into „ჩემი მომსახურებები“ (B4).
    path: 'saved',
    redirectTo: 'planning/services',
  },
  {
    path: 'for-vendors',
    loadComponent: () => import('./pages/for-vendors/for-vendors').then((m) => m.ForVendors),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact-page').then((m) => m.ContactPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register').then((m) => m.Register),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/auth/signup').then((m) => m.Signup),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // Target of the emailed reset link (?uid=&token=).
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password').then((m) => m.ResetPassword),
  },
  {
    // The old quick sign-up: sign-up is one page now (account first). Old links keep their
    // returnUrl.
    path: 'join',
    redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/signup'], { queryParams }),
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning').then((m) => m.Planning),
  },
  {
    // The start form right after sign-up (guide §3, D4): names, date, place, guests, budget.
    path: 'planning/start',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/planning/plan-start').then((m) => m.PlanStart),
  },
  {
    // „დავალებები“: tasks by stage with deadlines (guide §6, B3).
    path: 'planning/tasks',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/planning/tasks').then((m) => m.Tasks),
  },
  {
    // „ჩემი მომსახურებები“: saved → shortlisted → chosen vendors, offers, into the budget (guide §6, B4).
    path: 'planning/services',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/planning/services').then((m) => m.Services),
  },
  {
    // „ქორწილის დღე“: the couple's own day schedule (guide §7, B2); ?use=<example> fills it.
    path: 'planning/day',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/planning/wedding-day').then((m) => m.WeddingDay),
  },
  {
    // „მოსაწვევი“: the invitation in 7 steps, personal links and QR codes (guide §6, B6).
    path: 'planning/invitation',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/website/website-builder').then((m) => m.WebsiteBuilder),
  },
  {
    // „პარამეტრები“: the plan's details and partner access (guide §6, D8).
    path: 'planning/settings',
    canActivate: [roleGuard('Couple')],
    loadComponent: () => import('./pages/planning/plan-settings').then((m) => m.PlanSettings),
  },
  {
    // A partner invitation link: join the plan (BUILD-PLAN B1). Works signed out too.
    path: 'partner/:token',
    loadComponent: () => import('./pages/planning/partner-invite').then((m) => m.PartnerInvite),
  },
  {
    // Account settings for any signed-in user (no role arg → just requires authentication).
    path: 'account',
    canActivate: [roleGuard()],
    loadComponent: () => import('./pages/account/account').then((m) => m.Account),
  },
  {
    path: 'dashboard',
    canActivate: [roleGuard('Vendor')],
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
  },
  {
    // An admin edits one vendor's profile and photos with the vendor dashboard (admin-added
    // profiles have no owner account yet; BUILD-PLAN A3).
    path: 'admin/vendors/:id',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    // Legal pages: text comes from the admin content editor (404 until published).
    path: 'terms',
    data: { slug: 'terms' },
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'privacy',
    data: { slug: 'privacy' },
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
  },
  // "რჩევები და იდეები" (guide §5; URLs per PROPOSALS.md P11). Static sections come before
  // the old /guides/:slug redirect and the vendor routes below.
  {
    // Example wedding-day schedules (guide §3; URL from PROPOSALS.md P11).
    path: 'schedules',
    loadComponent: () => import('./pages/schedules/schedules').then((m) => m.Schedules),
  },
  {
    path: 'guides',
    loadComponent: () => import('./pages/guides/guides-hub').then((m) => m.GuidesHub),
  },
  {
    path: 'guides/blog',
    data: { kind: 'article' },
    loadComponent: () => import('./pages/guides/content-list').then((m) => m.ContentList),
  },
  {
    path: 'guides/inspiration',
    data: { kind: 'inspiration' },
    loadComponent: () => import('./pages/guides/content-list').then((m) => m.ContentList),
  },
  {
    path: 'guides/real-weddings',
    data: { kind: 'real-wedding' },
    loadComponent: () => import('./pages/guides/content-list').then((m) => m.ContentList),
  },
  {
    path: 'guides/blog/:slug',
    data: { kind: 'article' },
    loadComponent: () => import('./pages/guides/content-detail').then((m) => m.ContentDetailPage),
  },
  {
    path: 'guides/inspiration/:slug',
    data: { kind: 'inspiration' },
    loadComponent: () => import('./pages/guides/content-detail').then((m) => m.ContentDetailPage),
  },
  {
    path: 'guides/real-weddings/:slug',
    data: { kind: 'real-wedding' },
    loadComponent: () => import('./pages/guides/content-detail').then((m) => m.ContentDetailPage),
  },
  // Old article URLs (/guides/<slug>) moved under the blog. Requests from outside get a 301
  // in server.ts before Angular runs; this covers in-app navigation only.
  { path: 'guides/:slug', redirectTo: ({ params }) => `/guides/blog/${params['slug']}` },

  // Vendor profile — SEO URL shape /{category}/{city}/{slug}. Three segments, so it
  // doesn't collide with the single-segment routes above.
  {
    path: ':category/:city/:slug',
    loadComponent: () =>
      import('./pages/vendor-profile/vendor-profile').then((m) => m.VendorProfile),
  },

  // Category×city landing — SEO URL shape /{category}/{city} (e.g. /fotografi/tbilisi).
  // Two segments, so every static two-segment route above (invitations/find, w/:slug,
  // guides/blog, guides/:slug…) still wins; unknown category slugs 404 inside the component.
  {
    path: ':category/:city',
    loadComponent: () =>
      import('./pages/category-city/category-city').then((m) => m.CategoryCity),
  },

  // Real 404 (noindex) for anything unmatched — no more soft-404 redirects.
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound) },
];
