# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, and others) when working with code in this repository. It is the source of truth; the sibling `CLAUDE.md` imports it via `@AGENTS.md`.

It is the **monorepo orientation layer**: it maps the whole repo and points to the
module guides that own the depth. For anything inside a module, read that module's
guide rather than expecting full detail here:

- **[backend/AGENTS.md](backend/AGENTS.md)** — backend depth: harness/app split, agent &
  middleware chain, sandbox, MCP, skills, memory, IM channels, persistence/migrations,
  config system, test layout.
- **[frontend/AGENTS.md](frontend/AGENTS.md)** — frontend depth: Next.js App Router layout,
  thread/streaming data flow, code style, commands.
- **[frontend-vue/README.md](frontend-vue/README.md)** — Vue commands and verification;
  architecture lives in `frontend-vue/ARCHITECTURE.md` and hard behavior contracts in
  `frontend-vue/BEHAVIOR_CONTRACTS.md`.

The Vue application runs alongside React. How complete the replacement is, is not stated
anywhere in prose — read the code, its tests and the gates, and distrust any status claim you
find, including this file's. React remains the default production hostname and Vue is selected
by a secondary hostname. That topology is not production-cutover evidence: public DNS/TLS/outer-proxy/real-IdP
activation and target-environment acceptance remain environment-owned. Vue owns its
framework-specific stream/artifact-panel, agent-chat, channels, integrations and thread-history
tests. Shared specs are limited to framework-neutral behavior, so a React change enters Vue-owned
surfaces only through an explicit idiomatic Vue implementation and test update.

## What is DeerFlow

DeerFlow is a LangGraph-based AI super-agent system with a full-stack architecture. The
backend runs a "super agent" with sandboxed execution, persistent memory, subagent
delegation, and extensible tools (built-in, MCP, community), all per-thread isolated. The
default frontend is a Next.js chat UI, with a coexisting Nuxt/Vue implementation available on
the configured secondary hostname. Remaining environment risks (public DNS/TLS, outer proxy,
real IdP, target-environment acceptance) are owned outside this repository. External IM
platforms (Feishu,
Slack, Telegram, Discord, DingTalk) bridge into the same agent through the Gateway.

## Service Topology

A single `make dev` / Docker stack runs four cooperating services:

| Service            | Port   | Role                                                                |
| ------------------ | ------ | ------------------------------------------------------------------- |
| **Nginx**          | `2026` | Unified reverse-proxy entry point — open this in the browser        |
| **Gateway API**    | `8001` | FastAPI REST API + embedded LangGraph-compatible agent runtime      |
| **React frontend** | `3000` | Default Next.js web interface                                       |
| **Vue frontend**   | `3000` | Nuxt on the Vue hostname; `make dev-vue` runs it on `3100` outside Docker |
| **Provisioner**    | `8002` | Optional — only when sandbox is configured for provisioner/K8s mode |

Nginx is the single public entry: it serves the frontend and proxies `/api/langgraph/*`
to the Gateway's LangGraph runtime, rewriting it to Gateway's native `/api/*` routes; all
other `/api/*` go straight to the Gateway REST routers. See
[backend/AGENTS.md](backend/AGENTS.md) for the runtime and router detail.
It compresses HTML and configured textual assets, while deliberately leaving SSE,
fonts, images, audio, and video uncompressed at the proxy layer.

Both compose files publish that entry as `"${BIND_HOST:-127.0.0.1}:${PORT:-2026}:2026"`
— **loopback by default**, matching the README's documented deployment model. A bare
`"${PORT}:2026"` binds `0.0.0.0`, which does not.
Nginx itself listens `default_server` on IPv4+IPv6 and the
Gateway binds `0.0.0.0:8001` inside the container on purpose — both are container-
internal; the published nginx port is the entire external surface, and the Gateway's
`8001` is deliberately not published. Any new published port needs an explicit bind
address; `backend/tests/test_compose_default_bind_host.py` pins this for every service
in both compose files.

## Repository Map

```
deer-flow/
├── Makefile                        # Root orchestration: drives the full stack (dev/start/stop, docker, setup)
├── .env / config.yaml / extensions_config.json  # Intentionally tracked runtime config
├── config.example.yaml             # Main config template
├── extensions_config.example.json  # Extensions template
├── backend/                        # Python backend — see backend/AGENTS.md
│   ├── Makefile                    # Per-module backend commands (dev, gateway, test, lint, migrate-rev)
│   ├── packages/extension-api/     # deerflow-extension-api package (import: deerflow_extension_api.*) — public extension contract
│   ├── packages/harness/           # deerflow-harness package (import: deerflow.*) — agent framework
│   └── app/                        # FastAPI Gateway + IM channels (import: app.*)
├── frontend/                       # Next.js frontend (pnpm) — see frontend/AGENTS.md
├── frontend-vue/                   # Coexisting Nuxt/Vue frontend — see frontend-vue/README.md
├── docker/                         # docker-compose files, nginx config, provisioner
├── skills/                         # Agent skills: public/ (committed), custom/ (gitignored)
│                                    # Managed integration skill packs are global at .deer-flow/integrations/skills/{provider}/
│                                    # Integration credentials and enabled state remain per-user
├── contracts/                      # Cross-component JSON contracts (e.g. subagent status, skill review)
├── scripts/                        # Root orchestration scripts invoked by the Makefile (check, configure, doctor, support_bundle, serve, nginx, docker, deploy, setup_wizard)
├── tests/                          # Root-level tests (currently tests/skills/ — public skill tests)
└── docs/                           # Cross-cutting docs, plans, and design notes
```

Third-party extensions are loaded from a top-level `plugins:` list in `config.yaml`
(operator-controlled on purpose — that list causes code to be imported, so it is deliberately
kept out of the API-writable `extensions_config.json`). See the Extension System section in
[backend/AGENTS.md](backend/AGENTS.md).

Runtime config lives at the repo root. `.env`, `config.yaml`, and
`extensions_config.json` are intentionally tracked; preserve that policy. Setup uses the
examples only when a real file is missing, and Gateway may edit runtime-owned sections.
Schema and resolution order live in [backend/AGENTS.md](backend/AGENTS.md).

`skills/public/skill-reviewer/` is the built-in read-only reviewer. It uses the harness
`review_skill_package` tool and `contracts/skill_review/`; full ownership and safety
boundaries live in [backend/AGENTS.md](backend/AGENTS.md).

Scheduled-task note:

- The scheduled-task MVP adds a workspace page at `/workspace/scheduled-tasks` plus a background scheduler service gated by `config.yaml -> scheduler.enabled`.
- Scheduled background runs are intentionally non-interactive: they execute through the normal run lifecycle, but the lead-agent toolset excludes `ask_clarification` when `context.non_interactive=true`. The key is honored only for internally-authenticated callers (the scheduler launch path); client-supplied `context.non_interactive` is dropped.

Vue parity notes:

- Memory, Skills & MCP retain Query owners and auth boundaries; `make e2e-settings` covers the production path.
- The workspace layout owns one palette, settings host and toaster. The route owns settings-open state; Query owns workspace changes and propagates aborts.
- `make e2e-shell` keeps production Auth, owner checks, event reads, filtering and Nuxt; only its isolated seed event and recovery 503 are controlled fixtures.

## Commands: Root vs. Module

**Root `make` targets drive the whole stack** (run from the repo root):

```bash
make setup       # Interactive setup wizard (recommended for new users)
make doctor      # Check configuration and system requirements
make support-bundle  # Generate redacted troubleshooting summary, AI issue draft, and optional zip
make config      # Generate local config files from the examples
make check       # Check that required tools are installed
make install     # Install all dependencies (frontend + backend + pre-commit hooks)
make dev         # Start all services with hot-reload (Gateway + Frontend + Nginx)
make dev-vue     # Start Gateway + Vue on 3100
make dev-dual    # Start Gateway + both frontends directly
make dual-frontend-production-check  # Check React-default/Vue-secondary ingress
make start       # Start all services in production mode (local, optimized)
make stop        # Stop all running services
make up / down   # Build/stop the production Docker stack (browser at localhost:2026)
make docker-start / docker-stop / docker-logs   # Gateway + React/Vue Docker dev; both frontends use Compose Watch/HMR
```

Production `make up` explicitly reconciles both frontend containers after rebuilding.

Docker log and restart commands resolve `DEER_FLOW_ROOT` from the current
checkout before invoking Compose, matching the start and stop commands.

Run `make help` for the full list.

**Per-module commands drive a single module** (run inside that module):

```bash
# Backend (see backend/AGENTS.md for the full set)
cd backend && make dev        # Gateway API with reload (port 8001)
cd backend && make test       # Backend test suite
cd backend && make lint       # ruff check
cd backend && make format     # ruff format

# Frontend (see frontend/AGENTS.md for the full set)
cd frontend && pnpm dev       # Dev server with Turbopack (port 3000)
cd frontend && pnpm check     # Lint + type check (run before committing)
cd frontend && pnpm test      # Unit tests

# Vue frontend (see frontend-vue/README.md for all gates)
cd frontend-vue && make verify
cd frontend-vue && make e2e-mock
cd frontend-vue && make e2e-backend
```

Rule of thumb: root `make` owns application lifecycle; module Makefiles/package commands
own backend, React, or Vue work.

Host pnpm consumers use `scripts/pnpm.py`; `--dir frontend|frontend-vue` selects the
workspace. It resolves absolute paths, prefers direct `pnpm`/`pnpm.cmd`, and otherwise
runs Corepack from the selected workspace so its pinned package manager is honored.

## Where to Go Next

- Backend work → **[backend/AGENTS.md](backend/AGENTS.md)**
- Frontend work → **[frontend/AGENTS.md](frontend/AGENTS.md)**
- Vue frontend → **[frontend-vue/README.md](frontend-vue/README.md)**,
  **[frontend-vue/ARCHITECTURE.md](frontend-vue/ARCHITECTURE.md)**
- Setup & install → **[Install.md](Install.md)**, **[CONTRIBUTING.md](CONTRIBUTING.md)**
- Project overview & usage → **[README.md](README.md)** (translations: `README_zh.md`,
  `README_ja.md`, `README_fr.md`, `README_ru.md`)
- Security policy → **[SECURITY.md](SECURITY.md)**
- Changes → **[CHANGELOG.md](CHANGELOG.md)**
- Cutting a release → **[RELEASING.md](RELEASING.md)**

## Cross-Cutting Conventions

These apply repo-wide; module guides own the module-specific detail.

- **Documentation update policy** — keep docs in sync with code: update `README.md` for
  user-facing changes and the relevant `AGENTS.md` for development/architecture changes in
  the same change set.
- **Test-driven development** — features and bug fixes ship with tests. Backend tests live
  in `backend/tests/` (TDD is mandatory there; see [backend/AGENTS.md](backend/AGENTS.md));
  frontend tests live in `frontend/tests/`.
- **Format before pushing** — run `make format` (backend) / `pnpm check` (frontend). Backend
  CI enforces `ruff format --check`, so formatting must be clean before a push.
