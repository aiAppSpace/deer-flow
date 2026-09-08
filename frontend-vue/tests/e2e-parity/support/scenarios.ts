/*
  【文件职责】     用**与框架无关的数据**描述对照场景：打开哪里、做什么、等到什么。
  【架构位置】     对照测试基础设施
  【主要导出】     PARITY_SCENARIOS · applyScenarioBackend · applyScenarioStubs · runScenario · DIMENSION 类型
  【依赖关系】     ../../e2e/utils/mock-api（Gateway 的 HTTP/SSE 行为）· @playwright/test
  【边界与注意】   场景是**数据不是函数**，这一条是刻意的。写成函数，作者迟早会在里面
                   分叉——「React 走这条、Vue 走那条」——而那正是对照要发现的东西，
                   一旦能被绕过，比对结果就只反映测试作者的耐心。写成数据，一个场景
                   只能有一种执行方式，两个应用要么都到得了，要么就是一处真差异。

                   步骤只能用**两边共有**的定位方式表达：data-testid、role + 可访问名、
                   可见文本、以及两边都写死的 data-* 选择器（如 [data-sidebar]）。
                   不允许用 class 名或组件库内部结构——那是 ARCHITECTURE 里明写只对齐
                   可观察行为的三处之一。

                   后端有两种来源，对应仓库里本来就有的两种拓扑：
                   - mock：共享 route-level mock，两个应用拿到**逐字节相同**的响应，
                     因此渲染差异只可能来自前端；
                   - gateway：真 replay Gateway，用于必须有真实后端行为的场景。
                   同一份 mock 能同时喂两个应用，是因为它拦的是 glob 通配下的 `/api/` 路径，而两个
                   应用都走自己的同源代理请求这些路径（见 react-preview.ts 文件头）。
*/

import type { Page } from "@playwright/test";

import {
  mockLangGraphAPI,
  type MockAPIOptions,
} from "../../e2e/utils/mock-api";

/** 采样维度。默认只取一份 desktop/light/en-US；要变的场景自己声明。 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

export type ParityViewport = keyof typeof VIEWPORTS;
export type ParityTheme = "light" | "dark";
export type ParityLocale = "en-US" | "zh-CN";

export type ParityDimension = {
  viewport: ParityViewport;
  theme: ParityTheme;
  locale: ParityLocale;
};

export const DEFAULT_DIMENSION: ParityDimension = {
  viewport: "desktop",
  theme: "light",
  locale: "en-US",
};

/**
 * 默认维度的中文孪生。
 *
 * **只跑一种语言的场景，等于把「翻译分叉」整类排除在取样之外**（坑 244）：
 * wave 91 给 `branch-thread` 补上 zh-CN，当场撞出两个应用的分支键取了不同的
 * 词典键——en-US 下两条恰好都是 "Branch conversation"，只跑 en-US 永远看不出来。
 * wave 92 把这一条系统地扫了一遍：19 个此前只有 en-US 的场景全部补上这一维。
 *
 * 一个场景补**一维**就够（语言轴与断点/主题轴正交，翻译分叉在哪个断点上都一样），
 * 所以不给每个既有维度都配一个中文孪生——那只会让取样时间翻倍而不多查出东西。
 */
export const ZH_DIMENSION: ParityDimension = {
  viewport: "desktop",
  theme: "light",
  locale: "zh-CN",
};

/**
 * 定位方式。四种都是两个应用共有的表达，没有第五种。
 */
export type ParityTarget =
  | { testId: string }
  | { selector: string }
  | { role: Parameters<Page["getByRole"]>[0]; name: string | RegExp }
  | { text: string | RegExp };

/** 一个具名终态：`id` 进台账的键，`steps` 是走到它的交互。 */
export type ParityState = {
  id: string;
  steps: ParityStep[];
  /*
    这个终态**额外**装的路由覆盖，装在场景自己的之后（Playwright 后注册者优先）。

    **为什么需要**（wave 128）：「天生看不见的八类」里的第⑥类是「只在某种后端状态下
    才分叉的渲染路径」——错误态、降级态这些分支，只有让接口真的失败才走得到。
    此前 `routes` 只能写在**场景**上，而一个场景只有一份后端；用 `states` 挂就能在
    同一条场景里同时取「正常」与「失败」两个终态，**而且不动覆盖率棘轮的场景 id**。
  */
  routes?: ParityRouteOverride[];
  /*
    这个终态**自己的**断点/主题/语言，覆盖场景那一层的 `dimensions`。

    **为什么需要**（wave 147）：有些终态**只在某个断点上存在**。会话行的 ⋯ 菜单
    就是——它在移动端要先点开抽屉才够得到，而同一条场景的默认终态是桌面的，
    桌面上根本没有抽屉这一步。此前只能二选一：要么把整条场景改成移动端
    （默认终态的锚点全废），要么这一屏永远不进取样面。

    与 `routes` 是同一条理由（wave 128）：**场景 id 受覆盖率棘轮约束、编不出新的**，
    所以「同一条场景里换一个维度」只能做成终态自己的一档。
    不写就沿用场景的 `dimensions`，**没写过这一档的场景键逐字不变**。
  */
  dimensions?: ParityDimension[];
};

export type ParityStep =
  | { kind: "visible"; target: ParityTarget }
  | { kind: "hidden"; target: ParityTarget }
  | { kind: "click"; target: ParityTarget }
  /*
    把鼠标移到某个锚点上并停在那里。

    为什么必须是**新的一档**：`opacity-0 group-hover:opacity-100` 这一类
    「悬停才看得见」的东西，`click` 造不出来——点完鼠标确实在那里，但点击本身
    往往还有副作用（消息动作条那一排点下去就是真的分叉/重跑了）。
    而 `visible` 只是等待，不移动指针。

    Playwright 的 `hover()` 把指针留在那里直到下一次移动，所以取样时悬停态还在
    （与坑 214 的判据一致：加取样点先问「这个点到取样时还在吗」）。
    **注意 `opacity: 0` 的元素照样可以 hover**：Playwright 的可见性判据看的是
    盒模型与 `visibility`，不看 opacity。
  */
  | { kind: "hover"; target: ParityTarget }
  | { kind: "fill"; target: ParityTarget; value: string }
  | { kind: "press"; key: string }
  /*
    在 `scope` 子树里选中一段正文，并派发 mouseup —— 划词工具条的唯一入口。

    为什么必须是一条**新的步骤**而不是既有词汇的组合：选区是浏览器状态，不是
    DOM 状态，`click` / `press` 都造不出一个 Range 来。sidecar 面板的全部入口都
    挂在这条工具条上，所以在有这一步之前，`sidecar-chat` 只能挂在 pending 里
    （理由原文写在 baseline/parity-scenario-coverage.json 的 $pendingReasons）。

    实现照抄 frontend/tests/e2e/sidecar-chat.spec.ts:29 的 selectTextOnPage：
    走 TreeWalker 找到第一个包含该串的文本节点，建 Range，再在它的父元素上派发
    一个**真的 MouseEvent**（坑 76 的同一条机制：两个应用的处理器都挂在 mouseup 上，
    普通 Event 造不出 clientX/clientY，工具条的定位会拿到 0/0）。

    两个应用共用这段代码，因为它只碰浏览器 API，不碰任何一边的实现细节。
  */
  | { kind: "select-text"; scope: ParityTarget; text: string };

/**
 * 额外的路由覆盖，写成数据。
 *
 * 好几个 React spec 在 mockLangGraphAPI 之上再盖一条 `page.route`（把某个 feature
 * flag 关掉、换一份 provider 列表）。这里照搬那种能力，但仍然是数据：一旦允许写
 * 回调，场景就又能分叉了。Playwright 后注册的路由优先，所以覆盖必须在 mock 之后注册。
 */
export type ParityRouteOverride = {
  /** Playwright glob，与 mock-api 里的写法一致。 */
  pattern: string;
  status?: number;
  json: unknown;
  /*
    artifact 的**正文**不是 JSON。用 application/json 端上去，两个应用都会渲染一串
    带引号的 JSON 字面量——比出来的仍然一致，但比的是夹具而不是产品。
    ETag 同理：artifact 的 revision 走它，没有 ETag 两个应用都看不到编辑入口，
    于是「编辑这一整块」被静默排除在对照之外。
  */
  contentType?: string;
  headers?: Record<string, string>;
  /*
    应答之前先等多久（毫秒）。**给「加载中」那一档用的**（wave 134）。

    此前取样面里**一个「还在转」的样本都没有**：`states` 能造出「失败」，
    因为失败是一个稳定终态；「加载中」不是——正常 mock 立刻返回，取样时它早过去了。
    这个字段把它变成一个可以停住的终态：应答慢到取样窗口之后，
    两个应用就都停在各自的加载分支上。

    **仍然是纯数据**（一个数字），没有回调——回调会让场景又能在
    「React 走这条、Vue 走那条」上分叉，那正是这份目录要防的（见文件头）。
    等待发生在 `installRoutes` 的固定实现里。

    **取值判据**：要比取样窗口长得多。取样是 `runScenario` 之后再等
    `settleMs`（默认 700ms），而步骤自己有 auto-wait；取 30 秒的话，
    用例的 30s 超时会先到。**取 15 秒**：比整条取样链长一个量级，
    又不会让失败时的报错等满用例预算。
  */
  delayMs?: number;
};

/**
 * 页面加载**之前**要装的夹具。
 *
 * 与 `routes` 同一个道理：写成**枚举值**，不是回调。允许传函数的话，场景又能在
 * 「React 走这条、Vue 走那条」上分叉，而那正是这份目录要防的东西（见文件头）。
 * 每一项的实现固定写在 `applyScenarioStubs` 里，场景只能从封闭集合里挑一个值。
 *
 * 这是 `settings-notification` 一直待在 pending 里的原因：它要的不是一次交互，
 * 而是在页面跑起来之前把 `Notification` 与 `document.hasFocus` 换掉。
 */
export type ParityStubs = {
  /**
   * 用一个假的 `Notification` 替换 `window.Notification`，并选定初始权限。
   *
   * 不能靠真实浏览器权限：**实测（wave 57，plain context 与 PARITY_CONTEXT_OPTIONS
   * 两种、opaque origin 与 `http://localhost` 两种，四次全是 `denied`）**——
   * headless Chromium 压根不支持通知，于是"已授权"那一支（开关已打开、可以发测试
   * 通知）永远走不到，而那才是这个面板真正长代码的地方。
   *
   * **这里原来写的是「Playwright 里它默认是 `default`」，那句是错的**，
   * 而同一份文件下面 `settings-notification` 场景的注释里早就写着实测是 `denied`
   * ——**一份文件里两句话互相矛盾，没有人对过**。保留下面那条的日期标注。
   * 假的那份同时把发出去的通知记进 `window.__deerflowNotifications`，
   * 与上游 `frontend/tests/e2e/settings-notification.spec.ts` 的 mock 同形。
   */
  notification?: "default" | "granted" | "denied";
  /** `document.hasFocus()` 的返回值。页面在后台时产品才会发完成通知。 */
  documentFocused?: boolean;
};

export type ParityScenario = {
  /** 与 React spec 文件同名（去掉 .spec.ts），覆盖率棘轮靠它对齐。 */
  id: string;
  title: string;
  backend: "mock" | "gateway";
  /** 两个应用打开同一个路径。 */
  path: string;
  mock?: MockAPIOptions;
  routes?: ParityRouteOverride[];
  /** 打开后等到这些锚点，保证两边取样时机一致。 */
  settle: ParityStep[];
  /** 取样前的交互。与 `states` 二选一。 */
  steps?: ParityStep[];
  /*
    同一个场景里**互斥**的多个终态。

    **为什么需要它**：一个场景只有一个终态，而「点一下才出现」的东西彼此常常
    互斥——`workspace-changes` 上的推理档菜单与改动面板都是模态的，开了一个就
    点不到另一个。此前的办法是二选一，于是另一半永远进不了取样面
    （wave 87 在这条上撞到才加的这一档）。

    **不能靠加场景绕过去**：场景 id 受覆盖率棘轮约束，必须逐字等于上游的
    spec 文件名，编不出新的来。夹具与步骤不受约束，所以把「多个终态」做成
    场景内部的一个轴是唯一不动棘轮坐标系的做法。

    台账的键因此变成 `场景#终态/断点/主题/语言`；没声明 `states` 的场景
    键不变（`场景/断点/主题/语言`），所以既有的 39 个样本一行都不动。
  */
  states?: ParityState[];
  /** 页面加载前要装的夹具；见 ParityStubs。 */
  stubs?: ParityStubs;
  /** 要跑的采样维度；缺省只跑 DEFAULT_DIMENSION。 */
  dimensions?: ParityDimension[];
};

export function locateTarget(page: Page, target: ParityTarget) {
  if ("testId" in target) return page.getByTestId(target.testId);
  if ("selector" in target) return page.locator(target.selector);
  if ("role" in target)
    return page.getByRole(target.role, { name: target.name });
  return page.getByText(target.text);
}

/** 装一组路由覆盖。后注册者优先，所以调用顺序就是优先级顺序。 */
async function installRoutes(
  page: Page,
  overrides: ParityRouteOverride[] | undefined,
) {
  for (const override of overrides ?? []) {
    await page.route(override.pattern, async (route) => {
      if (override.delayMs)
        await new Promise((resolve) => setTimeout(resolve, override.delayMs));
      return route.fulfill({
        status: override.status ?? 200,
        contentType: override.contentType ?? "application/json",
        headers: override.headers,
        body:
          typeof override.json === "string" && override.contentType
            ? override.json
            : JSON.stringify(override.json),
      });
    });
  }
}

/** 把后端接上。mock 场景必须在 goto 之前调用。 */
export async function applyScenarioBackend(
  page: Page,
  scenario: ParityScenario,
  state?: ParityState,
) {
  if (scenario.backend === "mock") mockLangGraphAPI(page, scenario.mock);
  // 后注册者优先，所以覆盖一定要在 mock 之后；终态的又在场景的之后。
  await installRoutes(page, scenario.routes);
  await installRoutes(page, state?.routes);
}

/**
 * 把 `stubs` 声明的夹具装进页面。**必须在 goto 之前调用。**
 *
 * 实现固定在这里，场景那边只给一个枚举值——这样两个应用拿到的是**同一段**注入代码，
 * 渲染差异不可能来自夹具。
 */
export async function applyScenarioStubs(page: Page, scenario: ParityScenario) {
  const stubs = scenario.stubs;
  if (!stubs) return;
  if (stubs.notification !== undefined) {
    await page.addInitScript((permission) => {
      const record: { title: string; body?: string }[] = [];
      (
        globalThis as unknown as {
          __deerflowNotifications?: typeof record;
        }
      ).__deerflowNotifications = record;

      class MockNotification {
        static permission = permission;
        static async requestPermission() {
          MockNotification.permission = "granted";
          return "granted";
        }
        onclick: (() => void) | null = null;
        onerror: ((error: Event) => void) | null = null;
        closed = false;
        constructor(title: string, options?: { body?: string }) {
          record.push({ title, body: options?.body });
        }
        close() {
          this.closed = true;
        }
      }

      Object.defineProperty(globalThis, "Notification", {
        configurable: true,
        value: MockNotification,
      });
    }, stubs.notification);
  }
  if (stubs.documentFocused !== undefined) {
    await page.addInitScript((focused) => {
      Document.prototype.hasFocus = () => focused;
    }, stubs.documentFocused);
  }
}

/**
 * 把维度加到页面上。两个应用用的是**同一套**持久化：locale 走 `locale` cookie，
 * theme 走 localStorage 的 `theme` 键（next-themes 的默认 storageKey 与 Vue 的
 * THEME_STORAGE_KEY 恰好相同）。所以维度也能用一份数据表达。
 */
export async function applyDimension(
  page: Page,
  base: string,
  dimension: ParityDimension,
) {
  await page.setViewportSize(VIEWPORTS[dimension.viewport]);
  await page.context().addCookies([
    {
      name: "locale",
      value: dimension.locale,
      url: base,
    },
  ]);
  await page.addInitScript((theme) => {
    try {
      globalThis.localStorage?.setItem("theme", theme);
    } catch {
      /* 无痕/禁用存储时按默认主题渲染即可 */
    }
  }, dimension.theme);
}

async function runStep(page: Page, step: ParityStep, timeout: number) {
  if (step.kind === "press") return page.keyboard.press(step.key);
  if (step.kind === "select-text") {
    const scope = locateTarget(page, step.scope).first();
    await scope.waitFor({ state: "visible", timeout });
    return scope.evaluate((root, targetText) => {
      globalThis.getSelection?.()?.removeAllRanges();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const start = (node.textContent ?? "").indexOf(targetText);
        if (start >= 0) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + targetText.length);
          const selection = globalThis.getSelection?.();
          selection?.removeAllRanges();
          selection?.addRange(range);
          const rect = range.getBoundingClientRect();
          node.parentElement?.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            }),
          );
          return;
        }
        node = walker.nextNode();
      }
      throw new Error(`select-text 找不到这段文字：${targetText}`);
    }, step.text);
  }
  const locator = locateTarget(page, step.target).first();
  switch (step.kind) {
    case "visible":
      return locator.waitFor({ state: "visible", timeout });
    case "hidden":
      return locator.waitFor({ state: "hidden", timeout });
    case "click":
      return locator.click({ timeout });
    case "fill":
      return locator.fill(step.value, { timeout });
    case "hover":
      /*
        **移三次，不是一次**（坑 237 的同族，wave 91 实测）。

        两组读数，都如实记下来：

        - 探针里「`hover()` 一次 + 等 1.5 秒」：**Vue 侧动作条已经 `opacity: 1`
          且 tooltip 开了，React 侧仍然是 `opacity: 0`、一个 tooltip 都没有**；
          随手再抖一次鼠标，React 立刻也开了。
        - 场景里「`hover()` 一次 + 后续 `visible` 轮询（最多 30 秒）」：
          **两个应用都到不了**。等待时间不是变量——多等 30 秒也没用。

        **机制没查到底，就不写死。** 能确定的只有一条：一次鼠标移动之后，
        指针最终**不在**它该在的位置上（Playwright 的 hover 会先
        `scrollIntoViewIfNeeded`，而这一屏的消息容器确实会被滚动——
        同一次取样里 React 那个容器 scrollTop=60、Vue=0）。
        再移一次就对了，两边都对。

        修的是**测量方式不是契约**：往元素里的三个不同位置各移一次，每次之间
        有 Playwright 自己的 auto-wait。这与坑 237 的「滚到它真的动为止」是同一条
        ——别拿一次输入去赌一个还在动的界面。
      */
      await locator.hover({ timeout, position: { x: 3, y: 3 } });
      await locator.hover({ timeout, position: { x: 5, y: 5 } });
      return locator.hover({ timeout });
  }
}

/** 在一个应用上执行一个场景，返回稳定后的页面，供调用方取样。 */
/**
 * 场景要跑的终态列表。
 *
 * 没声明 `states` 的场景有且只有一个**匿名**终态（id 为空串），它的步骤就是
 * `steps`——这样调用方只有一条路径，不需要到处写 `scenario.states ?? ...`。
 */
export function scenarioStates(scenario: ParityScenario): ParityState[] {
  if (scenario.states === undefined)
    return [{ id: "", steps: scenario.steps ?? [] }];
  if (scenario.steps !== undefined)
    throw new Error(
      `${scenario.id}: steps 与 states 只能二选一——两个都写的话，` +
        "读的人无法判断哪一半会被跑。",
    );
  return scenario.states;
}

export async function runScenario(
  page: Page,
  base: string,
  scenario: ParityScenario,
  dimension: ParityDimension = DEFAULT_DIMENSION,
  state: ParityState = scenarioStates(scenario)[0]!,
  timeout = 30_000,
) {
  await applyScenarioBackend(page, scenario, state);
  await applyScenarioStubs(page, scenario);
  await applyDimension(page, base, dimension);
  await page.goto(`${base}${scenario.path}`);
  for (const step of scenario.settle) await runStep(page, step, timeout);
  for (const step of state.steps) await runStep(page, step, timeout);
  return page;
}

const MOCK_THREAD_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_RUN_ID = "00000000-0000-0000-0000-000000000099";
const MOCK_THREAD_ID_2 = "00000000-0000-0000-0000-000000000002";

/*
  **每一个 UUID 形状的夹具 id 都必须进 `KNOWN_IDS`**（wave 120）。
  `normalizeRequest` 把「UUID 形状且不在 KNOWN_IDS 里」的路径段抹成 `«generated»`
  ——那是为了吃掉客户端随机生成的 id，但它对夹具 id 一样有效：**两个应用请求了
  不同的夹具线程，归一之后会变成同一个字符串，差异就此消失**（硬规则 2：
  每一条归一化都在抹掉信息）。这三个此前就漏在外面。
  下面 `tests/unit/parity/known-ids.test.ts` 双向钉住这件事。
*/
export const HISTORY_THREAD_ID_NEWEST = "00000000-0000-0000-0000-00000000010a";
export const HISTORY_THREAD_ID_OLDER = "00000000-0000-0000-0000-00000000010b";

const MOCK_AGENTS = [
  {
    name: "test-agent",
    description: "A test agent for E2E tests",
    system_prompt: "You are a test agent.",
  },
  {
    name: "second-agent",
    description: "Another test agent for E2E tests",
    system_prompt: "You are another test agent.",
  },
];

/*
  画廊那一屏用的 agent 夹具。**不能用上面那份 `MOCK_AGENTS`**：它只有
  name/description/system_prompt，而 `Agent` 类型里 `model` / `tool_groups` / `skills`
  是必填的，卡片直接对它们取 `.length`——喂上面那份，两个应用都会在渲染里抛错，
  整屏只剩页头（wave 137 第一版实测：快照里一张卡都没有）。

  两个 agent 刻意走**不同分支**：第一个有模型、两个工具组、一个技能；
  第二个三项全 `null`，走「继承默认 / 全部工具组 / 没有技能」那一侧。
*/
const GALLERY_AGENTS = [
  {
    name: "test-agent",
    description: "A test agent for E2E tests",
    system_prompt: "You are a test agent.",
    model: "parity-basic",
    tool_groups: ["search", "code"],
    skills: ["review"],
  },
  {
    name: "second-agent",
    description: "Another test agent for E2E tests",
    system_prompt: "You are another test agent.",
    model: null,
    tool_groups: null,
    skills: null,
  },
];

/** 与 frontend/tests/e2e/thread-list-infinite-scroll.spec.ts 同一份构造。 */
const MANY_THREADS = Array.from({ length: 120 }, (_, index) => {
  const padded = String(index + 1).padStart(3, "0");
  return {
    thread_id: `00000000-0000-0000-0000-0000000${padded.padStart(5, "0")}`,
    title: `Conversation ${padded}`,
    updated_at: new Date(
      Date.UTC(2025, 5, 30, 12, 0, 0) - index * 60_000,
    ).toISOString(),
  };
});

const PLAIN_TEXT_SOURCE = "#include <stdio.h>";

/** 与 frontend/tests/e2e/channels.spec.ts 同一份 provider 列表。 */
/*
  八个 provider 各站一种状态，而不是八份同样的「已连接」。

  同形夹具下，侧栏里所有按钮的文案都一样，于是「连接态怎么算」这条判据整段测不到——
  把 isConnected 写死成 true 也一样绿。这里让每一支分支各有一行：enabled=false 的
  整行不该渲染；configured=false 走「先填运行时配置」；connection_status 非 connected
  的显示「连接」；**已连接但 runtime 不可用**的也必须显示「连接」——最后这条是
  provider.connection_status 与 unavailable_reason 的交叉点，两边的判据都是
  `!unavailable_reason && connection_status === "connected"`，少一半就红。

  Telegram 与 DingTalk 仍然可见，因为它们是 settle 锚点与几何锚点；这里顺手让
  Telegram 站在「未连接」一侧，DingTalk 站在「已连接」一侧，几何锚点于是同时覆盖
  两种按钮变体（secondary 与 outline+勾）的行高与行内布局。
*/
const CHANNEL_PROVIDERS = [
  { provider: "buzz", display_name: "Buzz", auth_mode: "binding_code" },
  {
    provider: "telegram",
    display_name: "Telegram",
    auth_mode: "deep_link",
    connection_status: "not_connected",
  },
  { provider: "slack", display_name: "Slack", auth_mode: "binding_code" },
  {
    provider: "discord",
    display_name: "Discord",
    auth_mode: "binding_code",
    enabled: false,
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  {
    provider: "feishu",
    display_name: "Feishu",
    auth_mode: "binding_code",
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  { provider: "dingtalk", display_name: "DingTalk", auth_mode: "binding_code" },
  {
    provider: "wechat",
    display_name: "WeChat",
    auth_mode: "binding_code",
    connectable: false,
    unavailable_reason: "WeChat runtime is not running.",
  },
  {
    provider: "wecom",
    display_name: "WeCom",
    auth_mode: "binding_code",
    connection_status: "revoked",
  },
].map((provider) => ({
  enabled: true,
  configured: true,
  connectable: true,
  connection_status: "connected",
  unavailable_reason: null,
  credential_fields: [
    { name: "token", label: "Token", type: "password", required: true },
  ],
  ...provider,
}));

/*
  带能力位的模型目录。共享 mock 的 `/api/models` 返回**空列表**，于是工具条上的
  模型/模式/推理强度三个控件要么没有名字、要么整个不渲染——composer 的这一半
  一直落在取样面之外，而"台账 0"在这种情况下只说明"这一屏没被取样"。

  两条记录各站一种能力：`parity-basic` 什么都不支持，`parity-thinker` 同时声明
  supports_thinking 与 supports_reasoning_effort。两个应用都在模型目录到位之后
  把 context 收敛到 models[0]（React 的 useEffect + getResolvedMode，本仓的
  watch + normalizeComposerContext），所以谁排第一决定了默认落在 flash 还是 pro，
  也就决定了推理强度选择器出不出现——两份顺序因此都要用上。
*/
const PARITY_MODEL_BASIC = {
  id: "parity-basic",
  name: "parity-basic",
  model: "parity/basic",
  display_name: "Parity Basic",
};
const PARITY_MODEL_THINKER = {
  id: "parity-thinker",
  name: "parity-thinker",
  model: "parity/thinker",
  display_name: "Parity Thinker",
  supports_thinking: true,
  supports_reasoning_effort: true,
};
/** 不支持 thinking 的模型排第一：默认收敛到 flash。 */
const MODELS_ROUTE_BASIC_FIRST: ParityRouteOverride = {
  pattern: "**/api/models",
  json: {
    models: [PARITY_MODEL_BASIC, PARITY_MODEL_THINKER],
    token_usage: { enabled: false },
  },
};
/** 支持 thinking 的模型排第一：默认收敛到 pro，推理强度选择器随之出现。 */
const MODELS_ROUTE_THINKER_FIRST: ParityRouteOverride = {
  pattern: "**/api/models",
  json: {
    models: [PARITY_MODEL_THINKER, PARITY_MODEL_BASIC],
    token_usage: { enabled: false },
  },
};

const ARTIFACT_PATH = "/artifact-fixtures/report.html";

/*
  markdown 预览的正文里**必须**有一条链接和一张图片。

  `richContentComponents` 是本仓对 Streamdown 内建元素样式的镜像，而它一直没有 `a`
  与 `img`——聊天路径看不出来（MessageList 用自己的 MarkdownLink / MarkdownMessageImage
  把这两个覆盖掉了），artifact 预览这一支才是裸的。此前所有 artifact 夹具的正文里
  一个链接一张图都没有，于是这处缺口整整三轮台账都是 0（线索 111）。

  图片走**同源固定路径 + 路由夹具**，不是外网 URL。下载按钮只在图片真的加载成功后
  才出现，所以图片能不能加载直接决定台账里有没有那两行——外网 URL 会让这份台账
  变成一份看网络脸色的门禁（实测：同一次跑里两个应用一个加载到了一个没有，
  `button "Download image"` 与 `img` 两行凭空冒出来）。

  为什么挂在 artifact-batched-stream 而不是 artifact-preview：后者的正文来自
  write_file 草稿，而**两个应用都会把连续的工具步骤折叠成「1 more step」并只显示
  最后一条**——再加一条 write_file，`/artifact-fixtures/report.html` 这个 settle 锚点
  当场取不到（实测：artifact-preview 与 artifact-panel-resize 一起红）。
  batched-stream 的正文是路由喂的，改它不动任何锚点。
*/
/** 一张最小的同源图片，两个应用都从自己的源上取到逐字节相同的一份。 */
const PARITY_FIXTURE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="#e2e8f0"/></svg>';

const BATCHED_ARTIFACT_MARKDOWN = [
  "# batched report",
  "",
  "See [the upstream repo](https://github.com/bytedance/deer-flow) for context.",
  "",
  "![Chart](/parity-fixtures/chart.svg)",
  "",
].join("\n");

/** 与 frontend/tests/e2e/artifact-preview.spec.ts 的 writeFileMessages() 同形。 */
const ARTIFACT_MESSAGES = [
  {
    type: "human",
    id: "msg-human-artifact",
    content: [{ type: "text", text: "Create a report artifact" }],
  },
  {
    type: "ai",
    id: "msg-ai-write-artifact",
    content: "",
    tool_calls: [
      {
        id: "write-file-artifact",
        name: "write_file",
        args: {
          description: "Writing report artifact",
          path: ARTIFACT_PATH,
          content:
            "<!doctype html><html><body><h1>Report draft</h1><p>测试内容</p></body></html>",
        },
        type: "tool_call",
      },
    ],
    invalid_tool_calls: [],
  },
];

const SUBTASK_DESCRIPTION = "Research stopped reload regression";
const SUBTASK_DONE_DESCRIPTION = "Summarize the release notes";
const SUBTASK_DONE_RESULT = "Three regressions were fixed this week.";

const MERMAID_CONTENT = `Here is a relationship diagram.

\`\`\`mermaid
flowchart TD
    A[Lin<br/>protagonist]
    F[Gu<br/>daughter]
    A -- "sealed memory" -.-> F
\`\`\`
`;

export const WORKSPACE_CHANGES_RUN_ID = "00000000-0000-0000-0000-0000000009c1";

const HISTORY_THREADS = [
  {
    thread_id: MOCK_THREAD_ID,
    title: "First conversation",
    updated_at: "2025-06-01T12:00:00Z",
  },
  {
    thread_id: MOCK_THREAD_ID_2,
    title: "Second conversation",
    updated_at: "2025-06-02T12:00:00Z",
  },
];

/**
 * 场景目录。
 *
 * id 与 `frontend/tests/e2e/*.spec.ts` 的文件名一一对应，缺哪个由
 * `baseline/parity-scenario-coverage.json` 显式列出。
 *
 * **「目录只能变长、待办清单只能变短」是评审政策，不是门禁**（wave 85 逐条查过：
 * 没有任何检查在守这个方向，没有历史参照也判不了单调性）。真正上了门禁的是
 * 那份 baseline 的 `$semantics` 里标着「门禁」的四条。从这里删掉一个场景，
 * 会同时逼出「covered 少一个」和「pending 多一条理由」两处 diff——
 * 它靠的是这个，不是靠一条断言。
 */
export const PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "chat",
    title: "新会话的空状态与输入框",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [
      { kind: "visible", target: { selector: "textarea" } },
      {
        kind: "hidden",
        target: { role: "button", name: /load more/i },
      },
    ],
    // 这一条跑满矩阵，用来证明维度机制真的生效；其余场景先跑默认维度，
    // 全矩阵留给比对层按需要展开，避免现在就把套件时间乘以十二。
    dimensions: (["desktop", "tablet", "mobile"] as const).flatMap((viewport) =>
      (["light", "dark"] as const).flatMap((theme) =>
        (["en-US", "zh-CN"] as const).map((locale) => ({
          viewport,
          theme,
          locale,
        })),
      ),
    ),
  },
  {
    /*
      **首次提交后的那一屏。** 挂了 146 轮才进来，卡点从来不是步骤词汇不够
      （`fill` + `press "Enter"` wave 29 就走得完），而是**上游这一屏在取样点上有两个
      终态、Vue 只有一个**。采纳判据是「同一次构建连取 20 次，React 只出现一个终态」，
      而且 `aria` 与 `requests` **两档都算**：wave 63 量到 19/4、wave 101 量到 15/5、
      wave 102 又量了 22 个。

      **wave 158 修掉 aria 那一半、wave 175 修掉 requests 那一半，判据一个字没改。**
      两次连取 20 样本，四档（react/vue × aria/requests）**全部单一终态**。

      三处根因，都是「同一个逻辑事件被两个独立机制各触发一次」：

      ① **AI 回复之后多出一条重复的「Hello」**（wave 158）。`hooks.ts` 里那个「切会话
         就重置」的 effect **也会在这次发送自己的 id 交接时触发**，把 `sendMessage` 刚捕好的
         `prevHumanMsgCountRef` 基线覆盖掉，于是「服务器那条人类消息到了」的边沿被吞掉。
      ② **播报器里压着 `Loading...`**（wave 158）。`thread-title.tsx` 把 `isLoading` 排在
         优先级最前、盖掉已知名字，被 Next 的 assertive 路由播报器播出且再不更正。
      ③ **三条请求各发两次**（wave 175）。`onStart` 把 history / token-usage / metadata
         三个查询挂上并立刻取，`onFinish` 又把同一批 key 失效一次——**不是竞态是重复**，
         竞态只决定 React Query 有没有恰好去重（invalidate 落在 +7ms 被去重、+16ms 真重取）。
         修法是让这三个查询等这一轮 run 结束再取（`thread.isLoading` 由 SDK 维护，
         报错 / 用户 stop / 正常结束三条路都走同一个翻转）。
         **去掉的那一轮没有任何可观察效果**——两个终态的 `aria` 此前就逐字相同。
    */
    id: "chat-thread-init-ordering",
    title: "首次提交后的会话初始化",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
    states: [
      {
        id: "",
        steps: [
          { kind: "fill", target: { selector: "textarea" }, value: "Hello" },
          { kind: "press", key: "Enter" },
          { kind: "visible", target: { text: "Hello from DeerFlow!" } },
        ],
      },
    ],
  },
  {
    id: "sidebar",
    title: "侧栏的 Chats / Agents 导航",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [
      {
        kind: "visible",
        target: {
          selector: "[data-sidebar='sidebar'] a[href='/workspace/chats']",
        },
      },
      {
        kind: "visible",
        target: {
          selector: "[data-sidebar='sidebar'] a[href='/workspace/agents']",
        },
      },
    ],
    /*
      斜杠建议**展开态**挂在这个场景上，理由与 agent-chat 挂模型选择器相同：
      场景 id 受棘轮约束，夹具与步骤不受，而这个场景本来就停在一屏干净的 composer 上。

      展开态必须取样。这一屏在 wave 20 之前一次都没被打开过，而它一打开就是 8 行
      差异：上游每项是 `/{name}` + 说明两行，本仓技能项只有裸名字、`/goal` 拼成
      "Goal — 说明"、`/compact` 连名字都没有（线索 103 的又一例）。

      只需要一步 `fill`——它顺带满足了显示条件里的焦点态，两个应用都是如此。
      默认 mock 的技能目录里有 data-analysis / frontend-design 两条启用的，加上
      /goal 与 /compact 两条内建命令，正好四行。

      **活动项跟着指针走**（两个应用都是），所以这个场景不能有 click 步骤：
      Playwright 的虚拟指针停在上一步点过的地方，取样结果就会变成
      「上一步把鼠标留在哪儿」。`fill` 不移动指针，指针留在 (0,0)，两边的
      `[selected]` 因此稳定落在第一项。
    */
    steps: [{ kind: "fill", target: { selector: "textarea" }, value: "/" }],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "thread-history",
    title: "侧栏列出已有会话 + 会话行的 ⋯ 菜单",
    backend: "mock",
    path: "/workspace/chats/new",
    mock: { threads: HISTORY_THREADS },
    settle: [
      { kind: "visible", target: { text: "First conversation" } },
      { kind: "visible", target: { text: "Second conversation" } },
    ],
    /*
      会话行的 ⋯ 菜单**此前一行都没进过取样面**：它只在点一下之后才存在，
      而这个场景原来没有 steps（wave 86 按 wave 20/21 的判据逐个域清点时找到的）。
      两边的结构本来就该一样——置顶/重命名/分享 + 导出子菜单（Markdown / JSON）
      + 分隔线 + 删除——所以任何差异都是真差异。

      **按可访问名点，不按属性点**（坑 224）：上游把 "More" 放在一个 sr-only 的
      span 里，本仓写的是 `aria-label`，两边的可访问名相同而属性完全不同。

      展开子菜单那一步是有意的：`common.exportAsMarkdown` / `exportAsJSON`
      两条词条只在子菜单里出现，不点开就永远比不到。
    */
    steps: [
      { kind: "click", target: { role: "button", name: /^(More|更多)$/ } },
      {
        kind: "visible",
        target: { role: "menuitem", name: /^(Rename|重命名)$/ },
      },
      {
        kind: "visible",
        target: { role: "menuitem", name: /^(Delete|删除)$/ },
      },
      { kind: "click", target: { role: "menuitem", name: /^(Export|导出)$/ } },
      {
        kind: "visible",
        target: {
          role: "menuitem",
          name: /^(Export as Markdown|导出为 Markdown)$/,
        },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "agent-chat",
    title: "自定义 agent 的新会话页",
    backend: "mock",
    path: "/workspace/agents/test-agent/chats/new",
    mock: { agents: MOCK_AGENTS },
    /*
      模型选择器**展开态**挂在这个场景上，理由与 branch-thread 挂 interrupt 相同：
      场景 id 受棘轮约束，夹具与步骤不受约束，而这一屏本来就是最干净的 composer。

      展开态必须取样，因为它整个 portal 到 body 上、稳定态里一个节点都不留。
      实测（2026-09-02）它一次带出六行差异：搜索框的 role、列表的可访问名、
      活动项的 aria-selected——全是 wave 19 换成 Dialog+Command 时没人看得见的。

      触发器按可访问名点，两个应用都渲染 selectedModel.display_name。
    */
    routes: [MODELS_ROUTE_BASIC_FIRST],
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
    steps: [
      { kind: "click", target: { role: "button", name: "Parity Basic" } },
      { kind: "visible", target: { role: "dialog", name: "Model Selector" } },
      { kind: "visible", target: { role: "option", name: /Parity Thinker/ } },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  /*
    **建 agent 那一屏第一次进取样面**（wave 188）。

    它一直进不来不是没人想到，是**规则不允许**：`covered` 必须逐字等于场景 id 集合，
    而 `classified` 又必须逐字等于上游 spec 清单——上游没为这一屏写过 e2e spec，
    于是它永远排不进来。wave 188 把那条相等放松成包含（改动与理由写在
    `tests/parity/scenario-coverage.test.ts` 里），并新加了一个以**路由**为坐标的棘轮
    （`tests/guards/route-sampling-coverage.test.ts`），这一条才排得进来。

    这一屏是名字步：一颗 `<Input>`（可访问名来自 placeholder，两边都不写 aria-label）
    加一颗继续键，填完之后才换成引导 composer。取样停在名字步——
    引导 composer 那一半要发一条真实消息，属于另一条场景。
  */
  /*
    **公开 showcase 那一屏第一次进取样面**（wave 189）。

    它一直在外面的理由此前写的是「需要一个可公开读的 thread 夹具」——**那是猜的**。
    实测：两个应用各自把 demo 线程的静态夹具签在自己的 `public/` 里
    （`public/demo/threads/<id>` 与 `public/images/<id>.jpg`），
    **这一屏不打 Gateway、也不需要鉴权**，两边都直接 200，标题相同、
    正文长度都是 4661 字符、按钮列表逐条一致。

    线程 id 取 allowlist 的第一条（`shared/showcase.ts` 的 `DEMO_THREAD_IDS`）。
    **不在这里重复那份名单**——写死一条就够，名单本身另有守卫。
    `backend: "mock"` 仍然要给：这一屏虽然不取数据，但页面上的
    features/models 之类的常规查询照样会发，两边必须看到同一份回答。
  */
  {
    id: "showcase-public-thread",
    title: "公开 showcase 的只读会话",
    backend: "mock",
    path: "/showcase/21cfea46-34bd-4aa6-9e1f-3009452fbeb9",
    settle: [
      {
        kind: "visible",
        target: { selector: "[data-testid='main-message-list']" },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "agent-create-name-step",
    title: "建 agent 的名字步",
    backend: "mock",
    path: "/workspace/agents/new",
    mock: { agents: MOCK_AGENTS },
    settle: [{ kind: "visible", target: { selector: "input[placeholder]" } }],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "agents-feature-disabled",
    title: "agents_api 关闭时的说明页",
    backend: "mock",
    path: "/workspace/agents",
    mock: { agents: [] },
    routes: [
      { pattern: "**/api/features", json: { agents_api: { enabled: false } } },
    ],
    /*
      **`settle` 是空的，这一条是有意的**（wave 135）。

      规矩是「settle 必须在每一个终态下都成立」（wave 129 立的）。这个场景的两个终态
      **一个共有的元素都没有**：feature 关掉时本仓整页换成 `AgentsFeatureDisabled`
      （`v-if="featureDisabled"`），连页头都不在。所以把等待整个交给各终态自己的步骤
      ——几何取样取的是 `settle` **与** `state.steps` 里的 visible 锚点
      （见 capture.ts 的 sampleGeometry），一格都不会少。

      **`loading` 那个终态第一次让 agents 画廊本体进取样面。** 此前这条场景只走
      feature 关掉那一支，画廊页（页头 + 新建入口 + 列表）**一行台账都没有**
      ——「天生看不见的八类」里的第⑦类。
    */
    settle: [],
    states: [
      {
        id: "default",
        steps: [
          {
            kind: "visible",
            target: { text: /contact your administrator|联系管理员/i },
          },
        ],
      },
      /*
        把 feature 打开、再让 `/api/agents` 慢下来，两个应用就都停在各自的加载分支上
        （`delayMs` 见 ParityRouteOverride，wave 134 加的）。终态的路由装在场景的之后，
        所以这里的 `/api/features` 覆盖掉上面那条关闭态（**注释里不能写 glob——
        `*` 加 `/` 就是注释结束符，线索 277，这一轮又踩了一次**）。

        两边都有这一支（判据：**grep 渲染点**）——上游
        `frontend/src/components/workspace/agents/agent-gallery.tsx:39` 的
        `isLoading ? …`，本仓 `app/pages/workspace/agents/index.vue:128`。

        **锚点只能是那句加载文案，而且两边措辞不一样**：上游用 `t.common.loading`
        （`Loading...` / `加载中...`），本仓有一条自己的 `agents.loading`
        （`Loading agents…` / `正在加载智能体…`，上游词典里没有这个 key）。
        找不到一个「夹具喂进去的词」可用，也不能拿页头当锚点——页头在加载前就在，
        钉它等于什么都没等（wave 130 的教训）。所以正则四选一，**措辞差异本身就是
        要量的东西**，它会如实出现在台账里。
      */
      {
        id: "loading",
        routes: [
          {
            pattern: "**/api/features",
            json: { agents_api: { enabled: true } },
          },
          { pattern: "**/api/agents", delayMs: 15_000, json: [] },
        ],
        /*
          **两个锚点，缺一不可**——第一版只钉那句加载文案，**负向验证当场抓到它太松**：
          把上面那条打开 feature 的覆盖去掉（本该退回「功能已关闭」那一页、锚点等不到），
          实测 **zh-CN 红了、en-US 却绿了（395ms）**。原因是本仓那句加载文案的条件是
          `!features.loaded.value || agentCatalog.loading.value`——`/api/features` 还没回来
          的那一小段里它同样在，于是锚点撞上的是「feature 还没查到」而不是
          「agents 还在取」。两种语言表现不同，正说明那是一场竞态。

          加一条**页头 heading** 当前置锚点：两个应用的画廊页头都是 `<h1>{agents.title}</h1>`，
          而 feature 关掉那一页两边画的都是 `<p>`（`agents-feature-disabled.tsx:15`），
          所以等到这个 heading 就等到了「feature 查回来且是开着的」。

          **第一版拿「新建智能体」的文本当这条锚点，实测本仓这一侧等不到**：
          那颗控件加了图标之后，Vue 模板在图标与插值之间留了一个空白文本节点，
          `textContent` 成了 `" New Agent "`，而 **Playwright 的 `getByText` 用正则时
          不做空白归一**；上游 JSX 里图标与文字紧挨着，所以那一侧照常匹配。
          手动挤掉空白会被 prettier 格式化回来——**换成 role + 可访问名，
          而可访问名是归一化过的**。
        */
        steps: [
          {
            kind: "visible",
            target: { role: "heading", name: /^(Agents|智能体)$/ },
          },
          /*
            新建入口也要有一格几何取样：wave 135 第一次量它的时候
            `width Δ-22.6 / height Δ4 / fontSize 16px vs 14px`（本仓手写了一版按钮样式、
            还少一个加号图标），改成 `buttonVariants()` + `<Plus>` 之后要有人盯着它。

            **正则不加 `^$`**：本仓那颗控件的 `textContent` 是 `" New Agent "`
            （模板在图标与插值之间留了一个空白节点，见 index.vue 那段注释），
            而 Playwright 的 `getByText` 用正则时不做空白归一。不加锚定就两边都匹配得到，
            而且 `text=` 只取**最内层**包含这段文字的元素，所以不会落到 header 上。
          */
          { kind: "visible", target: { text: /New Agent|新建智能体/ } },
          {
            kind: "visible",
            target: {
              text: /^(Loading\.\.\.|加载中\.\.\.|Loading agents…|正在加载智能体…)$/,
            },
          },
        ],
      },
      /*
        **画廊有数据、并且把设置对话框打开**（wave 137）。

        这个终态一次做两件事：
        ① `AgentCard` 与模型设置对话框**第一次进对照取样面**（wave 135 只接了加载态，
           那一屏上一个 card 都没有）；
        ② 补上 wave 136 缺的那一半——把模型清单改成「打开对话框才取」之后，
           **没有任何自动化在守「冷开画廊、打开对话框、清单仍然到得了」**
           （那一轮想用 `e2e-agents` 当安全网，实测是一次无效变异：
           它回画廊之前已经把 `MODELS_QUERY_KEY` 填热了）。这里是冷开的，
           取不回来两个应用就画得不一样，台账上立刻现形。

        **按钮的可访问名两边不是同一条**：上游用 `title={t.agents.settings}`
        （`agent-card.tsx:199`，名字就是「模型设置」），本仓用
        `aria-label="模型设置: <agent 名>"`。正则只钉前缀，两边都匹配得到；
        **那处差异本身会如实出现在台账里**。
      */
      {
        id: "gallery",
        routes: [
          {
            pattern: "**/api/features",
            json: { agents_api: { enabled: true } },
          },
          { pattern: "**/api/agents", json: { agents: GALLERY_AGENTS } },
        ],
        steps: [
          {
            kind: "visible",
            target: { role: "heading", name: /^(Agents|智能体)$/ },
          },
          {
            kind: "click",
            target: { role: "button", name: /^(Model settings|模型设置)/ },
          },
          { kind: "visible", target: { selector: "[role=dialog]" } },
        ],
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    /*
      browser 面板**本体**。这条场景原来只断言触发器可见，从来没打开过面板——
      于是整块头部（标题、前进后退、地址栏、Live 切换、关闭）一行台账都没有，
      而实测那里有六条 aria 差异和一整排几何差异（本仓的 URL 栏被挤到只剩 36.6px 宽，
      上游同一屏是 129.3）。

      **点击写在 settle 而不是 steps**：几何只取 settle 里的 visible 锚点
      （见 capture.ts 的 sampleGeometry），所以要让头部进几何取样，把面板打开的
      那一下必须排在这些锚点前面，也就是同在 settle 里。

      **锚点全部用两个应用共有的可访问名**，一条都不靠 data-testid（上游这个面板
      一个 testid 都没有）：
      - `/^Browser$/` 是面板标签那一格，上游画的是 `t.common.browser`；
      - Back / Forward 的名字上游来自 `title`，本仓也用 `title`；
      - 地址栏的名字来自 **placeholder**——本仓曾经挂 `aria-label` 把它顶掉，
        这条锚点就是那个 bug 的守卫，改回去当场取不到；
      - `/^…$/` 是 Live 切换在「请求了 Live 但还没连上」时的文案。mock 后端没有
        WS 端点，两个应用都停在这一态：实测 React 三轮四个时点恒定 "…"。
        本仓原来是四态（Connecting → Reconnecting n/6 → …），实测取样点
        settle+700ms 正好落在第一次重连定时器（800ms）前 100ms，
        **拿它当锚点就是一份会飘的门禁**——两态化之后才敢挂上来。
      - 关闭按钮的名字两边都有：上游那颗原来没有可访问名，是 WCAG 4.1.2 缺陷，
        已按「两边同改」补上 `t.common.closeBrowser`。

      空状态那条 heading 一并挂上：它证明取样落在「还没有画面」这一支，
      两个应用都到得了，不会静默退化成「两边都没渲染、台账照样 0」。
    */
    id: "browser-feature",
    title: "浏览器面板入口与面板本体",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Enabled" }],
    },
    settle: [
      { kind: "visible", target: { testId: "browser-trigger" } },
      { kind: "click", target: { testId: "browser-trigger" } },
      { kind: "visible", target: { text: /^(Browser|浏览器)$/ } },
      { kind: "visible", target: { role: "button", name: /^(Back|后退)$/ } },
      { kind: "visible", target: { role: "button", name: /^(Forward|前进)$/ } },
      {
        kind: "visible",
        target: {
          role: "textbox",
          name: /^(Enter a URL and press Enter|输入网址后按 Enter)$/,
        },
      },
      { kind: "visible", target: { role: "button", name: /^…$/ } },
      {
        kind: "visible",
        target: { role: "button", name: /^(Close browser|关闭浏览器)$/ },
      },
      {
        kind: "visible",
        target: {
          role: "heading",
          name: /^(Connecting to live browser…|正在连接实时浏览器…)$/,
        },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    /*
      sidecar 面板的**草稿态**：选中正文 → 点「Ask in side chat」→ 面板打开，
      但还没有 sidecar thread。这一屏原来两个应用差得最远，而台账一行都没有，
      因为在这条场景进来之前，sidecar 面板从来没有被取样过。

      **夹具自证**：最后四条 visible 全是被测对象自己的锚点——头部标题、头部副标题、
      空状态的标题与说明。四条在两个应用上都必须渲染出来，缺一条整轮当场红，
      不会悄悄退化成「两边都没有、台账照样 0」。挂上去的时候本仓四条全缺
      （标题读错词条、副标题整行不存在、空状态那一支根本没写），正是它们把
      SidecarPanel.vue 的四处分叉逼出来的。

      工具条本身**不在这条场景的取样里**：两个应用点完之后都会把选区清掉
      （React setSelectionToolbar(null) / 本仓 selection.value = null），
      所以稳定态里没有它。**这条场景的 steps 不要动**——wave 30 要取工具条的样，
      是另起一条不带 click 的 select-text 挂在 streaming-reasoning-order 上，
      而不是把这一条的最后一步删掉：这一条守的是点完之后的面板。
    */
    id: "sidecar-chat",
    title: "划词开启 side chat 的草稿态",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
      ],
    },
    settle: [
      { kind: "visible", target: { text: "Build it as a side conversation." } },
    ],
    steps: [
      {
        kind: "select-text",
        scope: { testId: "main-message-list" },
        text: "Build it as a side conversation.",
      },
      {
        kind: "click",
        target: {
          role: "button",
          name: /^(Ask in side chat|在侧边聊天中提问)$/,
        },
      },
      { kind: "visible", target: { testId: "sidecar-panel" } },
      { kind: "visible", target: { text: /^(Side chat|侧边对话)$/ } },
      {
        kind: "visible",
        target: { text: /^1 (selected text fragment|个已选文本片段)$/ },
      },
      { kind: "visible", target: { text: /^(Ask a follow-up|继续深入追问)$/ } },
      {
        kind: "visible",
        target: {
          text: /^(Ask a follow-up grounded in the referenced text\.|基于引用内容单独追问。)$/,
        },
      },
      /*
        分栏的拖拽把手。**这一屏是它第一次进取样面**（wave 146）。

        挂它的直接理由是伪元素那一档：整套里此前只有技能页那颗 tab 的 `::after`
        被采到（4 个样本），而 `after:` 在两个应用里总共只有九处，
        **上游 `ui/resizable.tsx` 那一处正是「把 1px 的分隔线放大成可以抓住的区域」**
        ——一件纯粹画在伪元素上、其余七档全都看不见的事。

        按 wave 131 的规矩先数过：`[role=separator]`（含 `hr`）在这一屏
        **两个应用各恰好 1 个**，盒模型也逐字相同（1.0×800.0 @870,0），
        所以这个锚点不会落到别的东西上。
      */
      { kind: "visible", target: { role: "separator" } },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "thread-list-pin",
    title: "会话列表的置顶排序",
    backend: "mock",
    path: "/workspace/chats/new",
    mock: {
      threads: [
        {
          thread_id: HISTORY_THREAD_ID_NEWEST,
          title: "Newest chat",
          updated_at: "2026-07-04T10:00:00Z",
        },
        {
          thread_id: HISTORY_THREAD_ID_OLDER,
          title: "Older chat",
          updated_at: "2026-07-03T10:00:00Z",
        },
      ],
    },
    /*
      **settle 只等两个断点上都在的东西。**

      原来这里等的是两条会话标题——它们在桌面侧栏里，而移动端侧栏是抽屉、
      默认关着，于是 `#mobile-drawer` 那个终态还没跑到自己的第一步就在
      settle 上超时了（wave 147 实测：`getByText('Newest chat')` 等满 30 秒）。
      两条会话锚点挪进默认终态的 steps——**`steps` 里的 `visible` 同样进取样面**
      （wave 76），所以一格几何都不少。
    */
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
    /*
      侧栏页脚那颗「设置和更多」菜单挂在这个场景上。

      **为什么不挂在 `sidebar` 上**：那个场景明写着不能有 click 步骤——活动项跟着
      指针走，点过一下之后取样到的 `[selected]` 就变成「上一步把鼠标留在哪儿」。
      这个场景只比会话列表的排序，没有那种敏感度。

      这颗菜单此前一行都没进过取样面，而它和会话行的 ⋯ 菜单同一形状：
      一个 popper，朝向与内容盒宽度全靠 props。锚点用覆盖两种语言的正则
      （这个场景目前只有 en-US 一档，但按名字找的锚点该一开始就写成语言无关的，
      免得哪天加了语言维度才发现——wave 86 在 scheduled-tasks 上正好踩过一次）。
    */
    /*
      **第一个终态不取名字，键就逐字不变**（`key()` 只在 `state.id` 非空时加 `#`）。
      加 `states` 是为了下面那个移动端终态，不该顺带把已有的两条账改名。
    */
    states: [
      {
        id: "",
        steps: [
          { kind: "visible", target: { text: "Newest chat" } },
          { kind: "visible", target: { text: "Older chat" } },
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Settings and more|设置和更多)$/,
            },
          },
          {
            kind: "visible",
            target: {
              role: "menuitem",
              name: /^(About DeerFlow|关于 DeerFlow)$/,
            },
          },
        ],
      },
      /*
        **移动端抽屉里的会话行**——这一屏此前从没进过取样面。

        为什么非要一个自己的断点：会话行的 ⋯ 按钮在上游是
        `SidebarMenuAction`，它的两条关键类**只在 768px 以下才生效**
        （`md:opacity-0` 与 `after:-inset-2 md:after:hidden`），
        桌面维度上量到的永远是「都不生效」那一半。wave 147 实测 375px：
        上游 `opacity=1`、有效点击区 **28×36**；本仓当时 `opacity=0`、
        点击区 **20×20**——触摸设备上那一整组会话动作**根本够不着**，
        而八档里没有一档看得见，因为这一屏不在取样面里。

        锚点 `role=button name=/^(More|更多)$/` 在两个应用里都不止一个
        （每条会话一颗），取的是 `.first()`。按 wave 131 的判据这没问题：
        这个场景比的就是会话排序，两边顺序一致本身就在台账里守着，
        所以 `.first()` 两边落在同一条会话上。
      */
      {
        id: "mobile-drawer",
        dimensions: [{ viewport: "mobile", theme: "light", locale: "en-US" }],
        steps: [
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Toggle Sidebar|Open sidebar)$/,
            },
          },
          { kind: "visible", target: { text: "Newest chat" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(More|更多)$/ },
          },
        ],
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "thread-list-infinite-scroll",
    title: "会话列表页的首屏分页",
    backend: "mock",
    path: "/workspace/chats",
    mock: { threads: MANY_THREADS },
    /*
      **这个场景的主角是页面里那张列表，不是侧栏**（wave 131）。

      ~~`text: "Conversation 001"`~~ 在这一屏上匹配到**两份**，而且是两个不同的东西
      ——`.first()` 落在**侧栏**那一份上。实测（两个应用逐字相同）：

        #0  span < a[data-sidebar=menu-button] < li[data-sidebar=menu-item] < …
            @ x=16  y=258 w=**112**      ← 侧栏的会话行
        #1  div < div < div < a < …
            @ x=376 y=176 w=**784**      ← 页面里那张列表的行

      后果两条：`settle` 可能在**页面列表还没画出来**的时候就通过了（侧栏那份先到），
      而几何档里 `text:Conversation 001` 那一行量的是**112px 宽的侧栏标签**，
      不是这个场景真正在说的 784px 宽的列表行。这是 wave 129 / 130 那一类的第三例。

      改成把侧栏排除掉：两个应用的侧栏链接都写死 `data-sidebar="menu-button"`
      （上面的祖先链两边逐字相同），所以 `a:not([data-sidebar])` 是一条两边共有的表达。
      **不用 `chats-page-sentinel`**（两边都有这个 testid）：它是 `aria-hidden`
      的 1px 哨兵，量它的几何没有意义，而且它只在 `hasMore && !isSearching` 时才渲染。
    */
    settle: [
      {
        kind: "visible",
        target: {
          selector: 'a:not([data-sidebar]):has-text("Conversation 001")',
        },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "ui-polish-mobile",
    title: "移动端工作区首屏",
    backend: "mock",
    path: "/workspace/chats/new",
    /*
      模式菜单在**不支持 thinking** 的模型下的样子。另外三个展开态都用
      thinker-first，于是"选不中的档位该不该列出来"这条判据在取样面上是空的——
      两边同改成"不列"之后，没有任何门禁看得见 React 那一半。这一条补上它。

      它顺带落在 mobile 维度上，而这个场景本来就只跑 mobile：菜单宽 w-80 大于
      375 的视口，浮层的碰撞调整两边各做各的，但那属于定位策略、不进取样面。
    */
    routes: [MODELS_ROUTE_BASIC_FIRST],
    settle: [{ kind: "visible", target: { selector: "textarea" } }],
    steps: [
      { kind: "click", target: { role: "button", name: /^(Flash|闪速)$/ } },
      {
        kind: "visible",
        target: { role: "menuitemradio", name: /^(Flash|闪速) / },
      },
    ],
    // 这个场景的全部意义就是小屏，所以它只跑 mobile。
    dimensions: [
      { viewport: "mobile", theme: "light", locale: "en-US" },
      { viewport: "mobile", theme: "light", locale: "zh-CN" },
    ],
  },
  {
    id: "user-message-plain-text",
    title: "用户消息按纯文本渲染",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Plain text rendering",
          updated_at: "2025-06-01T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-plain-text",
              content: [{ type: "text", text: PLAIN_TEXT_SOURCE }],
            },
            { type: "ai", id: "msg-ai-plain-text", content: "ack" },
          ],
        },
      ],
    },
    /*
      模式菜单的**展开态**挂在这里。菜单同样 portal 到 body，稳定态里没有它。
      用 thinker-first 的目录是因为四档模式只有在模型支持 thinking 时才全出现，
      而"哪几档该出现"本身就是两边分叉过的判据。
    */
    routes: [MODELS_ROUTE_THINKER_FIRST],
    settle: [{ kind: "visible", target: { text: PLAIN_TEXT_SOURCE } }],
    steps: [
      { kind: "click", target: { role: "button", name: /^Pro$/ } },
      {
        kind: "visible",
        target: { role: "menuitemradio", name: /^Ultra / },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "integrations",
    title: "设置里的集成页",
    backend: "mock",
    path: "/workspace/chats/new?settings=integrations",
    /*
      喂一份**混合**状态,而不是 replay Gateway 那份全 Pending 的默认值。

      默认值只走得到「什么都没装」这一支:四格全 Pending、下一步是「先装技能包」、
      权限面板与换应用面板都不渲染、安装按钮写 Install。这个域真正长代码的地方
      全在另一侧——已装/CLI 就绪/已授权之后才出现的那些分支。台账对它们一行都报不出来,
      不是因为两边一致,是因为取样根本走不到。

      这一份同时点亮:已装版本行 + 可更新提示 + 运行时版本不匹配、权限面板(22 个域
      按钮与自定义 scope)、换应用按钮、连接成功的下一步 Alert、授权格的 **verified**
      分支(念账号名而不是「已为 X 配置」)、以及 sandbox runtime 格**没有就绪**时的
      Pending 徽标——四格里另外三格都是 Ready,只有它是 Pending,一格漏了徽标就会显出来。

      注意这里量的是「两个应用拿同一份响应会不会渲染成同一个样子」,所以不能把状态
      写成两边各自的期望值;它就是 Gateway 契约里的一种真实状态。
    */
    routes: [
      {
        pattern: "**/api/integrations/lark/status",
        json: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.70",
          runtime_version_mismatch: true,
          app_configured: true,
          app_id: "cli_parity_mock",
          app_brand: "feishu",
          skills_expected: 27,
          skills_installed: 4,
          installed_skills: [
            "lark-doc",
            "lark-im",
            "lark-shared",
            "lark-sheets",
          ],
          enabled_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
          install_path: "/mock/integrations/skills/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "lark-cli version v1.0.65",
            error: null,
          },
          auth: {
            status: "authenticated",
            message: "Lark authorization is live-verified.",
            user: "Alice",
            verified: true,
          },
          sandbox_runtime_mode: "init-container",
          sandbox_runtime_ready: false,
          sandbox_runtime_detail:
            "The provisioner has no lark-cli init image configured (LARK_CLI_INIT_IMAGE).",
        },
      },
    ],
    /*
      锚点必须与语言无关,否则加不了 zh-CN 维度:对话框标题在中文下是「设置」,
      卡片标题是「Lark / 飞书 CLI」(两个应用的词典里都翻译了,不是漏翻)。
      改用两边都有的结构锚点——`[data-slot=card-title]` 是 shadcn CardTitle 的合同,
      本仓的 CardTitle 逐行照抄了它。
    */
    settle: [
      { kind: "visible", target: { selector: "[role=dialog]" } },
      { kind: "visible", target: { selector: '[data-slot="card-title"]' } },
    ],
    /*
      这个面板上「点一下才出现」的东西只有四样，而它们全都挂在两个互斥的终态上：
      权限面板里选中的域 + 自定义 scope（选了之后连接键会改写成「申请新权限」），
      以及「切换飞书 Bot」展开出来的整块表单（品牌二选一 + 两个输入 + 两颗动作键）。
      `useState` 数一遍就是这四个：selectedAuthDomains / customAuthScope /
      showChangeApp / changeAppBrand，其余状态都要真的授权流程才走得到。

      三个终态而不是两个：`default` 保住此前那一份样本（那一屏本身仍然要比），
      另外两个各自把一块此前从来没进过取样面的表面接上来。

      **锚点为什么写成跨语言正则**：这个场景跑 en-US 与 zh-CN 两个维度，
      而域名与按钮文案两边词典里都翻译了（坑 234）。只有 `App ID` 两种语言
      逐字相同，才敢直接按名字找。
    */
    states: [
      { id: "default", steps: [] },
      /*
        **后端失败那一支**（wave 128，第⑥类第一次进取样面）。

        这一屏的错误态只有让 `/api/integrations/lark/status` 真的失败才走得到——
        场景自己的 `routes` 是一份「正常」的响应，而一个场景只有一份后端，
        所以这一支挂在 `states` 上（`ParityState.routes`，装在场景的之后、优先级更高）。

        锚点用 `settings.integrations.loadFailed` 的两种译文：**两边词典都有这一条**
        （上游 `en-US.ts:885`），所以它是一条真正共有的表面，不是本仓独有的分支。
      */
      {
        id: "load-failed",
        routes: [
          {
            pattern: "**/api/integrations/lark/status",
            status: 500,
            json: { detail: "boom" },
          },
        ],
        steps: [
          {
            kind: "visible",
            target: {
              text: /(Failed to load integration status|加载集成状态失败)/,
            },
          },
        ],
      },
      /*
        **设置对话框里另一个域的失败分支**（wave 133）。

        为什么挂在 `integrations` 上：技能设置页在上游**没有对应的 spec 文件**，
        而场景 id 受覆盖率棘轮约束、编不出新的来；夹具与步骤不受约束，
        所以按交接文档里那条既定做法「直接挂现成场景」。这个场景本来就是
        **设置对话框**那一屏（`?settings=integrations`），导航到「技能」只是一次点击。

        两边都有这一支（判据是 wave 129 订正过的**「grep 渲染点、不是词典」**）：
        上游 `frontend/src/components/workspace/settings/skill-settings-page.tsx:50`
        的 `) : error ? (` 那一档，本仓 `SkillSettings.vue:124` 的 `v-if="skills.error.value"`。
        两边的 `isAdminRequired` 都是 `status === 403`，所以 500 走的是 error 那一支
        而不是「需要管理员」那一支。

        锚点用夹具喂进去的那个词（`boom`）而不是任何一边的措辞：
        上游画的是 `<div>Error: {message}</div>`（硬编码英文前缀、没有 role），
        本仓画的是 `<p role="alert">{message}</p>`——**措辞与角色都不一样，
        那正是要量的东西，不能拿它当锚点。**
      */
      {
        id: "skills-load-failed",
        routes: [
          {
            pattern: "**/api/skills",
            status: 500,
            json: { detail: "boom" },
          },
        ],
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Skills|技能)$/ },
          },
          { kind: "visible", target: { text: /boom/ } },
        ],
      },
      /*
        **技能清单画出来的那一屏**（wave 144）。

        wave 133/134 只取了这一页的「失败」与「加载中」两支，那两支里筛选标签是被
        挡掉的；`integrations#default` 又停在集成面板上。**结果是这一页真正长东西的
        那一屏——两个筛选标签 + 技能行——一个样本都没有**（第⑦类）。

        接它的直接理由：上游用的是 `<TabsList variant="line">`，而本仓的
        `TabsList` / `TabsTrigger` 是另写的一套、**连 variant 这个 prop 都没有**
        （上游那套靠 `group/tabs-list` 标记 + `group-data-[variant=*]/tabs-list:`
        选择器联动）。**这一处两边长得不一样，而台账此前看不见。**
      */
      {
        id: "skills",
        routes: [
          {
            pattern: "**/api/skills",
            json: {
              skills: [
                {
                  name: "review",
                  description: "Review a skill package",
                  category: "public",
                  enabled: true,
                },
                {
                  name: "draft",
                  description: "Draft a document",
                  category: "custom",
                  enabled: false,
                },
              ],
            },
          },
        ],
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Skills|技能)$/ },
          },
          { kind: "visible", target: { role: "tablist" } },
          {
            kind: "visible",
            target: { role: "tab", name: /^(Public|公共)$/ },
          },
          /*
            **锚点用开关的可访问名，不是 `skill-review` 这个 testid**：那是本仓独有的
            （上游的技能行一个 testid 都没有），第一版就用它，**React 侧当场等不到**
            ——wave 131 立的那条规矩（锚点必须两边都有）第一次被自己违反。
          */
          { kind: "visible", target: { role: "switch", name: "review" } },
        ],
      },
      /*
        **「还在转」那一档**（wave 134）——取样面此前一个这样的样本都没有。

        与 `skills-load-failed` 同一处代码的另一支：上游
        `skill-settings-page.tsx:44` 是 `isLoading ? 只画一句 Loading : …`，
        整块清单让位；本仓原来把 `Loading…` 加在筛选标签**下面**。
        wave 133 只对齐了 error 那一支，**loading 这一支当时没量过、所以没动**，
        这一轮补上。

        锚点用 `t.common.loading` 的两种译文——**两边词典都有这一条**，
        而且这一屏上只有它一处（判据见 wave 131 那三问）。
      */
      {
        id: "skills-loading",
        routes: [
          {
            pattern: "**/api/skills",
            delayMs: 15_000,
            json: { skills: [] },
          },
        ],
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Skills|技能)$/ },
          },
          {
            kind: "visible",
            target: { text: /^(Loading\.\.\.|加载中\.\.\.)$/ },
          },
        ],
      },
      {
        id: "permission-request",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Calendar|日历)$/ },
          },
          { kind: "click", target: { role: "button", name: /^(Docs|文档)$/ } },
          {
            kind: "fill",
            target: { role: "textbox", name: /OAuth scope/ },
            value: "calendar:calendar.event:read",
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Calendar|日历)$/ },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Docs|文档)$/ },
          },
          /*
            一颗**没被选中**的相邻域也要取样：选中与未选中的色板是这一块唯一
            会变的量，只取选中的那些，「两边都把整排画成选中」也一样是 0。
          */
          {
            kind: "visible",
            target: { role: "button", name: /^(Drive|云空间)$/ },
          },
          /*
            连接键改写成「申请新权限」才说明这次交互真的落到了状态上——
            没有它，三颗按钮的颜色可以只是主题色相同而已。
          */
          {
            kind: "visible",
            target: {
              role: "button",
              name: /^(Request permissions|申请新权限)$/,
            },
          },
        ],
      },
      {
        id: "change-app",
        steps: [
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Change Lark app|切换飞书 Bot)$/,
            },
          },
          // 品牌是单选：点掉默认的 feishu，两颗按钮的状态必须一起翻过来。
          { kind: "click", target: { role: "button", name: /^Lark$/ } },
          {
            kind: "visible",
            target: {
              text: /^(Switch to a different Lark app|切换到其他飞书 App)$/,
            },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Feishu|飞书)$/ },
          },
          { kind: "visible", target: { role: "button", name: /^Lark$/ } },
          // 两种语言下都是 "App ID"，这是这一块唯一不用写正则的锚点。
          { kind: "visible", target: { role: "textbox", name: "App ID" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Switch app|切换 App)$/ },
          },
          {
            kind: "visible",
            target: {
              role: "button",
              name: /^(Re-register in browser|在浏览器重新注册)$/,
            },
          },
        ],
      },
    ],
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
    ],
  },
  {
    id: "branch-thread",
    title: "已完成回合上的分支入口",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Original chat",
          updated_at: "2026-06-01T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "human-1",
              content: [{ type: "text", text: "First question" }],
            },
            { type: "ai", id: "ai-1", content: "First answer" },
            {
              type: "human",
              id: "human-2",
              content: [{ type: "text", text: "Second question" }],
            },
            { type: "ai", id: "ai-2", content: "Intermediate answer" },
            /*
              这条 interrupt 是**故意**挂在 branch-thread 上的，不是另起一个场景：
              场景 id 受棘轮约束（baseline/parity-scenario-coverage.json 只钉 id），
              但夹具数据不受约束，而换夹具比加交互步骤划算——夹具不引入任何时序。

              两边的分组逻辑逐字相同（core/messages/utils.ts 的
              isClarificationToolMessage + assistant:clarification 分支实测 diff 为空），
              所以 `name: "ask_clarification"` + `artifact.human_input` 在两个应用里
              都会长出一个独立的 clarification 组。前一条是不带 tool_calls 的 ai，
              形成 `assistant` 组，`lastOpenGroup()` 因此返回 null——这条 tool 消息
              只进独立组，不会同时被塞进 processing 组里渲染两次。

              必须放在**最后**：`deriveHumanInputThreadState` 有一条 legacy 兜底，
              请求之后再出现任何可见的 human 消息就把它当成「已答」，卡片会从
              active 掉成 answered，取样到的就不是打开态了。

              choice_with_other 一次覆盖到卡片的大部分表面：标题、context 与问题的
              markdown、选项按钮网格、sr-only 标签 + Textarea 的「其它答案」表单、
              以及页脚提交按钮。
            */
            /*
              第二条 clarification，**故意不带** `artifact.human_input`：走的是
              「没有结构化请求、只有一段正文」的那一支。上面那条覆盖的是
              HumanInputCard，这一条覆盖的是同一个 `assistant:clarification` 组
              在**没有**请求时该画什么——上游把这段正文当 markdown 渲染
              （message-list.tsx 的 `if (hasContent(message))` 那一支）。

              两条分支共用一个组类型，所以只喂带请求的那份，缺的那一支在台账上
              永远是 0：不是两边一致，是这一屏根本没有这种内容（线索 114）。
              正文里放一个有序列表，让「正文按 markdown 渲染」这件事在
              可访问性树上留下 list/listitem，而不只是一段 text。
            */
            {
              type: "tool",
              id: "tool-clarify-0",
              name: "ask_clarification",
              content:
                "Two deploy targets look plausible here.\n\nWhich one did you mean?\n\n  1. The staging cluster\n  2. The production cluster",
            },
            {
              type: "tool",
              id: "tool-clarify-1",
              name: "ask_clarification",
              content: "Waiting for clarification",
              artifact: {
                human_input: {
                  version: 1,
                  kind: "human_input_request",
                  source: "ask_clarification",
                  request_id: "parity-clarification-1",
                  tool_call_id: "call-parity-1",
                  question: "Which environment should I deploy to?",
                  context: "Need the target environment.",
                  input_mode: "choice_with_other",
                  options: [
                    {
                      id: "option-1",
                      label: "development",
                      value: "development",
                    },
                    { id: "option-2", label: "staging", value: "staging" },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    /*
      第二条锚点让这个夹具**自证**：settle 步骤在两个应用上都要跑通，所以哪一边
      没把卡片渲染出来，整轮就当场红，而不是悄悄退化成「两边都没有、台账照样是 0」。
    */
    settle: [
      { kind: "visible", target: { text: "First answer" } },
      {
        kind: "visible",
        target: { text: "Which environment should I deploy to?" },
      },
    ],
    /*
      这一屏「点一下才出现」的东西其实**不是点出来的，是悬停出来的**：
      助手回合下面那一排动作键写的是 `opacity-0 … group-hover:opacity-100`，
      两个应用都一样。**在 wave 91 之前没有任何门禁量过它**——
      `opacity: 0` 的元素照样在可访问性树里、照样有位置与尺寸、computed `color`
      也一点不变，所以 aria / 几何 / 请求三档同时报不出「一边看得见一边看不见」。
      wave 91 给几何档加了 `opacity`，又加了 `hover` 这一档步骤，这一块才第一次
      进得来。

      悬停目标直接选**分支键本身**而不是外层回合：悬停按钮既能触发外层的
      `group-hover`（按钮在回合里面），又能顺带把它的 tooltip 打开，
      一步取到两样。
    */
    states: [
      { id: "default", steps: [] },
      {
        id: "turn-actions",
        steps: [
          {
            kind: "hover",
            target: {
              role: "button",
              name: /^(Branch conversation|分叉|创建对话分支)$/,
            },
          },
          {
            kind: "visible",
            target: {
              role: "button",
              name: /^(Branch conversation|分叉|创建对话分支)$/,
            },
          },
          { kind: "visible", target: { selector: "[data-assistant-turn]" } },
          /*
            证明 tooltip 真的开了，用的是**触发器自己的 `data-state`**，
            不是那块浮层。两条理由，都是量出来的：

            ① **`[role=tooltip]` 不能用**：Radix 与 Reka 都把它挂在一个
            1×1、`clip: rect(0,0,0,0)` 的**隐藏播报节点**上，等它「可见」会
            30 秒超时，报出来是「Vue 没能到达场景」，看着像产品缺陷。

            ② **`[data-slot="tooltip-content"]` 能等到，但它的坐标不能比**：
            浮层是 portal 到 body 的 `position: fixed` 元素，`sampleGeometry`
            那套「把祖先链的 scrollTop 加回去」对它无效（它的祖先只有 body/html，
            scrollTop 都是 0），于是量到的 y 里**原样带着触发器所在容器的滚动**。
            实测：分支键的**文档**坐标两边都是 y=208，而**视口**坐标 React=148、
            Vue=207——差的 59px 全是滚动（React 那个消息容器 scrollTop=60，
            Vue=0，两边 scrollHeight 都是 1042）。台账里会表现成
            `tooltip-content y Δ44`，看着像 side 反了，其实与布局无关
            （capture.ts 文件头里 mermaid 那条 Δ69 是同一件事的第一次）。

            触发器是普通的在流元素，滚动补偿对它成立，所以它的几何可比。
          */
          {
            kind: "visible",
            target: {
              selector:
                '[data-slot="tooltip-trigger"][data-state="delayed-open"]',
            },
          },
        ],
      },
    ],
    /*
      **加 zh-CN 这一维是这一轮的正题之一。** 这一屏此前只跑 en-US，而两个应用
      的分支键取的是**不同的词典键**（上游 `common.branch`，本仓
      `messages.actions.branch`）——en-US 下两条恰好都是 "Branch conversation"，
      所以单跑 en-US 永远看不出来。差异只在另一个语言维度上存在。
    */
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
    ],
  },
  {
    id: "subtask-card",
    title: "子任务卡片",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Stopped subtask",
          updated_at: "2026-06-18T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-stopped-subtask",
              content: [
                {
                  type: "text",
                  text: "Start a subtask and then stop before the task tool returns.",
                },
              ],
            },
            {
              type: "ai",
              id: "msg-ai-stopped-subtask",
              content: "",
              additional_kwargs: {},
              response_metadata: {},
              tool_calls: [
                {
                  id: "call-stopped-subtask",
                  name: "task",
                  args: {
                    subagent_type: "general-purpose",
                    description: SUBTASK_DESCRIPTION,
                    prompt:
                      "Investigate why the stopped subtask card should not remain running after reload.",
                  },
                  type: "tool_call",
                },
                /*
                  第二个子任务带工具结果，于是走的是**另一条**渲染路径：
                  derivePendingSubtaskStatus 看到有结果就给 in_progress，真状态由
                  parseSubtaskResult 从 additional_kwargs 读出来（completed）。
                  一条 ai 消息里两个 task 调用还顺手覆盖了组头的复数分支
                  （`executing(2)` 才会插数字和 "in parallel"）。

                  没有第三种状态的卡片：in_progress 要么当前回合还在跑、要么工具结果
                  的形状没被认出来，前者静态夹具做不到，后者是「契约变了」的降级路径，
                  拿它当常态样本会把一条本该刺眼的兜底渲染钉成基线。
                */
                {
                  id: "call-completed-subtask",
                  name: "task",
                  args: {
                    subagent_type: "general-purpose",
                    description: SUBTASK_DONE_DESCRIPTION,
                    prompt: "Read the changelog and summarize what shipped.",
                  },
                  type: "tool_call",
                },
              ],
              invalid_tool_calls: [],
            },
            {
              type: "tool",
              id: "msg-tool-completed-subtask",
              name: "task",
              tool_call_id: "call-completed-subtask",
              content: `Task Succeeded. Result: ${SUBTASK_DONE_RESULT}`,
              additional_kwargs: {
                subagent_status: "completed",
                subagent_result_brief: SUBTASK_DONE_RESULT,
                subagent_model_name: "deerflow-basic",
                subagent_token_usage: {
                  input_tokens: 800,
                  output_tokens: 400,
                  total_tokens: 1200,
                },
              },
            },
          ],
        },
      ],
    },
    /*
      三个锚点都在折叠态和展开态下同时可见，所以既能当 settle 断言又能量几何
      （sampleGeometry 只取 settle 里的 visible，但量的是**跑完 steps 之后**的状态）。
      组头那一行是这一轮新增的，单独给它一个锚点：它的 pt-2 与外层 gap 的关系
      决定了整组的纵向节奏，量它比量卡片更早发现问题。
    */
    settle: [
      { kind: "visible", target: { text: SUBTASK_DESCRIPTION } },
      { kind: "visible", target: { text: SUBTASK_DONE_DESCRIPTION } },
      {
        kind: "visible",
        target: {
          text: /^(Executing 2 subtasks in parallel|并行执行 2 个子任务)$/,
        },
      },
      /*
        **卡片底下那层环境光**（wave 165）。两个应用都无条件渲染这个 div，
        只有 in_progress 才给它加 `.enabled` 拿到 opacity——这个夹具里两张卡片都是
        终态，所以它盒子高度为 0。用 `hidden` 而不是 `visible`：它确实不可见，
        而 `hidden` 的目标同样进几何锚点（见 capture.ts 里 sampleGeometry 的说明）。

        取它是为了让那条无限循环的动画**进得了台账**：动画画在 `::before`/`::after`
        上，wave 161 两边同改把它收进减动分支时台账零反应，就是因为没有任何锚点
        碰得到这一层。伪元素那一格从这一轮起多取 `animationName`。

        锚点走 `data-slot` 而不是类名：`scenario-coverage` 那条「只用两边共有的定位
        方式」不许拿 class 当选择器（class 是组件库实现细节），而这一层原本除了类名
        没有别的抓手——所以 wave 165 **两边同加**了 `data-slot="ambilight"`，
        与本仓到处在用的那套命名一致。这一屏上它匹配两张卡片各一个，
        `hidden` 走 `.first()`，两边量的是同一张。
      */
      { kind: "hidden", target: { selector: '[data-slot="ambilight"]' } },
    ],
    /*
      展开一张卡片。展开区里的一切——prompt 的 markdown、终态步骤、失败原因——
      折叠着的时候两边都在 DOM 之外，台账一行都看不到；aria 快照是在所有 steps
      跑完之后取的，所以这一步把整个展开面板纳入了比对。
    */
    steps: [
      { kind: "click", target: { text: SUBTASK_DESCRIPTION } },
      {
        kind: "visible",
        target: {
          text: "Investigate why the stopped subtask card should not remain running after reload.",
        },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "artifact-preview",
    title: "打开 artifact 面板后的预览",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact preview",
          updated_at: "2026-06-02T12:00:00Z",
          messages: ARTIFACT_MESSAGES,
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: ARTIFACT_PATH } }],
    /*
      **锚点必须是「点开面板之后才有」的那一份**（wave 130）。

      ~~`text: "report.html"`~~ 是 wave 129 那处缺陷的第二例：`getByText` 的字符串
      是**子串**匹配，而消息列表里那张文件卡的文字就是 `/artifact-fixtures/report.html`
      ——它**在点击之前就已经满足**，`.first()` 也永远落在它身上。实测（两个应用逐条相同）：

        点击前   text:report.html           **1** 个（就是那张卡，visible）
        点击后   text:report.html           2 个，`.first()` 的文本是
                                            "/artifact-fixtures/report.html" ← 还是那张卡
        点击后   text:/^report\.html$/       **1** 个，文本 "report.html" ← 面板标题
        点击前   text:/^report\.html$/       **0** 个

      也就是说这一步既没有等到面板，几何档里 `text:report.html` 那一行量的也是
      消息卡（而那张卡 `settle` 已经量过一次了，等于白占一格）。
      改成整串匹配的正则，**这一格从此量的是面板标题**。

      顺带记下两个**量过之后被排除**的候选：`[data-slot="select-trigger"]` /
      `[data-slot="select-value"]` / `role:combobox` 在这一屏上**两个应用都是 0 个**
      ——这份夹具走的不是 artifacts 列表那条 Select 分支（坑 265：同一组件的两条
      渲染分支，先确认夹具走了哪条）。照着 wave 103 的记忆去选它就会选空。
    */
    steps: [
      { kind: "click", target: { text: ARTIFACT_PATH } },
      { kind: "visible", target: { text: /^report\.html$/ } },
    ],
    /*
      窄屏也跑一份。React 在 isMobile 分支把右侧面板整个换成 Sheet，也就是一个真的
      模态 dialog（chats/chat-box.tsx）——那是与宽屏 complementary 完全不同的语义，
      不跑窄屏就等于没比过其中一半。
    */
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "mobile", theme: "light", locale: "en-US" },
      ZH_DIMENSION,
    ],
  },
  {
    id: "artifact-panel-resize",
    title: "artifact 面板的分栏几何",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact panel resize",
          updated_at: "2026-06-03T12:00:00Z",
          messages: ARTIFACT_MESSAGES,
        },
      ],
    },
    settle: [{ kind: "visible", target: { text: ARTIFACT_PATH } }],
    /*
      这一条的 `steps` 原来**只有一个 click、没有任何锚点**（wave 130 补）：
      点完之后没有人等面板，取样只靠 `captureScenario` 那 700ms 固定等待——
      而这个场景量的正是**分栏几何**，也就是最怕量到中间态的那一种
      （坑 237：别拿固定等待去赌一个还在动的界面）。
      锚点用与上面同一条整串正则，理由见那一段。
    */
    steps: [
      { kind: "click", target: { text: ARTIFACT_PATH } },
      { kind: "visible", target: { text: /^report\.html$/ } },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "scheduled-tasks",
    title: "定时任务列表",
    backend: "mock",
    path: "/workspace/scheduled-tasks",
    /*
      夹具刻意不是「一个全新的任务」。这一页有好几支只由**数据**决定的分叉，一次
      页面加载就能全部走到，不需要任何交互，也就不引入任何时序：

      - `context_mode: reuse_thread` 走详情里 `Thread:` 那一支（fresh 模式走的是
        `Last thread:`，两者二选一）；
      - `last_run_at` / `last_run_id` / `last_error` 都不为空，于是时间戳格式、id
        与失败原因都进树，而不是三个 `—`；
      - 第二个任务是 `once` + `paused`，列表行的措辞「One-time · Paused」才有样本；
      - 预置两条运行（一条成功一条失败），运行列表、`trigger · status` 的措辞、
        run id、计划时刻与错误行才有样本——否则永远只比得到「No runs yet」。

      再跑一份 zh-CN：这一页的词典两边逐字相同，但「用的是不是同一个 key」只有
      换一种语言才看得出来，时间戳的 locale 分支同理。
    */
    mock: {
      threads: [],
      scheduledTasks: [
        {
          id: "task-1",
          thread_id: "thread-1",
          context_mode: "reuse_thread",
          last_thread_id: "thread-9",
          title: "Daily summary",
          prompt: "Summarize thread",
          schedule_type: "cron",
          schedule_spec: { cron: "0 9 * * *" },
          timezone: "UTC",
          status: "enabled",
          next_run_at: "2026-07-02T01:00:00+00:00",
          last_run_at: "2026-07-01T01:00:00+00:00",
          last_run_id: "run-42",
          last_error: "Upstream model timed out",
          run_count: 2,
          created_at: "2026-07-01T00:00:00+00:00",
          updated_at: "2026-07-01T00:00:00+00:00",
        },
        {
          id: "task-2",
          thread_id: null,
          title: "One-off cleanup",
          prompt: "Clean up the workspace",
          schedule_type: "once",
          schedule_spec: { run_at: "2026-08-01T09:00:00+00:00" },
          timezone: "UTC",
          status: "paused",
          next_run_at: "2026-08-01T09:00:00+00:00",
          last_run_at: null,
          last_run_id: null,
          last_error: null,
          run_count: 0,
          created_at: "2026-07-01T00:00:00+00:00",
          updated_at: "2026-07-01T00:00:00+00:00",
        },
      ],
      scheduledTaskRuns: {
        "task-1": [
          {
            id: "run-b",
            task_id: "task-1",
            thread_id: "thread-1",
            run_id: "run-42",
            scheduled_for: "2026-07-01T01:00:00+00:00",
            trigger: "scheduled",
            status: "failed",
            error: "Upstream model timed out",
            started_at: "2026-07-01T01:00:01+00:00",
            finished_at: "2026-07-01T01:00:30+00:00",
            created_at: "2026-07-01T01:00:00+00:00",
          },
          {
            id: "run-a",
            task_id: "task-1",
            thread_id: "thread-1",
            run_id: null,
            scheduled_for: "2026-06-30T01:00:00+00:00",
            trigger: "manual",
            status: "success",
            error: null,
            started_at: "2026-06-30T01:00:01+00:00",
            finished_at: "2026-06-30T01:00:20+00:00",
            created_at: "2026-06-30T01:00:00+00:00",
          },
        ],
      },
    },
    /*
      **`settle` 必须在这个场景的每一个终态下都成立。** 它跑在 `state.steps`
      之前，而下面新增的终态是「列表请求失败」——原来这里等的「Daily summary」
      那颗任务按钮，恰恰是失败态里唯一不会出现的东西（列表为空）。
      改等创建表单里的 schedule input：它挂在页面顶部，与列表查询无关，
      两个终态、两种语言下都在（testid 两边逐字相同）。
      「Daily summary」那一等原样挪进 `default` 终态的第一步，先后顺序不变。
    */
    settle: [
      { kind: "visible", target: { testId: "schedule-preset" } },
      { kind: "visible", target: { testId: "schedule-timezone" } },
    ],
    /*
      **详情里的编辑表单此前一行都没进过取样面。** 这个场景的夹具刻意只走
      「由数据决定」的分叉（见上面那段注释），而编辑态是纯交互态：点一下
      「Edit」才存在。里面是标题输入框 + 提示词文本域 +
      `ScheduledTaskScheduleInput`（`scheduleTypeLocked`）+ 「Save edit」，
      两边结构本来就该一样，所以任何差异都是真差异。

      ~~锚点选「Save edit」这颗按钮，加上 schedule input 里面的两个 testid
      （`schedule-preset` / `schedule-timezone`，两边逐字相同）：只钉外壳的话，
      那一整块换了位置也看不见。~~ **⚠ 这句话是错的，wave 129 实测推翻。**

      那两个 testid 在**创建表单**里也各有一份，而且是页面一打开就在的
      （两个应用的创建草稿默认都是 `schedule_type: "cron"`，
      `frontend-vue/app/core/scheduled-tasks/form.ts:64` /
      `frontend/src/app/workspace/scheduled-tasks/page.tsx:84`）。
      `runStep` 与 `sampleGeometry` 都对 locator 取 `.first()`，
      于是这两步**永远落在创建表单那一份上**：它们在点「Edit」之前就已经满足，
      既没有等编辑表单里的 schedule 块出现，几何档里那两行量的也是创建表单
      的控件——**而注释写的是编辑表单**。这是坑 266 的同一形状：
      一个看起来很具体的锚点，落到了另一个层级上。

      改法分两处，各自说清在钉什么：
      - 创建表单那两份挪去 `settle`（它们本来就是页面加载态的控件，见上面）；
      - 编辑表单那两份用 `>> nth=1` 显式取第二份。两个应用的 DOM 顺序都是
        「创建表单在上、详情/编辑在下」，所以 index 1 在两边指的是同一个东西；
        万一某天不是，几何档会当场报出一行离谱的差异（自证的锚点，不需要豁免表）。

      **两次锚点都先量错了，都记在这里**：

      ① 第一版内层锚点写成 `text: "Timezone"`，**两边都到不了**——
         `fields.timezone` 这条词条在两个应用的 schedule input 里都没有被渲染成
         可见文字（它只是个 Select，标签没画出来）。照着词典猜锚点会猜到一条
         从来没被渲染的 key 上（坑 214 的同一条）。
      ② 第二版按可访问名找「Edit」/「Save edit」，**en-US 过、zh-CN 当场超时**——
         这个场景**有两个语言维度**，而按名字找的锚点天生只在一种语言下成立。
         这一页两边的按钮都没有共用的 testid（本仓多了几个，上游没有），
         所以名字写成覆盖两种语言的正则；内层两个锚点用两边逐字相同的 testid，
         不受语言影响。

      **判据：一个锚点在加进来之前，要问它在这个场景的每一个维度上都成立吗**
      ——wave 129 补上第二问：**它在这一屏上只有一份吗**。
    */
    states: [
      {
        id: "default",
        steps: [
          {
            kind: "visible",
            target: { role: "button", name: /Daily summary/i },
          },
          { kind: "click", target: { role: "button", name: /^(Edit|编辑)$/ } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Save edit|保存编辑)$/ },
          },
          {
            kind: "visible",
            target: { selector: '[data-testid="schedule-preset"] >> nth=1' },
          },
          {
            kind: "visible",
            target: { selector: '[data-testid="schedule-timezone"] >> nth=1' },
          },
        ],
      },
      /*
        **列表请求失败那一支**（wave 129，第⑥类的第二处）。

        判据与 wave 128 的 `integrations#load-failed` 同一条，但**收紧了一格**：
        不只问「那条 i18n key 上游词典里有没有」，还要问「上游真的把它渲染出来
        了吗」。这一条两问都过——`scheduledTasks.detail.loadFailed` 在上游词典
        `frontend/src/core/i18n/locales/en-US.ts:381`，渲染在
        `frontend/src/app/workspace/scheduled-tasks/page.tsx:339`，
        而且两边挂的是**同一个 testid** `scheduled-task-load-error`。

        另外三个候选（`agents` / `account` / `artifact` 的 loadFailed）**这一轮
        没接**，理由逐条量过、写在提交说明里：上游要么没有这一支，要么
        把 error 整个丢掉了，量出来必然是「本仓有、上游没有」，没有对照意义。

        两边都从 `{ detail }` 里取错误文案（`throwGatewayApiError`），
        所以文案本身是夹具喂进去的，比出来的是结构不是措辞。
      */
      {
        id: "load-failed",
        routes: [
          {
            pattern: "**/api/scheduled-tasks",
            status: 500,
            json: { detail: "boom" },
          },
        ],
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-load-error" } },
        ],
      },
    ],
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
    ],
  },
  {
    /*
      通知设置面板。这一条**从目录建起来就待在 pending 里**，理由是它要的不是一次
      交互，而是在页面跑起来之前把 `Notification` 换掉——权限是浏览器状态，
      `page.route` 和步骤词汇都碰不到它。`stubs` 就是为它加的（见 ParityStubs）。

      取"已授权"那一支：这个上下文里浏览器默认给的是 **denied**（实测，见下面那条
      锚点的注释），于是不注入就只走得到"被拒绝"那一支——开关恒为禁用、旁边挂一段
      提示。授权之后开关才活过来、才谈得上发测试通知，那才是这个面板真正长代码
      的地方，而它**只能靠注入到达**。
    */
    id: "settings-notification",
    title: "已授权状态下的通知设置面板",
    backend: "mock",
    path: "/workspace/chats/new?settings=notification",
    stubs: { notification: "granted" },
    /*
      第二条锚点是**夹具生效的证据**，而且它必须挑一条只有 `granted` 才成立的事实。
      实测（2026-09-02）：这个上下文里 `Notification.permission` 默认是 **denied**
      （不是 default，也不是 granted）——所以「请求通知权限」那颗按钮在两种情况下
      都不出现，拿它当证据是拿不住的（第一版就是这么写的，把 stub 摘掉照样绿）。
      改成断言**拒绝提示不在**：那段话只在 denied 时渲染，也就是默认态。
    */
    settle: [
      {
        kind: "visible",
        target: { role: "switch", name: /^(Notification|通知)$/ },
      },
      {
        kind: "hidden",
        target: { text: /Notification permission was denied/ },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "channels",
    title: "侧栏的 IM 渠道列表",
    backend: "mock",
    path: "/workspace/chats/new",
    routes: [
      {
        pattern: "**/api/channels/providers",
        json: { enabled: true, providers: CHANNEL_PROVIDERS },
      },
      { pattern: "**/api/channels/connections", json: { connections: [] } },
    ],
    settle: [
      {
        kind: "visible",
        target: { selector: "[data-sidebar='sidebar']" },
      },
      { kind: "visible", target: { text: "Telegram" } },
      { kind: "visible", target: { text: "DingTalk" } },
    ],
    /*
      侧栏这一行上「点一下才出现」的只有一样：运行时配置对话框。它有**两条互斥的
      分支**，走哪一条由 provider 的状态决定（见 core/channels/provider-state.ts）：

      - `providerNeedsRuntimeConfig`（enabled 且未 configured 且有 credential_fields）
        → 新建分支，标题 `setupTitle`、提交键 `saveAndConnect`。夹具里只有 **Feishu**
        落在这一支（Discord 也未 configured，但它 `enabled: false`，整行不渲染）。
      - 已连接 + `providerCanEditRuntimeConfig` → 编辑分支，标题 `setupEditTitle`、
        提交键 `saveChanges`。夹具里 buzz / slack / dingtalk 都已连接，取 **DingTalk**
        （它本来就是 settle 的锚点之一）。

      两条分支都是模态的，所以只能用 `states` 分开挂（wave 87 那条轴）。

      **触发器为什么这么定位**：两个应用**没有共用的 testid**（本仓的按钮上有
      `channel-provider-*`，上游没有），而按钮文案两边都是 "Connect"/"Connected"
      的翻译，一屏上有好几颗。唯一两边都成立、又与语言无关的坐标是
      **夹具自己给的 `display_name`**——它不进词典，两种语言下逐字相同。
      所以按 `[data-sidebar="menu-item"]`（两个应用都写死的 data-* 选择器）
      加 `:has-text(<display_name>)` 收窄到那一行，再取行内那颗按钮。

      对话框里的锚点同理：字段标签 `Token` 来自夹具的 `credential_fields`，
      两种语言下也逐字相同，所以 `role: textbox` + `name: "Token"` 不用写正则。
    */
    states: [
      { id: "default", steps: [] },
      {
        id: "runtime-config",
        steps: [
          {
            kind: "click",
            target: {
              selector: '[data-sidebar="menu-item"]:has-text("Feishu") button',
            },
          },
          { kind: "visible", target: { selector: "[role=dialog]" } },
          {
            kind: "visible",
            target: { selector: '[role=dialog] [data-slot="dialog-title"]' },
          },
          { kind: "visible", target: { role: "textbox", name: "Token" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Save and connect|保存并连接)$/ },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Cancel|取消)$/ },
          },
        ],
      },
      {
        id: "runtime-config-edit",
        steps: [
          {
            kind: "click",
            target: {
              selector:
                '[data-sidebar="menu-item"]:has-text("DingTalk") button',
            },
          },
          { kind: "visible", target: { selector: "[role=dialog]" } },
          {
            kind: "visible",
            target: { selector: '[role=dialog] [data-slot="dialog-title"]' },
          },
          { kind: "visible", target: { role: "textbox", name: "Token" } },
          /*
            提交键的文案是这两条分支唯一在可访问树上分得开的地方
            （`saveChanges` vs `saveAndConnect`）。拿它当锚点，等于顺手钉住
            「点已连接的那一行进的是编辑分支」。
          */
          {
            kind: "visible",
            target: { role: "button", name: /^(Save changes|保存修改)$/ },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Cancel|取消)$/ },
          },
        ],
      },
    ],
    dimensions: [
      DEFAULT_DIMENSION,
      { viewport: "desktop", theme: "light", locale: "zh-CN" },
    ],
  },
  {
    id: "thread-history-mermaid",
    title: "历史消息里的 Mermaid 图",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Mermaid history",
          updated_at: "2026-05-24T04:47:01.123949+00:00",
        },
      ],
    },
    routes: [
      {
        pattern: "**/api/langgraph/threads/*/runs*",
        json: [
          {
            run_id: MOCK_RUN_ID,
            thread_id: MOCK_THREAD_ID,
            status: "success",
            created_at: "2026-05-24T04:46:42.565307+00:00",
            updated_at: "2026-05-24T04:47:01.123949+00:00",
          },
        ],
      },
      {
        pattern: `**/api/threads/${MOCK_THREAD_ID}/messages/page*`,
        json: {
          data: [
            {
              thread_id: MOCK_THREAD_ID,
              run_id: MOCK_RUN_ID,
              event_type: "llm.ai.response",
              category: "message",
              content: {
                content: MERMAID_CONTENT,
                additional_kwargs: {},
                response_metadata: {},
                type: "ai",
                name: null,
                id: "lc_run--issue-3193",
                tool_calls: [],
                invalid_tool_calls: [],
              },
              seq: 720,
              created_at: "2026-05-24T04:47:01.123949+00:00",
              metadata: {
                caller: "lead_agent",
                content_is_json: true,
                content_is_dict: true,
              },
            },
          ],
          has_more: false,
          next_before_seq: null,
        },
      },
    ],
    /*
      两个锚点：消息正文 + 图本身。

      正文那条确定「这条历史消息已经从 messages/page 加载并渲染完了」。

      图那条是 wave 10 加的，此前**故意没加**，理由是「让锚点兼任断言的话，一边
      渲染不出来时得到的是超时而不是台账里那一行」——那条理由在 Vue 侧还画不出
      工具栏时成立，因为那 15 行差异正是当时的产出。现在两边都画得出来，剩下的
      只有时序，而时序不加锚点就是掷骰子：实测 React 侧从 `runScenario` 返回到
      图渲染完要 418 / 431 / 631 / 728ms（2026-08-31 四次，机器空闲），而
      captureScenario 的静置窗口是 700ms。也就是说不等这一条，同一份代码会在
      「0 行」和「15 行 ariaOnlyVue」之间随机跳——一份随机变红的台账等于没有台账。

      现在一边真的渲染不出来时得到的是超时。那比 15 行来路不明的差异更准确：
      它指向「图没出来」这一件事，而不是让人去逐行读那 15 行再反推同一个结论。
    */
    settle: [
      { kind: "visible", target: { text: "Here is a relationship diagram." } },
      { kind: "visible", target: { selector: '[data-streamdown="mermaid"]' } },
    ],
    /*
      图表工具条上唯一「点一下才出现」的东西：下载菜单。

      **上游那一侧不是上游源码**，是 `streamdown` 这个 npm 包的发布产物（装在上游的
      依赖目录里，文件名带构建哈希、每次装都会变，所以这里**不写死那个文件名**），
      锚点名字是去那份产物里核出来的，不是照本仓词典猜的：触发器 `title="Download diagram"`，
      三个菜单项的可见文字是 `SVG` / `PNG` / `mmd`，`title` 是
      `Download diagram as SVG|PNG|MMD`。

      菜单项**有可见文字**，所以可访问名来自文字而不是 title（title 退成描述），
      第三项因此写成两边都认的 `/^(mmd|MMD)$/`——**放宽的是锚点不是判据**：
      两个应用各自的可访问性树照样整棵进台账，大小写差异该报还是会报。
    */
    states: [
      { id: "default", steps: [] },
      {
        id: "download-menu",
        steps: [
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Download diagram|下载图表)$/,
            },
          },
          { kind: "visible", target: { role: "button", name: /^SVG$/ } },
          { kind: "visible", target: { role: "button", name: /^PNG$/ } },
          { kind: "visible", target: { role: "button", name: /^(mmd|MMD)$/ } },
        ],
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "workspace-changes",
    title: "工作区改动摘要",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Workspace changes",
          updated_at: "2026-07-04T10:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-workspace-changes",
              content: [{ type: "text", text: "Create a report" }],
              run_id: WORKSPACE_CHANGES_RUN_ID,
            },
            {
              type: "ai",
              id: "msg-ai-workspace-changes",
              content: "I updated the workspace report.",
              run_id: WORKSPACE_CHANGES_RUN_ID,
            },
          ],
        },
      ],
    },
    routes: [
      MODELS_ROUTE_THINKER_FIRST,
      {
        pattern: "**/api/threads/*/runs/*/workspace-changes*",
        json: {
          available: true,
          version: 1,
          summary: {
            created: 1,
            modified: 1,
            deleted: 0,
            symlink_created: 0,
            additions: 8,
            deletions: 2,
            truncated: false,
          },
          files: [
            {
              path: "/mnt/user-data/outputs/report.md",
              root: "outputs",
              status: "modified",
              binary: false,
              sensitive: false,
              size_before: 12,
              size_after: 20,
              sha256_before: "before",
              sha256_after: "after",
              diff: "--- a/mnt/user-data/outputs/report.md\n+++ b/mnt/user-data/outputs/report.md\n@@ -1,2 +1,2 @@\n-Draft\n+Ready",
              diff_truncated: false,
              diff_unavailable_reason: null,
              additions: 1,
              deletions: 1,
            },
          ],
        },
      },
    ],
    /*
      推理强度菜单的展开态。它只在 supports_reasoning_effort 且当前不是 flash
      时才渲染，所以必须用 thinker-first 的目录——basic-first 会把模式收敛到
      flash，整个控件连同它的菜单一起消失。
    */
    settle: [
      { kind: "visible", target: { text: "I updated the workspace report." } },
    ],
    /*
      两个终态，都是模态的：推理档菜单开着的时候点不到「View changes」，
      反过来也一样。此前只能二选一，改动面板那一整块因此从来没进过取样面
      ——`states` 这一档就是为这件事加的（见 ParityScenario.states）。

      「View changes」这个可访问名是上游自己的 e2e 在用的
      （frontend/tests/e2e/workspace-changes.spec.ts:111），两边逐字相同；
      面板里那个 heading 的断言也照抄它下一行。
    */
    states: [
      {
        id: "reasoning-menu",
        steps: [
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Reasoning Effort|推理深度)[:：]/,
            },
          },
          {
            kind: "visible",
            target: { role: "menuitemradio", name: /^(Minimal|最低) / },
          },
        ],
      },
      {
        id: "changes-panel",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(View changes|查看更改)$/ },
          },
          {
            kind: "visible",
            target: {
              role: "heading",
              name: /(workspace changes|工作区变更)/i,
            },
          },
        ],
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "streaming-reasoning-order",
    title: "已结束回合里推理在答案之上",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    /*
      取的是 React spec 里**已结束**的那半边。另一半要挂一个「一直不关」的流服务器，
      那超出当前步骤词汇能表达的范围；顺序这件事在结束态同样可比。
    */
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Settled reasoning order",
          updated_at: "2026-06-04T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-4576",
              content: [{ type: "text", text: "Who are you?" }],
            },
            {
              type: "ai",
              id: "msg-ai-4576-settled",
              content: "I am DeerFlow, an open-source super agent.",
              additional_kwargs: {
                reasoning_content:
                  "The user asked who I am, so I will list the core capabilities.",
              },
            },
          ],
        },
      ],
    },
    settle: [
      {
        kind: "visible",
        target: { text: "I am DeerFlow, an open-source super agent." },
      },
    ],
    /*
      划词工具条的**选中态**挂在这里。

      交接文档从 wave 21 起写着「要守住它需要一条取样在选中态的**新场景**」。
      wave 30 把这句当假设重新验，结论是**不需要**：`select-text` 这条步骤 wave 21
      就有了，挡路的是 `sidecar-chat` 的最后一步——它在 select-text 之后紧接着
      click，而两个应用都在那次点击里把选区清掉，于是稳定态里根本没有工具条
      （scenarios 里那段注释说的就是这件事）。**不点**就取得到。

      挂在这条场景上，是因为它是一屏**已经结束**的会话（避开线索 134：首次发送
      之后上游在两个终态之间抛硬币），锚点只有正文那一行，而 sampleGeometry 只量
      settle 里的锚点，加一步不动几何面；请求面也不动（select-text 不发请求）。

      实测（2026-09-02，加步骤之前）：这一屏 aria 差 **1 行**——上游多一颗
      `button "Close"`。位置差得远得多（上游 367,197 / 本仓 955,642），但那是几何，
      而工具条不是 settle 锚点，台账天生量不到；位置与翻转由
      tests/unit/chat/selection-toolbar.dom.test.ts 守。
    */
    steps: [
      {
        kind: "select-text",
        scope: { testId: "main-message-list" },
        text: "I am DeerFlow, an open-source super agent.",
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "artifact-stream-state",
    title: "线程带 artifact 时的入口",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact stream state",
          updated_at: "2026-06-05T12:00:00Z",
          artifacts: ["/artifact-fixtures/report.md"],
          messages: [
            {
              type: "human",
              id: "msg-human-artifact",
              content: [{ type: "text", text: "Create a markdown report" }],
            },
            {
              type: "ai",
              id: "msg-ai-artifact",
              content: "Created a markdown report.",
            },
            /*
              present_files 这一整组此前没有任何样本走到过：上游给它一个专门的
              `assistant:present-files` 组，画的是文件卡片（文件名 + 类型 +
              下载链接），而不是通用的工具步骤折叠块。夹具里没有这种内容，
              两边画得多不一样都不会进台账（线索 114）。

              挂在这条场景上是因为它的锚点都不在会话流里：settle 只等头部的
              artifact-trigger，steps 全在面板内，所以多一组消息不动任何锚点
              （线索 113 说的折叠只发生在连续的**工具步骤**上，
              present_files 自己就是一个独立组）。

              文件名**不能**叫 report.md：steps 里有 `click text: report.md`，
              同名会让定位器一次命中两个节点直接 strict violation。

              路径不进 thread 的 artifacts 数组，卡片只读 tool_call 的 filepaths
              （两边都是），所以头部 artifact 计数不变。
            */
            {
              type: "ai",
              id: "msg-ai-present",
              content: "",
              tool_calls: [
                {
                  name: "present_files",
                  args: {
                    filepaths: ["/mnt/user-data/outputs/summary.txt"],
                  },
                  id: "call-present-1",
                  type: "tool_call",
                },
              ],
            },
            {
              type: "tool",
              id: "msg-tool-present",
              name: "present_files",
              tool_call_id: "call-present-1",
              content: "Successfully presented files",
            },
          ],
        },
      ],
    },
    /*
      正文只回一段并声明总长度，两个应用都会进入**截断**分支：提示条、
      「加载完整文件」、以及截断时代码区的渲染方式。此前没有任何样本走到这里，
      而 React 在截断时还会把代码/预览开关整个收起来（canPreview && !truncated）。
    */
    routes: [
      {
        pattern: "**/api/threads/*/artifacts/**",
        status: 206,
        contentType: "text/markdown",
        headers: {
          "Content-Range": "bytes 0-31/2097152",
          ETag: `"${"b".repeat(64)}"`,
        },
        json: "# report\n\nfirst chunk of a long file",
      },
    ],
    settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
    steps: [
      { kind: "click", target: { testId: "artifact-trigger" } },
      { kind: "visible", target: { text: "report.md" } },
      { kind: "click", target: { text: "report.md" } },
      {
        kind: "visible",
        target: { role: "button", name: /^(Load full file|加载完整文件)$/ },
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
  {
    id: "artifact-batched-stream",
    title: "批量写入后的 artifact 面板",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Artifact batched stream",
          updated_at: "2026-06-06T12:00:00Z",
          /*
            路径必须落在 /mnt/user-data/outputs/ 下，两个应用的编辑门槛都要求它
            （React 的 canEditOpenedArtifact 与 Vue 的 canSaveArtifactText 同一条规则）。

            另外两个文件是为了走到详情面板剩下的两条分支：图片走浏览器媒体预览，
            .docx 走「不能预览」的下载回退。它们和 markdown 那条一起挂在同一个线程上，
            靠头部的文件下拉切换——这是唯一不用新增场景 id 就能覆盖到的走法。
          */
          artifacts: [
            "/mnt/user-data/outputs/batched-report.md",
            "/mnt/user-data/outputs/diagram.png",
            "/mnt/user-data/outputs/report.docx",
            "/mnt/user-data/outputs/helper.skill",
          ],
          messages: [
            {
              type: "human",
              id: "msg-human-batched",
              content: [{ type: "text", text: "Create a markdown report" }],
            },
            {
              type: "ai",
              id: "msg-ai-batched",
              content: "Created a markdown report.",
            },
          ],
        },
      ],
    },
    /*
      正文与 ETag 都要给：没有正文两个应用各自报错（错误处理是另一处差异，会盖住
      这里要比的东西），没有 ETag 两边都拿不到 revision，于是编辑入口在两侧都不出现，
      「详情面板有哪些动作」这一整块就静默地没被比过。
    */
    routes: [
      {
        pattern: "**/api/threads/*/artifacts/**",
        contentType: "text/markdown",
        headers: { ETag: `"${"a".repeat(64)}"` },
        json: BATCHED_ARTIFACT_MARKDOWN,
      },
      {
        pattern: "**/parity-fixtures/chart.svg",
        contentType: "image/svg+xml",
        json: PARITY_FIXTURE_SVG,
      },
    ],
    settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
    /*
      **第⑥类的第三处，也是第一处真的走内容请求的**（wave 132）。

      wave 130 量过：`artifact-preview` 那份夹具接不了「预览失败」——它的产物是
      `write-file-artifact`，正文直接来自消息里的工具结果，**两个应用都不发
      `/api/threads/<id>/artifacts/<path>`**（探针：`/artifacts` 响应 0 条）。
      这个场景不一样：它的产物来自 thread 的 `artifacts` 清单，正文**必须**去取，
      场景自己那条 `routes` 就是喂正文的。把同一条 pattern 在终态上盖成 500，
      两个应用才第一次同时走到 `ArtifactPreviewError` 那一支。

      **锚点用 `artifactPreview.previewFailed` 的两种译文**——上游那一块**没有 testid**
      （`artifact-file-detail.tsx:731` 的 `ArtifactPreviewError`；本仓多一个
      `data-testid="artifact-preview-error"`，所以锚点不能用它）。

      顺带订正 wave 130/131 交接文档里的一句话：那里写着「造一份产物来自 artifacts
      清单的夹具，会**第一次**让文件下拉那条分支进取样面」——**假的**，
      这个场景本来就是那条分支（四个产物 + 头部下拉逐个切过去）。
    */
    states: [
      {
        id: "default",
        steps: [
          { kind: "click", target: { testId: "artifact-trigger" } },
          { kind: "visible", target: { text: "batched-report.md" } },
          // 从清单点进详情：这一支覆盖的是**正式产物**的详情面板（文件下拉、
          // 打开/下载/编辑动作、代码/预览切换），write-file 草稿那一支由
          // artifact-preview 覆盖。
          { kind: "click", target: { text: "batched-report.md" } },
          // 详情面板独有的锚点：清单那一支的下载是 link，只有详情面板里它是 button。
          // 不用文件下拉当锚点——它**没有可访问名**（照 React 的 SelectTrigger），
          // 按名字根本定位不到。
          {
            kind: "visible",
            target: { role: "button", name: /^(Download|下载)$/ },
          },
          // 再点进编辑态：编辑器、保存/退出/放弃，以及「有未保存的改动」那条播报，
          // 此前一条样本都走不到。上面的 ETag 就是为这一步准备的——没有 revision，
          // 两个应用都不会显示编辑入口。
          // 名字用锚定正则：`name: "Edit"` 是子串匹配，会先命中消息工具条上的
          // "Edit and rerun"，一路点进消息编辑态。
          { kind: "click", target: { role: "button", name: /^(Edit|编辑)$/ } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Exit editing|退出编辑)$/ },
          },
          {
            kind: "click",
            target: { role: "button", name: /^(Exit editing|退出编辑)$/ },
          },
          /*
        文件下拉**没有可访问名**（照 React 的 SelectTrigger），只能按选择器定位；
        `[role="combobox"]` 是两个应用共有的表达。切到图片走媒体预览分支，
        再切到 .docx 走下载回退分支。
      */
          { kind: "click", target: { selector: '[role="combobox"]' } },
          { kind: "click", target: { role: "option", name: "diagram.png" } },
          { kind: "visible", target: { selector: 'img[alt="diagram.png"]' } },
          { kind: "click", target: { selector: '[role="combobox"]' } },
          { kind: "click", target: { role: "option", name: "report.docx" } },
          { kind: "visible", target: { text: /^Word (file|文件)$/ } },
          // 最后切到 .skill：replay Gateway 的用户是管理员，所以安装入口在两边都该出现。
          { kind: "click", target: { selector: '[role="combobox"]' } },
          { kind: "click", target: { role: "option", name: "helper.skill" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Install|安装)$/ },
          },
          /*
        最后切回 markdown，让这一份样本**停在渲染好的 markdown 预览上**。
        前面几支的可达性由上面的步骤各自断言过了，但一个场景只取一份样本——
        停在 .skill 上，整棵 markdown 渲染树就一行都没被比过。
      */
          { kind: "click", target: { selector: '[role="combobox"]' } },
          {
            kind: "click",
            target: { role: "option", name: "batched-report.md" },
          },
          {
            kind: "visible",
            target: { role: "link", name: "the upstream repo" },
          },
        ],
      },
      {
        id: "preview-failed",
        routes: [
          {
            pattern: "**/api/threads/*/artifacts/**",
            status: 500,
            json: { detail: "boom" },
          },
        ],
        steps: [
          { kind: "click", target: { testId: "artifact-trigger" } },
          { kind: "visible", target: { text: "batched-report.md" } },
          { kind: "click", target: { text: "batched-report.md" } },
          {
            kind: "visible",
            target: {
              text: /^(This file could not be previewed\. You can still download it\.|无法预览此文件，但仍可下载原始文件。)$/,
            },
          },
        ],
      },
    ],
    dimensions: [DEFAULT_DIMENSION, ZH_DIMENSION],
  },
];
