/*
 * Product parity runs both production frontends against one replay Gateway.
 * Formal Make targets require React at config load; standalone verification
 * uses its own suites. Each frontend exercises its production same-origin proxy.
 */

import { PARITY_USE_OPTIONS } from "./tests/e2e-parity/support/context-options";
import {
  reactAppPresent,
  reactAppUrl,
  reactPreview,
} from "./tests/e2e-parity/support/react-preview";
import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_PARITY_PORT ?? "3115";
const reactPort = process.env.E2E_PARITY_REACT_PORT ?? "3116";
const gatewayPort = process.env.E2E_PARITY_GATEWAY_PORT ?? "8021";

function requestedBrowserChannel(): "chromium" | "chrome" {
  const channel = process.env.E2E_PARITY_BROWSER_CHANNEL;
  // Use the full browser's native document/frame focus traversal. The separate
  // headless shell loops back into a terminal iframe after leaving the page.
  if (channel === undefined || channel === "") return "chromium";
  if (channel === "chrome" || channel === "chromium") return channel;
  throw new Error(
    `Unsupported E2E_PARITY_BROWSER_CHANNEL=${channel}; expected bundled full Chromium or installed stable Chrome`,
  );
}

const browserChannel = requestedBrowserChannel();

// 对照用例要用绝对 URL 同时访问两个应用，React 那一侧从这里取地址。
process.env.E2E_REACT_APP_URL ??= reactAppUrl(reactPort);

export default defineSuite({
  name: "e2e-parity",
  testDir: "./tests/e2e-parity",
  port,
  gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
  serial: true,
  timeout: 180_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: true, gatewayPort }),
    ...(reactAppPresent
      ? [reactPreview({ port: reactPort, authDisabled: true, gatewayPort })]
      : []),
  ],
  // 取样条件与 diff.spec.ts 为每个场景新开的 context 共用一份，见该文件头。
  use: {
    ...PARITY_USE_OPTIONS,
    channel: browserChannel,
  },
});
