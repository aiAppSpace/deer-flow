/*
 * React production build and server for cross-app parity. Browser requests use
 * the frontend same-origin proxy to the shared replay Gateway. This sibling
 * dependency belongs to parity support, outside standalone portable suites.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { WebServerEntry } from "../../support/playwright-factory";

const reactRoot = fileURLToPath(
  new URL("../../../../frontend/", import.meta.url),
);

/** Detect the sibling checkout; formal Make targets require it before collection. */
export const reactAppPresent = existsSync(`${reactRoot}package.json`);

/*
 * Formal Make targets and CI set PARITY_REQUIRE_REACT=1. Check the same resolved
 * React path used by the server so a missing sibling fails during config load.
 * Direct portable runs may leave the requirement unset and skip parity specs.
 */
export function assertReactAppPresentIfRequired(
  present: boolean = reactAppPresent,
  required: boolean = process.env.PARITY_REQUIRE_REACT === "1",
): void {
  if (!required || present) return;
  throw new Error(
    `PARITY_REQUIRE_REACT=1，但兄弟 React 应用不在 checkout 里（找的是 ${reactRoot}package.json）。` +
      "对照套件此时会整组跳过并退出 0——那是一条量不到任何东西的绿。",
  );
}

assertReactAppPresentIfRequired();

export function reactAppUrl(port: string) {
  return `http://localhost:${port}`;
}

/** frontend/ 的生产构建 + 启动，同源代理指向 gatewayPort 上的 replay Gateway。 */
export function reactPreview(options: {
  port: string;
  /** 必须与 Gateway 和 Vue 侧的 auth 模式一致，否则两个应用看到的不是同一个用户。 */
  authDisabled: boolean;
  gatewayPort: string;
}): WebServerEntry {
  return {
    command: "./node_modules/.bin/next build && ./node_modules/.bin/next start",
    cwd: reactRoot,
    url: reactAppUrl(options.port),
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: options.port,
      // React 的 env schema 在 CI 之外会拒绝空值；构建产物本身不依赖它们。
      SKIP_ENV_VALIDATION: "1",
      BETTER_AUTH_SECRET: "parity-fixture-secret",
      DEER_FLOW_AUTH_DISABLED: options.authDisabled ? "1" : "0",
      DEER_FLOW_INTERNAL_GATEWAY_BASE_URL: `http://127.0.0.1:${options.gatewayPort}`,
    },
  };
}
