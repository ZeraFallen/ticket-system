# ---- base: install all deps + source (used by test stage) ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# ---- test: `docker build --target test ./api` fails the build if tests fail ----
FROM base AS test
RUN npm test

# ---- production: prod deps only, non-root ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
USER node
CMD ["node", "server.js"]
