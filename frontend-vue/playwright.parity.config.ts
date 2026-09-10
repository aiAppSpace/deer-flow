/*
  【文件职责】     把 React 与 Vue 同时架在**同一个** replay Gateway 上，供跨应用对照使用。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/e2e-parity/support/react-preview.ts ·
                   backend/scripts/run_replay_gateway.py · tests/e2e-parity/**
  【边界与注意】   唯一一个需要**兄弟应用**才能跑的套件，所以它既不在 e2e-mock 也不在
                   e2e-backend 里——理由与 external / visual 并列写在
                   tests/guards/e2e-suite-contract.test.ts 的 standalone 集合旁。
                   frontend/ 缺席时不启动 React，用例整组跳过，本模块的独立性不受影响。

                   三个服务器共用一个 Gateway 端口是**判据本身**：两个应用必须看到同一份
                   后端状态，否则后面任何一层比出来的差异都可能只是「两边数据不同」。
                   topology.spec.ts 第一条用例钉的就是这件事。

                   不用 backend 的 mock、也不手写夹具服务：run_replay_gateway.py 是**真**
                   Gateway，模型换成签入的录制回放，已经是 e2e-real / e2e-protocol 等
                   八个套件的确定性后端。手写夹具会随后端演进过期，真 Gateway 不会。
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
  use: PARITY_USE_OPTIONS,
});
