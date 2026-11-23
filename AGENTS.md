# AGENTS.md

This is the source of truth for repository agent guidance; `CLAUDE.md` imports it via `@AGENTS.md`.

## Cross-platform project onboarding

Start with **[docs/ai/README.md](docs/ai/README.md)** for the reading order,
project relationships, evidence rules and platform-independent execution guidance.
**[docs/ai/CURRENT_TASK.md](docs/ai/CURRENT_TASK.md)** points to the current handoff
and records the boundary between the original checkout and the isolated candidate.
Reading these files does not resume a paused task. Historical plans and tool-specific
notes do not override the user's latest instructions or current source evidence.
Keep long task status in the handoff, not duplicated in this file. When authorized
to commit, commit on the branch where the changes were made; do not create a branch
solely to make a commit. Do not infer permission to commit or push from a review request.

This **monorepo orientation layer** maps the repo. For module details, read its guide:

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

DeerFlow pairs a LangGraph super agent with a Next.js chat UI. The backend provides
sandboxed execution, persistent memory, subagents, and extensible built-in, MCP,
and community tools, isolated per thread. Feishu, Slack, Telegram, Discord, and
DingTalk connect through the Gateway.

## Service Topology

A single `make dev` / Docker stack runs four cooperating services:

| Service         | Port   | Role                                                                 |
| --------------- | ------ | ------------------------------------------------------------------- |
| **Nginx**       | `2026` | Unified reverse-proxy entry point — open this in the browser        |
| **Gateway API** | `8001` | FastAPI REST API + embedded LangGraph-compatible agent runtime      |
| **React frontend** | `3000` | Next.js in Docker; local `make dev` / `make dev-dual` use `3200`    |
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
— **loopback by default**, matching the README's documented deployment model; a bare
`"${PORT}:2026"` binds `0.0.0.0`, which does not. The root `PORT` value is Docker ingress
configuration only; local orchestration pins Next.js to `3200` so loading `.env` cannot
make `make dev` wait on the wrong port. Nginx listening `default_server` on IPv4+IPv6 and
the Gateway binding `0.0.0.0:8001` are container-internal on purpose: the published nginx
port is the entire external surface. Any new published port needs an explicit bind
address; `backend/tests/test_compose_default_bind_host.py` pins this for every service in
both compose files.

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
├── examples/                       # Extension examples: deerflow-extension-{example,bookmarks,agent-teams}
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

Third-party extensions are loaded from operator-controlled `config.yaml -> plugins:`.
This imports code, so the list stays outside API-writable `extensions_config.json`.
Extensions contribute middleware, lifecycle observers, Gateway services, FastAPI
routers, and experimental full-stack plugins. Use
`deerflow extensions install/upgrade/list/enable/disable/remove` or root
the extension targets listed below. Restart Gateway after every mutation. Build hooks
and extension code run with Gateway privileges; use only trusted operator sources.
Transactions, accepted source forms, locking, and contribution contracts:
[extensions guide](backend/packages/harness/deerflow/extensions/AGENTS.md).
User manual: `frontend/src/content/{en,zh}/harness/extensions/`.

**Extension-first evaluation** — before implementing a feature by editing core code,
evaluate whether it can ship as a packaged extension through the contribution points
above. Stay in core for bug fixes and for changes to the agent loop, memory, context
compaction, or authentication. If existing hooks cannot express the feature, add a
generic hook to the extension contract plus an extension that uses it — do not
hard-code business logic into core. Working examples:
`examples/deerflow-extension-{example,bookmarks,agent-teams}`.

Runtime config lives at the **repo root**. `.env`, `config.yaml` and
`extensions_config.json` are **intentionally tracked here** — preserve that policy rather
than "fixing" it into a gitignore. Setup copies from `config.example.yaml` /
`extensions_config.example.json` only when a real file is missing, and Gateway may edit
runtime-owned sections in place. Schema and resolution order:
[backend/AGENTS.md](backend/AGENTS.md).

Skill quality review note:
- `skills/public/skill-reviewer/` is the built-in read-only reviewer (harness tool
  `review_skill_package`, contracts in `contracts/skill_review/`). Model-visible review
  data is tag-neutralized; raw payloads stay in tool artifacts. See
  [backend/AGENTS.md](backend/AGENTS.md) for the ownership boundaries.
- CI waivers live in `.github/skill-review-waivers.v1.json`, enforced by
  `scripts/review_changed_public_skills.py`. Only the manifest from the trusted base
  revision can suppress a run, and blocker findings can never be waived.

Scheduled-task note:
- `scheduler.tool_enabled` (default off) offers owner-bound schedule tools only
  through Gateway capability admission. Interactive turns create/manage their
  schedules; scheduled turns can request stopping only their own schedule.
  Per-occurrence goal success does not end a recurring schedule.
- The scheduled-task MVP adds a workspace page at `/workspace/scheduled-tasks` plus a
  background scheduler gated by `config.yaml -> scheduler.enabled`.
- Scheduled runs are non-interactive: `ask_clarification` is excluded. `non_interactive`,
  `disable_clarification`, and `github_token` are honored only for internally-authenticated
  callers; client-supplied copies are dropped.
- Busy occurrences persist as `queued`; `scheduler.queue_timeout_seconds` bounds the wait.
  Do not reintroduce skip-on-overlap.

## Commands: Root vs. Module

**Root `make` targets drive the whole stack** (run from the repo root):

```bash
make setup       # Interactive setup wizard (recommended for new users)
make doctor      # Check configuration and system requirements
make support-bundle  # Generate redacted troubleshooting summary, AI issue draft, and optional zip
make config      # Generate local config files from the examples
make check       # Check that required tools are installed
make install     # Install all dependencies (frontend + backend + pre-commit hooks)
make extension-install SOURCE=...  # Install and enable a trusted Python extension
make extension-upgrade SOURCE=...  # Replace an installed extension and keep its config
make extension-list                # List configured Python extensions
make extension-enable NAME=...     # Enable an installed extension (restart required)
make extension-disable NAME=...    # Disable without uninstalling (restart required)
make extension-remove NAME=...     # Remove package and config entry (restart required)
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

The Docker build context excludes generated `.cache` directories at every depth,
including frontend failure archives and extension-package caches. The exclusion
follows extension source reinclusions so runtime artifacts cannot enter an image.

Run `make help` for the full list.

**Per-module commands drive a single module** (run inside that module):

```bash
# Backend (see backend/AGENTS.md for the full set)
cd backend && make dev        # Gateway API with reload (port 8001)
cd backend && make test       # Four parallel shards; excludes live and blocking-I/O tests
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

`make dev-vue` and `make dev-dual` pass their explicit frontend mode to
`scripts/check.py`; they expose direct frontend ports and do not require host Nginx.
The default React startup and general `make check` retain the Nginx prerequisite.

Host-side pnpm consumers — the root/frontend Makefiles and local diagnostic scripts — must
run through `scripts/pnpm.py`, where `--dir frontend|frontend-vue` selects the workspace. It
resolves absolute paths before changing the child's working directory (so it is independent
of the caller's), prefers direct `pnpm`/`pnpm.cmd`, and otherwise runs Corepack **from the
selected workspace** so that project's pinned package manager is honored.
Native Windows resolves pnpm.cmd/corepack.cmd first; POSIX resolves pnpm/corepack first.

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
- Local `make dev`: Gateway and frontend output goes to
  `logs/gateway.log` and `logs/frontend.log` in the repository root.
  Run `tail -f logs/gateway.log logs/frontend.log` there to follow both.

## Where to Go Next

- Backend work → **[backend/AGENTS.md](backend/AGENTS.md)**
- Frontend work → **[frontend/AGENTS.md](frontend/AGENTS.md)**
- Vue frontend → **[frontend-vue/README.md](frontend-vue/README.md)**, **[frontend-vue/ARCHITECTURE.md](frontend-vue/ARCHITECTURE.md)**
- Setup & install → **[Install.md](Install.md)**, **[CONTRIBUTING.md](CONTRIBUTING.md)**
- Project overview & usage → **[README.md](README.md)** (translations: `README_zh.md`,
  `README_ja.md`, `README_fr.md`, `README_ru.md`, `README_pt.md`)
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
  (`version` + `appVersion`), and `backend/uv.lock` must record the same version for the root
  package (uv stores its PEP 440 form, e.g. `2.1.0rc0`). Pushing a `v*` git tag triggers CI
  that runs `scripts/verify_versions.sh` and **blocks all publishing** if any source drifts.
  Before bumping a version, run `scripts/bump_version.sh <ver>` (aligns the four fields and
  refreshes `backend/uv.lock` at once — it needs `uv` on `PATH`) and
  `scripts/verify_versions.sh <ver>` to catch drift early. See [RELEASING.md](RELEASING.md).
- **Don't edit `CLAUDE.md`** — it only contains `@AGENTS.md`. All agent guidance changes
  belong here in `AGENTS.md`; `CLAUDE.md` is a thin import shim.
