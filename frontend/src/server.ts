import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

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
 * Old article URLs (/guides/<slug>) moved to /guides/blog/<slug> (design-system/PROPOSALS.md
 * P11). Redirected here, permanently and before Angular: search engines carry the old URL's
 * standing over, and a missing article still ends as a plain 404 at its new address (inside
 * Angular, a redirect whose target page answers 404 crashes the SSR response).
 */
const GUIDE_SECTIONS = new Set(['blog', 'inspiration', 'real-weddings']);
app.get('/guides/:slug', (req, res, next) => {
  const { slug } = req.params;
  if (GUIDE_SECTIONS.has(slug)) {
    next();
    return;
  }
  const at = req.originalUrl.indexOf('?');
  const query = at === -1 ? '' : req.originalUrl.slice(at);
  res.redirect(301, `/guides/blog/${encodeURIComponent(slug)}${query}`);
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
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
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
