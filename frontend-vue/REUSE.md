# Reusing the Vue agent contracts

This guide describes the contracts that are reusable **from this checkout**. The
`@deerflow/agent-core` package is private and has not been published to npm. The
supported paths today are a workspace dependency or a tarball produced with
`pnpm pack`; do not write an npm registry version into another project.

This guide is about reuse boundaries, not React/Vue product parity. A green
L1/L2 consumer test must not be used as evidence that the DeerFlow Vue
application is ready to replace React.

## 1. Choose the layer you need

| Layer | Reuse boundary                                                             | What the new project supplies                                                 |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| L1    | `packages/agent-core/`                                                     | Backend `RunProtocol`, event classifier, `EventReducer`, message adapter      |
| L2    | Markdown + Button sources listed below; documented chat behavior contracts | Host message model, product composition, styling and business extension cards |
| L3    | DeerFlow application wiring                                                | Replace it; do not copy it as if it were generic                              |

There is deliberately no `packages/agent-ui-kit`. The current chat components
still import DeerFlow stores, endpoints and product types. Creating a package
around those files would only hide the coupling.

## 2. Install or attach L1

For another workspace in the same repository:

```json
{
  "dependencies": {
    "@deerflow/agent-core": "workspace:*"
  }
}
```

For a separate repository, pack the current checkout and install the tarball:

```bash
cd frontend-vue/packages/agent-core
pnpm pack --pack-destination /path/to/consumer
```

Then use a `file:` dependency that points at the generated tarball. Only the
package root is public:

```ts
import {
  createAgentExternalStore,
  createRunSession,
} from "@deerflow/agent-core";
import type { EventReducer, RunProtocol } from "@deerflow/agent-core";
```

Imports such as `@deerflow/agent-core/src/session/run-session` are unsupported
and are blocked by both `package.json#exports` and the architecture tests.

## 3. Current L1 API (contract version `m8`)

`m8` is the checked-in contract identifier exported by the package. It is retained for
consumer compatibility and does not represent the repository's current delivery phase.

The exact symbol list is guarded by
`packages/agent-core/tests/architecture.test.ts`. It is grouped here by purpose:

- Contract/errors: `AGENT_CORE_CONTRACT_VERSION`, `AgentErrorKind`,
  `AgentStreamError`, `isRetryableKind`, `toAgentStreamError`.
- Messages: `AgentContentPart`, `AgentMessage`, `AgentMessageContent`,
  `AgentMessageRole`, `AgentToolCall`, `createAgentMessage`.
- SSE: `SseEvent`, `SseFrame`, `FrameReaderOptions`, `readSseFrames`,
  `flushSseRemainder`, `readNextSseFrame`, `parseSseFrame`.
- Session/protocol: `BackoffOptions`, `computeBackoffDelay`, `DEFAULT_BACKOFF`,
  `CancelResult`, `ClassifyEvent`, `InspectedRun`, `OpenedStream`, `RunOutcome`,
  `RunProtocol`, `StreamRequest`, `StreamSignal`, `RunSessionState`,
  `SessionOutput`, `RunSession`, `RunSessionOptions`, `createRunSession`.
- Reducer/store: `AgentSnapshot`, `EventReducer`, `ReduceAction`,
  `AgentExternalStore`, `applyReduceActions`, `createAgentExternalStore`.
- Watchdog: `WatchdogInput`, `WatchdogOptions`, `WatchdogVerdict`,
  `DEFAULT_WATCHDOG`, `evaluateWatchdog`.

Adding or removing a symbol is a public contract change. Update the exact export
test, this guide and the consumer example in the same change. The package ships
TypeScript source for bundler-based consumers and declares no runtime framework
dependency.

## 4. Adapt a custom backend

Use the runnable example in `examples/agent-core-consumer/` as the starting
point. It intentionally uses a non-LangGraph `/sessions` protocol.

1. Define the backend's wire message shape in `message-adapter.ts` and convert it
   to `AgentMessage`. Preserve unknown protocol fields in `AgentMessage.meta`.
2. Implement `RunProtocol` in `protocol.ts`:
   - `create()` creates once and returns a stable handle plus the response;
   - `resume()` only resumes that handle and forwards the cursor;
   - `cancel()` distinguishes a draining response, accepted cancellation and an
     already-terminal result;
   - `inspect()` maps durable backend status to `RunOutcome`.
3. Classify the backend's terminal/error/gap events with `ClassifyEvent`.
4. Implement a pure `EventReducer` in `reducer.ts`. A full snapshot should use
   `replace-state`; message deltas use message actions. Do not mutate host reactive
   state from the reducer.
5. Create one external store and run session per conversation/child session.
   The framework adapter subscribes to snapshots; it does not reimplement the
   protocol state machine.

Run the same acceptance path used by this repository:

```bash
cd frontend-vue
make consumer-check
```

That command packs the real package, copies the checked-in example to an
isolated system temporary directory, performs a clean install, typechecks it,
bundles it and runs the session. It cannot resolve dependencies through this
repository's parent `node_modules`.

## 5. Current L2 boundary

The independently reusable source set is intentionally small:

- `app/core/markdown/**`;
- `app/components/markdown/**`;
- `app/components/ui/**`, the Reka-based primitive layer (Dialog, AlertDialog,
  Sheet, Popover, DropdownMenu, Select, Tabs, Switch, Tooltip, HoverCard,
  ScrollArea, Command, Button);
- `app/lib/utils.ts`, which the variants use.

`tests/architecture.test.ts` freezes this exact set, requires final `L2` file
headers and rejects imports from DeerFlow protocol, API, artifact, auth, channel,
config, model, settings, sidecar, skill, task, thread, upload, store and workspace
modules. Existing Markdown DOM-equivalence, streaming, error-boundary, Shiki and
Mermaid tests support the component behavior; the Button contract has its own
unit test, and the primitive layer is covered by `tests/unit/ui/**` (roles, aria
state, keyboard exits) plus `tests/e2e/ui-primitives-a11y.spec.ts` (real focus
trapping, Escape and focus restoration in a browser).

Current public component seams are:

- `StreamMarkdown`: `content`, remark/rehype plugins and options, element
  `components`, incomplete-markdown recovery, word animation and root class.
- `MarkdownBlock`: content, plugins/options, element components and animation.
- `CodeBlock`: code and language; copy/download/highlight behavior stays local.
- `MermaidDiagram`: code and dark mode; parse failure falls back to code.
- `Button`: shadcn-vue-compatible variants and sizes.

The following behavior has focused tests and is reusable as a pattern, but those
tests do not prove complete product parity. Its current Vue component is an
**L3 UI adapter**, not a portable package:

| Behavior                                   | Current source and seam                                                                                                                                                 | Why it is not in the L2 source set                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Message grouping, reasoning and tool steps | `core/messages/utils.ts`, `run-duration.ts`, `MessageList.vue`; `messages/rawMessages/streaming` props plus branch/regenerate/edit/humanInput/artifact/selection events | Uses DeerFlow wire `Message`, artifact/change/sidecar cards and task metadata |
| Composer                                   | `threads/composer-draft.ts`, `ChatComposer.vue`; thread/context/streaming props plus send/stop/upload/context/goal events                                               | Imports DeerFlow skills, uploads, models, goal, polish and sidecar types      |
| Human input                                | `core/messages/human-input.ts`, `HumanInputCard.vue`; request/answered/active/pending plus submit                                                                       | Request extraction is tied to DeerFlow ToolMessage wire shape                 |
| Child session                              | `SidecarPanel.vue` consuming the same `MessageList` and `useThreadStream`                                                                                               | Hidden-thread metadata and APIs are DeerFlow-specific                         |
| Subtask timeline                           | `SubtaskCard.vue` consuming normalized task state and on-expand history                                                                                                 | Task events and run-event URLs are DeerFlow-specific                          |

A new project should keep the behavioral invariants and replace those host
adapters against its own message model. Do not add a second message state machine
just to make the component signature look generic.

## 6. Artifacts as the extension reference

Artifacts validate the extension direction rather than belonging to L2:

```text
ArtifactPanel (L3) -> StreamMarkdown (L2)
MessageList (host adapter) --artifact(path)--> AgentChat -> artifact panel state
```

`ArtifactPanel.vue` imports the L2 Markdown renderer. No L2 file imports artifact
code, and the architecture test guards that direction. A different project can
replace the artifact event, panel state and file API with its own domain panel
while preserving the generic Markdown renderer and main-session ownership.

## 7. L3 replacement checklist

Replace every applicable group below when moving to another backend/product:

1. Protocol and wire model:
   - `app/core/agent-deerflow/**`;
   - `app/core/types/message.ts` and `message.contract.ts`;
   - `app/core/api/stream-mode.ts` (LangGraph request modes).
2. Gateway REST, auth and runtime configuration:
   - `app/core/api/**`, `app/core/config/**`, `app/plugins/runtime-config.ts`;
   - `server/routes/api/[...path].ts`, `server/utils/gateway-proxy.ts`,
     `server/plugins/request-guard.ts`;
   - `app/core/auth/**`, `app/middleware/auth.global.ts`, login/setup/callback
     pages and the relevant auth layout.
3. Vue/thread application adapter:
   - `app/composables/useThreadStream.ts`, `useThreadHistory.ts`, `useThreads.ts`,
     `thread-context.ts`, `useCoalescedStreamMessages.ts`;
   - `app/core/threads/**` and thread routes. Nothing owns a duplicate thread list.
4. DeerFlow product extensions:
   - `app/core/artifacts/**`, `components/workspace/artifacts/**`,
     `useArtifactsPanel.ts`;
   - `app/core/sidecar/**`, `components/workspace/sidecar/**`, `useSidecar.ts`;
   - `components/workspace/changes/**` and `app/core/workspace-changes/**`;
   - `components/workspace/browser-view/**`;
   - settings, agents, skills, models, integrations/MCP, memory, channels,
     scheduled tasks, goal/mode, notifications, uploads and voice-input modules.
5. Product composition and routes:
   - `AgentChat.vue`, `MessageList.vue`, `ChatComposer.vue` and
     `HumanInputCard.vue` host adapters;
   - `WorkspacePanels.vue`, `ThreadSidebar.vue`, workspace layout/pages and
     feature stores/composables.
6. Deployment wiring:
   - Nuxt public/private base URLs, Nitro proxy, nginx/Compose hostname rules,
     OIDC callbacks, cookies/CSRF, WebSocket Upgrade and SSE timeouts.

The list is deliberately broader than `app/core/agent-deerflow/**`: replacing
only the transport while retaining DeerFlow auth, stores or product panels is not
a backend-independent reuse.

## 8. Testing and upgrades

Before adopting a new core revision:

1. Compare `AGENT_CORE_CONTRACT_VERSION` and the exact export test.
2. Run the consumer's adapter/reducer/session tests with raw protocol traces.
3. Run `make consumer-check` and `make verify` here. The provenance ledger and
   its `migration-check` gate were deleted with the rest of the migration tooling
   in `1209651f`; `app/core/` is maintained in this workspace now, so
   `make verify` is the whole story.
4. If the change touches chat UI or Markdown seams, run `make e2e` and the
   artifact gates. If it touches protocol/session/reducer, run `make e2e-stream`,
   `make e2e-protocol` and the relevant real-Gateway suite (`make e2e-backend`
   runs all eight).
5. Keep end-to-end product tests in the consuming project. L1 success does not
   prove its authentication, reverse proxy, business panels or visual states.

No command in this guide publishes npm, changes DeerFlow's default React entry,
or activates a public Vue deployment. Architecture and ownership boundaries are maintained in
[ARCHITECTURE.md](ARCHITECTURE.md) and [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md).
