# syntax=docker/dockerfile:1.7

ARG NPM_REGISTRY

FROM node:22.22.3-bookworm-slim AS dependencies
ARG NPM_REGISTRY
WORKDIR /workspace
RUN if [ -n "${NPM_REGISTRY}" ]; then \
      export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
    fi && \
    corepack enable && corepack prepare pnpm@10.26.2 --activate
RUN if [ -n "${NPM_REGISTRY}" ]; then pnpm config set registry "${NPM_REGISTRY}"; fi
COPY frontend-vue/package.json frontend-vue/pnpm-lock.yaml frontend-vue/pnpm-workspace.yaml ./frontend-vue/
COPY frontend-vue/packages/agent-core/package.json ./frontend-vue/packages/agent-core/package.json
RUN cd frontend-vue && pnpm install --frozen-lockfile --strict-peer-dependencies

WORKDIR /workspace/frontend-vue
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
WORKDIR /workspace

FROM dependencies AS dev
COPY frontend-vue ./frontend-vue
WORKDIR /workspace/frontend-vue
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "exec", "nuxt", "dev", "--host", "0.0.0.0", "--port", "3000"]

FROM dependencies AS build
COPY frontend-vue ./frontend-vue
RUN cd frontend-vue && pnpm exec nuxt build

FROM node:22.22.3-bookworm-slim AS runtime
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/frontend-vue/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
