/*
  【文件职责】     只在**开着鉴权**的构建上才到得了的那几屏。
  【架构位置】     对照套件（e2e-parity-auth）
  【主要导出】     AUTH_PARITY_SCENARIOS
  【依赖关系】     ../e2e-parity/support/scenarios 的类型与维度
  【边界与注意】   与主场景目录分开**不是为了整齐**：路由棘轮
                   （tests/guards/route-sampling-coverage.test.ts）把「哪些路由被取样过」
                   从场景文件里反查出来，两份合在一起的话，主套件跑不到的屏会被算成
                   已取样。分成两份，棘轮就能分别看见谁被哪一套盖住。

                   **`backend` 一律是 "gateway"，不许改成 "mock"**：mock 会把
                   `GET /api/v1/auth/me` 应答成「已登录」，登录页当场跳去工作区，
                   两个应用就不在可对照的状态了。理由全文见 config 的文件头。
*/
import {
  DEFAULT_DIMENSION,
  ZH_DIMENSION,
  type ParityScenario,
} from "../e2e-parity/support/scenarios";

export const AUTH_PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "login-screen",
    title: "登录页",
    backend: "gateway",
    path: "/login",
    settle: [
      { kind: "visible", target: { selector: "input[type='password']" } },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "setup-screen",
    title: "首次安装向导",
    backend: "gateway",
    path: "/setup",
    /*
      **锚在「第二个密码框」上，不是「有密码框」**：登录页也有一个密码框，
      一边跳去登录页时，「有密码框」这个锚点照样成立，取样就会在两个不同的屏上进行。
      安装表单有两个（新密码 + 确认）。两个应用这几个 input 的 id 各不相同
      （Vue `new-password` / `confirm-password`，React `password` / `confirmPassword`），
      没有共用属性可锚；`:nth-match` 是 Playwright 自己的选择器引擎支持的，且与语言无关。

      wave 193 时这一条被挡在门外：当时的「同不同屏」判据是「两棵树公共行不能太少」，
      而 zh-CN 下只有 3 行——**误判**。wave 194 把判据换成「最终路径相同」之后
      才看清：两边其实都停在 `/setup`，公共行少是因为**上游那一屏在 zh-CN 下几乎整屏英文**。
    */
    settle: [
      {
        kind: "visible",
        target: { selector: ":nth-match(input[type='password'], 2)" },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
];
