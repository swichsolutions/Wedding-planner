# Build context = frontend/ (Render "Root Directory" setting).
# Multi-stage: Node image builds the Angular SSR bundle, then a lean Node
# image runs the compiled Express server (dist/frontend/server/server.mjs).

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The API origin is compiled into the bundle at build time (Angular environment
# files aren't runtime-configurable). Render turns a dashboard env var named
# API_BASE_URL into this build ARG automatically — set it on the frontend
# service to the backend service's public URL, e.g. https://weddingplanner-api.onrender.com
ARG API_BASE_URL=""
RUN sed -i "s#apiBaseUrl: ''#apiBaseUrl: '${API_BASE_URL}'#" src/environments/environment.ts

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/frontend ./dist/frontend

EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
