# Real socket stream fixture repair — Stage39

The repair changes three test files. Product code, dependencies, execution budgets, the six browser cases and their existing assertions are unchanged. The final source hashes and direct results are in [the freeze receipt](evidence/capabilities-final-stage38/repair-round-2/stream-fixture-freeze.json).

## Preserved failure

The complete original `make -j1 -C frontend-vue e2e-mock e2e-backend e2e-external` stopped at the real stream suite: 512 product, 25 authentication, 15 infrastructure and 2 proxy-options cases passed; all 6 stream cases failed. Backend and external suites were not reached. This is retained in [aggregate.log](evidence/capabilities-final-stage38/repair-round-2/aggregate.log), its receipt and the six complete trace/video/screenshot/error-context directories under `stream-mock-failure/e2e-stream`.

The plain-stream trace proves the identity mismatch: create accepted client UUID `f7d254a4-ce8d-4b0d-a485-77aebb90b79d`, but the run's Content-Location and metadata advertised `00000000-0000-0000-0000-0000000000a1`. Subsequent reads followed that unrelated identity while the route retained the client UUID. The stub also returned an object for thread search and empty content for durable reads. Actual Gateway creation preserves a supplied thread ID; actual run headers and metadata use that thread's identity.

## Repair

- The socket stub retains each created thread independently and uses that thread's actual ID in metadata, Content-Location, task streams, resume, state and history. Search returns a thread array; repeated creation retains its existing state. Unknown-thread run requests return 404.
- Submitted human message IDs and content are preserved. The intentional AI-before-human transport order remains, while the durable checkpoint preserves canonical human-before-assistant order and accumulated content.
- Completed durable AI messages carry their actual run ID and elapsed integer `additional_kwargs.turn_duration`, matching the Gateway's completed-history shape. This independent omission has its own real HTTP negative regression.
- Browser selectors follow the current physical row then logical group structure. The retry check consumes the actual WorkspaceToaster message and waits for its own expiry; it does not infer dismissal from task completion.

The first browser supplement passed five cases and exposed the old duration locator; the second also passed five. The failed DOM already contained “Took <1s”: the duration is a sibling before the AI content inside the same physical row. Its visibility assertion now anchors to that owning row, explicitly asserts row index 1, and retains the AI-role/order assertions. The missing durable fields are an independent protocol correction, **not the cause of this locator failure**. Both intermediate failures and their traces remain preserved.

## Direct verification

| Check                                                | Actual result                                             |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Original native HTTP/SSE identity regressions        | 5 FAIL, direct 1                                          |
| Identity repair                                      | 5 PASS, direct 0                                          |
| Completed-duration negative regression before repair | 3 FAIL / 2 PASS, direct 1                                 |
| Final real HTTP/SSE regression                       | 5 PASS, direct 0, 4.37 seconds                            |
| Final complete real socket browser suite             | 6 PASS, direct 0, 14.7 seconds, no skipped or flaky cases |
| Test TypeScript, scoped ESLint, formatting           | Each direct 0                                             |

The browser supplement reused the existing compiled Nuxt output without a build. Both test-owned servers used actual HTTP sockets and Nitro forwarding; SSE responses were not fulfilled or mocked by Playwright. The final browser JSON/log are `stream-native-complete-browser.{json,log}` under the receipt directory.

[AST comparison](evidence/capabilities-final-stage38/repair-round-2/stream-assertion-preservation.json) compares the exact original aggregate source hash: all 30 original in-case matcher methods and arguments remain, including text, ordering, task/model/token details, focus, scroll and cursor checks. Both shared helpers are identical in the AST, preserving their additional assertion: 31 original assertions become 32 solely through the added row-identity check. No timeout or browser case count changed.

## Remaining final acceptance boundary

After this fixture freeze, a fresh complete Vue verify/asset run and the complete mock → backend → external aggregate remain pending the coordinated standalone quiet window. The focused results above do not stand in for those aggregate runs. Root's active immutable cross-app copy does not execute this socket fixture and was left running unchanged. Docker's COPY includes test files, so these three paths are an explicit final input drift relative to its prior checkpoint; production runtime files are unaffected.
