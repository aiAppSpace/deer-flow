/*
  【文件职责】     真实 Gateway/SQLite 的定时任务 HTTP 与 UI 生命周期。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/run_m0_gateway.py · tests/e2e-scheduled/**
  【边界与注意】   使用真实 scheduler poller；不种 task 数据，测试自行创建。
*/

import {
  defineSuite,
  nuxtPreview,
  m0Gateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_SCHEDULED_PORT ?? "3110";
const gatewayPort = process.env.E2E_SCHEDULED_GATEWAY_PORT ?? "8013";

export default defineSuite({
  name: "e2e-scheduled",
  testDir: "./tests/e2e-scheduled",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    {
      ...m0Gateway({
        port: gatewayPort,
        cors: `http://localhost:${port}`,
        args: ["--scheduler"],
      }),
      env: {
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    },
    nuxtPreview({ port, authDisabled: true, gatewayPort }),
  ],
});
