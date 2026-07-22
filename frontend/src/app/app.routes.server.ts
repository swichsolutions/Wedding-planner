import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Every route is server-rendered on demand (full crawlable HTML per request).
  // Not prerendered: pages are data-driven (vendor API), so building them statically
  // would require the API to be live at build time. SSR satisfies the SEO requirement.
  { path: '**', renderMode: RenderMode.Server },
];
