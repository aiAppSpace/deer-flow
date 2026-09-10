/*
  【文件职责】     Playwright config 的共享装配层：把「起哪些服务器」与「测什么」分开声明。
  【架构位置】     测试基础设施
  【主要导出】     nuxtPreview / replayGateway / m0Gateway / defineSuite
  【依赖关系】     @playwright/test
  【边界与注意】   每个套件仍是一份独立 config，因为它们的**后端拓扑真的不同**：
                   gateway 二进制不同（run_m0_gateway vs run_replay_gateway）、
                   seed 环境变量不同（channels / agents / settings / runs 各一套）、
                   前端 auth 模式不同。合并它们等于改变被测行为。
                   这一层消除的是复制，不是差异——差异必须在各自 config 里显式写出来。
*/

import { defineConfig, devices } from "@playwright/test";

import type { PlaywrightTestConfig } from "@playwright/test";

type WebServer = NonNullable<PlaywrightTestConfig["webServer"]>;
/*
  取联合里**数组那一支**的成员类型。

  原来写的是 `WebServer extends readonly (infer T)[] ? T : never`——条件类型在
  联合上会分配，非数组那一支求出 `never`，于是整体塌成 `never`，
  四份 config 里的 `servers: [...]` 全部「不能赋给 never」。
  运行时一直是对的；**类型上一直是错的，而 `tests/` 不在 typecheck 里，没人说话。**
*/
export type WebServerEntry = Extract<WebServer, readonly unknown[]>[number];

const isCI = Boolean(process.env.CI);

/** Nuxt production preview。build 与 preview 必须拿到同一组 NUXT_PUBLIC_*，否则产物与运行时不一致。 */
export function nuxtPreview(options: {
  port: string;
  /** 前端的 auth 模式。真实 Gateway 套件里它必须与 Gateway 的 auth 设置一致。 */
  authDisabled: boolean;
  /** `__m0` 测试页面。只有代理/协议这类基础设施套件需要。 */
  m0TestPages?: boolean;
  /** 同源代理指向的 Gateway。留空表示套件自己用 page.route() mock。 */
  gatewayPort?: string;
  /** 额外的 NUXT_PUBLIC_*，build 与 preview 都会拿到。 */
  publicEnv?: Record<string, string>;
}): WebServerEntry {
  const shared = {
    NUXT_PUBLIC_AUTH_DISABLED: options.authDisabled ? "1" : "0",
    ...(options.m0TestPages === undefined
      ? {}
      : { NUXT_PUBLIC_M0_TEST_PAGES: options.m0TestPages ? "1" : "0" }),
    ...options.publicEnv,
  };
  const prefix = Object.entries(shared)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  const internal = options.gatewayPort
    ? `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${options.gatewayPort} `
    : "";
  return {
    command:
      `${internal}${prefix} ./node_modules/.bin/nuxt build && ` +
      `PORT=${options.port} HOST=127.0.0.1 ${prefix} ./node_modules/.bin/nuxt preview`,
    url: `http://localhost:${options.port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  };
}

/** backend/scripts/run_replay_gateway.py —— 真实 FastAPI Gateway，走签入的 replay fixture。 */
export function replayGateway(options: {
  port: string;
  cors: string;
  /** 该套件需要的 seed 开关。每个套件只开自己那一个，见文件头。 */
  env?: Record<string, string>;
}): WebServerEntry {
  return {
    command: `uv run python scripts/run_replay_gateway.py --port ${options.port} --cors ${options.cors}`,
    cwd: "../backend",
    url: `http://127.0.0.1:${options.port}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    ...(options.env ? { env: options.env } : {}),
  };
}

/** tests/support/run_m0_gateway.py —— 本仓自有的 Gateway 包装，可控事件保留窗口与浏览器工具。 */
export function m0Gateway(options: {
  port: string;
  cors: string;
  args?: string[];
  pipeOutput?: boolean;
}): WebServerEntry {
  const args = options.args?.length ? ` ${options.args.join(" ")}` : "";
  return {
    command: `../backend/.venv/bin/python tests/support/run_m0_gateway.py --port ${options.port} --cors ${options.cors}${args}`,
    url: `http://127.0.0.1:${options.port}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    ...(options.pipeOutput
      ? { stdout: "pipe" as const, stderr: "pipe" as const }
      : {}),
  };
}

/**
 * 一个套件 = 一个 testDir + 一组服务器。
 *
 * `serial` 给共享进程级状态的套件用：真实 Gateway 的数据、stub server、
 * 截图基线、登录态都不是每个测试一份，并发会互相踩（auth 套件实测：
 * 并行 4 红，workers=1 全绿）。只有各自用 page.route() 自带 mock 的
 * 产品合同套件可以按文件并行。
 */
export function defineSuite(options: {
  name: string;
  testDir: string;
  port: string;
  /** 需要绝对 URL 访问 Gateway 的套件在这里声明；spec 读 E2E_GATEWAY_URL。 */
  gatewayUrl?: string;
  servers: WebServerEntry[];
  serial?: boolean;
  timeout?: number;
  globalSetup?: string;
  expect?: PlaywrightTestConfig["expect"];
  grep?: RegExp;
  /** 套件专属的 use 覆盖，合并在默认值之后。跨应用对照需要把时区、动画和配色钉死。 */
  use?: PlaywrightTestConfig["use"];
}) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${options.port}`;
  process.env.PLAYWRIGHT_BASE_URL ??= baseURL;
  // 需要用绝对 URL 发 API 请求的 spec 从这里拿地址，而不是各自去读一个
  // 按套件命名的端口变量——那样每挪一次套件就要同步改 spec、Makefile 和 config 三处。
  process.env.E2E_APP_URL ??= baseURL;
  if (options.gatewayUrl) process.env.E2E_GATEWAY_URL ??= options.gatewayUrl;
  return defineConfig({
    testDir: options.testDir,
    fullyParallel: !options.serial,
    workers: options.serial ? 1 : isCI ? 2 : undefined,
    forbidOnly: isCI,
    retries: 0,
    reporter: isCI ? "github" : "list",
    timeout: options.timeout ?? 30_000,
    outputDir: `test-results/${options.name}`,
    ...(options.globalSetup ? { globalSetup: options.globalSetup } : {}),
    /*
      单条断言的等待预算。**Playwright 的默认值是 5s，而用例本身有 30s**——
      交接文档里那一串「异步 / hover / 滚动 + 固定超时」的已知抖动，机制就是这个
      5s：机器一慢，某一条 `toBeVisible` 用光预算，而同一个用例还剩二十几秒没人用。

      wave 108 用 CDP 的 `Emulation.setCPUThrottlingRate` 把它变成了可复现实验：
      `i18n-theme.spec.ts` 第一条 `expect(dialog).toBeVisible()` 在 **30x 节流**下
      实测 **3832ms**（预算 5000ms，用掉 77%），50x 时直接超时。
      也就是说这一类根本不是「断言钉错了对象」（那是 wave 107 修的另一类），
      **断言本身是对的，只是预算给小了。**

      取 10s：**语义一行都不变**（能过的断言立刻返回，过不了的照样红），
      代价只有一个——**真失败时报错慢一倍**（5s → 10s），而且只在那一条上付。
      仍然远低于用例的 30s，所以失败消息还是「哪个 locator 没等到」，
      不会退化成一句「Test timeout of 30000ms exceeded」。
      套件仍可用 `options.expect` 覆盖。

      **spec 里不要再把 5_000 写进单条断言**（wave 109 清掉了最后 7 处）：那个数字
      是**旧默认值的回声**，写下来等于把这条断言永久钉在旧预算上，后来把默认值调大
      也救不到它。实测那 7 处**没有一处在断言「必须多快完成」**——全是
      「等 tooltip 出现 / 等布局稳下来」，也就是说 5s 只是当年顺手抄的。
      全仓其余显式超时的分布：15s **164** 处、10s **40** 处、20s **28** 处，
      **本来就没人真的想要 5s**。

      **反过来，短超时不是一律不许写**：`tests/e2e-parity/support/capture.ts` 的
      `{ timeout: 2_000 }` 是有意的——那是逐元素探针，长超时会把整套 600s 预算吃光。
      判据是**「这个数字在断言一件事，还是只是抄了默认值」**，不是「数值大小」。
      正因为这条判据分不出「有意的短」与「抄来的短」，**这里有意不做成门禁**
      （做出来必然要一张豁免表，线索 180）。
    */
    expect: { timeout: 10_000, ...options.expect },
    ...(options.grep ? { grep: options.grep } : {}),
    use: {
      baseURL,
      locale: "en-US",
      /*
        **`retain-on-failure`，不是 `on-first-retry`。**

        本仓 `retries: 0`（就在上面几行），而 `on-first-retry` 只在**重试**时录
        ——没有重试，就永远没有 trace。**这条设置从来没有触发过。**
        它旁边的 `video` 用的正是 `retain-on-failure`，同一份文件里两条策略自相矛盾。

        代价是这么写的：录制只在**失败**的用例上保留，绿的一律丢弃，
        所以正常跑一遍不多花一点存储。换来的是**一次偶发失败就能查**：
        wave 195 遇到一条 1/15 左右的偶发红（sidecar 关闭再打开后消息列表为空），
        连跑 14 次没能复现，而现场只剩一张截图——**没有网络与 DOM 时间线，
        就只能靠猜**。这条设置就是那次查不下去的直接原因。

        `tests/guards/tooling-contracts.test.ts` 钉住「retries 为 0 时不许用只在重试时
        才录的模式」，免得它再退回去。
      */
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
      ...options.use,
    },
    // project 名就是浏览器维度。套件身份由 config 承担，不重复编进 project——
    // 视觉快照的文件名里含 project 名，把套件名编进去会让「改套件名」
    // 连带作废所有基线图。
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: options.servers,
  });
}
