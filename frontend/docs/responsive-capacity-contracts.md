# Responsive scrolling, overlays and panel capacity

These contracts apply to the React frontend. Read them before changing chat
scrolling, portaled controls, settings or project capacity, and artifact panels.
They describe current ownership and required shared browser regressions.

`ChatBox` keeps desktop panel content at its final width until the actual panel
size and content opacity transitions finish. Its public panel `elementRef` owns
the sized host; descendant animations do not delay completion. Closing content
remains mounted through that lifetime, including the mobile Sheet's own exit
animation. Reopen, breakpoint change and unmount retire older completions;
cancellation rechecks current animations. Layouts with no animation settle after
the committed host is observed, without a duration timer. Preserve the native
sidecar width/scroll assertions as well as the mounted lifetime regressions.

`ConversationEmptyState` uses safe centering and its own native vertical overflow;
its icon and text retain their natural heights when the available side-chat body is
shorter than their content. Ordinary centering must not place the first content above
the scroll origin. `sidecar-empty-capacity.spec.ts` covers both root font sizes.

Fullscreen Markdown tables own the complete viewport, with spacing owned by the toolbar
and table scrollport. Ordinary dialog max-height and breakpoint padding do not apply.
The public table renderer uses Radix for nesting, Escape and focus return while retaining
Streamdown's exported copy/download controls. Shared `markdown-table-presentation.spec.ts`
and `markdown-table-actions.spec.ts` cover normal, mobile, low-height and enlarged-text
geometry plus actual clipboard/download payloads.

Keep `Conversation` / `StickToBottom.Content` as the physical message scroller
at every breakpoint. The virtualizer, history anchors and tail-following hooks
all observe that element. Do not replace its bounded height and overflow with
natural-height content on narrow screens: reflow can move an open message menu's
trigger outside the viewport while its fixed portal remains unreachable. The
named `chat-pane` container below `48rem` puts the header in the existing outer
`main` pan, so a low viewport can scroll past the header and an oversized
composer. Its message flex item uses the automatic content minimum capped at
`100dvh`; the inner native scroller and virtualizer remain bounded. Remove the
floating-header top reservation at that same container breakpoint and preserve
real save-hint spacing. The container query scales with root font size and
handles narrow split panes inside a wide viewport.
Composer bottom decorations use the same spacing token as the host’s `pb-4`;
they must not extend the native pan beyond that reserved space or shift a focused
main composer relative to its sidecar.
Open portaled dropdowns retain their actual `aria-labelledby` reference when
layout or visual-viewport changes detach both menu and reference from their
visible clipping intersections. The generic primitive reveals that reference
through existing native scroll owners and leaves Radix placement, menu focus,
selection and close behavior intact. It does not set portal coordinates or
close a menu on resize; subscriptions and pending frames retire on close/unmount.
Model popovers use the unique public trigger `aria-controls` relation instead;
absent or ambiguous references do not authorize guessing an anchor. Keep their
mounted Radix placement updating through a resize that introduces a new scroll
ancestor, while native reference reveal preserves keyboard focus. Shared tests
live in `frontend-vue/tests/e2e-parity/popup-capacity-reflow.spec.ts`.
DialogContent preserves Radix's modal focus scope after asynchronous content
removal resets focus to its container. Tab from that container enters the first
real candidate; Shift+Tab enters the last. Caller cancellation takes precedence,
and the existing focus-reveal owner keeps that candidate visible. A programmatically
focused negative-tabindex heading enters the real first/last candidate only at
the corresponding DOM edge. Keyboard modality is captured on the content owner
document for its mounted lifetime, including the first Tab after a nested portal
closes and leaves focus on a document guard.
Dialog and Sheet mount autofocus belongs to Radix: the first eligible real
non-link candidate receives focus in raw DOM order, including unchecked radios;
inputs retain text selection, and empty candidates fall back to the content host.
Caller cancellation, focus redirects and already focused nested scopes retain
control. Native boundary guards are installed by the content owner's effect
after descendant FocusScope entry, so they cannot become autofocus candidates.
Links and checked-radio filtering remain part of ordinary sequential navigation.
`dialog-initial-focus.dom.test.tsx` covers both public components, StrictMode and
reopen; `knowledge-radio-boundary.spec.ts` covers All entry and keyboard reopen
before any selection click alongside existing selection/error scenarios.
Dialog and Sheet content retain scope-local focus boundaries while they contain
an iframe or native radio group. Native iframe focus does not bubble to the parent
document; document guards alone restore a stale control. Native radio groups
contribute their checked member as a sequential stop, grouped by name, form and
root. Boundary wrapping must preserve that selection and native arrow navigation. Keep ref cleanup and dynamic
child ownership in `ui/dialog-focus-boundary.ts`, and let Radix own nesting,
Escape and focus return. Controlled promotion dialogs without a DialogTrigger
remember the actual invoking file action and return focus there on every close
path. Ordinary Tab enters and leaves notifications in document order without
restoring a stale entry or cancelling native navigation. Alt+T records the
invoking control and returns there when that shortcut visit reaches a Tab boundary.
Escape collapses the expanded list without moving focus. Removing a viewport that still owns focus also restores
its connected entry. Reveal that entry through native scrolling only after focus
actually returns. The locked Sonner source repair removes its unconditional blur
restoration; project code owns shortcut visits and leaves ordinary navigation native.
Skill detail title and actions wrap as separate flex groups, preserving title
geometry and every action. `focus-capacity-regressions.spec.ts` exercises these
flows, model favorites and table navigation in both production frontends.
Sheet reveal frames belong to the current physical
host and active control; retire them on focus changes, close and unmount.

Message focus stops the existing StickToBottom owner. Only the explicit send or
regenerate `onSend` callback advances `tailRequest` to restore following; history
and remote message changes cannot restore it. Delayed focus reveal checks the
connected target against its own document's active element before using native
center in the outer-pan layout or nearest otherwise. Composer hosts enter the
popover layer only while their textarea or contenteditable owns an active
`aria-controls` relation to a command/reference popup. Hidden command lists stay
mounted for placement measurement and must not keep that layer active.
Shared real browser regressions live in `frontend-vue/tests/e2e-parity/chat-content-reflow.spec.ts`
and `chat-scroll-owner-reflow.spec.ts`.

The chats index keeps ScrollArea's existing viewport as its list and virtualizer
owner. When the page's actual height is below 28rem, the page itself can pan past
its breadcrumb, tabs and search, while the inner list has a bounded `100dvh`
viewport. Move `py-4` inside that viewport only at this breakpoint so enlarged
complete rows retain the available window height; keep desktop viewport,
scrollbar and content geometry unchanged. VirtualThreadList remeasures its
offset when the original viewport or its content resizes. Shared regressions in
`frontend-vue/tests/e2e-parity/chat-list-capacity-reflow.spec.ts` retain archived,
infinite and unread rows, native wheel/Tab, pagination and virtual row identity.

Tool-details panels and payload Copy buttons adapt their padding to their named
container width. Keep complete labels and the native scrollport: enlarged text
in a narrow nested panel must not make a button taller than its scrollport.
`frontend-vue/tests/e2e-parity/chat-state-resize.spec.ts` checks both resize
directions, complete keyboard-focused controls and preserved expanded payloads.

Settings and managed-model dialogs keep their bounded desktop content scrollers.
Below the two-column settings breakpoint, let the dialog itself scroll through
natural-height navigation, content and form actions. Fixed header/footer space
must not compress an inner scrollport below a complete field or button when
text enlarges. Shared native-wheel and keyboard regressions live in
`frontend-vue/tests/e2e-parity/settings-capacity-reflow.spec.ts`.
Use the same natural-height fallback when the settings dialog's own height
container is below 28rem, including wide short windows. Do not split its
two-column grid into two equal rows and compress a complete theme card.
Project detail bounds low-height focusable tab panels to its page size container
minus the existing `pt-8`/`pb-6` padding, with a native scrollport; keep Tab entry
and PageDown available.
`frontend-vue/tests/e2e-parity/settings-project-capacity.spec.ts` covers both.
SettingsDialog's size container caps the narrow content viewport at `100cqh`,
derived from the dialog itself. A focusable native scrollport must fit inside
that outer visible capacity even when its natural content is taller.

MCP JSON and icon editors keep their natural body height, with the existing
whole-dialog native pan. Fixed heading and action space must not compress their
body below a complete input or action. The JSON textarea retains its `h-96`
desktop height (384px at a 16px root) and native text scrolling. Its maximum
border-box height is `100dvh - 4rem - 2px`, or `100dvh - 5rem - 2px` at `sm`:
the dialog's existing 2rem outer margin, its two `p-4` / `sm:p-6` paddings and
two 1px borders define the available capacity. Use `min-h-0` so the old minimum
cannot override that bound in a short enlarged-text viewport. Resizing must
preserve the same textarea and complete draft; both the dialog and textarea
remain natively scrollable. The MCP cases in
`frontend-vue/tests/e2e-parity/capability-controls-reflow.spec.ts` retain the
original strict survey and cover short windows, text enlargement, native editing
and desktop restoration. Sidebar content reserves one existing
`h-8` menu row; its physical sidebar parent pans when the remaining space is
smaller. A desktop sidebar without overflow must not gain a keyboard stop.
Below the workspace-changes Sheet's 28rem capacity boundary, its body uses
natural flow and the whole Sheet pans; ordinary desktop keeps its inner scroller.
At low height, project instructions bound their label and textarea together to
the existing page size container minus its `pt-8` / `pb-6` spacing. The label
keeps its natural height and the textarea takes the remaining grid row. Keep
the default desktop `min-h-40`, complete value and native text scrolling; footer
actions and errors remain in ordinary flow under the same native panel owner.

Artifact detail uses the same existing whole-panel fallback when its container
is below the header's 28rem reflow boundary. Its content flex item keeps its
natural minimum bounded by the viewport, while the preview's native scroller
remains intact. A tall complete link must not be trapped below fixed header
controls; do not change its content or widen the reachability exceptions.
`frontend-vue/tests/e2e-parity/artifact-preview-capacity-reflow.spec.ts` covers
both implementations with real wheel/keyboard and the unchanged strict survey.
Keep the desktop artifact root bounded by its host at low height. In the mobile
Sheet, preserve the root content minimum so the existing whole-Sheet pan can
reveal a complete long link or table region instead of trapping it in a shorter
inner viewport. Keep both body and preview flex ownership intact. The existing
`frontend-vue/tests/e2e-parity/artifact-panel-capacity.spec.ts` and the three-axis
`triple-panel-capacity.spec.ts` jointly cover these different hosts. Project
instruction footer groups wrap naturally; settings actions retain complete labels,
maximum available width and their original minimum height.

The reference and command pickers remain inside InputBox. Their placement helper
reads current clipping ancestors and the visual viewport. References use their
actual CSS margins; commands account for the half-rem `mb-2` gap and enter normal
flow when the clipped overlay space is too small. References also enter normal
flow when neither tethered side can fit the largest actual interactive row;
their scrollport is then bounded by the visible clipping intersection. While open,
ResizeObserver follows the composer, picker body and ancestors;
scroll/resize and visualViewport events update placement, with complete cleanup
on close. Keep font-only reflow and native pointer/keyboard reachability covered
by `frontend-vue/tests/e2e-parity/chat-content-reflow.spec.ts` and
`frontend-vue/tests/e2e-parity/command-popup-reflow.spec.ts`.

Scheduled chat cards bound their footer actions to the available content width.
Keep full labels, natural wrapping and height, and the original minimum button
height; overflow-hidden must not conceal a fixed single-line action. Shared
regressions live in `frontend-vue/tests/e2e-parity/scheduled-card-reflow.spec.ts`.

Reference-picker keyboard highlight follows native arrows and remains distinct
from selected references. Scroll or reflow beneath a stationary pointer must not
change that highlight; only actual mouse or pen movement selects a hover target.
Touch scrolling keeps the current keyboard highlight. Shared popup-capacity
regressions traverse every enabled option before checking its complete geometry.

Nested programmatic Dialog closure returns to the element active when that scope
opened; explicit triggers remain authoritative. The parent host is a legitimate
trap fallback if that opener becomes unavailable, but a newer focused control
or a new route/account owner cannot be overwritten by a delayed close. Actual
Memory tests retain the hidden file input, pending disabled opener, failure/retry
and normalized payload behavior. The shared memory-dialog-close native suite
separately exercises the real filechooser and direct input entry, physically
detached child content and real Tab/Shift+Tab continuation.
