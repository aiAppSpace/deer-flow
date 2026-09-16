/*
  【文件职责】     以生产模式启动兄弟 React 应用，让它与 Vue 指向同一个 replay Gateway。
  【架构位置】     对照测试基础设施（只有 parity 套件用）
  【主要导出】     reactAppPresent · reactAppUrl · reactPreview
  【依赖关系】     ../../../../frontend（缺席时 parity 套件整组跳过）· @playwright/test
  【边界与注意】   这是 frontend-vue 里**故意**指向兄弟应用的少数几处之一，所以它放在
                   tests/e2e-parity/ 里而不是 tests/support/：共享工厂被每一个套件
                   import，把一个 `../frontend` 字符串放进去，会让「本模块不依赖兄弟
                   应用」这件事从目录层面再也看不出来。

                   两边都**不设** NEXT_PUBLIC_* / NUXT_PUBLIC_* 的绝对 Gateway 地址，
                   只给 DEER_FLOW_INTERNAL_GATEWAY_BASE_URL。这不是图省事：React 的
                   next.config rewrites 与 Vue 的 Nitro catch-all 都只在这个变量存在、
                   且对应公开变量缺席时才接管 `/api/*`（见 frontend/next.config.js 的
                   rewrites()）。于是两个应用各自走**自己的生产同源代理**打到同一个
                   Gateway：浏览器侧没有跨域也没有 CORS，两边的请求序列因此可以直接
                   对照——这正是后面网络层比对能成立的前提。

                   用 ./node_modules/.bin/next 而不是 pnpm，与 nuxtPreview 的做法一致：
                   套件不该要求 pnpm 在 PATH 上。
*/

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { WebServerEntry } from "../../support/playwright-factory";

const reactRoot = fileURLToPath(
  new URL("../../../../frontend/", import.meta.url),
);

/** 兄弟应用在不在 checkout 里。缺席时 parity 套件不启动它，用例整组跳过。 */
export const reactAppPresent = existsSync(`${reactRoot}package.json`);

/*
  **跳过是对开发机说的，不是对 CI 说的。**

  parity 的四份 spec 每一份开头都是 `test.skip(!reactAppPresent, …)`。
  在开发机上这是对的：本模块的独立性判据要求 `../frontend` 缺席时一切照常
  （见 make standalone-check / standalone-sim）。
  但同一行搬到 CI 上就变成了这个项目反复踩的那种门——**156 条全跳过、退出 0、
  一片绿，而什么都没量**。`e2e-visual` 悄悄红了三个提交、
  `invented-palette-colors` 在收集期读兄弟应用红了二十轮，都是这个形状。

  所以 CI 把 `PARITY_REQUIRE_REACT=1` 打开：缺席时**在配置加载那一刻就炸**，
  而不是安静跳过。判据用的是 `reactAppPresent` 本身——写成工作流里的
  `test -f frontend/package.json` 就成了第二把尺子，它绿不代表这把尺子绿
  （比如 reactRoot 算错了路径）。

  门禁：tests/guards/tooling-contracts.test.ts 钉「跑 parity 的 CI job 设了这个变量」，
  tests/unit/parity/react-presence.test.ts 钉这段逻辑本身。
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
