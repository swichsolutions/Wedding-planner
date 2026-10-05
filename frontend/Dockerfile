# Build context = frontend/ (render.yaml `dockerContext`, or the dashboard's Root Directory).
# Multi-stage: Node image builds the Angular SSR bundle, then a lean Node
# image runs the compiled Express server (dist/frontend/server/server.mjs).

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Values compiled into the bundle at build time (Angular environment files aren't
# runtime-configurable). Render turns the service's env vars into Docker build ARGs
# automatically — see render.yaml.
#   API_BASE_URL      the API's public origin, e.g. https://weddingplanner-api-xxxx.onrender.com
#   GOOGLE_CLIENT_ID  Google sign-in client id; empty hides the button (default)
#   NG_ALLOWED_HOSTS  extra SSR allowed hosts baked into angular.json (comma-separated,
#                     "*.onrender.com" by default). The same-named env var is also read at
#                     runtime by @angular/ssr, so either place works.
ARG API_BASE_URL=""
ARG GOOGLE_CLIENT_ID=""
ARG NG_ALLOWED_HOSTS="*.onrender.com"
RUN sed -i "s#apiBaseUrl: ''#apiBaseUrl: '${API_BASE_URL}'#" src/environments/environment.ts \
 && sed -i "s#googleClientId: '[^']*'#googleClientId: '${GOOGLE_CLIENT_ID}'#" src/environments/environment.ts \
 && node -e " \
    const fs = require('fs'); \
    const cfg = JSON.parse(fs.readFileSync('angular.json', 'utf8')); \
    const opts = cfg.projects.frontend.architect.build.options; \
    opts.security = opts.security || {}; \
    const extra = (process.env.NG_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean); \
    opts.security.allowedHosts = [...new Set([...(opts.security.allowedHosts || []), ...extra])]; \
    fs.writeFileSync('angular.json', JSON.stringify(cfg, null, 2)); \
    console.log('allowedHosts:', opts.security.allowedHosts.join(', '));" \
 && grep -E "apiBaseUrl|googleClientId" src/environments/environment.ts

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/frontend ./dist/frontend

EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
