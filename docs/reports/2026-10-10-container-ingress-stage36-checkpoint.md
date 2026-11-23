# Stage36 isolated Docker ingress checkpoint

Recorded 2026-10-10 05:05 CST. This is an exact historical source checkpoint, not the final current-source acceptance: the later Settings dialog capacity and generic React Dropdown fixes require both final images to be rebuilt and revalidated.

## Inputs and images

- Complete physical isolated context: 2901 inputs, SHA256 `8b9ce4a43700b3f7045bc1d9a02b89c07683645d8cc49771e43205fc5401ac92`.
- Canonical Dockerignore: SHA256 `a826e200a2b17254a17acd3085734f9c29c3d3e76cc85f06717375dc4fe0290f`, unchanged.
- Actual BuildKit scratch COPY export: 2900 module files, SHA256 `4bab3ec0a937472d2c16f231c87905202c0bea80c40339455ada0e44d776e7e7`. Dockerignore is a separate engine instruction. These receipts describe actual byte membership, not semantic compiler consumption or network transfer totals.
- Vue canonical image: `sha256:ecaa55a210f126ea1849859ef97f91114b85c87a45ddc19c68eddba2ca25220f`, direct exit 0.
- React canonical production image: `sha256:c2a4d04c5e00e4d5dfb4a8936e4aea919d7703bf965caa2f6e479e7921c481b7`, direct exit 0.
- Existing Gateway image reused only after current/source-copy comparison of 894 production files passed: SHA256 `f9b69382f64f5c78b7fc1b36bbdab14af33d00f8391215032d62e0b55ba44740`. New IdP behavior is a frontend-owned controlled fixture; no backend or product-auth source changed.

The strict current-repository fence correctly failed before any service start when four test/gate inputs changed. That failure is preserved. Runtime probes subsequently used a separately verified immutable image context and actual byte-fenced probe inputs, with current source drift recorded. The historical context receipt was never overwritten or silently accepted as current.

## Actual runtime results

| Gate | Actual result |
| --- | --- |
| Public Nginx → Vue / real Gateway password/session/CSRF/API/SSE/upload/download | PASS, direct exit 0 |
| Private Nuxt proxy → real Gateway | PASS, direct exit 0 |
| Public real browser-tool WebSocket | PASS, direct exit 0 |
| Real production Nginx dual-host OIDC authorization/callback | PASS, final checked-in probe direct exit 0 |
| Canonical Vue container smoke (nonroot, health, showcase, resource 404) | PASS, direct exit 0 |
| Actual Docker lifecycle | Signal 15 → die exit 0 → destroy; no signal 9 |
| Running image/health/Compose labels/loopback/readonly mount receipts | PASS, direct exit 0 |

Only project `deerflow-vue-ingress-00aff39027` was started. Nginx publishes `127.0.0.1:2326`; the controlled IdP publishes `127.0.0.1:2386`. Frontend/Gateway ports remain internal. SQL state was retained; no unrelated project or tracked runtime configuration was changed.

## OIDC probe correction and evidence boundary

The first real probe failed because Playwright deliberately skips route handlers for redirected requests; both applications had already completed real callbacks, so the intended simultaneous pending-state assertions were not executed. A native Chromium Fetch-domain pause now observes each actual redirected IdP authorization hop and resumes the original request. It never fulfills a response or changes IdP/auth product code.

The next strict assertion exposed a second probe error: `context.cookies(origin + '/')` omits the real state cookie, whose path is `/api/v1/auth/callback/m0idp`. All pending, mismatch-preservation and consumed-state reads now use that actual callback URL. The final checked-in probe preserves every original expectation and passes simultaneous independent host-only signed state cookies, wrong-host state 403 without correct-state consumption, real code/PKCE/nonce exchange, each own Gateway and frontend callback, same SQL owner, HttpOnly/CSRF, expected-owner preferences and reload stability. Final probe SHA256 is `f2bdcb0ca7727e60492ab43dc53211ca8eade398a3f02cfce9f5a34145115877`. Fixture units: 8 passed / 0 skipped; test types, lint, formatting and syntax all exited 0. Default Playwright collection changed by zero cases.

Full source/COPY/image/artifact/mount receipts, safe runtime results, retained RED logs and phase exits are in [checkpoint-execution-receipt.json](evidence/container-ingress-stage36/checkpoint-execution-receipt.json). OIDC cookies, state, codes, tokens and client secrets are not exported into the report. This checkpoint does not prove external DNS/TLS or a remote IdP deployment, and cannot stand in for the final current-source full cross-app/211-state/751-key gates.

## Fixture stop supplement — 2026-10-10 05:18 CST

Normal stopping of the dedicated project retained all SQL state and released both published ports. Vue/Gateway/Nginx exited 0, React exited 143, and the controlled IdP exited 137. The IdP receipt shows direct Python PID 1, no entrypoint wrapper or Docker init, default SIGTERM, and no OOM. This historical 137 is retained separately from the mandatory Vue smoke's proven signal 15 → exit 0 result.

The controlled fixture overlay now sets `init: true`, forwarding the native Docker signal to Python. Only `prepare_container_oidc.py` and its existing overlay regression changed; no product, production Compose, backend or `run_m0_idp.py` input changed. The old overlay produced a real 1-failed/2-passed RED; the updated affected fixture suite passed all 8 tests, and test types/lint/format/syntax exited 0. A one-off container using the actual generated IdP command/config, with no network or published port, passed its real HTTP health check and stopped in 0.118 seconds with exit 143; actual events contain signal 15 and no signal 9. The temporary proof container was removed. [The supplementary receipt](evidence/container-ingress-stage36/idp-init-fixture-freeze.json) links those checks and native events. Full final-context Docker ingress/OIDC revalidation remains UNRUN until the unified source/build window.
