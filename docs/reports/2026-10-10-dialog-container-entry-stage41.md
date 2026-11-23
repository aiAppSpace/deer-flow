# React Dialog container entry — Stage41

Current product fix is frozen. Only `frontend/src/components/ui/dialog.tsx` changes runtime; the new mounted regression is `frontend/tests/unit/components/ui/dialog-container-entry.dom.test.tsx`. The four-line development contract addition lives in `frontend/AGENTS.md`. Exact final hashes and direct exits: [receipt](evidence/keyboard-order-independent-stage40/stationary-dialog/production-freeze.json). No new formal Playwright cases; the existing complete keyboard matrix retains these five states.

## Cause

Independent real contexts on the immutable React preview at `localhost:3271` reproduced `integrations#install`, `integrations#install-error`, `plugin-icons#uploaded-preview`, `plugin-icons#editor`, and `skill-export#download`. Each had 4–28 actual tabbable DOM candidates but stopped on the dialog container (`tabIndex=-1`) for all 60 native Shift+Tab presses. The initial `focus()` stack came from the installed Radix FocusScope MutationObserver, following asynchronous focused-action removal/disable changes. A reverse press was not prevented: Chrome attempted a focus target outside the dialog, and Radix's document focus trap restored its remembered container. Forward Tab entered content immediately. Vue traversed the corresponding content. This is a real React directional-entry defect, not a valid single-stop overlay or a reason to expand `SINGLE_STOP`.

[Native observation summary](evidence/keyboard-order-independent-stage40/stationary-dialog/stationary-summary.json) and the five full `react-*.json` files retain focus stacks, candidate geometry, native events and all 60 final active-element values. The 10-context initial observation completed directly with exit 0; it reports successful diagnosis, not product acceptance.

## Minimal fix

The DialogContent caller's `onKeyDown` runs first. Only an uncancelled ordinary Tab whose event target is the actual content container enters a real candidate, first forward or last backward. Candidate filtering follows the installed Radix TreeWalker, disabled/hidden and computed visibility/display rules; candidates that do not actually accept focus are skipped. Empty content, child key events, modifiers, other keys and caller cancellation keep the original behavior. Existing Radix modal, dismissal and focus-restoration ownership remains intact.

Entry uses the same `focus({preventScroll:true})` as installed Radix. The existing DialogContent `onFocusCapture` owner then reveals the selected target through native `scrollIntoView({block:"nearest"})`. The browser regression proves the actual last target is wholly visible: its bottom is 279.8125 inside the unchanged 80–280 native scrollport, with native scrollTop 598 of 598. No coordinates or CSS are written by the product fix. No rendered attributes or class strings change.

## Verification and boundary

- Mounted old source: **3 FAIL / 8 PASS**, covering both fallback directions and actual focused-child removal → FocusScope container recovery. Final source: **2 files / 16 PASS / 0 skipped**, including the existing UI-affordance suite.
- Real Chromium with the actual production primitive and installed React/Radix, compiled as a narrow one-module fixture: old source **1 FAIL / 3 PASS**, the failure being reverse entry; final source **4 PASS**, including async fallback, full visible candidate, empty dialog, caller cancellation, ordinary first/last loop, Escape/trigger restoration and outside dismissal. Logs and retained old trace/PNG are in the receipt directory. This is not a fresh Next application build.
- Final `tsc --noEmit`, scoped ESLint with `--no-ignore`, and Prettier check each directly exited **0**.

Fresh full application keyboard/parity, full React current-source gates and the affected React image/entry still require the parent's unified new-source gates. Earlier images and running cross-copy remain precise historical checkpoints. This report does not claim whole-tree zero drift or promote the current Git review marker.
