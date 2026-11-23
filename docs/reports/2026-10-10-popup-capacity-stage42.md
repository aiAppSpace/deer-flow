# Model and reference popup capacity — Stage42

Current source was frozen at **2026-10-10 10:37:00 CST**. The exact eight production and six test paths, hashes, modification times and direct exits are in [source-freeze.json](evidence/triple-popover-independent-stage42/source-freeze.json). No baseline, shared scenario, survey threshold, API contract, selection rule or font size was changed. The new formal suite adds **12 cases in one file**, six existing terminal states for each frontend; the original 211-state macros remain intact.

**Final uniform Next/Nuxt compiled acceptance of these 12 cases is UNRUN.** Isolated causal injection into an old build is diagnostic evidence and is not acceptance of the current product. The remaining React causal-injection failure is retained rather than converted into PASS.

## Proven causes

### Open model popovers retain an obsolete overflow-ancestor subscription

The installed Floating DOM `autoUpdate` computes its overflow ancestors when opened. If the menu opens on desktop before a breakpoint creates an ancestor scroller, that new scroller is absent from the original subscription. Its `observeMove` zero-intersection fallback retries after 1000ms. Native wheel moved the real model trigger while the popup initially retained its previous coordinates; continuous sampling subsequently observed an update after about 705ms in Vue and 459ms in React. Thus this is a delayed update, not a permanent lack of update. Closing and reopening after the ancestor was already scrollable removed the delay.

The timing evidence is in `evidence/triple-popover-independent-stage42/timing-final-results.{log,json}` and `{vue,react}-overflow-ancestor-causality.json`. The earlier scratch React selector failure remains in `timing-results.log`.

The delayed subscription also exposed a separate capacity problem: when the real trigger was below the 360px viewport, its tethered popup extended below the viewport and its last model/star could not be fully reached through the internal scroller. Merely revealing the real trigger without causing an immediate primitive update still failed six original surveys (`reveal-results.*`). Revealing it plus a resize event made those six old-build causal surveys pass (`reveal-update-results.*`). Synthetic resize is diagnostic only and is not used by the product.

The product uses the public **`updatePositionStrategy="always"`**, active only while the picker exists/open, plus the existing native-reference retention contract. When both the real trigger and content leave their actual intersected clipping area, the retention owner reveals that real trigger with native `scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})`. The primitive continues to own coordinates, keyboard focus and placement. No virtual rectangle, clamped reference, manual translation or focus transfer was introduced. Layout subscriptions and pending animation frames retire on close/unmount.

### Radix Popover and Dropdown expose different public reference relations

The first real React source bundle remained RED because the existing dropdown retention hook looked only at `aria-labelledby`. Installed Radix Popover does not use that relation for its trigger: its Trigger exposes `aria-controls=Content.id`. Therefore directly assuming that a Popover could reuse the dropdown lookup was wrong.

The hook keeps its original Dropdown `aria-labelledby` path. Its Popover fallback requires an exact content ID, exactly one connected matching controller and `aria-haspopup="dialog"`; absent, mismatched, ambiguous or non-trigger controllers do not produce a guessed reference. The standard `isConnected` fence protects a subsequently unmounted trigger. A real mounted Popover reproduced zero reveal calls before the change (`react-popover-reference-red.log`, 1 FAIL/6 PASS). The current combined actual consumer regression passes 67 assertions, including the original five Dropdown cases, real Popover caller focus, missing/mismatched/ambiguous/non-trigger relations and trigger retirement.

### Reference picker side space was smaller than one real option

At 360×360 with a 32px root font, the old composer occupied roughly y120…590. The outer reference picker received only 100px above it while real research/Alice options were 104px tall. Native arrows and wheel could scroll the picker, but no scroll position could fully fit such a row. Native outer scrolling could reduce the old anchored maximum to zero. Both frontends reproduced the same failure.

The shared-shaped, framework-local placement functions now measure the tallest actual interactive control. If neither anchor side can hold it, the same complete picker participates in the existing composer/native pan, bounded by the real visible clipping intersection minus the existing 4px edge on each side. When an anchor side fits again, normal anchored positioning returns. The composer observes the actual picker child alongside its existing root/ancestors so its measured content participates in reflow. Controls, selection, draft and labels are retained.

The original six reference surveys were RED. A normal-flow capacity candidate made all six original surveys GREEN (`inline-results.*`), without reducing fonts, hiding content or altering thresholds. Actual current Vue/React composer DOM tests verify inline/anchored transitions and observer retirement. The old-build injected-helper experiments are separately bounded below.

## Native and test evidence

| Execution | Direct exit | Observed result |
| --- | ---: | --- |
| Vue focused current tests | 0 | 4 files, 49 PASS |
| React focused current tests | 0 | 3 files, 67 PASS |
| Current actual-source model microbundles | 0 | 2 native cases; each has old-policy RED/current GREEN |
| Final formal source on old immutable build | 1 | All 12 cases RED at the original survey capacity assertion; expected negative evidence |
| Formal collection | 0 | 12 tests in one file |
| Vue application and test types | 0 | Both current typechecks pass |
| React current full types | 0 | Pass; an earlier concurrent project-page editing error is preserved separately |
| Both scoped lint/format checks | 0 | Pass |
| Uniform fresh compiled formal 12 | — | **UNRUN** |

The current model microbundles load the real model components, primitives and retention owners, with only session/i18n domain fixtures. They use each frontend's compiled CSS and native Chromium. The negative variant disables only the new retention/public-always policy, not the entire old tree. Both negative variants reproduce lost controls. Both current variants pass the original survey, native Arrow traversal, wheel scrolling, real reference/popup tether after outer wheel, Escape/reopen and exact zero desktop rectangle differences across every measured main/button/dialog/group/row node. The final bundle input hashes are in `native-model-inputs.json`; result/trace files use the `native-model-frozen-*` prefix. This is actual source component proof, not a claim that the whole application has been rebuilt.

The final formal spec is `frontend-vue/tests/e2e-parity/popup-capacity-reflow.spec.ts`. Each case uses a fresh context and fails on any unmatched API request. It opens the existing scenario before the breakpoint creates the scroll owner, then applies the original 360×360/32px condition. It retains model names, selected state, favorites and every reference option including Upload; exercises native wheel and Arrow; checks every clip ancestor with the existing survey's 0.5px native boundary; and preserves the complete original survey (`24`, horizontal document allowance `1`, zero lost/clip/scroller rows). Exact intersection ratios and rectangles remain attached for diagnosis. A measured 1/64px native scroll rounding produced ratios `.999822`/`.999699`; no pixel compensation was added. Wheel reaching the reference footer is not assumed to keep the preceding Upload row visible: Arrow traversal verifies every complete option after the wheel boundary checks.

## Retained failures and causal limits

The older candidate runs, traces and screenshots are retained in `evidence/triple-popover-independent-stage42/`:

- `formal-old-results.*` and final `formal-old-frozen-results.*`: original actual build, 12/12 RED, no API leakage.
- `native-model-results.*`: initial microharness lacked React's real max-height CSS; this is a harness failure, preserved.
- `native-model-final-results.*`: after correct CSS, Vue passed while React's missing public reference lookup remained genuinely RED; fixed by the exact ARIA relation above.
- `formal-causal-results.*`: a scratch CommonJS `require` in an ESM test and an over-exact newly added intersection ratio check; neither is product evidence.
- `formal-causal-mentions-results.*`: the incorrect scratch assumption that Upload must remain visible when the picker is wheeled past it to its footer, plus exact native rounding.
- `formal-causal-complete-results.*`: 11 PASS/1 FAIL. Old React asynchronous rendering overwrote the injected new helper's maximum with its old 84px maximum while the diagnostic retained the new inline class.
- `formal-causal-owner-exclusive-results.*` and `formal-causal-coexisting-diagnostic.*`: still 11 PASS/1 FAIL and a retained exact Upload geometry. An old component render/effect can temporarily restore absolute placement before its old active-option `scrollIntoView`, after which injection restores flow and shifts the target. This is not the atomic current `setMentionPlacement({above,inline,maxHeight})` implementation. It does **not** prove current compiled coexisting behavior; the formal new-build test is the required next judge.

No attempt was made to make that old-build injection green by weakening the formal test. The original old source and shared live services were never modified. Repro tooling is archived under `evidence/triple-popover-independent-stage42/tools/`; the input receipts distinguish temporary old compiled CSS from current component bytes. No application build, full unit run, backend write or unrelated port operation was performed for this repair.
