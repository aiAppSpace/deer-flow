# DeerFlow Vue frontend

English | [简体中文](README_zh.md)

`frontend-vue` is the coexisting Nuxt 4 implementation of the DeerFlow web
application. It uses the same Gateway surface as `../frontend` and has
implementations for the chat workspace, artifacts, sidecar, browser control,
agents, channels, integrations, scheduled tasks, settings, goal/mode,
authentication, Showcase, mobile layouts and the production container.

**Completion is not stated here.** How far any capability actually goes is
readable only from the code, its tests and the gates. A "done" written into
prose goes stale before the code does, and the next reader takes it as fact.

React remains the default production hostname; Vue is selected only by
`DEER_FLOW_VUE_HOSTNAME`. Local parity evidence does not authorize a default
cutover. Public DNS, TLS, outer-proxy trust, real IdP callback registration and
target-environment acceptance must still be completed before changing production
traffic.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): current layers, runtime flow, state
  ownership, proxy and authentication boundaries.
- [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md): product, streaming, ordering,
  cache, panel and Vue semantics that changes must preserve.
- [REUSE.md](REUSE.md): private `@deerflow/agent-core` and reusable UI seams.
- [Production dual-frontend guide](../docs/dual-frontend-production.md): hostname,
  OIDC, validation and rollback.
- [I18N_INVENTORY.md](I18N_INVENTORY.md): live product-SFC copy inventory,
  translation/dynamic-content classification and source-guard boundaries.

## Run with Docker

From the repository root, start the single Docker development stack:

```bash
make docker-start
```

Vue is available at `http://vue.localhost:2026`; React remains at
`http://localhost:2026`. Both frontends run their framework development servers
inside containers. Compose Watch syncs source changes for HMR and rebuilds the
affected image when dependency manifests change. The command remains in the
foreground; use `Ctrl+C` to stop it.

The Vue landing page's **Enter workspace** action routes through `/workspace`,
so the existing authentication, setup and new-chat routing remains the single
owner of workspace admission.

## Run locally

From the repository root:

```bash
make dev-vue   # Gateway :8001 + Vue :3100
make dev-dual  # Gateway :8001 + React :3000 + Vue :3100
make stop
```

For the Vue workspace only:

```bash
cd frontend-vue
make install
make dev       # http://localhost:3100
```

`make -C frontend-vue dev` is equivalent when the shell should remain at the
repository root.

## Verify changes

Start with the smallest relevant gate and finish with `make verify` for normal
module changes:

```bash
make verify             # lint, format, types, unit, i18n, OpenAPI, contracts, standalone, build
make asset-budget       # build-output ceiling across every chunk (not what users download)
make e2e-mock           # every suite that needs no backend process
make e2e-backend        # every suite that needs a real Gateway
make e2e-visual         # product screenshots; local-only, the baselines are `-darwin`
make e2e-list           # collect every suite and print its test count
make consumer-check     # changes to packages/agent-core
make container-smoke    # production image, health, SIGTERM and rejection policy
make coverage           # unit-test line coverage — a diagnostic, deliberately not a gate
```

`make audit` is **expected to fail today**, and the triage is recorded next to the
target in the `Makefile`: three of the four highs are unreachable (`js-yaml` never
reaches a client chunk, `nanoid`'s advisory needs a custom generator we do not pass,
`lodash-es` arrives through mermaid's parser and the advisory is about `_.template`).
The fourth — mermaid's radar-diagram DoS — is **deliberately not patched here**:
this app pins `mermaid` to the exact version React resolves through
`@streamdown/mermaid`, because mermaid output is compared between the two apps
(`thread-history-mermaid` is a ledger scenario). Bumping one side alone splits the
ledger; bumping both means overriding a vendored library's dependency tree. That
upgrade belongs upstream.

`make coverage` is **not** part of `verify` and has no threshold. Two reasons:
a coverage floor buys filler tests, and the number only sees code executed inside
the unit-test process — `app/layouts/`, `server/routes/` and `app.vue` are covered
by the E2E suites and read as 0% here. Use it to find _which_ module nobody tests,
not as a pass mark. Current reading: 73% statements, 75% lines, with
`app/components/` (66%) the largest gap.

One suite is one backend topology, and the name says what it tests. Pick the
narrowest one while iterating:

```bash
make e2e                # product contracts on a mocked Gateway
make e2e-auth           # auth UI contracts, frontend built with auth on
make e2e-infra          # same-origin proxy and __m0 test pages
make e2e-proxy-options  # proxy with streaming forwarding disabled
make e2e-stream         # real chunked SSE: heartbeat, resume cursor, gap
make e2e-protocol       # run-protocol state machine on a real Gateway
make e2e-real           # render, multi-run order, artifact write
make e2e-scheduled      # scheduled tasks against real Gateway/SQLite
make e2e-channels       # channel connection lifecycle, auth on
make e2e-agents         # custom agent creation and settings, auth on
make e2e-settings       # settings with a supported and a degraded Gateway
make e2e-shell          # workspace shell and workspace-changes, auth on
make e2e-browser        # browser panel against a real Chromium backend
make e2e-external       # WebSocket and OIDC; needs the backend browser extra
make e2e-parity         # React and Vue on one replay Gateway; needs ../frontend
make e2e-parity-auth    # the same two apps built with auth ON: the login screen
```

`make e2e-mock` aggregates `e2e`, `e2e-auth`, `e2e-infra`, `e2e-proxy-options`
and `e2e-stream`; `make e2e-backend` aggregates `e2e-protocol`, `e2e-real`,
`e2e-scheduled`, `e2e-channels`, `e2e-agents`, `e2e-settings`, `e2e-shell` and
`e2e-browser`. `make e2e-parity-auth` exists because auth is a **build-time** decision -- one
preview can only be one mode. With auth disabled, which is how the main parity
suite builds both apps, `/login` redirects straight to `/workspace/chats/new` in
**both** of them, so that suite can never reach the first screen a user sees.
It ships its own baseline (`baseline/parity-auth-diff.json`) because the two
suites run different builds, and shares the _criterion_ with the main one
(`tests/e2e-parity/support/diff-entry.ts`) because two rulers that disagree are
worse than none. Its scenarios must use `backend: "gateway"`: the workspace mock
answers `GET /api/v1/auth/me` with a signed-in user, which makes the Vue login
page bounce to the workspace while React stays put -- two different screens, and
a diff of them is noise, not a finding.

**One e2e run at a time.** Every suite goes through
`scripts/keep-e2e-failure-artifacts.mjs`, which takes an exclusive lock at
`test-results/.e2e-run.lock` and **refuses to start** (exit 2) while another run
holds it. Two concurrent runs corrupt each other in both directions: the one
that starts later clears `test-results/<suite>/` out from under the earlier
one's in-flight trace, and the one that finishes earlier `renameSync`s the
failure dirs into `failures/` out from under the later one -- both surface as
`ENOENT` plus a 180s timeout, which reads exactly like a regression. Suites that
share the Gateway also seed the same thread twice. A lock left behind by a
crashed run is detected as stale (its PID is gone) and taken over. Override with
`E2E_ALLOW_CONCURRENT=1` only when you know the two runs cannot touch each
other.

`make e2e-parity` is in neither either, for a different reason:
it is the only suite that needs the sibling React app, and this workspace's
install, build, test and e2e must all work without it (`make standalone-check`
proves it statically, `make standalone-sim` proves it by actually doing it).
When `../frontend` is absent it does not start React and its cases skip.

`make icon-parity` compares the two apps' icons, icon sizes and button
variants -- three things that never enter the accessibility tree, so no
screenshot or ARIA gate can reach them. It exits 0 with a note when
`../frontend` is absent, because nothing in this workspace may depend on the
sibling; when the sibling **is** there it can fail, on a stale exemption or a
broken shape assert. That is why it is a gate and not a report. It needs
`lucide-react`'s type declarations to resolve icon aliases, so it runs in the
one job that installs both apps' `node_modules` -- `frontend-vue-parity.yml`.

**What CI actually runs.** `frontend-vue-verify.yml` runs `verify`,
`asset-budget`, `standalone-sim`, `audit`, `container-smoke`, `e2e-mock`,
`e2e-backend` and `e2e-visual`'s siblings. `frontend-vue-parity.yml` runs
`icon-parity`, `e2e-parity` and `e2e-parity-auth`.

`standalone-sim` **used to be local-only**, and the reason given here was that it
renames the sibling app out of the checkout. That reason never made it unsafe in
CI -- the job is sequential and the script puts the sibling back before it exits
-- and being outside every automatic entry point is exactly what let
`invented-palette-colors.test.ts` read the sibling app at _collection_ time from
the day it was written and stay red for twenty rounds, invisible on every
developer machine because `../frontend` is always present there. It has run in
the `verify` job since 2026-09-16.

`icon-parity`, `e2e-parity` and `e2e-parity-auth` **used to be local-only**, and
the reason given here was a cost that had never actually been priced: "local-only
by default, not by design, which means the ledger that this whole effort is
measured by is never checked by a machine that isn't this laptop". They have run
in `frontend-vue-parity.yml` since 2026-09-17. The cost was then measured rather
than guessed, so it is spent under a path filter (`frontend-vue/**`,
`frontend/**`, the replay Gateway's inputs) instead of on every push -- a
React-only change **is** in that filter, because upstream drift moving the ledger
is the entire thing being measured.

That workflow sets `PARITY_REQUIRE_REACT=1`, and that is not decoration: every
parity spec opens with `test.skip(!reactAppPresent)`, which on a runner without
`../frontend` would skip all 156 cases and exit 0 -- a green that measured
nothing, the same shape as `e2e-visual` staying red across three commits and
`invented-palette-colors` reading the sibling app at collection time for twenty
rounds. The flag turns that skip into a throw at config load. Both halves are
pinned by `tests/guards/tooling-contracts.test.ts`, which scans **every** file in
`.github/workflows/` rather than a named one -- a guard that reads only the
workflow it was written for is indistinguishable from no guard the moment a
second workflow appears.

One gate still runs **only locally**: `make e2e-visual`, and its local-only
status is machine-coupled to its cause
(`tests/guards/visual-baseline-platforms.test.ts`).

`make e2e-visual` is deliberately in neither: its screenshot
baselines exist only for `-darwin`, so it stays a local gate until `-linux`
baselines are generated and checked in. Those two facts are coupled by
`tests/guards/visual-baseline-platforms.test.ts` — checking in `-linux`
baselines without wiring the gate into CI fails, and so does the reverse. The
procedure, and why the baselines must not be produced locally through amd64
emulation, is in that file's header.

Targeted checks:

```bash
make parity-accept      # re-record baseline/parity-diff.json after a parity change
make parity-auth-accept # same, for baseline/parity-auth-diff.json
make proxy-security     # Nitro body limits, bodyless/chunked DELETE, SSE and traversal
make i18n-source-check  # AST guard for every product Vue SFC
make icon-parity        # icon/size/variant parity vs ../frontend; skips without it
make standalone-check   # no cross-app reference to ../frontend (static)
make standalone-sim     # move ../frontend away, run what claims to cope, move it back
make typecheck-core     # standalone tsc for packages/agent-core
make upstream-drift     # report what ../frontend changed since the reviewed marker
```

The two standalone gates also measure different things. `make standalone-check`
is a static scan: it proves no file references `../frontend` from code.
`make standalone-sim` renames the sibling app out of the checkout, runs every
entry the exemption table claims can cope without it, and moves it back — it is
deliberately out of `make verify` because it touches the filesystem and must not
run next to a build. The distinction is not academic: the static count had been
zero for dozens of changes while `make verify` was in fact red without the
sibling, because a `describe.skipIf` factory still runs at collection time.

Two size gates measure different things and are easy to confuse.
`make asset-budget` sums **all** emitted chunks and guards against total build
output running away. What a user actually downloads is guarded by
`tests/e2e/route-payload.spec.ts` inside `make e2e`: it measures the scripts a
real navigation requests, and forbids shiki, mermaid and KaTeX from entering
the critical path. Both commands print their current measurements — **they are
not copied here**, because a number in prose goes stale before the code does.
They can move in opposite directions: deferring KaTeX cut 269 KB from the
workspace payload while total build output grew by 1 KiB. For performance
work, read the second one.

Test counts are deliberately not written down here — `make e2e-list` prints the
live number for every suite, and a number copied into prose is the first thing
to go stale. Every `make` command, relative link and repository path named in
this workspace's documentation is checked by
`tests/guards/doc-references.test.ts`, which also fails when a suite exists in
the Makefile but not in this list. Run `make help` for the full target list. Suite names describe what
a suite tests, not a migration stage, and a green local gate does not
communicate the completion state of the replacement gaps.

## Runtime configuration

The browser defaults to same-origin requests. Nuxt proxies them to
`DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` (default `http://127.0.0.1:8001`). Optional
public base URLs bypass the corresponding same-origin proxy:

```bash
NUXT_PUBLIC_LANGGRAPH_BASE_URL=http://localhost:8001/api
NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001/api
```

`DEER_FLOW_AUTH_DISABLED=1` is for isolated contract-test environments. Real
authentication must be exercised through the same-origin Nuxt/Gateway path.
`NUXT_PUBLIC_M0_TEST_PAGES=1` exposes internal visual fixtures only for tests;
the variable name is retained for compatibility with existing test configs.

Production routing, OIDC callback rules and rollback commands are maintained in
the [dual-frontend production guide](../docs/dual-frontend-production.md).

## Browser control

The panel starts in Live mode, keeps the last visible frame when switched to
Static, and uses the Gateway REST navigation endpoint when Live transport is
unavailable. URL and title are accepted only from Gateway WebSocket events or
REST responses. Closing the panel, changing threads, or disabling the feature
stops reconnect timers, sockets, and pending REST work. Detailed ownership and
hard input/cleanup rules live in [ARCHITECTURE.md](ARCHITECTURE.md) and
[BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md).

## Artifacts

Artifact capabilities are selected by an explicit path/source policy. Known
UTF-8 text and code can be loaded; images, audio, video and PDF use dedicated
previews; Office files, archives, SVG, extensionless files and unknown binaries
fail closed to download-only. MIME metadata never promotes an unknown filename
to editable text. Formal HTML is previewed only after the complete document has
loaded and passed the document-integrity check.

Only fully loaded formal UTF-8 files under `/mnt/user-data/outputs` can enter
edit mode. Saves carry the loaded SHA-256 revision, and Gateway conflicts or
permission errors preserve the local draft. Dirty drafts protect file, panel,
thread and route changes as well as page unload. Open and download first perform
an authenticated one-byte Range probe; skill installation is available only for
real skill artifacts when the current user has admin permission.

## Scheduled tasks

The workspace page lives at `/workspace/scheduled-tasks`.
The workspace scheduled-task page supports the Gateway's actual `once` and
`cron` types, hourly/daily/weekly/monthly/custom cron input, editable IANA
timezones, DST-aware one-time conversion, fresh or reused thread context, and
the built-in recipes. Editing preserves the immutable schedule type; pause,
resume, trigger and confirmed delete use their dedicated Gateway endpoints.
Filters include both schedule types and all six task statuses. Run history is
loaded with explicit `limit/offset` pagination and shows all Gateway run states,
times, thread/run IDs and errors.

`make e2e-scheduled` starts a real local FastAPI Gateway backed by
SQLite, the Nuxt preview server and Playwright Chromium. It covers real
once/cron create and validation, context/thread permissions, PATCH,
pause/resume, trigger, paged run records and delete. The model side uses a
checked-in replay fixture, and authentication is test-isolated; this is not
evidence for a production scheduler/model, wall-clock advancement, DNS/TLS,
outer proxy trust or a real IdP.

## Channels

Channel providers describe server capability and runtime configuration; they do
not own a user's connection status. The authenticated user's
`/api/channels/connections` response is the sole status and account-instance
truth, including multiple accounts for one provider. Connect consumes the
Gateway URL, instruction and finite expiry window, opens deep links through a
synchronously prepared browser window, and polls only the scoped connections
query until a new account connects, expires or is cancelled. Query, mutation,
poll and AbortController cleanup all belong to `useChannelConnections`.

Settings expose two intentionally different destructive actions: a user can
disconnect one exact connection ID, while an administrator can remove the
provider runtime configuration, which revokes that provider's active
connections instance-wide. `make e2e-channels` proves the real
FastAPI/Auth/CSRF/SQLite routes and Vue convergence with a controlled external
channel worker/callback fixture. It does not prove real Slack, Telegram,
Discord, Feishu or other platform authorization, production credentials,
deep-link handlers, DNS/TLS, outer proxies or a real IdP.

## Agents

Agent creation keeps the bootstrap conversation on the new-agent page while
using its prepared real thread as the visible stream scope. Save sends one
hidden human instruction, then correlates an `AIMessage.tool_calls` entry named
`setup_agent` with the matching `ToolMessage.tool_call_id`. Only an explicit
`status: "success"` starts a finite visibility check; tool errors, run errors
and exhausted 404 retries remain visible and retryable. Duplicate clicks share
the same in-flight owner, and route/scope disposal aborts both the run and the
bounded `GET /api/agents/{name}` verification. Save remains disabled until the
initial design conversation succeeds and its send owner has fully released.

`useAgents` and `useModels` are the only server-state owners for the gallery
and model catalog. Settings select from the real model response and send the
exact `model`, `model_settings`, `thinking_enabled` and `reasoning_effort`
contract, including explicit `false`, numeric zero and `null` clearing when a
new model lacks a capability. Cards preserve the response order and duplicates
for skills and tool groups; `tool_groups: null` is shown as an unrestricted
configured-group filter, while `[]` is shown as no configured groups.

`make e2e-agents` exercises real FastAPI Auth/CSRF/features/models,
the thread/run router, LangGraph, `setup_agent`, SQLite Agent persistence,
user isolation and Vue convergence. Only the external LLM is replaced with a
deterministic model. The gate is not evidence for a production model/provider,
model credentials, production IdP, DNS/TLS, outer proxies or deployment.

## Memory and administrator settings

Memory is user-scoped server state owned by `useMemory`. The page supports
search and confidence filtering, exact `0`–`1` confidence editing, export, and
confirmed create/edit/delete/clear operations without keeping a component-local
copy of the Gateway response. Imports require the complete export structure and
a preview confirmation. Malformed data, storage-invalid facts and duplicate fact
IDs are rejected before any request; unknown fields and duplicate content under
different IDs are retained for preview with explicit warnings. The Gateway may
ignore forward-compatible unknown fields when it validates the request model.

Skills remain readable by an authenticated ordinary user, but only an
administrator can enable or disable them. MCP configuration is administrator-
only for both reads and writes, so the Vue page sends no MCP request when the
session already proves the user is not an administrator. Auth-disabled contract
environments use the Gateway's administrator semantics instead of inventing a
separate static role. Each mutation sends only the documented wire fields and
then re-reads its shared TanStack Query cache; permission failures remain
distinct from authentication and transport failures.

`make e2e-settings` exercises real local Auth/CSRF, FastAPI routers,
user-isolated DeerMem storage, a separate real Noop manager, skill
discovery/config writes, MCP atomic config writes and secret masking through
Nuxt and Playwright Chromium. It pins malformed 422, validation 400, missing
404, duplicate and revision-conflict 409, corrupted-storage 500 and unsupported
operation 501 responses. The fixture only seeds operator-owned skill/MCP input
files and exposes the run's isolated temporary home long enough to corrupt and
restore its own manifest. It does not prove Mem0/Honcho/OpenViking, a real
external MCP process, production SkillScan/LLM/IdP/credentials, DNS/TLS, an
outer proxy or deployment.

## Workspace shell and workspace changes

Memory, Skills & MCP retain Query owners and auth boundaries; `make e2e-settings`
covers the production path. The workspace layout owns one palette, settings host and
toaster; the route owns settings-open state, and Query owns workspace changes and
propagates aborts. `make e2e-shell` keeps production Auth, owner checks, event reads,
filtering and Nuxt; only its isolated seed event and recovery 503 are controlled
fixtures.

The workspace layout owns one command palette, settings host and toast store.
The palette implements the current cross-platform React shortcut set while
excluding repeat, IME and editable-target conflicts. Settings are route-owned:
`?settings=<section>` opens a focus-trapped dialog, close removes only that
query key, and browser back/forward restores the same deep link and focus
boundary. Gateway unavailable and authenticated recovery share the single auth
session Query owner, including the case where route middleware populated the
unavailable state before the banner mounted.

Each recent-thread menu independently owns rename, pin, share, export and
delete state. Share is the existing client-only stable URL/clipboard contract;
it does not invent a Gateway endpoint. Export loads the current thread state
before calling the existing serializer and always releases its temporary
anchor and object URL. Thread recency renders from the Gateway `updated_at`
timestamp.

Workspace-change summary and detail are separate TanStack Query identities that
include thread, run and both include flags. Switching identity aborts the old
request and late responses cannot replace the active result. The UI preserves
summary truncation, all four statuses, all five exact diff-unavailable reasons,
lossless Gateway errors and explicit retry.

`make e2e-shell` runs a real local Auth/CSRF/FastAPI Gateway,
thread/checkpoint and run-event stores, production owner checks and the
workspace-changes response builder through Nuxt and Chromium. Its isolated
test-only seed writes one controlled workspace event into the Gateway's own
event store; include filtering, status/reason preservation, authentication,
cross-user denial, thread state, clipboard and download remain production
paths. The single injected 503 exists only to prove unavailable-to-real-session
recovery. This gate is not evidence for a production IdP, DNS/TLS, outer proxy
or deployment.

## Streaming behavior

Chat run creation explicitly subscribes to `values`, `messages-tuple`, `updates`
and `custom`. `messages-tuple` carries incremental model text and tool-call
chunks; omitting it leaves the connection as SSE but makes answers update only
when complete state snapshots arrive. Vue coalesces dense chunks into render
updates at most 80 ms apart to keep Markdown and message grouping responsive.
While the viewport remains at the bottom, message-content resizes keep the
active answer in view. Scrolling upward releases that follow behavior until the
user returns to the bottom, matching the React frontend.

Task lifecycle and `llm_retry` custom events are folded into thread-scoped UI
state. Subtask cards expose status, model, cumulative token usage and live
steps; expanding a card backfills persisted steps after reload. Long
conversations initially request only the newest history page, with explicit or
upward-scroll loading for older pages. `/compact` is a real Gateway command for
established conversations and keeps the draft intact when the Gateway rejects
the request.

Messages, reasoning and processing text share one product Markdown adapter, so
GFM weather tables and streaming partials cannot diverge by call site. Table
copy/download/fullscreen controls and the visible message actions follow the
current React call sites; Vue does not expose a feedback action until React does.
