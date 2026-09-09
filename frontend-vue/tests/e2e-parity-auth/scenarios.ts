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
    id: "auth-callback",
    title: "OIDC 回调页（还在验证）",
    backend: "gateway",
    path: "/auth/callback",
    /*
      **挡这条路的理由本来是错的。** 路由棘轮里它挂着的原因写的是
      「要到达它得先有一次真实的 OIDC callback session，回放 Gateway 不提供」——
      而两边的实现都只做一件事：**问一次 `GET /api/v1/auth/me`，按结果分支**
      （React `auth/callback/page.tsx` 三态、Vue `callback.vue` 四态）。
      它不需要任何真实的 OIDC 往返，只需要那个端点给一个答案。
      **wave 189 踩过同一个坑**：`/showcase/[thread_id]` 挂着的理由也是猜的。

      **取的是「还在验证」这一态，不是终态。** 两边验证完都会 `replace` 跳走
      （成功 300ms、失败 1500ms），终态其实是 `/login`，而那一屏已经在取样面里；
      真正只有这一屏才有的内容就是验证过程本身。把 `auth/me` 用 `delayMs` 挂住，
      它就从「一闪而过」变成一个稳定终态——这正是 wave 134 加 `delayMs` 的用意。

      **锚点不能取那颗转圈的 `.animate-spin`。** 第一版取了它，zh-CN 当场报

          selector:.animate-spin width  React=41.3 Vue=44.7 Δ3.4
          selector:.animate-spin height React=41.3 Vue=44.7 Δ3.4

      ——`h-8 w-8` 明明是 32px。41.3 / 44.7 是**旋转中的外接盒**
      （32×(|cosθ|+|sinθ|)，随角度在 32 到 45.25 之间变）。而 `animate-spin` 在
      `baseline/looping-animations.json` 里是 `decision: "always"`：**有意常开**
      （冻住转圈会让界面撒谎成「卡住了」，走 WCAG 2.2.2 本质性动效那个口子），
      所以这不是「顺手把它门控掉」能解决的——签进基线就是签一条**必红**的行。
      en-US 那次没报，只是两边角度恰好落进了容差，纯属运气。

      改锚外层那个全屏容器：两边的类名**逐字相同**
      （`bg-background relative flex min-h-screen items-center justify-center`），
      尺寸就是视口、与语言无关。**换锚点不丢信号**——十一档里只有 `geometry`
      比锚点，其余十档比的都是整屏。
    */
    routes: [
      { pattern: "**/api/v1/auth/me", delayMs: 15_000, status: 200, json: {} },
    ],
    settle: [{ kind: "visible", target: { selector: "div.min-h-screen" } }],
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
