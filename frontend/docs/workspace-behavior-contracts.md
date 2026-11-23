# Workspace behavior contracts

Read the relevant section before changing scheduled tasks, models, plugins,
composer references, Lark authorization, artifact previews/revisions, capability
configuration, knowledge citations, MCP ownership or plugin mentions. These requirements
are part of the frontend development guidance linked from `../AGENTS.md`.

## Scheduled tasks and conversation origins

The dedicated `run-history.ts` hook replaces the unpaged runs hook. Show counts
only after a successful history read, never during initial loading or errors.
Scheduled run history uses task/page query keys and the existing live offset API.
Fetch 51 rows to display 50 plus a next-page sentinel; never append pages. Only
page zero polls or refreshes on focus/reconnect. Task switches reset to page zero,
and consumed AbortSignals cancel obsolete reads. Live offsets are not snapshots;
explicit mutations or navigation may observe newly inserted runs.
Run status `unmet` identifies a finished occurrence whose scheduled goal was not satisfied; keep it distinct from execution failure.
`core/scheduled-tasks/goal-outcome.ts` maps goal verdicts and host reason codes for run history; show known codes as localized labels; unknown codes, raw run errors and the evaluator's reason stay behind the run row's Details. Check-failure codes are "unchecked", not a miss. `contracts/scheduled_goal_notes_contract.json` pins the host strings it and `run-error.ts` match.
Scheduled-task views read state through the pure `core/scheduled-tasks` helpers (`status.ts`, `actions.ts`, `format.ts`, `describeTaskSchedule`, `errors.ts`) so list, detail and chat card agree. "Is a run active?" is `status === "running"` or `active_run_status` (a recurring task stays `enabled` while it runs). Default views show no IDs, ISO times, cron strings or enum names; errors localize by `detail.code` (`contracts/scheduled_task_errors_contract.json`) with raw text only behind Details. `tests/e2e/utils/readable.ts` and `tests/unit/helpers/readable.ts` assert this.
The tasks page (`app/workspace/scheduled-tasks/page.tsx`) only composes `components/workspace/scheduled-tasks/*`: list with status tabs, detail (Runs / Stops when / goal / Does / notes / History), outcome notice, create/edit/duplicate dialog (PATCH sends only changed fields, `null` clears) and the renew dialog that a `limits_exhausted` Resume opens. `?task_id=` selects a task; `?thread_id=` scopes the list to one chat.
In chat, a `schedule_task` result becomes an `assistant:scheduled-task` group (`core/scheduled-tasks/tool-result.ts`, last card per task per turn; not a turn boundary) rendered by `ScheduledTaskCard`, which polls the task only while on screen. A human message with `additional_kwargs.deerflow_scheduled_origin` stays a `human` group with `scheduledOrigin`: `ScheduledRunPrompt` renders the origin's user-language parts, never the launched text, and it is not editable.
Server-created threads: `core/threads/origin.ts` reads `metadata.deerflow_origin` (`contracts/thread_origin_contract.json`), then `channel_source`, then a legacy `scheduled_task_id`; provider names come from `threads.origin.providers`. `core/threads/activity.ts` polls `/api/thread-activity` (mount `useThreadActivity` once; unmounting resets its cursor; first poll only seeds; invalidate lists only on server-origin threads, truncation or a higher `read_version`) and `useMarkThreadRead` posts reads. `core/scheduled-tasks/events.ts` loads a chat's lifecycle events, not gated on its task list; `placeTaskEvents` puts each at the end of its `after_run_id` turn. The UI language is saved as the `locale` preference once per session and on each switch, only when the Gateway's preferences include `locale`.
Thread rows (sidebar, `/workspace/chats`) show `ThreadOriginIcon` and, if `unread === true` and not the open thread, `ThreadUnreadDot` with `threads.unreadLabel` as row label. `WorkspaceSidebar` mounts `useThreadActivity`. Chat pages call `useMarkOpenThreadRead` once metadata loads (marks read on load, on an unread flip, on tab visible, and via its callback from `onFinish`).
Chat pages pass `useThreadScheduledTaskEvents` data to `MessageList` (`scheduledTaskEvents`; the custom-agent page also passes its agent for the run link), which renders `ScheduledTaskEventLine` through `VirtualMessageList.renderAfterGroup` at the `placeTaskEvents` position, inside the group's measured row. Lines are history: never gated on the task list. Channel provider cards (Settings and the sidebar list) render `ChannelScheduledUpdates` from `proactive_notifications`, and nothing when the field is absent.

### Shared model settings

Settings → Models (`?settings=models`) offers administrator-only catalog management
through `/api/managed-models`. YAML entries are read-only. `core/models/management.ts`
whitelists editable fields so source metadata and `has_api_key` never get posted.
Draft credentials stay in editor state, never query cache or browser storage; blank
keeps the saved key, explicit removal sends an empty key. Saving invalidates both the
admin catalog and `MODELS_QUERY_KEY`. The management hook owns accepted save/delete
mutations and invalidation; closing an editor retires its local callbacks while the
accepted mutation may still finish. Editor unmount aborts probes. Account changes
retire old-owner effects. Static demos and non-admin users must not query the management API.

### Model reasoning capabilities

`/api/models` projects a per-model `reasoning` contract (issue #5073) beside the
deprecated `supports_thinking` / `supports_reasoning_effort` booleans.
`core/models/reasoning.ts` is the only place that interprets it: it falls back to
the booleans for older Gateways, clamps the chat mode (`getResolvedMode` never
yields `flash` for a required-thinking model), lists the effort options the
composer and the sidecar render, and maps mode presets and remembered values
through the contract's aliases/default (`resolveReasoningEffort`). Effort values
are open strings (`ReasoningEffortValue`), so provider-specific tokens such as
`max` flow through local settings and account preferences unchanged; the custom
agent dialog offers only the intersection with the per-agent `low/medium/high`
schema and hides "off" for required-thinking models. Do not read the booleans in
components directly. On a legacy model, `resolveReasoningEffort` keeps only its
advertised generic values; this drops a remembered provider-specific token after
a model switch without changing the backend's direct legacy-request behavior.

## Full-stack plugin UI

`core/extensions/` loads authenticated deployment-installed ES modules from `/api/plugins`.
Inline modules use authenticated fetch plus a released Blob URL. Manifest assets use
native credentialed module scripts, preserving relative imports and resource URLs.
Both honor the backend base and prefixes; transport and cache semantics are documented in
`docs/full-stack-plugins.md`. Host copy belongs in the typed locale dictionaries.
Conversation action factories, shapes and availability callbacks are guarded per plugin;
only validated value snapshots reach the toolbar/sidebar render paths.
`PluginNavigation` and the dynamic workspace extension route consume page declarations;
Capability Center defaults to the repository examples in `core/extensions/catalog.ts`,
merged by explicit namespace with runtime descriptors. Catalog-only entries are discovery
metadata, never module-loader inputs or proof of installation. Backend-only examples may
have no plugin descriptor; keep their runtime status unasserted. Details link to package
installation instructions. Keep the catalog aligned with `examples/deerflow-extension-*`.
Agent teams uses `community.agent-teams`; merge its installed descriptor into the
localized catalog entry without asserting runtime status for a catalog-only row.
Conversation action slots augment normal/custom-agent toolbars and sidebar menus without replacing native export or notification.
Plugin views use mount/dispose and abort signals; Shadow DOM is CSS isolation, not a sandbox.
Descriptors are user-keyed page snapshots, refreshed manually. Backend calls bind the plugin's
namespace, action allowlist and expected viewer identity. See `docs/full-stack-plugins.md`.

Plugin page `openConversation(threadId)` resolves authenticated thread metadata
with `pathOfThread`; do not let plugins hardcode default-agent routes. The page's
abort signal fences late navigation after unmount/account changes. Synchronous
conversation-action callbacks reject Promise returns while consuming rejections.

### Composer references

`components/workspace/mentions/` owns cursor-local `@` detection, the picker,
and atomic references. Render labels as DOM text, never HTML; canonical tokens
preserve draft positions. Submission expands tokens to `@label` and sends up to
16 unique skill IDs in `additional_kwargs.skill_references`; the backend checks
each against the user registry and agent allowlist. The web slash picker lists
only `/goal` and `/compact`; skill selection uses `@`. Legacy typed slash text
continues through normal message submission for backend and channel compatibility.
Project files require confirmed `additional_kwargs.files`. Conversation context
is reconciled from tokens against the current capability and limit. Only successful
discovery may flatten references; pending/errors preserve IDs and block reference
sends, with retry on failure. Polish restores whole labels longest-first in one
pass. Confirmed thread creation seeds metadata before migration; references stay
locked during attachment. Deleting an object removes its context; undo restores
references already attached to the draft. Labels grant no read authority. IME,
caret, thread changes and attachment fences apply to editor and picker. The `@`
and attachment buttons share the picker.

### Lark pending copy lifetime

Lark authorization-link copy feedback belongs to the pending flow and account
that initiated it. The component's committed lifetime revision retires pending
clipboard results on flow changes, account changes and unmount; the flow generation
also fences a replacement started before its next commit. The browser copy request
may already have happened, but its late result must not toast for a retired owner.
Keep the actual-component clipboard success/failure regressions alongside the
Lark hook/cache tests.

### Artifact byte revisions

Artifact edit revisions are SHA-256 of the original response bytes, including a
UTF-8 BOM. Complete responses prefer the Gateway's SHA-256 ETag, normalizing weak
compression tags and hex case. Truncated responses never expose an editable
revision. When WebCrypto is unavailable, load the pinned `@noble/hashes/sha2.js`
on demand and compute the same SHA-256; never use a short fingerprint as a content
revision. The browser editor-save test exercises missing WebCrypto/ETag and BOM
bytes against the actual PUT contract in both frontends.

Artifact preview reads remain bounded to the existing byte limit even when a server
ignores Range. Requesting the full file changes the request budget, not the
completeness check: partial responses or fewer bytes than the declared total
remain truncated and do not receive an editable revision, even with a SHA-256 ETag.

### Delimited artifact preview

CSV/TSV previews share `artifact-table-preview.tsx` between the panel and standalone viewer. Papa Parse runs only inside `delimited-preview.worker.ts`; `use-delimited-preview.ts` bounds input before transfer, cancels stale work, and enforces a five-second timeout. The parser detects the first record separator outside quoted fields and passes it explicitly to Papa Parse, so embedded newlines in an incomplete quoted field cannot corrupt newline detection. It retains at most 202 logical records and 50 columns, discarding an incomplete final record from truncated input. UI pagination displays at most 200 data rows in pages of 50. Keep the table mounted but inactive when switching to source so header/pagination state survives; changing file identity resets it. Pending `write_file` content stays in source mode until success.

For a truncated sample whose first separator is LF or CRLF, strip a terminal CR
before parsing so a split CRLF separator cannot make a quoted final field
invalidate the whole preview, including LF-first files with later CRLF records.
The terminal record remains incomplete and is discarded; complete CR-only files
and malformed quotes retain their existing behavior.

## Capability Center

`/workspace/capabilities` owns Plugins and Skills navigation. Plugins composes the
MCP manager and a lazily loaded Lark configuration dialog; installation, OAuth,
mutation permissions, and cache ownership remain in the existing hooks. Skill display names/summaries are presentation
metadata; runtime names and full descriptions remain unchanged. Public, custom,
integration, and legacy sources must stay distinct. Community currently offers
archive import, not a remote marketplace. Screenshot E2E fixtures are demo data.
`backend/packages/harness/deerflow/capabilities/builtin.json` owns localized
catalog manifests. Refresh the generated demo snapshot with `pnpm catalog:sync`
after changing the catalog; unit tests enforce equality with the source. Demo
business projections derive provider IDs from the catalog adapter metadata. The
sync script uses decoded filesystem paths for formatter configuration lookup.
`plugin-catalog.ts` only resolves localized text and explicit
installation metadata; never infer provider identity from server display names.
`plugin-directory.tsx` groups rows and applies search/category/installed filters.
`core/capabilities` consumes catalog and safe status projections; MCP secrets and
raw settings remain in the administrator-only editor. `plugin-adapters.tsx`
registers integration-specific settings flows once, independent of catalog size.
The `business` form uses manifest credential fields without asking for an MCP URL;
its backend adapter generates bundled DingTalk/WeCom notification or HubSpot CRM
connections. These also appear in MCP discovery, so deduplicate projections by
installation ID. Keep their labels as configuration, not package installation.
Keep installation, enabled state, configured credentials, and verified authorization
distinct. Agent `mcp_plugins` uses stable installation IDs; null means all, [] means
none. The settings dialog submits only selections changed from its opening
snapshot, preserving concurrent updates on unrelated saves and treating restored
selections as unchanged. It is runtime selection, not a replacement authorization policy. See
`docs/capability-center.md` for the complete contract and extension example.
`PluginIcon` is shared by recommendations, configured entries, and the editor;
brand assets and their provenance live in `public/images/plugins/`. Brand icons
require explicit catalog metadata; a custom server name never selects a brand.
Ambiguous installation IDs remain visible but cannot be selected for an Agent. The icon picker
accepts local PNG/JPEG/WebP up to 2 MiB, checks the signature, decodes and contains
the image in a 128px PNG, and stages changes until the existing targeted MCP save.
`presentation.icon` is a bounded PNG data URL carried by the API's existing extra
metadata support; it must never enter transport parameters. Preserve sibling
presentation fields and masked credentials; cancel/reset/unmount must fence stale
image-decoding results. Uploaded remote URLs and SVG are never rendered. Existing
shared-MCP administrator checks remain authoritative; this adds no personal scope.

### Knowledge source citations

`KnowledgeSourcesProvider` scopes source records to the current message list.
Only versioned native `knowledge_search`/`task` tool artifacts supply evidence;
AI/human text and metadata cannot create a source. `CitationLink` resolves
`#knowledge-…` citations through that context and renders unavailable text when
there is no matching record. `KnowledgeSourcesPanel` lists only sources cited
outside code/images. Dialog excerpts render as plain text, never HTML or nested
Markdown. Source records retain retrieval-time evidence, not live documents.
Resolve knowledge destinations before testing the label in message and artifact
link renderers: Sources lists use ordinary titles without a `citation:` prefix.

Custom-agent settings persist `knowledge_scope` as an optional retrieval default.
Use `knowledgeScopeToSelection` to restore all execution IDs, falling back to IDs
where the bounded display snapshot lacks names. Only dirty knowledge settings
are sent on save. Custom-agent chat derives its initial selection from the saved
binding; explicit page-local overrides survive new-thread route replacement and
reset on conversation changes. Gateway supplies defaults for clients without a
selector; frontend visibility must not become a runtime enforcement boundary.

MCP hooks and the editor default to personal scope. Mutation-option builders require an explicit scope. MCP control accessible names include the localized ownership section, so same-named shared and personal connections remain distinct without region context. Query keys include scope and authenticated user ID; remount each editor when that ID changes. Platform provided uses the deployment editor only for administrators outside static mode, restoring add, edit, toggle and delete through the existing admin-only MCP API. Ordinary users see shared entries read-only. My plugins contains personal configuration templates, Lark account authorization and the personal MCP editor; a deployment installation must not mark a personal template configured.

Plugin mention providers extend the existing composer picker via
`core/extensions/use-mentions.ts`. Keep provider queries bounded and fenced by
viewer, thread, query, and installed snapshot.
Provider and page-surface IDs must be strings before slug validation; JavaScript
coercion is not validation. A settled snapshot with no enabled, viewer-visible
mention providers returns an empty result immediately without a search timer.
Settled results may remain visible during query/retry refreshes only within the
same viewer, thread, locale and installed snapshot; stale responses stay fenced.
Inline plugin references serialize into human-message
`additional_kwargs.extension_mentions`; these IDs and labels
are untrusted input, never a routing or permission grant. Built-in mentions must
remain usable when a provider fails or times out.
