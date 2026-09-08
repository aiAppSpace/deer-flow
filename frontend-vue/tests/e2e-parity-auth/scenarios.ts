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

/*
  ⚠ **`/setup` 暂时不在这里，理由是实测的**（wave 193）：
  `setup-screen/desktop/light/zh-CN` 连跑两次，两棵可访问性树都只有 **3 行公共行**
  （en-US 两次都正常），被 diff.spec.ts 里那条「公共行不能太少」的断言拦下。
  换过锚点（从「有密码框」改成「第二个密码框」——登录页也有一个密码框）之后**依旧如此**，
  所以不是锚点问题，是**这两个应用在 zh-CN 下的 /setup 落在了不同的屏上**。
  **原因还没查清，所以不写进这张表**：录一份两边毫不相干的基线，等于把噪声当成发现。
  路由棘轮里 `/setup` 那条 pending 记着这个读数。
*/
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
];
