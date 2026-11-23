# Keyboard measurement: finite closure and stationary admission

This is a gate-only change to the five files listed in [the exact source receipt](evidence/keyboard-order-independent-stage40/adaptive-traversal/source-freeze.json). It changes no application runtime code or active preview copy. The complete cross-app keyboard gate still requires execution against the next unified source snapshot.

Each registered state, application and direction still receives the original 60 actual native keypresses. The one-hour budget, 14 historical directional `SINGLE_STOP` keys, one `UNSTABLE_RING` scenario, all registered states, isolated contexts, anti-empty checks and 600 distinct-stop floor remain intact. An unclosed finite traversal receives at most the initial potential focus-node count plus two additional native presses. The bound never grows. Physical replacement, insertion, removal or reordering prevents a changing document from borrowing closure, including when its observed physical sequence appears to repeat.

Physical node identity remains a page-local WeakMap; descriptors retain full names and title fallback. Canonical cycles preserve order and duplicate semantic names, reject unique pre-cycle prefixes and verify the observed tail. Semantic edge sets remain diagnostic and cannot erase repeated same-name links.

Stationary admission is supported by all 60 trusted Tab events and real candidate facts: a populated menu that actually prevents Tab; an actual dialog with one focusable descendant that is the active node and actually traps Tab; or a single document candidate that natively crosses the browser boundary and returns without preventing Tab. Empty overlays, empty menus, arbitrary Tab-swallowing buttons and multi-candidate stationary dialog containers are rejected. The sampler changes neither focus nor markup and removes its observer in `finally`, including after a native key failure.

## Executed evidence

| Check | Result |
| --- | --- |
| Old 60-only helper with new native controls | 5 FAIL / 5 PASS, direct exit 1 |
| Old helper through the actual registered macro | 1 FAIL / 12 PASS, direct exit 1; all four registered long-history walks remained unclosed |
| Final unit controls | 2 files / 13 PASS, direct exit 0 |
| Final real Chromium controls | 12 PASS, 0 skipped/flaky/unexpected, direct exit 0 |
| Scoped lint / formatting | Direct exit 0 |
| Shared test typecheck after the separate owner repaired its tuple | Direct exit 0 |
| Isolated capacity-rejection mutation | Removing only the rejection makes the repeating-but-changing native control FAIL; original sources remain byte-identical |

The native suite retains all four existing controls and adds eight cases. It covers a 64-node same-name/same-href finite ring in both directions, changing and expanding capacity, same-count node replacement during extra traversal, populated menu content/item focus and arrow access, a close-only dialog in both directions, a real single-input browser boundary, false overlays and observer cleanup. The actual macro execution controls retain 60 presses and 60 active-element reads for every ordinary context; only the selected registered 70-node finite history fixture receives 71 presses, independently for both applications and directions. Every operation retains its continuous Playwright step owner.

The first final shared test typecheck encountered a separate parallel owner's `overlay-anchor-survey.spec.ts:84` tuple inference error. That failed exit and exact error are retained in the receipt; its repair and subsequent shared typecheck are recorded separately. No type failure is suppressed. All detailed logs, JSON and the isolated mutation runner live in [adaptive-traversal](evidence/keyboard-order-independent-stage40/adaptive-traversal/).

This report does not turn the historical full cross-app failure into a PASS, does not claim a new application build, and does not infer whole-tree continuity from the five owned files. Root owns the final real collection count and complete cross-app rerun.
