import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { SITE_LINKS } from './server.head';
import { cleanAddress } from './server.redirects';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * One spelling per address (no trailing or doubled slashes, no /index.html, lower case) and the
 * addresses from before 2026-11-13 (/guides…, /schedules, /vendors?group=…, /vendors?category=…)
 * moved to the Georgian ones, in one hop: the same rule as the live Worker's server.redirects.ts.
 * Redirected here, permanently and before Angular: search engines carry the old URL's standing
 * over, and a missing article still ends as a plain 404 at its new address (inside Angular, a
 * redirect whose target page answers 404 crashes the SSR response). It runs before the static
 * files, which is why cleanAddress leaves file names' letters alone (chunk-AB12.js).
 */
app.use((req, res, next) => {
  const target = req.method === 'GET' || req.method === 'HEAD' ? cleanAddress(req.originalUrl) : null;
  if (target) res.redirect(301, target);
  else next();
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) return next();
      // the same Link header the live Worker sends with a page (server.head.ts)
      if (response.headers.get('content-type')?.includes('text/html')) res.setHeader('Link', SITE_LINKS);
      return writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
