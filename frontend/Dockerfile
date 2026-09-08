# syntax=docker/dockerfile:1.7

# Frontend Dockerfile
# Supports two targets:
#   --target dev   — install deps only, run `pnpm dev` at container start
#   --target prod  — full build baked in, run `pnpm start` at container start (default if no --target is specified)

ARG PNPM_STORE_PATH=/root/.local/share/pnpm/store
ARG NPM_REGISTRY

# ── Base: shared setup ────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ARG PNPM_STORE_PATH
ARG NPM_REGISTRY
# Configure corepack registry before installing pnpm so the download itself
# succeeds in restricted networks (COREPACK_NPM_REGISTRY controls where
# corepack fetches package managers from).
RUN if [ -n "${NPM_REGISTRY}" ]; then \
      export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
    fi && \
    corepack enable && corepack install -g pnpm@10.26.2
RUN pnpm config set store-dir ${PNPM_STORE_PATH}
# Optionally override npm registry for restricted networks (e.g. NPM_REGISTRY=https://registry.npmmirror.com)
RUN if [ -n "${NPM_REGISTRY}" ]; then pnpm config set registry "${NPM_REGISTRY}"; fi
WORKDIR /app

# Keep dependency installation independent from application source changes.
# The cache mount persists downloaded packages across clean BuildKit builds;
# node_modules itself remains in this image layer for downstream stages.
FROM base AS dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN --mount=type=cache,id=deer-flow-frontend-pnpm,target=${PNPM_STORE_PATH} \
    cd /app/frontend && pnpm install --frozen-lockfile

WORKDIR /app/frontend
# Refuse to bake an image whose node_modules was resolved for another platform.
#
# 2026-09-08: the dev image carried `lightningcss-darwin-arm64` — the macOS
# build of Tailwind's CSS engine — on an Alpine/arm64 container, from a
# `dependencies` layer Docker had cached a month earlier. Nothing revalidates
# such a layer: its only inputs are package.json and pnpm-lock.yaml, so as long
# as those do not change the same tree is served forever. It surfaced ten hours
# into a session as a 500 the first time Tailwind compiled a stylesheet from
# cold, because the compile cache had answered everything until then.
#
# How that layer came to hold a macOS package was never established — today's
# builds resolve correctly, and the production image built 2026-08-23 from this
# same Dockerfile is correct too. So this asserts the property instead of
# guessing at the cause: pnpm installs exactly the optional platform package
# matching the install host, so a `*-darwin-*` or `*-win32-*` directory here
# means the tree was resolved somewhere else, and the build must not proceed.
#
# The startup check in docker/node-entrypoint.sh is the other half: this one
# stops a bad image from being *produced*, that one stops an already-cached bad
# image from being *started*.
RUN found=$(find node_modules/.pnpm -maxdepth 1 -type d \
        \( -name '*-darwin-*' -o -name '*-win32-*' \) -print 2>/dev/null | head -1); \
    if [ -n "$found" ]; then \
        echo "node_modules was resolved for another platform: $found" >&2; \
        echo "rebuild with --no-cache; a cached dependencies layer never revalidates" >&2; \
        exit 1; \
    fi
WORKDIR /app

# ── Dev: install only, CMD is overridden by docker-compose ───────────────────
FROM dependencies AS dev
COPY frontend ./frontend
EXPOSE 3000

# ── Builder: install + compile Next.js ───────────────────────────────────────
FROM dependencies AS builder
COPY frontend ./frontend
# Skip env validation — runtime vars are injected by nginx/container
# App version stamp for the About page. Nightly CI passes
# APP_VERSION=<base>-nightly.<date>-<sha>; release/local builds leave it empty
# and the frontend falls back to package.json's version.
ARG APP_VERSION=""
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
RUN cd /app/frontend && SKIP_ENV_VALIDATION=1 pnpm build

# ── Prod: minimal runtime with pre-built output ───────────────────────────────
FROM node:22-alpine AS prod
ARG PNPM_STORE_PATH
ARG NPM_REGISTRY
RUN if [ -n "${NPM_REGISTRY}" ]; then \
      export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
    fi && \
    corepack enable && corepack install -g pnpm@10.26.2
RUN pnpm config set store-dir ${PNPM_STORE_PATH}
RUN if [ -n "${NPM_REGISTRY}" ]; then pnpm config set registry "${NPM_REGISTRY}"; fi
WORKDIR /app
# `--chown=node:node` so the server can own its own writable state: `next start`
# writes into `.next/cache`, and a root-owned tree would force either a root
# process or a mounted volume over that one directory (which is exactly what
# the Helm chart had to do -- see its README's "root-owned in the image" note).
COPY --from=builder --chown=node:node /app/frontend ./frontend

# Drop privileges. This image served production as **root**: nothing in the
# `prod` stage set a user, and the node base images leave it at 0. The Vue
# image next door has run as `node` all along, which is how the difference
# surfaced -- `docker exec deer-flow-frontend id` said uid=0 while the Helm
# chart separately forced runAsUser 1000, so Kubernetes was hardened and
# Compose was not.
USER node
EXPOSE 3000

# A TCP connect, not an HTTP GET, and deliberately so.
#
# `/` is the landing page: rendering it runs a server-side fetch to the GitHub
# API for the star count. Probing it every 10s would spend 360 requests an hour
# against an unauthenticated limit of 60 -- the same rate-limit stall that made
# `landing.spec.ts` flake for six waves. Next.js ships no lightweight route of
# its own, and inventing one just to be probed would put an ops endpoint in the
# product tree.
#
# The Helm chart already answered this question for the same workload: its
# frontend Deployment uses `tcpSocket` probes. `next start` binds the port after
# the server is ready, so accepting a connection is a fair readiness signal.
# The Vue image next door checks `/health` because it has one (a real Nitro
# route); each image uses the best signal it actually has, and
# backend/tests/test_frontend_images_drop_privileges.py pins that both have one.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "require('net').connect(3000, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"]

CMD ["sh", "-c", "cd /app/frontend && pnpm start"]
