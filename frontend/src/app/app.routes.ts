import { Routes } from '@angular/router';

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
    path: 'website',
    loadComponent: () => import('./pages/website/website-builder').then((m) => m.WebsiteBuilder),
  },
  {
    // Public wedding sites — the couple's shareable /w/{slug} link.
    path: 'w/:slug',
    loadComponent: () => import('./pages/website/site-view').then((m) => m.SiteView),
  },
  {
    path: 'saved',
    loadComponent: () => import('./pages/saved/saved').then((m) => m.Saved),
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
    // Legacy couple sign-up form — kept in code but no longer linked from the UI
    // (all couple sign-up CTAs now point to /signup).
    path: 'join',
    loadComponent: () => import('./pages/auth/join').then((m) => m.Join),
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning').then((m) => m.Planning),
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
    path: 'guides',
    loadComponent: () => import('./pages/guides/guide-list').then((m) => m.GuideList),
  },
  {
    path: 'guides/:slug',
    loadComponent: () => import('./pages/guides/guide-article').then((m) => m.GuideArticle),
  },

  // Vendor profile — SEO URL shape /{category}/{city}/{slug}. Three segments, so it
  // doesn't collide with the single-segment routes above.
  {
    path: ':category/:city/:slug',
    loadComponent: () =>
      import('./pages/vendor-profile/vendor-profile').then((m) => m.VendorProfile),
  },

  // Real 404 (noindex) for anything unmatched — no more soft-404 redirects.
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound) },
];
