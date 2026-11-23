# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, and others) when working with the DeerFlow frontend. It is the source of truth; the sibling `CLAUDE.md` imports it via `@AGENTS.md`.

## Project Overview

DeerFlow Frontend is a Next.js 16 web interface for an AI agent system. It communicates with a LangGraph-based backend to provide thread-based AI conversations with streaming responses, artifacts, and a skills/tools system.

**Stack**: Next.js 16, React 19, TypeScript 5.8, Tailwind CSS 4, pnpm 10.26.2. Requires Node.js 22+ and pnpm 10.26.2+.

### Core dependencies

- **LangGraph SDK** (`@langchain/langgraph-sdk` ^1.5.3) — Agent orchestration and streaming
- **LangChain Core** (`@langchain/core` ^1.3.0) — Fundamental AI building blocks
- **TanStack Query** (`@tanstack/react-query` ^5.90.17) — Server state management
- **UI**: Shadcn UI, MagicUI, React Bits, and Vercel AI SDK elements (generated from registries — see Code Style)

`package.json`'s `pnpm.overrides` overrides vulnerable `@xmldom/xmldom` 0.9.x releases to
0.9.12 for GHSA-965w-775f-mr7g. Nextra pulls it in through MathJax and
`speech-rule-engine@4.1.2`, which pins 0.9.8. Keep the override until the
upstream dependency chain resolves a patched version without it; regenerate
`pnpm-lock.yaml` and verify the docs build when changing this constraint.

The same override map pins `@codemirror/language` to 6.12.4, matching the
Vue editor's resolved version. This includes upstream initial bracket matching
and composition fixes absent in 6.12.1. Keep `@lezer/common` 1.5.3 and
`@lezer/highlight` 1.2.5 unified across grammars and themes: parallel highlight
instances create different tag/NodeProp identities and silently lose syntax
coloring. The mounted initial-JSON and actual CSS-highlight regressions plus
the cross-app code-editor suite cover these behaviors; do not hide matching
bracket decorations from the rendering comparison.

Nextra Theme Docs 4.6.1 has a pnpm-locked backport of upstream PR #4990:
validate complete Layout props before separating children from theme config.
Keep its schema strict and Zod at the security-fixed version. The production
browser regression `tests/e2e/docs-layout.spec.ts` covers both languages, nested
MDX, navigation and reload. Remove the patch when an official release includes
the equivalent fix and those checks pass; never edit installed dependencies.

The public Streamdown `components.table` adapter in `core/streamdown/table-renderer.tsx`
owns inline/fullscreen table containers and Radix modal lifetime. Keep the exported
Streamdown copy/download controls and serializers; do not patch private DOM after render.
Both actual tables keep their `table-wrapper` ancestry, so exported actions read the
selected table. Caller component overrides and public control settings retain priority.
Table and Mermaid renderers share control glyphs through `control-icon.tsx`.
Mounted table tests and the shared native table action/presentation suites cover focus,
Escape, downloads, clipboard payloads, independent tables and viewport geometry.

Citation copy continuations belong to the mounted source button. Departure clears its
feedback timer and retires late success/denial notifications without cancelling a browser
clipboard write already in progress. Keep live feedback and repeat-copy deadlines intact.

Streamdown 2.5.0 has a pnpm-locked backport of upstream commit 89c6877 (PR #584).
Markup memoization compares rendered props rather than source positions; code
fences also compare their metadata. Equal-length replacements must update text,
links, list starts and table cells while retaining their DOM and open dialogs.
Unchanged earlier blocks still remain memoized. Install the patch through pnpm;
keep Docker dependency inputs, Compose watches and CI patch paths covered.
`rendered-props.dom.test.tsx` and the shared `markdown-update.spec.ts` exercise
the installed renderer. Remove the backport once an official release includes
the equivalent fix and full mounted/native/streaming regressions pass.

Send and replay share an operation-owned submission guard. Retired callbacks must
not clear a newer turn. Replay preparation belongs to the committed displayed
thread/agent; preserve ordinary send's native adoption and Promise error contract.

Opt-in parity observation keeps ordinary human allocation and its submission
attempt on the same local observer. Emit only after uploads, callbacks and actual
submit-argument construction, preserving the initiating action across async work.
This proves a call attempt, not HTTP or backend admission; React's absent ordinary
idempotency key must remain absent. Default-off observation does not generate IDs.

Run context must not contain `thread_id`, including values restored from settings
or supplied through extra context. The request URL and Gateway own that identity.
Keep references and other permitted run options intact when removing it.

The project document attach dialog enables its thread query only while a document
is selected. Closing retains the query cache but does not refetch it on invalidation;
reopening resumes the existing stale-query and pagination behavior.

Composer persistence debounces the effective draft content and owner, not
React effect or capability-object identity. Same-content renders retain the
300 ms deadline; owner departure/pagehide flush it and accepted sends retire it.
The mounted draft-deadline tests exercise real query completion and storage.

Current-thread deletion hands focus from the closing Dialog to the new composer
through the existing thread-chat reset command. Only the matching main page
claims that completion; its current InputBox ref checks the new UUID, account
and editable state. Keep the account revision and newer-focus checks. Native
history adoption retains the prepared UUID and editor; deletion changes the UUID
and the existing ChatBox MessageDetailsProvider key replaces its subtree before
the welcome effect updates autoFocus. Native adoption preserves Next's route tree;
`useThreadChat` resolves recognized main, agent and Showcase thread identities from
public `usePathname` before its first consumer render. Back may retain `new` in
`useParams`, so do not mint a draft from that stale parameter. Keep native adoption
and its active stream mounted; never rewrite Next's private history state.
Initial draft allocation and later route synchronization share one identity, even
when the public route renders before the browser URL commits. Showcase mode also
belongs to that public route; the old browser URL cannot make it editable.
Initialization and synchronization use the same decoded new-chat classification;
other routes ending in `new` must not create another conversation owner. Do not add remounts or focus on every
welcome-state change to compensate for that ordering.

Opt-in Memory import observation binds the original normalized document and pending
preview through local weak receipts. Settings passes the optional observer through
its real mutation/API to the authenticated fetcher's before-native-fetch boundary,
after static/CSRF/init preparation. This proves only a call attempt, not delivery.
Unknown, unselected and retired consumers remain visible; clones never acquire a
source by content equality. Default-off calls do no extra signal inspection. The
observer cannot change bytes, headers, cancellation, cache updates or product errors;
serialization/preflight/static early returns have no dispatch event. Tests include
real Settings→mutation→API→fetcher imports, failed retries and abandoned previews.

Memory file reads belong to the mounted settings page and its latest selection.
Check both before parsing or reporting a read failure; unmount retires pending
reads, and Strict Mode effect replay must keep new selections usable.

## Commands

| Command          | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | Start the development server on 3200 with Webpack |
| `pnpm build`     | Production build                                  |
| `pnpm check`     | Lint + type check (run before committing)         |
| `pnpm lint`      | ESLint only                                       |
| `pnpm lint:fix`  | ESLint with auto-fix                              |
| `pnpm format`    | Prettier check (`pnpm format:write` to apply)     |
| `pnpm test`      | Run unit tests with Rstest                        |
| `pnpm test:e2e`  | Run E2E tests with Playwright (Chromium)          |
| `pnpm typecheck` | TypeScript type check (`tsc --noEmit`)            |
| `pnpm start`     | Start production server                           |

Unit tests live under `tests/unit/` and mirror the `src/` layout (e.g., `tests/unit/core/api/stream-mode.test.ts` tests `src/core/api/stream-mode.ts`). Powered by Rstest; import source modules via the `@/` path alias.

Webpack is the default development bundler. Use `DEER_FLOW_DEV_BUNDLER=turbo` with `pnpm dev` to opt in to Turbopack when diagnosing a local Next.js bundler issue.

The dev/start launchers share `scripts/next-server.mjs`: local port `3200`, with
explicit CLI port or `PORT` taking precedence. Both Docker runtime stages set
`PORT=3000`; local orchestration and its Nginx upstream use `3200` explicitly.
Keep the service command, readiness, stop ownership and documentation consistent.

Host Playwright web servers and asset builds use `../scripts/pnpm.py --dir frontend`.
The asset measurement process directly owns the installed Next CLI child so its
normal/failure cleanup stops the actual listener. The manual recording config
uses `3212` (override `E2E_RECORD_FRONTEND_PORT`) consistently for startup and
readiness; it does not inherit the local development or container port.

On Windows `pnpm dev` binds `127.0.0.1` by default because Hyper-V/winnat excluded port ranges can reject Next's default `0.0.0.0` bind with `EACCES` (#2870). Pass `pnpm dev -- --hostname 0.0.0.0` to listen on a LAN interface instead.

Rstest runs them as two projects (`rstest.config.ts`). `*.test.ts` / `*.test.tsx` run in a plain **node** environment — that is nearly the whole suite, and it is the default for anything that is pure logic. `*.dom.test.ts` / `*.dom.test.tsx` run in **happy-dom**, for tests that need a document: hooks driven through `renderHook` from `@testing-library/react`, and components. Keep the split — a DOM environment costs roughly 3x the runtime of the node suite, so tests that do not render should not opt into it. A hook whose behavior only exists under real React (effect ordering, cleanup on unmount, re-render on store change) belongs in a `.dom.test.*` file rather than a node test that mocks `react` itself.

Both frontends pin Happy DOM 21.0.4 and apply the same pnpm source patch for
Animation.finished cancellation/replay and CSSStyleDeclaration's Web IDL brand.
`tests/unit/tooling/happy-dom-contracts.test.ts` runs the installed public API in
an ordinary Node child with fatal unhandled rejections. Keep normal animations
and error reporting enabled; do not restore getComputedStyle/markRaw shims.
React binds only `@rstest/core@0.10.6>happy-dom` to 21.0.4 until Rstest's peer
range includes the verified version. Remove that override and the source patch
when upstream equivalents pass the same contracts and full suites.
Vue additionally owns the deterministic MutationObserver garbage-collection
regression in `../frontend-vue/tests/unit/tooling/mutation-observer-lifetime.test.ts`.
These dependency checks do not replace native browser focus/overlay acceptance.

The two create aliases in `tests/e2e/utils/mock-api.ts` share the Gateway's
idempotent contract: honor requested UUIDs, validate active projects before the
first insert, strip server-reserved metadata and return existing rows unchanged.
Creation starts with no messages; `handleRunStream` records the messages it
actually emits, including custom stream handlers. The same history owner retains
seeded and previous turns, replaces matching explicit message IDs in place, and
emits the complete merged values. Default new responses receive fresh message
IDs; explicit caller IDs remain unchanged. Input-less runs do not invent human
messages. Prepared replay consumers supply a known checkpoint base bound to the
request checkpoint ID and an explicit response message identity; replay folds its
input onto that base, and REST message rows retain the emitted run attribution.
Ordinary sends continue from existing history. Seed prior history explicitly
in `threads`, rather than manufacturing it during create.

E2E tests live under `tests/e2e/` and use Playwright with Chromium. They mock all backend APIs via `page.route()` network interception and test real page interactions (navigation, chat input, streaming responses). Config: `playwright.config.ts`. The real-backend auth contract in `tests/e2e-real-backend/auth-disabled-contract.spec.ts` and `backend/tests/test_auth_me_permissions.py` pin the complete route-permission list; update both when adding registered permissions (including `projects:read/write/delete`).
E2E tests live under `tests/e2e/` and use Playwright with Chromium. They mock all backend APIs via `page.route()` network interception and test real page interactions (navigation, chat input, streaming responses). Config: `playwright.config.ts`. The default suite owns an isolated production server on port `3002` and never reuses an arbitrary existing listener; use `PLAYWRIGHT_SKIP_WEB_SERVER=1` only when intentionally supplying and validating an external server.

Scheduled tasks, conversation origins, models, plugins, composer references, Lark
authorization and artifact revisions have detailed [workspace behavior contracts](docs/workspace-behavior-contracts.md).
Read the relevant section before changing these surfaces; preserve their shared contracts
and mounted/browser regressions.

Before changing chat scrolling, overlays, or settings/project/artifact capacity,
read [responsive capacity contracts](docs/responsive-capacity-contracts.md).
Preserve their native scroll owners, complete controls and shared browser gates.

Sonner 2.0.7 has a pnpm-locked source repair under `patches/`: ordinary list blur
must not force focus back to an earlier control. `components/ui/sonner.tsx` owns
Alt+T visits separately from native Tab traversal. Install through pnpm; never
edit `node_modules`. Keep the repair in Docker dependency inputs, Compose rebuild
watches, Vue CI paths and cross-component drift review. On a Sonner upgrade,
review both package entrypoints and rerun mounted focus/keyboard tests plus the
shared production-browser traversals before retiring or replacing the repair.
A native blur with no next focus target must retire the recorded entry immediately;
unmount must not restore it later. The shared notification-lifecycle browser
regression mounts the real components to cover blur, dismissal and unmount.
Its isolated component boundary complements the full application traversals.

Radix Tooltip 1.2.8 also has a pnpm-locked repair under `patches/`: its global
open notification identifies the originating content, so a popup retained by
an exit animation cannot close itself when it reopens. Other instances and
legacy unidentified notifications still close it. Keep both CJS/ESM entrypoints
in sync, install through pnpm, and rerun mounted lifecycle tests plus the shared
production Tooltip presentation and keyboard suites when upgrading or retiring
the repair. Preserve the existing animation, hover, Escape and scroll behavior.
The paired DismissableLayer 1.1.11 repair adds an optional `enabled` lifetime
(default true), and Tooltip passes its real open state. Closed, animated content
keeps its DOM but leaves the dismissal stack; reopening registers it as active
again. Keep both runtime and declaration entrypoints synchronized. Mounted tests
also require a stable internal node ref: layer-stack updates must not detach a
still-mounted Dialog/Sheet host or replace its native iframe focus boundaries.
Compose the forwarded ref with React's stable state setter; preserve normal
cleanup on actual unmount. The same mounted tests
cover peer reentry, controlled/uncontrolled owners, modal Escape ordering and
body pointer restoration, force-mounted closed hints, and preventDefault on
Escape/outside pointer events. Do not substitute forced unmounts or timer delays
for that interaction lifetime.

## Architecture

Read [workspace behavior contracts](docs/workspace-behavior-contracts.md) before
changing delimited artifact previews or the Capability Center. Detailed contracts
remain there; this guide owns module commands, dependencies and conventions.

```
Frontend (Next.js) ──▶ LangGraph SDK ──▶ LangGraph Backend (lead_agent)
                                              ├── Sub-Agents
                                              └── Tools & Skills
```

The frontend is a stateful chat application. Users create **threads** (conversations), send messages, set thread-scoped `/goal` completion conditions, and receive streamed AI responses. The backend orchestrates agents that can produce **artifacts** (files/code), **todos**, and goal state updates.

### Source Layout (`src/`)

- **`app/`** — Next.js App Router. Routes include `/` (landing), `/showcase/[thread_id]` (allowlisted public read-only demos), `/workspace/chats/[thread_id]` (authenticated chat), `/workspace/agents/[agent_name]` and `/workspace/agents/new` (custom agents), `/artifacts/view` (chrome-free window that renders Markdown or CSV/TSV artifacts with the panel's own renderer), `/blog/…`, the `(auth)/{login,setup,auth/callback}` flow, `/[lang]/docs/…`, and `/api/…` route handlers (e.g. `/api/memory`).
- **`components/`** — React components:
  - `ui/` — Shadcn UI primitives (auto-generated, ESLint-ignored)
  - `ai-elements/` — Vercel AI SDK elements (auto-generated, ESLint-ignored)
  - `workspace/` — Chat page components (messages, artifacts, settings)
  - `landing/` — Landing page sections
  - `docs/` — Docs / MDX rendering components
- **`core/`** — Business logic, the heart of the app. Domains include `threads/` (creation, streaming, state), `api/` (LangGraph client singleton), `agents/` (custom agents), `subagents/` (runtime worker catalog and administrator mutations), `auth/` (authentication), `artifacts/`, `channels/` (IM connections), `integrations/` (managed third-party integration status/install clients such as Lark CLI), `i18n/` (en-US, zh-CN), `settings/`, `memory/`, `skills/`, `messages/`, `mcp/`, `models/`, `input-polish/` (pre-send draft rewrite API), `voice-input/` (browser speech-recognition helpers), `suggestions/`, `tasks/`, `todos/`, `tools/`, `workspace-changes/` (run-scoped changed-file summaries and diff fetching), `config/`, `notification/`, `blog/`, plus rendering helpers (`rehype/`, `streamdown/`) and `utils/`.
- **`hooks/`** — Shared React hooks
- **`lib/`** — Utilities (`cn()` from clsx + tailwind-merge)
- **`content/`** — MDX content (blog posts, docs) rendered by the app
- **`styles/`** — Global CSS with Tailwind v4 `@import` syntax and CSS variables for theming
- **`typings/`** — Ambient TypeScript declarations
- Root files: `env.js` (env validation), `mdx-components.ts` (MDX component map)

More specific `AGENTS.md` files under `src/` contain the frontend sections split from this file.

## Code Style

Dialog/Sheet native iframe, radio and negative-entry focus ownership,
notification and controlled-dialog focus return, mobile artifact capacity, and
stationary-pointer reference highlight behavior are documented in
[responsive capacity contracts](docs/responsive-capacity-contracts.md).

`ui/dialog-focus-boundary.ts` installs its native Tab guards in the content
owner's effect after Radix FocusScope mount autofocus, never from the ref callback.
Keep default mount entry (including raw radio order and input selection), caller
cancellation/redirects, and nested scope ownership with Radix. The shared hook
owns guard cleanup and forwarded refs; initial-focus and frame-boundary component
tests cover replay, reopening, dynamic children, and retirement.

`ui/toggle-group.tsx` preserves Radix's initial roving entry and blur reset.
For an item's ordinary Shift+Tab, publish the requested root back-out state
synchronously before an enclosing FocusScope reads its edges. Run the caller's
handler first and respect preventDefault; leave disabled roving focus, embedded
inputs, modified keys and other key behavior with their existing owners. Do not
make the root permanently untabbable: before its first focus, its items have no
current tab stop.

Mermaid uses Streamdown's public `plugins.renderers` registration in
`core/streamdown/plugins.ts`. The project renderer preserves Streamdown 2.5's
diagram toolbar and engine configuration while its fullscreen uses a native
Radix Dialog layer. Keep Escape and focus inside that inner dialog; closing it
must retain the enclosing artifact Sheet and restore its trigger. Drawing and
downloads retire late results, viewport work, pointer capture and object URLs
with their component owner. Do not patch generated primitives or Streamdown's
installed package to coordinate nested overlays.
`core/streamdown/mermaid-export.ts` serializes the detached Mermaid HTML fragment
as XML before SVG download or PNG decoding. Keep foreignObject HTML namespaces,
void tags, entities and Unicode intact; a string containing `<svg` is not proof
that an exported image decodes. The shared native image-export regression checks
both applications, languages, viewport sizes and the original 5x PNG scale.

Artifact auto-selection belongs to `MessageGroup`'s current last tool, above
`FlipDisplay`'s exiting children. Keep the 100ms effect and cleanup for target,
pending/result, loading, selection and owner changes. Read a finalize tool's
actual result message; generic display parsing must not erase its success.
`CodeEditor` owns autofocus for the readonly-to-editable transition through
CodeMirror's committed `ViewUpdate`. UIW's autofocus effect runs before its
editable reconfiguration; focus only when that actual state becomes editable
and the caller requests it. Keep the same view and draft, and do not reclaim
focus for later document or configuration updates.
`InputBox` keeps a completed-turn followup snapshot across temporary disabled
or config loading states, then submits it once. Stop, a new run, thread/user/
composer lifetime changes and unmount retire and abort that owner; historical
initial mounts do not generate followups.

`core/utils/markdown.ts` reads web-fetch titles from the first nonblank line.
Match zero to three literal spaces before `# ` without trimming indentation;
mixed space/tab code blocks must fall back to the URL. Strip optional closing
hashes with a backwards scan so long fetched titles cannot cause quadratic regex
backtracking. Closing hashes require a preceding space/tab (or an empty title)
and only ASCII spaces/tabs afterward, apart from the terminal CR in CRLF input.
Non-ASCII trailing whitespace must not turn literal hashes into closing syntax.
Keep this local to title extraction rather than changing the shared streamdown
fence parser.

Custom Agent `display_name` is an optional Unicode UI label, edited in
`AgentSettingsDialog`. Use it with a fallback to `name` for gallery/chat text;
keep `name` for React identity, URLs, requests, and runtime `agent_name`.
The 100-code-point budget uses `[...value.trim()].length`, matching Pydantic;
do not use HTML `maxLength`, which counts UTF-16 code units instead.

Custom Agent portability uses the versioned `deerflow.custom-agent` JSON
document through `core/agents/api.ts`. Keep file parsing client-side only for
previewing the proposed local name; the Gateway is authoritative for schema,
name, model, and conflict validation. Export downloads must never synthesize
runtime state from browser caches.

- **Imports**: Enforced ordering (builtin → external → internal → parent → sibling), alphabetized, newlines between groups. Use inline type imports: `import { type Foo }`.
- **Unused variables**: Prefix with `_`.
- **Class names**: Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Path alias**: `@/*` maps to `src/*`.
- **Components**: `ui/` and `ai-elements/` are generated from registries (Shadcn, MagicUI, React Bits, Vercel AI SDK) — don't manually edit these.

Scheduled-task list search filters the current authorized query result by title or
prompt, composing with status/type filters and thread scope. Selection must derive
from the filtered list so hidden tasks cannot remain actionable. Keep literal
matching in `core/scheduled-tasks/search.ts`; clearing search retains other filters.

Single-run schedule edits retain the mounted task's original `run_at` while its wall time and timezone match. The parent echoes edits through `initial`; retain a stable snapshot and reset the parent draft during render before remounting with a task key when switching tasks. Use the resolved timezone consistently for the snapshot and displayed wall time. Component and scheduled-task E2E tests cover DST folds and timestamp precision.

## Environment

Scheduled-task interval forms preserve the initial `every_seconds` on mount,
timezone changes, and untouched blur. The backend's configurable interval minimum
can be lower than the UI's default 60-second floor. Apply that UI floor only after
an explicit amount/unit edit so editing metadata or duplicating a task cannot
silently change its cadence. Component regressions live in
`tests/unit/components/workspace/scheduled-task-schedule-input.dom.test.tsx`.

Backend API URLs are optional; an nginx proxy is used by default:

```
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001
NEXT_PUBLIC_LANGGRAPH_BASE_URL=http://localhost:8001/api
```

Leave these unset for the standard `make dev` / Docker flow, where nginx serves the public `/api/langgraph/*` prefix and rewrites it to Gateway's native `/api/*` routes.

`make build-static` creates a standalone read-only demo and copies `.next/static`
and `public` into the output. In static mode, `core/api/static-response.ts`
resolves Gateway REST reads with the bundled capability catalog and safe
installation projections from existing same-origin `/mock/api` fixtures; writes
and unknown API routes fail locally.
The homepage client counter calls `/github-stars`, outside the Gateway proxy.
That dynamic route reads the server-only `GITHUB_OAUTH_TOKEN` at runtime, caches
GitHub data for one hour, and returns 204 when the count is unavailable. Start
the standalone server from `frontend/` with `node --env-file=.env
.next/standalone/server.js` to load the current credentials.

To reach a dev server on anything other than localhost — a LAN address, or a proxied hostname — list the host in `DEER_FLOW_DEV_ALLOWED_ORIGINS` (comma-separated; a full URL is reduced to its host). It feeds Next's `allowedDevOrigins`, which gates `/_next/*`, fonts, and HMR. Without it those requests get a 403 and the page renders server-side but never hydrates, so nothing on it — including the login form — responds. Development only; production builds ignore it.

One-time schedule input uses `validZonedLocalToUtcIso` to reject wall times that
do not round-trip in the selected timezone. Invalid input emits an empty spec and
localized inline feedback; both create and edit must block submission. Keep this
UI validation separate from the API payload. Preserve the original instant when
wall time and timezone match the mounted snapshot; validate changed inputs, and
restore the exact original timestamp when those edits are reverted.

## Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain Core Concepts](https://js.langchain.com/docs/concepts)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs/app)

## Contributing

When adding features:

1. Follow the established `src/` structure
2. Add TypeScript types and proper error handling
3. Write unit tests under `tests/unit/` (`pnpm test`) and E2E tests under `tests/e2e/` (`pnpm test:e2e`)
4. Run `pnpm check` before committing
5. Update this `AGENTS.md` when architecture, commands, or conventions change

Route asset budgets are enforced with `pnpm perf:check`. The command measures
`/login` from a normal production build, then builds in static-demo mode for the
fixture-backed workspace routes. It starts the production server on temporary local
ports, measures the unique JavaScript and CSS files referenced by representative
routes, writes the detailed result to `.next/performance-results.json`, and compares
totals with `performance-budgets.json`. Fix route ownership or split points when a
budget fails; do not raise a ceiling without documenting and reviewing the measured
regression.

Chat archive is a thread metadata flag (`deerflow_archived === true`), independent
of run status. Sidebar and Chats explicitly request the Gateway's optional
`archived` filter through `searchThreadsByArchive`; the SDK drops this extension,
so use the authenticated REST fetcher. Static demos retain SDK fixture queries.
`core/threads/archive.ts` waits for the write, cancels stale reads, merges only the
owned flag into metadata snapshots, then restarts metadata reads and resets list
pagination. Keep both default and Custom Agent header restore controls in sync.
Pin/archive responses must not merge unrelated metadata flags: out-of-order
organization requests can otherwise roll back each other's confirmed state.
Run-created optimistic snapshots have no archive flag: refresh archive-filtered
lists from the server instead of inserting those snapshots into either view.

Custom skill export is admin-only and disabled in static demos. The lazy
`skill-export-dialog.tsx` must abort requests and ignore stale callbacks on close
or user/skill changes. `core/skills/export.ts` owns the revision-bound Blob download;
HTTP 409 requires explicit preview refresh. Keep file lists paginated and diagnostics
localized. Browser handoff does not prove the file was saved to disk.

Sidebar rows request deletion through `ThreadDeleteDialogProvider`, hosted in
`WorkspaceSidebar` outside the virtualized flat/project lists. Keep the selected
thread snapshot and retry UI alive when a partial deletion removes its row.
Focus Cancel on open and after a failed deletion has re-enabled the actions;
block dismissal while deletion is pending. Show the error message when available,
with a localized fallback, and log the rejection for debugging. The shared
delete helper accepts remote 404 (not 403) before retrying local cleanup, and
`onDeleted` runs only after both deletion steps succeed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Radix Dialog 1.1.15 and FocusScope 1.1.7 have local pnpm source repairs for
programmatic nested closes. A real DialogTrigger keeps its declared return target;
without one, FocusScope restores its captured opener. The existing scope stack
records the parent host so automatic orphan recovery is distinguishable from a
new control's focus. Closed generations cannot restore into a reopened scope;
removed, disabled or inert openers return to the surviving parent scope. Caller
close cancellation/redirects retain priority. These are locally maintained repairs,
not upstream-approved backports. Keep CJS/ESM entries synchronized and install
through pnpm; the mounted Dialog/Memory tests and shared memory-dialog-close
native suite cover both chooser and direct-input entry. Recheck all public UI
and direct consumers, including Sheet and nested renderer dialogs, on upgrades.

A paused stack entry can outlive a removed nested scope until deferred cleanup.
Close ownership checks distinguish connected newer scopes from those departing
descendants, so simultaneous parent/child removal preserves a surviving outer
Trigger. Exercise the installed CJS and ESM exports through mount/open/close as
well as the public component tests; import-only checks do not validate lifecycle.

Thread deletion captures the account revision when its dialog is requested. A
retired request cancels the primitive's default close return even when no
successful deletion completion exists; DOM connectivity alone cannot identify
a reused editor's account. Same-account Cancel/background close retains ordinary
opener return, independently of the successful current-delete composer handoff.
Tests observe both owners and wait through the actual close event before asserting
no stale focus, preserving the programmatic and physically focused entry paths.

Run observation is default-off and binds the actual submit input object to the existing human/replay observer. The compatible SDK client captures that binding when stream() is called while preserving lazy network iteration; only a normally returned original onRunCreated callback records delivery. Observation ownership retires with the displayed owner, not submit Promise completion. It never adds request fields, UUIDs, storage or an SSE reader.
