# Chat-list capacity root repair — Stage 42

Production froze on 2026-10-10 10:22:49 CST; the final direct-mount test host and receipt froze on 2026-10-10 10:30 CST. This report covers the chats-index capacity owner and its focused regressions. It does not claim the final complete cross-app, Linux, container or standalone gates have run on this source.

## Source and root cause

The existing page constrained the list beneath a fixed breadcrumb, tabs and search header. At a 360×360 viewport with a 32px root font, both implementations produced a 159px ScrollArea root whose external `py-4` left a 95px viewport. Each complete chat link was about 168px high. Native start/center/end scrolling cannot fit a complete control into a smaller physical scrollport.

The original registered states were retained:

| State | Vue lost controls | React lost controls |
| --- | ---: | ---: |
| thread-archive default | 50 | 50 |
| thread-list-infinite-scroll default | 50 | 50 |
| thread-activity unread-list | 2 | 2 |

The same complete-control assertion failed in all six old compiled contexts. Original logs, traces, screenshots and geometry remain under `docs/reports/evidence/triple-chat-list-capacity-stage42/baseline*`. No old preview source, listener or shared Gateway data was changed; every independent context installed an unmatched-API abort boundary before its scenario mocks.

## Production repair

- `frontend-vue/app/pages/workspace/chats/index.vue` and `frontend/src/app/workspace/chats/page.tsx` add a size container and a native outer pan to this page only. When its actual height is below 28rem, tabs use natural height and the existing inner list viewport has a bounded `100dvh` height. The breadcrumb, tabs and search can retire through the outer page pan. The original ScrollArea viewport remains the physical list and virtualizer owner.
- Only at that height breakpoint, `py-4` moves from the ScrollArea root to its scrollable content. It no longer consumes the complete viewport's capacity. Normal desktop layout retains its previous padding responsibility, viewport, scrollbar and content geometry.
- `frontend-vue/app/components/workspace/VirtualThreadList.vue` now observes that original viewport and its direct children, matching React's existing resize lifecycle. Unchanged rows can acquire a new scroll margin when padding or preceding sections reflow. The watcher rebinds across the static/virtual threshold and cancels retired observers; late callbacks cannot publish an old margin.

The 28rem breakpoint follows the existing height-responsive application capacity boundary and scales with the root font. The list uses the actual window height as its upper bound, so a complete control which fits the window can be exposed after the outer header scrolls away. Neither fonts nor content are shrunk or hidden. There is no second list `scrollTop` writer, global wrapper change, measurement-table substitution or virtualization bypass.

Architecture facts are recorded in `frontend-vue/ARCHITECTURE.md` and `frontend/docs/responsive-capacity-contracts.md`.

## Actual verification

| Verification | Actual result | Boundary |
| --- | --- | --- |
| Old compiled complete-control baseline | 6 FAIL, direct exit 1 | Expected defect reproduction, both apps and all three original states |
| Old mounted margin lifecycle | 2 FAIL, direct exit 1 | Same finalized async fixture; offset 0→32 with unchanged 100 rows remains stale and no observer retires |
| Final focused mounted + pure core | 2 files / 6 PASS, direct exit 0 | Three mounted ownership cases plus existing three margin/threshold core cases |
| Native causal layout / desktop geometry | 6 PASS, direct exit 0, 12.2s | Existing immutable compiled apps with equivalent candidate CSS; not a fresh application build |
| Formal two-app scope with installed Tailwind output | 2 PASS, direct exit 0, 11.4s | Exact new source utility classes injected into old compiled apps; fresh Vue resize-observer production bundle is not covered by this injection |
| Vue app types / all test types | Both direct exit 0 | No suppressed type diagnostics |
| Vue / React scoped ESLint | Both direct exit 0 | Changed component, pages and test files |
| Vue / React format checks | Both direct exit 0 | All seven source/test/documentation paths; parent owns subsequent documentation review |
| Formal registration | 2 tests / 1 file, direct exit 0 | Existing parity config; no new budget, skip or exemption |

The final six native cases preserve the original inner viewport identity, have zero strict-survey horizontal overflow, lost controls and unreachable clips, and reveal the first real row through Shift+Tab/Tab with intersection ratio 1. Native wheel movement reaches `scrollTop=360` for archive/infinite lists and `42` for the two-row unread list.

Whole-page desktop snapshots compare every existing descendant's rectangle, `clientHeight` and `scrollHeight`, including the real scrollbar after hover for overflowing lists. There were zero differences across Vue's 740/390/71 nodes and React's 741/391/72 nodes. Naturally short unread lists retain no scrollbar. The final receipt includes their geometry JSON paths.

The new formal file `frontend-vue/tests/e2e-parity/chat-list-capacity-reflow.spec.ts` keeps all three original scenarios and their settlement/actions. It checks nonempty rows, complete native focus, actual wheel movement, the original strict survey and unchanged viewport identity. Its infinite-list branch uses the real wheel and existing sentinel to fetch a second page, requires virtual rows, and checks the focused row by stable thread identity. It does not query a moving `.first()` locator after the virtual window has changed.

## Preserved diagnostic boundaries

Intermediate probe failures remain archived:

- The first wheel probe read `scrollTop` before the asynchronous wheel event had been processed. Polling the actual native owner demonstrated movement without changing any product behavior or assertion threshold.
- An early mounted fixture inspected a post-flush watcher before Vue's next tick. The finalized fixture was run against both the old and new owner; the valid old-source negative control is `virtual-margin-red2.log`.
- After a survey moved scroll positions, refocusing an already active node was a native no-op. The formal regression now performs real Shift+Tab/Tab re-entry. Its virtual-row check uses stable `href` identity because a changing first-rendered-row locator refers to a different physical control after scrolling.
- An intermediate desktop probe incorrectly required a scrollbar on the naturally short unread list. The final probe verifies its actual overflow condition and unchanged no-scrollbar state instead of fabricating overflow.
- Initial all-test type errors from another owner's combined-survey changes were retained. The final all-test type run completed with direct exit 0 after those changes and this fixture directly mounted the generic SFC into native parent elements with a typed slot. The temporary typed SFC host was removed; no component cast, `any`, ignored diagnostic, scanner change or new inventory exemption remains.

Fresh Next/Nuxt compilation of the two formal cases and the complete required gates remain **UNRUN** for this source at this freeze. Parent orchestration owns those runs. CSS-injection causal evidence is not substituted for compiled consumer acceptance.

Exact seven-path SHA-256 entries, final production timestamps and actual direct exits are in `docs/reports/evidence/triple-chat-list-capacity-stage42/source-final-freeze.json`.
