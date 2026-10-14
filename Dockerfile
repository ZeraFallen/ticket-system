# IT Ticketing - container image for the Vite + Firebase single-page app.
#
# Stages (each builds on the previous one):
#   deps       install npm dependencies (cached until package*.json changes)
#   lint       quality gate: `npm run lint` must pass (Jenkins builds this target alone)
#   build      `vite build`; VITE_* values are baked into the bundle here
#   production nginx serving the static dist/ folder
#
# There is no API or database container: the app talks straight to Firebase
# (Authentication + Firestore) from the browser.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS lint
COPY . .
RUN npm run lint

FROM lint AS build
# Firebase *web* config is public by design (Firestore rules protect the data),
# so passing it as build args is fine. Vite reads VITE_* from the environment.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
# Without these the build "succeeds" but the app only shows a missing-config
# screen, so fail loudly instead.
RUN for v in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_APP_ID; do \
      if [ -z "$(printenv "$v")" ]; then echo "ERROR: build arg $v is empty (copy .env.example to .env and fill it in)"; exit 1; fi; \
    done
RUN npm run build

FROM nginx:1.27-alpine AS production
ARG BUILD_NUMBER=dev
LABEL org.opencontainers.image.title="ticket-app-web" \
      org.opencontainers.image.version="${BUILD_NUMBER}"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
