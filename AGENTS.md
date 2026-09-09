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

Vue runs alongside React. **How complete the replacement is is deliberately not stated in
prose** — read the code, its tests and the gates, and distrust any status claim, this file's
included. React is the default hostname and Vue a secondary one **in Compose; the Helm chart
under `deploy/` ships React only** (pinned both ways by `test_dual_frontend_production_ingress.py`). Neither is
cutover evidence: DNS/TLS, outer proxy and real IdP stay environment-owned. Vue owns its
framework-specific stream/artifact-panel, agent-chat, channels, integrations and
thread-history tests; shared specs stay framework-neutral, so a React change reaches a
Vue-owned surface only through an explicit idiomatic Vue implementation and test update.

## What is DeerFlow

DeerFlow is a LangGraph-based AI super-agent system with a full-stack architecture. The
backend runs a "super agent" with sandboxed execution, persistent memory, subagent
delegation, and extensible tools (built-in, MCP, community), all per-thread isolated. The
frontend is a Next.js chat UI. External IM platforms (Feishu, Slack, Telegram, Discord,
DingTalk) bridge into the same agent through the Gateway.

## Service Topology

A single `make dev` / Docker stack runs four cooperating services:

| Service         | Port   | Role                                                                 |
| --------------- | ------ | ------------------------------------------------------------------- |
| **Nginx**       | `2026` | Unified reverse-proxy entry point — open this in the browser        |
| **Gateway API** | `8001` | FastAPI REST API + embedded LangGraph-compatible agent runtime      |
| **React frontend** | `3000` | Default Next.js web interface                                    |
| **Vue frontend**   | `3000` | Nuxt on the Vue hostname; `make dev-vue` runs it on `3100` outside Docker |
| **Provisioner** | `8002` | Optional — only when sandbox is configured for provisioner/K8s mode |

The provisioner sits behind the `provisioner` Compose profile, so a bare `docker compose up`
does not start it (without a cluster it crash-loops); `scripts/docker.sh` and
`scripts/deploy.sh` enable the profile themselves.
`backend/tests/test_compose_optional_services_are_profiled.py` pins both halves.

Nginx is the single public entry: it serves the frontend and proxies `/api/langgraph/*`
to the Gateway's LangGraph runtime, rewriting it to Gateway's native `/api/*` routes; all
other `/api/*` go straight to the Gateway REST routers. See
[backend/AGENTS.md](backend/AGENTS.md) for the runtime and router detail.
It compresses HTML and configured textual assets, while deliberately leaving SSE,
fonts, images, audio, and video uncompressed at the proxy layer.

Both compose files publish that entry as `"${BIND_HOST:-127.0.0.1}:${PORT:-2026}:2026"`
— **loopback by default**, matching the README's documented deployment model. A bare
`"${PORT}:2026"` binds `0.0.0.0`, which does not.
The root `PORT` value is Docker ingress configuration only; local orchestration pins
Next.js to `3000` so loading `.env` cannot make `make dev` wait on the wrong port.
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
├── config.example.yaml             # Template for the tracked config.yaml at repo root
├── extensions_config.example.json  # Template for the tracked extensions_config.json: MCP servers + skills
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
├── examples/deerflow-extension-example/ # Standalone package demonstrating all extension contribution kinds
├── scripts/                        # Root orchestration scripts invoked by the Makefile (check, configure, doctor, support_bundle, serve, nginx, docker, deploy, setup_wizard)
├── tests/                          # Root-level tests (currently tests/skills/ — public skill tests)
├── deploy/                         # Helm chart for the Kubernetes deployment
├── .github/                        # CI workflows and issue/PR templates
└── docs/                           # Cross-cutting docs, plans, and design notes
```

**Every tracked top-level directory has to appear above or in this line**, because
this section claims to map the whole repo — `backend/tests/test_agents_md_repository_map.py`
pins both halves. The ones deliberately left off the map: `.agent/` (agent working
files, not part of the build) and two strays from past PRs that nothing references —
`plans/` (one design note whose home is `docs/plans/`) and `pr-build/` (before/after
screenshots from #1986). `backend/extensions/sources/` (deployable snapshots of locally
installed Python extensions) is created at runtime and is not tracked, so it is named
here rather than in the tree.

Third-party extensions are loaded from a top-level `plugins:` list in `config.yaml`
(operator-controlled on purpose — that list causes code to be imported, so it is deliberately
kept out of the API-writable `extensions_config.json`). Packaged extensions contribute
middleware, task lifecycle, system-model observers, Gateway services and FastAPI routers;
the [reference extension](examples/deerflow-extension-example/) demonstrates all five.
Manage them with `deerflow extensions install/list/enable/disable/remove` or the root
`make extension-install` wrapper and its siblings. Every mutation needs a Gateway restart, and both build hooks
and extension code run with Gateway privileges, so only trusted operator sources belong
here. Manager transaction, source forms, lock discipline and the contribution contract:
[the extensions guide](backend/packages/harness/deerflow/extensions/AGENTS.md).

Runtime config lives at the **repo root**. `.env`, `config.yaml` and
`extensions_config.json` are **intentionally tracked here** — preserve that policy rather
than "fixing" it into a gitignore. Setup copies from `config.example.yaml` /
`extensions_config.example.json` only when a real file is missing, and Gateway may edit
runtime-owned sections in place. Schema and resolution order:
[backend/AGENTS.md](backend/AGENTS.md).

`skills/public/skill-reviewer/` is the built-in read-only skill quality reviewer
(harness `review_skill_package` + `contracts/skill_review/`). CI waivers are
documented with the script that enforces them:
[scripts/AGENTS.md](scripts/AGENTS.md). Ownership boundaries, SkillScan and the
non-activation rule: [backend/AGENTS.md](backend/AGENTS.md).

Scheduled tasks add `/workspace/scheduled-tasks` plus a scheduler service gated by
`config.yaml -> scheduler.enabled`; they dispatch through the normal run lifecycle and
are non-interactive by construction. Queue states, leases, overlap policy and
`scheduler.recursion_limit`: [backend/AGENTS.md](backend/AGENTS.md).

## Commands: Root vs. Module

**Root `make` targets drive the whole stack** (run from the repo root):

```bash
make setup       # Interactive setup wizard (recommended for new users)
make doctor      # Check configuration and system requirements
make support-bundle  # Generate redacted troubleshooting summary, AI issue draft, and optional zip
make config      # Generate local config files from the examples
make check       # Check that required tools are installed
make install     # Install all dependencies (frontend + backend + pre-commit hooks)
make extension-install SOURCE=...  # plus extension-list/enable/disable/remove (restart required)
make dev         # Start all services with hot-reload (Gateway + Frontend + Nginx)
make dev-vue     # Start Gateway + Vue on 3100
make dev-dual    # Start Gateway + both frontends directly
make dual-frontend-production-check  # Check React-default/Vue-secondary ingress
make start       # Start all services in production mode (local, optimized); SKIP_FRONTEND_BUILD=1 reuses the last frontend build
make stop        # Stop all running services
make up / down   # Build/stop the production Docker stack (browser at localhost:2026)
make docker-start / docker-stop / docker-logs   # Docker development environment
```

Production startup runs `uv run --no-sync` against the image's pre-built environment and
makes `make up` wait on the Gateway's real `/health` probe before printing success; a
readiness failure must surface Compose status and Gateway logs, not claim the stack is up.

Docker log and restart commands resolve `DEER_FLOW_ROOT` from the current
checkout before invoking Compose, matching the start and stop commands.

Production `make up` explicitly reconciles both frontend containers after rebuilding.

Run `make help` for the full list.

**Per-module commands drive a single module** (run inside that module):

```bash
# Backend (see backend/AGENTS.md for the full set)
cd backend && make dev        # Gateway API with reload (port 8001)
cd backend && make test       # Default backend suite; excludes live and blocking-I/O tests
cd backend && make test-blocking-io  # Strict blocking-I/O suite
cd backend && make lint       # ruff check
cd backend && make format     # ruff format

# Frontend (see frontend/AGENTS.md for the full set)
cd frontend && pnpm dev       # Dev server: Webpack by default (override with DEER_FLOW_DEV_BUNDLER=turbo)
cd frontend && pnpm check     # Lint + type check (run before committing)
cd frontend && pnpm test      # Unit tests

# Vue frontend (see frontend-vue/README.md for all gates)
cd frontend-vue && make verify
cd frontend-vue && make e2e-mock
cd frontend-vue && make e2e-backend
```

Rule of thumb: **root `make` = the full application**; per-module Makefiles/package
commands own backend, React, or Vue work.

Host-side pnpm consumers — the root/frontend Makefiles and local diagnostic scripts — must
run through `scripts/pnpm.py`, where `--dir frontend|frontend-vue` selects the workspace. It
resolves absolute paths before changing the child's working directory (so it is independent
of the caller's), prefers direct `pnpm`/`pnpm.cmd`, and otherwise runs Corepack **from the
selected workspace** so that project's pinned package manager is honored.

### Prerequisites before `make dev`

`make dev` does **not** generate config files. First-time setup order:

```bash
make config      # fill in config.yaml / extensions_config.json from the examples if missing
make install     # install frontend + backend deps and pre-commit hooks
make dev         # then start everything
```

Without `config.yaml` present, services fail to boot. `config.yaml` / `extensions_config.json`
may be edited at runtime via the Gateway API and are **tracked here**, so a runtime edit is
a real working-tree change — review it before committing.

### Run a single test

```bash
# Backend (pytest); run one file or one test function
cd backend && python -m pytest tests/test_compose_default_bind_host.py -q
cd backend && python -m pytest tests/path/to/test.py::test_func -q

# Frontend (rstest)
cd frontend && pnpm rstest run <pattern>     # e.g. pnpm rstest run my-component
```

### Logs

- Docker stack: `make docker-logs` (or `docker compose -f docker/... logs -f <svc>`).
- Local `make dev`: each service logs to its own terminal pane. Frontend dev-server
  errors surface in the browser console at `localhost:3000`; backend tracebacks appear
  in the Gateway terminal.

## Where to Go Next

- Backend work → **[backend/AGENTS.md](backend/AGENTS.md)**
- Frontend work → **[frontend/AGENTS.md](frontend/AGENTS.md)**
- Vue frontend → **[frontend-vue/README.md](frontend-vue/README.md)**, **[frontend-vue/ARCHITECTURE.md](frontend-vue/ARCHITECTURE.md)**
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
- **Skill text encoding** — treat `SKILL.md` and other textual skill resources as UTF-8;
  Python utilities that read or write them must pass `encoding="utf-8"` rather than
  relying on the platform locale.
- **Version sources must stay in lockstep** — a release version must match identically in
  `backend/pyproject.toml`, `frontend/package.json`, and `deploy/helm/deer-flow/Chart.yaml`
  (`version` + `appVersion`). Pushing a `v*` git tag triggers CI that runs
  `scripts/verify_versions.sh` and **blocks all publishing** if any source drifts. Before
  bumping a version, run `scripts/bump_version.sh <ver>` (aligns all four at once) and
  `scripts/verify_versions.sh <ver>` to catch drift early. See [RELEASING.md](RELEASING.md).
- **Don't edit `CLAUDE.md`** — it only contains `@AGENTS.md`. All agent guidance changes
  belong here in `AGENTS.md`; `CLAUDE.md` is a thin import shim.
