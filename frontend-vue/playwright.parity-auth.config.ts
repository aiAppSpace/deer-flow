/*
  【文件职责】     把 React 与 Vue 同时架在**开着鉴权**的构建上，供登录/安装这两屏对照使用。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/e2e-parity/support/react-preview.ts ·
                   tests/e2e-parity-auth/**
  【边界与注意】   **为什么不能塞进 e2e-parity**：auth 模式是**构建期**决定的
                   （同 playwright.auth.config.ts 的文件头：一个 preview 只能是一种）。
                   wave 189 实测：关掉鉴权时两个应用都把 `/login` 与 `/setup` 直接
                   `replace` 到 `/workspace/chats/new`——主对照套件因此**永远到不了这两屏**，
                   而它们是每个用户看到的第一屏。

                   **三者的 auth 模式必须一致**：Gateway 不设 DEER_FLOW_AUTH_DISABLED，
                   两个前端都 `authDisabled: false`。回放 Gateway 在这种模式下
                   `/api/v1/auth/me` 实测返回 401（wave 192 量过），
                   `/api/v1/auth/setup-status` 返回 `needs_setup: true`
                   ——**那正是「确实没有会话」的状态**，也正是这两屏要比的前提。

                   ⚠ **场景一律 `backend: "gateway"`，绝不能用 mock**（wave 193 的教训）：
                   `tests/e2e/utils/mock-api.ts` 对 `GET /api/v1/auth/me` 返回 200 +
                   MOCK_AUTH_USER（它的用途是让工作区用例不依赖真实会话）。装上它之后
                   Vue 的 `login.vue` 在 `onMounted` 里探到「已登录」就跳去工作区，
                   而 React 的登录页不问这个端点、留在原地——wave 191 因此录到一份
                   「两边完全不同」的基线，那记的是夹具不是差异，已整体撤回。
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

const port = process.env.E2E_PARITY_AUTH_PORT ?? "3117";
const reactPort = process.env.E2E_PARITY_AUTH_REACT_PORT ?? "3118";
const gatewayPort = process.env.E2E_PARITY_AUTH_GATEWAY_PORT ?? "8022";

process.env.E2E_REACT_APP_URL ??= reactAppUrl(reactPort);

export default defineSuite({
  name: "e2e-parity-auth",
  testDir: "./tests/e2e-parity-auth",
  port,
  gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
  serial: true,
  timeout: 180_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: { DEERFLOW_ENABLE_TEST_SEED: "1" },
    }),
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
    ...(reactAppPresent
      ? [reactPreview({ port: reactPort, authDisabled: false, gatewayPort })]
      : []),
  ],
  use: PARITY_USE_OPTIONS,
});
