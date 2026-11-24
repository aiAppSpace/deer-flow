# DeerFlow Vue frontend

English | [简体中文](README_zh.md)

Reference suggestions follow the caret when editing existing text, including
keyboard and mouse navigation into an unfinished `@` query.

New project conversations are created with their project in one Gateway request
before the first message, goal or document attachment. The returned membership
is authoritative; unavailable projects keep the draft for retry.

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

The desktop workspace uses the local `ui/resizable` primitive with native pointer
capture. Its caller owns panel presentation and persistence; owner changes,
disabling, cancellation and unmounting retire the active gesture. The legacy
`/__m0/splitpanes` fixture URL remains for the original four-pane infrastructure
test, now backed by this primitive. See the panel contracts below for behavior.
Escape closes an artifact editor's search panel while keeping the desktop
artifact panel open and returning focus to the editor. Individual panel content,
such as message details, retains its own close action.

Direct links to archived conversations retain their title and Restore chat action.
The active conversation owns header metadata and exported content; filtered sidebar
results do not supply these values. Agent header and composer controls preserve the
React layout in desktop, narrow and enlarged-text views.
Conversation exports omit injected project instructions and document indexes,
including attributed context tags, while preserving literal examples inside
fenced or indented code. Message rendering preserves those same code boundaries.

Message duration, answer text and workspace change cards retain the same spacing
as React when text is enlarged. A new reply keeps earlier completed change cards
available; only the active reply's card waits for completion. Main and side-chat
message tails retain their own presentation spacing.

Knowledge scope appears between the composer's mode and reasoning-effort controls.
Project instruction saves expose a distinct Saved status, and document and trash
lists show their loaded and total counts consistently in both frontends.

Markdown tables offer format-specific copy and download actions in both inline and
fullscreen views. Fullscreen tables use the complete viewport on desktop and mobile.
Citation copy feedback belongs to each source and ends when that source leaves;
side-chat empty content remains scrollable when enlarged text exceeds its space.

Public Showcase renders its complete saved snapshot, including goal status and tool
artifact badges. Switching examples clears the previous snapshot while the new one
loads; an unavailable public example never borrows private workspace state.

Project view preferences use the same stored field as React; existing Vue values
are retained and migrated on the next settings save. Subtask titles and API failure
messages follow the current shared behavior. Complete text artifacts retain real
SHA-256 revisions on HTTP LAN addresses without WebCrypto or ETag, including files
with a UTF-8 BOM; truncated previews remain read-only.

Closing and reopening a rename, project creation or channel configuration dialog keeps
its new draft independent of an earlier pending request. Leaving a login or setup page
retires its pending navigation; deleting a conversation does not redirect a newer route.

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
make dev-dual  # Gateway :8001 + React :3200 + Vue :3100
make stop
```

These Vue/dual modes check their actual runtime tools and do not require host Nginx.
The repository's default React development and general dependency checks still require host Nginx.

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
make verify             # lint, format, types, unit, i18n, generated types, contracts, extension docs, static independence, build
make asset-budget       # build-output ceiling across every chunk (not what users download)
make e2e-mock           # every suite that needs no backend process
make e2e-backend        # every suite that needs a real Gateway
make e2e-cross-app      # mandatory product, anonymous auth and real session comparison
make e2e-visual         # product screenshots; Darwin locally, native Linux in mandatory CI
make e2e-list           # collect every suite and print its test count
make consumer-check     # changes to packages/agent-core
make container-smoke    # production image, health, SIGTERM and rejection policy
make coverage           # unit-test line coverage — a diagnostic, deliberately not a gate
```

The unit suite checks that a still-owned MutationObserver continues receiving
DOM updates after garbage collection. It runs this dependency lifecycle check
in an isolated Node process with `--expose-gc`; it uses the installed Happy DOM
public API and leaves application observers and test timing unchanged.

Parity capture keeps literal request data unless an explicit endpoint slot and
independent identity source authorize a reference. Slot recognition alone does
not prove ownership. The comparison entry creates each context/Page through
`tests/e2e-parity/support/capture-page.ts`; its one-use construction proof guards
the entire setup window. Existing pages can still produce raw evidence, but
cannot claim fresh-page provenance. This proves fresh construction; the existing document census must also pass
before restricting document origin. Neither proves request owner or overall
parity acceptance.

Response Content-Location remains its original exposed header value in comparison
facts. Resolving it as a URL would merge relative/absolute forms, dot segments and
fragments before ownership is established; absence, empty values and malformed
references remain distinct too.

The identity registry admits the selected main/agent draft and its exact
uploads-limits consumers using producer, scope and lease evidence. A declared
same-raw adoption keeps the allocation and owner while checking the canonical
persisted route. Ordinary single first-send admission separately checks the
allocation, send instance, independent source/send actions, tail-message slot,
assistant/agent intent, request candidate domain, timing and key branch. Its pure
projection is bound to that same network snapshot and app origin; only approved
path/body leaves become tagged identity nodes. A default key may reference that
same human in that request; explicit same-value keys stay literal and an absent
React key remains absent. Display URLs, bodies and full
request facts share one projection, so multiplicity and header/body/response
pairing remain visible. A registry or binding error preserves literal facts and
adds observation errors, with atomic literal rollback. Initial-query and ordinary
first-send native tests exercise these bounded increments. They do not prove
arbitrary concurrent, retired or retried HTTP ownership. The aggregate capture
remains literal until Memory, replay, the remaining submission branches and the
complete ownership matrix are implemented and verified.

The bounded Memory admission checks one independently stable account and one
published file receipt, including complete generated/literal fact slots,
selection history and every import dispatch/request. Preview, cancellation and
rejected files have explicit zero-consumption expectations. Same-source retries
retain request multiplicity and failed responses; timing prefixes only reject
impossible orderings and never assign a causal request ID. Cross-kind source
claims share one collision check. Only generated `facts[index].id` leaves are
projected, with all replacements applied together; existing literal IDs remain
literal. Pre-aborted, multiple-source, account-changing or generally ambiguous
HTTP domains remain unresolved until their stronger evidence is implemented.

Ordinary send observation records the selected human ID, exact appended message
position and the effective submission-key branch on one local observer. Vue reads
the caller's key once at its original position after onSend; default, explicit
same-value and explicit empty keys stay distinct. The event records a runner-call
attempt, not HTTP or backend admission, and preserves the initiating action.
Observation does not change request headers, UUID allocation or retry behavior.

Product cross-app checks use Playwright's full Chromium channel so native
iframe and notification focus restoration follow the complete browser. Install
it with the existing Chromium setup; an explicit `E2E_PARITY_BROWSER_CHANNEL=chrome`
selects installed stable Chrome for diagnostics. Every declared scenario and the
existing assertions and budgets remain in the normal aggregate.

The product parity suite owns a disposable Chromium profile with native translation
prompts disabled. Modern Chromium removed the `Translate` feature flag; otherwise
a host-language translation bubble can take focus outside the webpage during Tab
traversal. All specs import `tests/e2e-parity/support/test.ts`. Each test and manual
`browser.newContext()` still gets isolated cookies and storage; the persistent
context only owns the process. The profile is removed after process shutdown,
including failures. Page languages, iframe sandboxing and native-key budgets stay
unchanged. The browser-environment regressions verify both languages/directions
and context isolation.

Reference suggestions keep keyboard highlight stable while their content scrolls
beneath a stationary pointer; moving a mouse or pen changes the hover target.
Dialog radio groups retain the selected option when Tab wraps at the boundary.
Dialog/Sheet boundaries follow their actual mounted content on first open and
reopen. Keyboard focus inside a model popover remains visible through its owning
chat viewport; closing a promotion dialog or crossing an Alt+T notification
visit's Tab boundary returns to its invoking control and reveals it through native
scrolling. Ordinary notification traversal follows native Tab order. Skill headings and
actions, project actions and mobile artifact content retain their complete
geometry under narrow, short and enlarged-text layouts.

Selecting a skill closes its menu while the detail panel opens. The exiting menu
cannot reopen merely because the panel layout moves it under a stationary pointer;
a new trigger interaction can open it again. Scheduled task ID copy reports
success only after the browser has actually written to the clipboard.

The cross-app suite includes native low-height scrolling regressions for long
artifacts, complete settings controls and focusable project tab panels. These
run with the existing full reachability and resize checks.

Artifact Source/Edit uses native CodeMirror modules loaded after mounting. Its
basicLight/monokai appearance follows the current React artifact consumer,
including complete syntax tags, `--text-sm` text, native horizontal scrolling
for long lines, and the same content/line/host spacing. Native search, Tab
indentation, completion, paired brackets, multiple selections and undo remain
available. Line numbers, fold gutter and active-line markers follow React's
current disabled settings; no diagnostics provider is added. Vue owns the
framework lifecycle and latest-language-request admission, while theme,
language and readonly updates preserve the same view and history. The DOM
contracts live in `tests/unit/ui/code-editor*.dom.test.ts`; the cross-app
`tests/e2e-parity/code-editor.spec.ts` compares public Source/Edit against React
in all seven language modes and both themes. These test entries describe the
contract, and do not claim the current acceptance run has passed.

Messages reveal long streaming updates progressively and flush immediately on
completion, replacement or reduced motion. Streaming code uses the same plain
fence and inline-code presentation as React, then hands off to the existing
rich renderer. Wide display equations scroll horizontally within their own
container. Truncated artifact source previews retain native scrolling and the
same text scale as React; loading the full file remains an explicit action.
The message adapter owns pacing and retirement, while the generic Markdown
renderer and the existing artifact/editor owners keep their responsibilities.

`make audit` matches every advisory against `baseline/audit-triage.json`.
An unknown advisory, changed installed version/path/severity or stale entry fails.
The current accepted entries document specific unreachable development/build
calls with no published compatible fix; they do not exempt a package wholesale.
React and Vue use the same patched Mermaid and KaTeX versions. The current
findings and source evidence are recorded in
[the dependency audit](../docs/reports/2026-10-09-vue-dependency-audit.md).

Mermaid diagrams export as SVG, PNG or their original MMD source. SVG/PNG exports
preserve HTML line breaks, entities and Unicode labels, with the same 5x PNG scale
as React. Changing the diagram source or leaving its owner cancels pending downloads.

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
make e2e-parity-session # real SQL sessions, owner-scoped preferences, CSRF and live RBAC
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

`make e2e-cross-app` runs `e2e-parity`, `e2e-parity-auth`, then
`e2e-parity-session` sequentially for the complete local comparison. CI runs
the same product files in isolated whole-file groups, followed by an aggregate
that also requires the anonymous auth and real session job.
The session suite uses Vue `3119`, React `3120` and an isolated Gateway `8023`,
with authentication enabled in both apps. It registers and logs in real SQL
users, verifies cookie/CSRF/expected-owner boundaries, changes roles through the
real admin API, and tests mounted send/stop/delete controls and Gateway denial.
Its fresh store keeps the anonymous suite's first-boot setup precondition intact.

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

Cross-app suites belong to `make e2e-cross-app`; portable mock/backend gates
run without the sibling React app. `make standalone-check` checks references
and `make standalone-sim` tests an isolated source copy without React. The copy
can collect cross-app suites, but their dual-app execution is explicitly UNRUN;
formal cross-app entries fail immediately when React is missing.

`make icon-parity` compares the two apps' icons, icon sizes and button
variants -- three things that never enter the accessibility tree, so no
screenshot or ARIA gate can reach them. It exits 0 with a note when
`../frontend` is absent, because nothing in this workspace may depend on the
sibling; when the sibling **is** there it can fail, on a stale exemption or a
broken shape assert. That is why it is a gate and not a report. It needs
`lucide-react`'s type declarations to resolve icon aliases, so it runs in the
one job that installs both apps' `node_modules` -- `frontend-vue-parity.yml`.

CI push and pull-request filters cover every path in the upstream drift review,
including all backend app, package and test sources plus the example configuration.
A workflow definition describes its configured gates; local results do not prove a
remote CI run occurred.

**What CI actually runs.** `frontend-vue-verify.yml` configures `verify`,
`asset-budget`, `standalone-sim`, `audit`, `container-smoke`, `e2e-mock`,
`e2e-backend`, `e2e-external` and `e2e-visual`.
`frontend-vue-parity.yml` alone owns the formal cross-app comparison: its product
matrix runs `make e2e-parity-ci GROUP=<id>` for every planner group, and its auth job runs
`e2e-parity-auth` then `e2e-parity-session`. It also runs `icon-parity`.
The `parity` aggregate requires successful planning, every product group and both
auth suites; failure, cancellation or skipping cannot satisfy it. A filtered
manual dispatch lives in `frontend-vue-parity-diagnostic.yml`, with a separate
concurrency group and no formal aggregate check. It cannot cancel or replace a
formal run. The formal workflow's manual dispatch always runs the complete gate.
Both push and pull-request filters preserve the full upstream review scope.

The former duplicate `cross-app-parity` job in the verify workflow is removed.
Repository branch-protection or ruleset requirements are environment-owned;
this source change does not prove a remote required-check migration or CI run.

Whole-file groups keep stateful macros intact and retain the original single
worker, replay Gateway, assertions and timeouts. Each CI job owns its checkout
and Gateway. New spec files enter the interactions group automatically; missing
named files or invalid groups fail before a browser starts. The matrix jobs
have a 180-minute wall-clock budget; the complete local `make e2e-cross-app`
remains serial and unfiltered. The two forms cover the same product files.
All formal group entries reject filtered/acceptance modes and require React at
config load through `PARITY_REQUIRE_REACT=1`. Each group uploads its ledger and
failure evidence under a unique artifact name, even when another group fails.

The product-visual job runs on native Ubuntu ARM64 with a pinned Playwright
image and checked-in `-linux` screenshots. Local Darwin snapshots remain
separate. `tests/guards/visual-baseline-platforms.test.ts` couples Linux baseline
coverage to the mandatory job. Baseline generation is a separate explicit
workflow action; a normal visual run never updates screenshots.

Targeted checks:

```bash
make parity-accept      # re-record baseline/parity-diff.json after a parity change
make parity-auth-accept # same, for baseline/parity-auth-diff.json
make proxy-security     # Nitro body limits, bodyless/chunked DELETE, SSE and traversal
make i18n-source-check  # AST guard for every product Vue SFC
make icon-parity        # icon/size/variant parity vs ../frontend; skips without it
make standalone-check   # no cross-app reference to ../frontend (static)
make standalone-sim     # install, build and test an isolated source copy without React
make typecheck-core     # standalone tsc for packages/agent-core
make upstream-drift     # report what ../frontend changed since the reviewed marker
```

The two standalone gates also measure different things. `make standalone-check`
is a static scan: it proves no file references `../frontend` from code.
`make standalone-sim` creates a separate source copy with no sibling React
application, installs its frozen dependencies, and runs the declared independent
entries. It preserves the original checkout, private runtime state and build
outputs. The default mode explicitly skips E2E. Running the original script
with `--with-e2e` additionally collects the cross-app configurations and runs
the complete `e2e-mock` and `e2e-backend` aggregates. Cross-app execution remains
explicitly UNRUN because React is absent. Standalone simulation runs separately
from `make verify` because it performs another install and build.
Failed command logs, the unit report and browser artifacts are copied back to
`.cache/standalone-failures/run-*` before the isolated copy is removed.

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

Size limits are reviewed against measured route payloads and the emitted module
graph. Keep the bundler's default optimizations and clear feature boundaries;
do not add forced chunks just to satisfy a named bucket. A dependency update may
justify a documented, bounded rebase with headroom. Preserve the checks for lazy
renderers, selected locale and zero initial speculative downloads, and rerun the
complete route suite on both supported verification platforms.

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

## Workspace panels

Artifacts, sidecar, browser and message details share one responsive layout.
Desktop opening and closing animate the outer pane while its content keeps the
final width. Closing revokes interaction immediately and retains only the exit
presentation for 280ms; reopening cancels that exit. Thread, account or Agent
changes synchronously retire the outgoing presentation and detail state, even
when an account or thread changes A→B→A within one Vue update. Presentation
reuses the submission owner's retirement identity; adopting its prepared UUID
keeps the same owner. Business sessions,
read-only permissions and dirty drafts remain with their existing owners.
Narrow screens use the shared Sheet focus boundary without remounting the main
conversation. Mounted lifecycle tests cover owner/exit admission; native
cross-app tests measure actual widths, scroll trajectories and transitions.

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

Scheduled host notes, goal-check classifications, message origin, lifecycle
vocabulary and UI error codes are generated from the root backend contracts.
Run `make gen-contract-constants` after changing a consumed contract;
`make gen-contract-constants-check` detects stale output, and type checking
requires complete localized mappings for new codes. Unknown future errors
retain their raw details and existing fallback behavior.

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
Notifications follow native Tab order without restoring an earlier control on
ordinary exit. An Alt+T visit returns to its invoking control at a Tab boundary.
Escape collapses the list without moving focus; removing the viewport while it still owns focus also restores its
connected entry. Notifications pause their remaining lifetime during interaction
or while the document is hidden.
Button-open references remain open while tabbing; clicking outside closes them.
Completed project document attachments retain their removable chip and empty input.
The palette implements the current cross-platform React shortcut set while
excluding repeat, IME and editable-target conflicts. Settings are route-owned:
`?settings=<section>` opens a focus-trapped dialog, close removes only that
query key, and browser back/forward restores the same deep link and focus
boundary. Gateway unavailable and authenticated recovery share the single auth
session Query owner, including the case where route middleware populated the
unavailable state before the banner mounted.
On narrow screens, settings and model forms scroll as a whole so enlarged text
cannot trap controls inside an undersized content pane. Artifact previews also
retain a whole-panel scroll path in narrow containers so enlarged links remain
reachable without changing their text or the saved file.

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
Short initial histories use the same spring parameters and frame-time progression as
the React conversation. Asynchronous first content starts one owned motion; it does
not become an instant append. Long virtualized histories and Sidecar initial/resize
positioning remain instant. The prepared submission identity survives its own URL
adoption; another conversation, account or agent retires the old scroll owner.

While the viewport remains at the bottom, message-content resizes keep the
active answer in view. Scrolling upward releases that follow behavior until the
user returns to the bottom, matching the React frontend.
This also covers browser focus or scroll-into-view movement without a wheel or
key event. Content or viewport resizing and the list's own navigation preserve
their existing positioning behavior.

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
Literal `<think>` tags inside Markdown code remain code in rendered answers,
copy and exports. Actual reasoning is separated from answer text; answers with
reasoning retain their normal bubble while streaming, and clarification
continuations retain already completed answers.
Completed answers remain copyable while a later run is waiting or streaming.
The current answer becomes copyable when its own run settles; main chat and
sidecar use the same run-owned message identity, including reconnect and reload.

Workspace queries refresh stale Agent, Memory, feature and capability data when the
browser tab becomes visible, matching React. Skills retain a five-minute freshness
window. Session visibility probes keep their existing sixty-second throttle;
models, thread history and other explicit query policies retain their own rules.

工具步骤中的产物登记与当前React一致：通用工具显示文件/集合图标、名称与句柄，
悬停显示实际引用；主聊天与侧聊共用各自的流式状态，不额外请求或复制缓存。
产物预览保持有界读取；“加载全文”后服务端仍只返回部分内容时，不提供编辑保存。

### 测试依赖源码修复

Happy DOM 21.0.4 的动画 Promise 与 CSSOM 类型修复由 `patches/happy-dom@21.0.4.patch`
和 pnpm 锁文件共同固定；普通安装即可应用，Docker 与独立工程也携带该输入。
修复范围、公开 API 回归和上游替换条件见 [架构文档](ARCHITECTURE.md#验证入口)。

### Deleting the current conversation

Successful deletion returns the main or Agent chat to a fresh, usable composer.
The confirmation closes before handing focus to that conversation's input. A
newer route, account, new-chat command or focused control retires the handoff.
Deleting a background conversation preserves the active draft; failure keeps
Cancel focused for retry. Explicit current deletion discards the deleted
conversation's text, attachments and references even while its URL is still
`/new`; ordinary draft restoration and prepared-ID adoption remain unchanged.

### Modal focus after asynchronous actions

The maintained Reka dependency patch restores an active modal's focus when a
focused action becomes disabled, the browser leaves focus on the document body,
and a subsequent content update removes a child. Valid input focus, nested scopes,
closed dialogs and caller-canceled autofocus retain their owners. Focus history
is retired when the scope becomes hidden, so canceling autofocus on reopen cannot
reuse ownership from an earlier opening. The dependency
patch covers package source and both runtime module formats; install it through
the normal frozen pnpm lockfile. The ownership contract is documented in
[`ARCHITECTURE.md`](ARCHITECTURE.md), and
`tests/e2e-parity/disabled-control-focus.spec.ts` exercises installation, failed
installation, skill download and icon preview using the existing scenario drivers.

### Navigation announcements

Client navigation announces the first committed arriving page name once when it differs
from the actual leaving page name. Initial loading and later data-title updates stay
silent. The live region remains inside its shadow root so modal background hiding
continues to apply. Page names use the document title, then the first heading, then
the pathname.

The first accepted run can replace its own prepared draft URL without creating a new
page announcement. This one-time continuation preserves the real title and existing
live-region text. Normal navigation, redirects, attachment navigation and later history
visits retain the regular announcement contract. Once the router has committed another
page or project query, a late callback from the still-displayed old page may update
its thread cache but cannot replace the current URL.

### Composer capability discovery

Conversation-reference capability discovery follows the mounted composer, including
read-only Showcase and pending polish/compact operations. Editing locks continue to
block the picker, attachments and sends. Account retirement and final observer disposal
still cancel stale discovery; a failed refresh cannot authorize reference sends from
cached permissions. Unlocking the editor does not itself trigger another capability read.

Memory source observation is opt-in: the selected pending preview and original
normalized document share a local weak receipt. The actual mutation/API passes
that document to a synchronous notification immediately before native fetch,
after authenticated-fetch preparation. Vue resolves its reactive wrapper with
`toRaw` only inside the opt-in callback. `memory.dispatch` records selected,
retired, unselected or unowned status and the sampled cancellation flag; it does
not claim HTTP/backend admission. No diagnostic headers, second body reader,
extra normalization or UUID allocation are introduced. API/preflight failures
and cancelled previews do not fabricate dispatch. Memory source receipts still
need typed registry admission before aggregate identity projection is complete.
Replay source observation preserves the own `source_message_ids` representation
as `sourcesType`: absent, array, null, invalid or unreadable. An empty array is
distinct from absence; own undefined is invalid. The observer reads one descriptor
without invoking an accessor and retains the real response/attempt phases.
Mounted tests cover public message selection with observation off/on: Vue adopts
the response list or its nullish fallback, while React regenerate retains the
caller's list. The observation never changes those product branches. This finite
source record is not replay request admission or whole-plan browser acceptance.

The pure replay attempt source reader validates the complete replay event domain
against independently declared old-turn roles. It preserves source presence,
phase order, one human input, replacement relations and a separate generated key.
Retirement/failure after an attempt stays visible; a current finish is not success.
This bounded reader returns candidates only: document/account/thread lifetime,
complete prepare/run request ownership, collision claims and projection remain
separate obligations. It is not wired into aggregate identity projection.

Ordinary sends use the shared complete prepare/run request inventory. The inventory
recognizes local endpoint paths before checking the observed method, retaining
wrong-method, malformed, failed and worker candidates for validation. Independent
thread/operation declarations must give each candidate exactly one consumer;
unknown or same-thread mixed operations remain unresolved. Body/key equality or
response order never picks a consumer. This partition is not replay admission.

Replay HTTP candidates currently require one independently declared stable account,
one selected persisted literal thread and a single prepare/run pair. The complete
source vector, selected lifetime, prepare body/status, run identity references,
assistant/context and key must agree. The earliest response receipt bounds prepare
start; SDK callback finish does not bound HTTP start. Failed/open run requests
remain facts. A separate replay admission registers the response replacement and
Vue's independently allocated key in the shared collision domain, including unused
definitions. Old human/assistant/run/checkpoint/group references stay literal;
a group fallback to the source human requires an explicit independent declaration.
Only the run's input human ID, metadata edit ID and generated key header receive
exact identity decisions. The prepare/run pair remains checked even for React
regenerate with no generated slots. Any inconsistent decision rolls all three
comparison views back to literal values. Additional old source-message kinds,
new run/Content-Location, general concurrency and active-SSE proof remain open;
this bounded support is not whole-plan or aggregate capture acceptance.

The pure run-source reader consumes already admitted ordinary/replay submissions
and their exact public Request rows. A successful response location must name the
same thread; its original authority, encoded segments and trailing slash remain
separate source fields without URL reconstruction. Run IDs need not be UUIDs.
An open or later-failed SSE does not erase headers already received. This reader
creates no identity claim, response projection or join/cancel/cursor permission.
It has no response-available timestamp or client-handle adoption proof; even a
matching later request remains outside this source-only result. Public headers()
may combine lines, so visible multi-value rejection is not proof of unique raw
header lines. Same-origin absolute source parsing does not prove Vue adopted it.

An independent run declaration now admits the create response into shared claims
and one fixed Content-Location comparison decision. The generated run definition
has an explicit response marker; old run references remain literal and cannot gain
an identity by changing a boolean. All visible successful create definitions
participate in collision checks, even when no run slot selects them. The response
decision states thread identity permission explicitly and coexists with the same
submit's body/header decisions. Projection rechecks source membership and the raw
location, copies response/headers, and preserves authority/trailing-slash spelling,
status and later stream failure. Missing or inconsistent entities/decisions revert
the complete batch to literal views. Join/cancel/inspect/cursors remain literal;
this source and response proof does not establish handle adoption or active SSE
consumer causality, and aggregate/whole-plan acceptance remains open.

Run 接管观察使用默认关闭的真实 input/handle 对象关联。`tests/unit/parity/run-observation.dom.test.ts` 与 `tests/unit/agent-deerflow/run-observation.dom.test.ts` 验证来源、退休和真实协议/session/runner；React 有真实 RunsClient 对应测试。新增事件本身不构成消费者准入，独立 reader 和实际 active SSE off/on 仍需单独验收。

`IdentityExpectations.runObservation` 独立声明 SDK/adapter 接管检查。registry 在一次构建内使用完整已验证事件域，按原 submission observer 校验 run 的 bind/call/received/delivered 和退休边界；有 phase 却缺声明、缺 run source 或有多余/未归属 phase 时整体拒绝，三视图不部分转换。这个结果只证明已观察的 callback/runner delivery，不授权 join/cancel/cursor，也不等于流已结束。
