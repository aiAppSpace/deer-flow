/*
  【文件职责】     在一个应用上跑完一个场景，取下可比对的样本：可访问性树 + API 请求序列。
  【架构位置】     对照测试基础设施
  【主要导出】     ParityCapture · normalizeRequest · sampleGeometry · captureScenario ·
                   waitForFiniteAnimations
  【依赖关系】     ./scenarios · ../../../scripts/lib/aria-parity.mjs · @playwright/test
  【边界与注意】   取样只保留两边都会发的**产品请求**：`/api/` 下面的那些。框架自己的
                   资源与载荷请求（Next 的 `_next` 与 RSC、Nuxt 的 `_nuxt` 与 payload）
                   被丢掉，不是因为它们不重要，而是因为它们**天然不可能相同**——
                   两个框架各有自己的加载协议。把它们留在比对里，等于让报告的每一行
                   都在说「Next 不是 Nuxt」，真差异会淹死在里面。

                   请求按**多重集**比对，不比顺序。顺序有价值，但并发请求之间的先后
                   本来就没有保证，直接比顺序会得到一份随机变红的门禁。是否稳定到能
                   比顺序，由 diff.spec.ts 里的自一致性用例实测回答——在有测量结果
                   之前不加这条判据。

                   同理，归一化规则只能因为实测而增加：每一条都在抹掉信息。
                   目前只有一条，来自第一次测量：`/workspace/chats/new` 上两个应用
                   各自**在客户端生成**一个新线程 id，于是 `uploads/limits` 的路径
                   每次都不同，而且两边必然不同。它不是产品差异，是这个页面的定义。

                   但不能把所有 UUID 一律抹掉：那样「React 打开的是线程 1、Vue 打开
                   的是线程 2」也会一起消失，而那是货真价实的差异。所以判据是
                   **白名单**——场景自己声明它认识哪些 id，其余 UUID 形状的段才算
                   客户端生成。
*/

import type { Page, Request } from "@playwright/test";

import {
  MOCK_RUN_ID,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "../../e2e/utils/mock-api";

import {
  normalizeAriaSnapshot,
  normalizeAriaTree,
} from "../../../scripts/lib/aria-parity.mjs";
import {
  ARCHIVE_LEGACY_THREAD_ID,
  HISTORY_THREAD_ID_NEWEST,
  HISTORY_THREAD_ID_OLDER,
  locateTarget,
  PARITY_PROJECT_ID,
  runScenario,
  WORKSPACE_CHANGES_RUN_ID,
  type ParityDimension,
  type ParityScenario,
  type ParityState,
  type ParityTarget,
} from "./scenarios";

export type ParityCapture = {
  aria: string;
  /** 带深度的同一棵树，只给 `diffAriaDepth` 用。 */
  ariaTree: { depth: number; body: string }[];
  /** 归一化后的产品 API 请求，按发出顺序。 */
  requests: string[];
  /**
   * 带请求体的那些请求：归一后的键 + 归一后的 JSON 体。
   *
   * **「天生看不见的八类」里的第②类**（交接文档那一节）：`requests` 只比
   * `METHOD /path?query`，**请求体一个字节都不进取样面**。这不是理论问题——
   * 上游 `mcp-settings.spec.ts` 自己断言的就是「PUT body 里没丢 advanced 字段、
   * 也没动到兄弟条目」，而那正是台账看不到的一半。
   *
   * 只收**真的带体**的请求（GET 没有体）。非 JSON 的体原样留着——
   * 抹掉它等于假装它不存在，而硬规则 2 说归一化只能因为实测而增加。
   */
  requestBodies: { key: string; body: string }[];
  /** 场景锚点的盒模型与关键计算样式。 */
  geometry: Record<string, GeometrySample | null>;
  /** 取样时刻的 `document.activeElement`，归一成一句话。见 describeFocus。 */
  focus: string;
  /** 取样时刻**能用 Tab 走到**的元素，按 DOM 顺序，各归一成一句话。见 sampleTabbables。 */
  tabbables: string[];
  /**
   * 取样时刻的**最终路径**（只取 pathname，不含 host 与查询串）。
   *
   * 不进台账——它不是「两边有什么差异」，而是「这次比的是不是同一屏」。
   * wave 191 录过一份基线：React 停在 `/login`、Vue 因为夹具把它当成已登录而跳去了
   * `/workspace/chats/new`，**每一档都满是行、看起来像一份丰收的差异清单**。
   * 那种情形下该做的是当场红，不是签收；而两个应用的最终路径是判断它最直接的证据
   * ——比「两棵树有多少公共行」准得多：同一屏但一侧没翻译时，公共行同样会塌到近乎零
   * （wave 194 实测：上游的安装页在 zh-CN 下几乎整屏英文，公共行只有 3）。
   */
  url: string;
};

/**
 * 一个锚点的可见几何与色板。
 *
 * 只取用户能看见的量：位置、尺寸、前景/背景色、字号。不取 class、不取内边距的
 * 具体来源、也不取组件库的包装层——那些是 ARCHITECTURE 里只对齐可观察行为的地方。
 *
 * `x` / `y` 是**未滚动布局里的文档坐标**，不是视口坐标，见 sampleGeometry。
 */
export type GeometrySample = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  fontSize: string;
  /*
    字重。**加这一档是因为它是一处真的盲区**（wave 140）：
    本仓的 `DropdownMenuLabel` 基类丢掉了上游的 `font-medium`，于是 token 用量菜单的
    分组标题上游是 medium、本仓是 semibold——**aria 树不带字重，几何档此前也不采样它，
    命中测试与 opacity 更不相干**，四档同时看不见。
    坑 258 的判据（「有没有一种变异能让它响、而现有的档都不响」）在这一条上有现成答案：
    只改一个 `font-weight`，其余各档一行都不会动。
  */
  fontWeight: string;
  /*
    圆角。

    **加这一档是因为它是一处真的盲区**（2026-09-12 第九轮撞出来的）：
    几何档量位置、尺寸、前景/背景色、字号、字重、opacity、命中与伪元素，
    **一样都不是形状**。把一块面板的 `rounded-2xl` 改成 `rounded-md`，
    盒子的 x/y/宽高一个数都不动、颜色不动、字重不动、命中不动——
    **现有各档一条都不响**（坑 258 那句判据在这一条上有现成答案）。

    这不是假想的形状：上游的 composer 外壳是靠调用点一句
    `*:data-[slot='input-group']:rounded-2xl` 把 `ui/input-group` 的 `rounded-md`
    顶掉的（`input-box.tsx:2265`），而本仓那块是手写的 `ComposerSurface.vue`。
    第九轮把那块外壳挂成锚点、12 维零差异——**但那个「零」不包括形状**，
    判词里写明了这条边界，这一档就是来补它的。

    **只取 `borderRadius` 一个属性，不取 `boxShadow` / `backdropFilter`**：
    后两者的计算值里带颜色与长度的组合写法，浏览器归一化之后噪声比信号多
    （`rgba(0,0,0,0.05) 0px 1px 2px 0px` 这种串两边一个空格的差别就报一行）。
    真要加，先按同一条判据单独论证。

    四个角各不相同时 `getComputedStyle` 返回的是四段（`8px 8px 0px 0px`），
    所以这一档天然覆盖「只有上面两个角是圆的」这类写法，不需要分别取四个属性。
  */
  borderRadius: string;
  /*
    元素**自己**的 opacity。

    加这一档是因为它是一处真的盲区：`opacity: 0` 的元素**照样在可访问性树里**
    （不是 `display:none` 也不是 `visibility:hidden`），照样有 x/y/宽高，
    computed `color` 也一点不变——也就是说「一边看得见、另一边看不见」这件事，
    aria、几何、请求三档**同时**都报不出来。消息动作条那一排就是这样：
    两个应用都写 `opacity-0 group-hover:opacity-100`，而在这之前没有任何门禁
    量过它到底是 0 还是 1。

    只取元素自己的值，不把祖先链乘起来：乘起来的话，一处祖先透明度差异会让
    它下面每个锚点同时报一行，而那是同一处差异的 N 个投影（坑 219 的同一件事）。
  */
  opacity: string;
  /**
   * 这个锚点的中心点上，真正拿到指针的是不是它自己（或它的后代）。
   *
   * **它答的问题现有各档都答不了**（坑 258 的判据）：一颗按钮可以名字对、
   * 位置对、尺寸对、颜色对、能 tab 到——**却点不动**，因为
   * `pointer-events: none`，或者被一层透明浮层盖住了。
   * aria 看不见它，几何看不见它（盒模型没变），tab 序也看不见它（照样可聚焦）。
   *
   * 取 `elementFromPoint(中心)`：命中自己或自己的后代记 `self`；
   * 命中别的记那个元素的**标签与 role**（不记名字——名字是 aria 档的活，坑 255）；
   * 点落在视口外记 `off-screen`（两边都这样时 diffGeometry 会当成相同）。
   *
   * **只对「点得动才有意义」的元素量，其余记 `n/a`**——这一条是量出来才加的：
   * 第一版对所有锚点都量，三行差异**全部来自 `text:` 锚点**
   * （`text:Which environment should I deploy to? hit React=textarea Vue=div(group)`、
   * `text:Here is a relationship diagram. hit React=header Vue=self`）。
   * `getByText` 解析到的是**包着这段文字的元素**，它的盒子可能很宽，
   * 中心点落在贴顶的 header 或压在上面的输入框上——**那不是「这段文字被挡住了」，
   * 是「盒子中心恰好在别的东西下面」**，对一段正文来说也没有任何后果。
   * 判据因此收成：**它是不是一个用户要去点的东西**。
   */
  hit: string;
  /*
    `::before` / `::after` 画出来的东西。**这是台账天生看不见的第⑨类**
    （wave 145 的负向验证 N2 暴露、wave 146 补上）。

    几何档量的一直是**元素**：`getBoundingClientRect` 与不带第二参的
    `getComputedStyle` 都碰不到伪元素。这不是理论上的缺口——上游 Tabs 的
    `line` 那一档，**选中态整根下划线就画在 `::after` 上**
    （`group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100`），
    也就是说 wave 145 刚搬进来的那套 variant，视觉主体没有任何一档在守。
    当时的识别信号很干脆：把它依赖的 `group/tabs` 删掉，**台账零反应**。

    坑 258 的门槛（「有没有一种变异能让这一档响、而现有的档都不响」）
    在这一条上有现成答案：**N2 本身就是**。

    **只记「画没画出来、画多大」，不记位置**：伪元素的 x/y 跟着宿主走，
    宿主的位置已经是 x/y 两档在报的事，再报一遍就是同一处差异的第二个投影
    （坑 219）。`content: none` 记成 `none`——那是「这个伪元素不存在」，
    两边都不存在时不产生任何行。
  */
  before: string;
  after: string;
};

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 场景认识的 id。不在这里面的 UUID 形状路径段视为客户端生成。 */
export const KNOWN_IDS = new Set([
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_RUN_ID,
  // wave 120 补：这三个是场景里的夹具 id，此前被当成客户端生成的抹掉了。
  HISTORY_THREAD_ID_NEWEST,
  HISTORY_THREAD_ID_OLDER,
  WORKSPACE_CHANGES_RUN_ID,
  // 项目详情页那条场景的项目 id（scenarios.ts 的 PARITY_PROJECT_ID）。
  PARITY_PROJECT_ID,
  // 归档场景里那条「比一整页归档还旧」的活跃会话。
  ARCHIVE_LEGACY_THREAD_ID,
]);

/**
 * 把一个请求归一成 `METHOD /path?sorted-query`；不是产品 API 请求则返回 null。
 */
export function normalizeRequest(
  method: string,
  url: string,
  knownIds: ReadonlySet<string> = KNOWN_IDS,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.pathname.startsWith("/api/")) return null;

  const pathname = parsed.pathname
    .split("/")
    .map((segment) =>
      UUID_SEGMENT.test(segment) && !knownIds.has(segment)
        ? "«generated»"
        : segment,
    )
    .join("/");

  /*
    **这里原来还有一张 `VOLATILE_QUERY_KEYS = {_, t, ts, cacheBust}` 的丢弃表**，
    wave 121 量掉了：给这段装探针跑一整轮，**116 次查询参数观测，`DROPPED` 0 次**
    ——四条一条都没响过。而那个 0 是**算出来的**：同一轮的控制组打印了实际出现的
    参数（`include_files` 48 / `include_diff` 48 / `limit` 8 / `task_id`、`offset`、
    `event_types` 各 4），证明探针在跑（线索 195）。

    删掉的理由不是「没用」，是**它在抹信息而没有证据**（硬规则 2：归一化规则只能
    因为实测而增加）——`t` / `ts` 完全可能是产品自己的参数名，真出现时会被静默丢掉，
    与 wave 120 那三个夹具 id 是同一类失效。

    **真需要再加时的做法**：先让台账把那个抖动的参数报出来（它会作为一条
    requests 差异出现），拿着那条读数再加，别凭「看起来像缓存参数」加。
  */
  const params = [...parsed.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return `${method.toUpperCase()} ${pathname}${query}`;
}

/**
 * 把一个 JSON 值归一成**稳定可比**的字符串。
 *
 * 只做两件事，一件都不多：
 * 1. 对象按 key 排序——两个应用序列化字段的顺序天然可能不同，而那不是差异；
 * 2. UUID 形状且不在 `KNOWN_IDS` 里的字符串抹成 `«generated»`——与
 *    `normalizeRequest` 对路径段用的**同一条规则、同一份名单**，
 *    理由也一样（客户端生成的 id 两边必然不同）。
 *
 * **没有第三条**。时间戳、随机 nonce 这类看起来"显然该抹"的东西一律不抹：
 * 硬规则 2 说归一化只能因为实测而增加——真出现了，它会作为一条 body 差异
 * 报出来，拿着那条读数再加（`normalizeRequest` 里那张被删掉的
 * `VOLATILE_QUERY_KEYS` 表就是这么量掉的）。
 */
export function canonicalJson(
  value: unknown,
  knownIds: ReadonlySet<string> = KNOWN_IDS,
): unknown {
  if (typeof value === "string")
    return UUID_SEGMENT.test(value) && !knownIds.has(value)
      ? "«generated»"
      : value;
  if (Array.isArray(value))
    return value.map((item) => canonicalJson(item, knownIds));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort())
      out[key] = canonicalJson(
        (value as Record<string, unknown>)[key],
        knownIds,
      );
    return out;
  }
  return value;
}

/**
 * 请求体归一成一行。**解析不了 JSON 就原样留着**——
 * 静默丢掉一个"不认识"的体，与 wave 120 那三个夹具 id 是同一类失效。
 */
export function normalizeRequestBody(
  raw: string,
  knownIds: ReadonlySet<string> = KNOWN_IDS,
): string {
  try {
    return JSON.stringify(canonicalJson(JSON.parse(raw), knownIds));
  } catch {
    return raw;
  }
}

/**
 * 跑一个场景并取样。
 *
 * settle 之后再静置一小段：有些请求是渲染完成后才发的（token 用量、features）。
 * 静置窗口是取样的一部分，两个应用用同一个值，否则「谁被多等了一会儿」会变成
 * 一条假差异。
 */
/** 锚点的稳定标识。两个应用用同一份场景数据，所以标识天然一致。 */
export function targetLabel(target: ParityTarget): string {
  if ("testId" in target) return `testId:${target.testId}`;
  if ("selector" in target) return `selector:${target.selector}`;
  if ("role" in target) return `role:${target.role}[${String(target.name)}]`;
  return `text:${String(target.text)}`;
}

/**
 * 取每个锚点的几何与色板。
 *
 * 位置量的是**布局**，不是滚动状态——这是它与 `getBoundingClientRect()` 的全部区别。
 *
 * rect 给的是视口坐标，等于把祖先容器滚了多少也一起量了进去。实测：
 * `thread-history-mermaid` 的锚点在 stick-to-bottom 的会话流里，React 侧同一份布局
 * 量出来的 y 在 3/3/2/1/-1/4 之间跳（2026-08-26 单日统计 3,2,3,2,3,3,2,2），因为
 * mermaid 图是异步渲染的，内容高度一变容器就重新贴底；Vue 侧那条流没溢出，恒为 72。
 * 台账里那条 `Δ69` 因此**整条都是滚动状态**，与布局无关，却让门禁约一半概率变红。
 *
 * 所以把祖先链上每一层的 scrollLeft/scrollTop 加回去：容器滚多少，元素的视口坐标
 * 就少多少，两者相加恒等于未滚动布局里的文档坐标。页面级滚动也在这条链上
 * （documentElement.scrollTop 就是 scrollY），不用另外加。
 *
 * **不是**「相对最近可滚动祖先的内容原点」。那个写法量过，它换来的东西更糟：
 * 参照系变成各应用自己的 DOM。实测同一次取样里，mermaid 锚点 React 的最近可滚动
 * 祖先是会话流那个 div、Vue 那条流没溢出于是退回文档，两边的 x 明明都是 375.5，
 * 相对坐标却差 256；`integrations` 的 "Lark / Feishu CLI" 同样差 381，
 * `scheduled-tasks` 的 "Daily summary" 差 360。对照比的是两个应用，参照系必须与
 * 应用无关——文档原点是，最近可滚动祖先不是。
 *
 * 「量出来与滚到哪里无关」这条判据由 diff.spec.ts 的滚动不变性用例实测钉住，
 * 不是这里的注释说了算。
 */
export async function sampleGeometry(
  page: Page,
  scenario: ParityScenario,
  state: ParityState,
): Promise<Record<string, GeometrySample | null>> {
  const samples: Record<string, GeometrySample | null> = {};
  /*
    取 `settle` **与 `steps`** 里的 `visible` 锚点。

    此前只取 settle 那一半，理由写的是「click/fill 的目标在交互后可能已经移动或
    消失，拿它们量几何是在量时序」——**那句话只对 click/fill 成立**。
    `steps` 里的 `visible` 是另一回事：它是「这次交互该让什么出现」，
    场景本身就在等它稳定，拿它量几何与拿 settle 的锚点量没有区别。

    漏掉这一半的代价是线索 137 的正题：**靠交互才出现的东西，位置永远进不了台账**
    ——artifact 面板、agent 建成那屏、批量流的文件列表，几何档一格都没量过。
    wave 76 把它接上，新增约 20 个锚点。

    仍然**不取** click / fill 的目标：那些是「点哪里」，不是「该出现什么」，
    点完之后它可能已经不在了。

    **`hidden` 的目标也取（wave 165）。** 听着别扭——场景刚断言它不可见，为什么还量它？
    因为「不可见」在这套取样面里有两种：**元素不在**（两边都 `null`，diffGeometry 跳过，
    等于没取）和**元素在、只是不占位或透明**。后一种正是**装饰层**的常态：
    子任务卡片底下那层 `.ambilight` 永远在 DOM 里，只有 in_progress 时才加 `.enabled`
    拿到 opacity，其余时候盒子高度为 0——于是 `visible` 匹配不上，
    **它连同它的伪元素（那条无限循环的环境光动画就画在 `::before`/`::after` 上）
    在此之前一格都没被量过**。wave 161 两边同改把那条动画收进减动分支时台账零反应，
    就是因为这里。

    代价接近零：现有三处 `hidden` 步骤的目标本来就不存在，两边都记 `null`。
  */
  for (const step of [...scenario.settle, ...state.steps]) {
    if (step.kind !== "visible" && step.kind !== "hidden") continue;
    const label = targetLabel(step.target);
    const locator = locateTarget(page, step.target).first();
    /*
      **每个锚点最多等 2 秒。**

      `steps` 里的 `visible` 锚点到取样时可能已经不在了——`artifact-batched-stream`
      一路点过好几个文件，先前那几条 `visible` 早被换掉。`locator.evaluate` 自带
      auto-wait，用默认超时的话每个消失的锚点要卡满 30 秒：wave 76 第一版就是这么
      把整条 diff 用例从 4 分钟拖到 10 分钟超时的（报错是 context 被拆掉时的
      `page.route: Target page ... has been closed`，看不出真正的原因）。

      两秒够长：这里已经在 `settleMs` 之后，真还在的元素不需要等。
      两秒之后仍拿不到就记 `null`——**两边都是 `null` 时 diffGeometry 会跳过**，
      「两个应用都没有这个锚点」没有可比的几何。
    */
    samples[label] = await locator
      .evaluate(
        async (element) => {
          /** 未滚动布局里的文档坐标 + 尺寸。见函数头。 */
          const layoutBox = () => {
            const rect = element.getBoundingClientRect();
            let scrolledLeft = 0;
            let scrolledTop = 0;
            for (
              let ancestor = element.parentElement;
              ancestor;
              ancestor = ancestor.parentElement
            ) {
              scrolledLeft += ancestor.scrollLeft;
              scrolledTop += ancestor.scrollTop;
            }
            return {
              x: rect.x + scrolledLeft,
              y: rect.y + scrolledTop,
              width: rect.width,
              height: rect.height,
            };
          };

          /*
          先等布局停下来再量。

          实测：mermaid 场景里 React 侧同一个锚点的 y 在两次运行之间差 1px——
          它下面的图是异步渲染的，量早了就量到中间态。这类抖动不是产品差异，但
          它会让清单每跑一次变一行，而一份每次都变的清单等于没有清单。

          判据是「连续两帧盒模型不变」，不是「等固定毫秒」：固定等待在慢机器上
          仍然会量到中间态，只是概率低一点，而低概率的假差异比高概率的更难查。

          等的是**布局**盒模型。此前这里比的是视口 rect，于是在 stick-to-bottom
          的容器里它永远等不到「不再变」——变的是滚动而不是布局，加长判据
          （试过连续 3 帧、6 帧）自然也不收敛。
        */
          const frame = () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
          const boxOf = () => {
            const { x, y, width, height } = layoutBox();
            return `${x}|${y}|${width}|${height}`;
          };
          let previous = boxOf();
          for (let attempt = 0; attempt < 40; attempt++) {
            await frame();
            await frame();
            const current = boxOf();
            if (current === previous) break;
            previous = current;
          }

          const box = layoutBox();
          const style = globalThis.getComputedStyle(element);
          const round = (value: number) => Math.round(value * 10) / 10;
          /*
          计算样式给出的颜色**记法**两边不同：实测 React 侧序列化成
          `lab(2.75381 0 0)`，Vue 侧是 `oklch(0.145 0 0)`——而这两个是同一个颜色
          （都解析成 rgba(10,10,10,255)）。直接比字符串等于在比记法，会让台账里
          塞满假条目，而假条目比没有条目更糟：它会让人不再相信这份清单。
          让浏览器自己画一像素再读回来，比的就是最终呈现的颜色。
        */
          /*
            命中测试用**视口坐标**：`elementFromPoint` 就是按视口取的。
            上面那套「把祖先滚动加回去」是为了让**位置**与滚动无关，两件事不冲突。
          */
          const clickable = element.matches(
            "a[href],button,input,select,textarea,summary,[role=button]," +
              "[role=menuitem],[role=menuitemradio],[role=option],[role=tab]," +
              "[role=switch],[role=checkbox],[role=separator],[contenteditable=true]",
          );
          const viewportRect = element.getBoundingClientRect();
          const cx = viewportRect.left + viewportRect.width / 2;
          const cy = viewportRect.top + viewportRect.height / 2;
          const topmost =
            cx >= 0 &&
            cy >= 0 &&
            cx <= globalThis.innerWidth &&
            cy <= globalThis.innerHeight
              ? document.elementFromPoint(cx, cy)
              : null;
          const hit = !clickable
            ? "n/a"
            : !topmost
              ? "off-screen"
              : element.contains(topmost)
                ? "self"
                : `${topmost.tagName.toLowerCase()}${
                    topmost.getAttribute("role")
                      ? `(${topmost.getAttribute("role")})`
                      : ""
                  }`;

          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext("2d");
          const toRgba = (value: string) => {
            if (!ctx) return value;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = "#000";
            ctx.fillStyle = value;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
            return `rgba(${r},${g},${b},${a})`;
          };
          /*
            伪元素。`content: none` 表示它压根不存在——两边都不存在时
            这一档不产生任何行。存在时记：内容、透明度、宽高、底色。
            **不记位置**，理由见 `GeometrySample.after` 的注释。
          */
          const pseudo = (which: string) => {
            const ps = globalThis.getComputedStyle(element, which);
            if (ps.content === "none" || ps.content === "normal") return "none";
            const size = (value: string) =>
              round(Number.parseFloat(value) || 0);
            return (
              `content=${ps.content} op=${ps.opacity} ` +
              `w=${size(ps.width)} h=${size(ps.height)} ` +
              `bg=${toRgba(ps.backgroundColor)} ` +
              // 装饰层的「动没动」此前一格都没量过：wave 160~162 两边同改了四条
              // 无限循环动画，台账全程零反应。`animationName` 是唯一能看见它的字段
              // ——几何、颜色、opacity 在动画停住前后都一样。
              `anim=${ps.animationName}`
            );
          };

          return {
            x: round(box.x),
            y: round(box.y),
            width: round(box.width),
            height: round(box.height),
            color: toRgba(style.color),
            background: toRgba(style.backgroundColor),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            borderRadius: style.borderRadius,
            opacity: style.opacity,
            hit,
            before: pseudo("::before"),
            after: pseudo("::after"),
          };
        },
        undefined,
        { timeout: 2_000 },
      )
      .catch(() => null);
  }
  return samples;
}

/**
 * 把取样时刻的焦点归一成一句可比的话。
 *
 * **这是台账天生看不见的第八类**（交接文档里 wave 28 就记下了，wave 94 才补上）：
 * `document.activeElement` 不进 aria 快照、不是几何量、也不进请求，
 * 所以「打开这一屏之后光标在哪」这件事，此前**三档同时报不出来**，
 * 只能靠临时 probe 里顺手加一行——而临时 probe 跑完就没了。
 * wave 28 正是这样发现建 agent 页与 composer 都少了 autoFocus 的。
 *
 * **取什么、不取什么**——三条都是第一版量出来才定的（尺子先量自己，坑 213）：
 *
 * 1. **`type` 只对 `input` 取。** 第一版对所有标签都取，于是 `subtask-card` 与
 *    `scheduled-tasks` 各报一行 `button "X"` vs `button[button] "X"`——
 *    **同一颗按钮、同一个名字**，差的只是上游没写 `type="button"` 而本仓写了。
 *    那是「按钮怎么声明」，不是「焦点在哪」。`input` 留着，因为 text/password
 *    对使用者是两回事。
 * 2. **文字只对「文字就是它名字」的标签取**（button / a / summary / label / option）。
 *    第一版对所有标签兜底取 `textContent`，于是三个场景各报一行
 *    `div "SettingsDeerFlow's official website…"` vs `div "Settings DeerFlow's…"`
 *    ——焦点在**同一个没有名字的容器**上，差的只是子节点之间有没有空白文本节点。
 *    那是 aria 树该管的事，不该在焦点这一档里再报一遍。
 * 3. **不取 `data-testid` / `id` / `class`**：testid 两个应用本来就不是一一对应
 *    （本仓补了不少上游没有的），`id` 是 reka/radix 生成的（aria 归一化里已经
 *    抹掉一批），`class` 是 ARCHITECTURE 明写不对齐的三处之一。
 *
 * 剩下的形状只有两种：`body` / `(none)`，或者 `标签[类型] "名字"`。
 */
export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return "(none)";
    if (element === document.body) return "body";
    const tag = element.tagName.toLowerCase();
    const type = tag === "input" ? element.getAttribute("type") : null;
    const textIsName = ["button", "a", "summary", "label", "option"].includes(
      tag,
    );
    const name =
      element.getAttribute("aria-label") ??
      element.getAttribute("placeholder") ??
      element.getAttribute("title") ??
      (textIsName
        ? (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
        : "");
    return `${tag}${type ? `[${type}]` : ""}${name ? ` "${name}"` : ""}`;
  });
}

/**
 * 取样时刻**能用 Tab 走到**的元素，按 DOM 顺序。
 *
 * **它比 aria 树多出来的信息是「能不能 tab 到」**：一个节点可以在可访问性树里
 * 好端端地待着，却因为 `tabindex="-1"`、`disabled`、`display:none` 或者被
 * `inert` 盖住而根本走不到——反过来，一个 `tabindex="0"` 的 `<div>` 在树里
 * 可能只是个 generic。两个应用的 aria 树逐行相同、tab 序却不同，是完全可能的，
 * 而在这之前没有任何一档量它（wave 86 那处「上游多一层 menu > link > menuitem
 * 嵌套可交互元素」正是这一类：多出来的那个 `<a>` 会**自己进 tab 序**）。
 *
 * **判据取「原生可聚焦 + 显式 tabindex >= 0」，再逐个问浏览器它到底可不可见**：
 * `offsetParent` 为空（`display:none` 或祖先如此）与 `disabled` 都排除。
 * `visibility:hidden` 靠 computed style 排除。**不排 `opacity: 0`**——
 * 那种元素照样能 tab 到，那正是 wave 91 那一档要管的事。
 *
 * **不做完整的 tabindex 排序**：正数 tabindex 会插队，但那本身就是一处该报的
 * 差异；这里按 DOM 顺序取，两边一旦有一边用了正数 tabindex，顺序档就会报出来。
 *
 * **描述只取「标签 + 显式 role」，不取名字**——这一条是量出来才定的。
 * 第一版把名字也放进来，114 行差异里**只有一处是新东西**：
 * 其余 40 行是「上游把字写死成英文、本仓翻译了」那一类（名字不同 → 同一颗键
 * 在两边被当成两个不同的项）在这一档里的重复，还有 8 行是
 * `button "🏷️GitHub Issue triage"` vs `button "🏷️ GitHub Issue triage"`
 * ——emoji 与标题之间差一个空白文本节点，而 aria 档按可访问名比、根本没报它。
 *
 * **这一档要回答的只有一个问题：「能不能 tab 到」。名字那一半是 aria 档的活。**
 * 把名字放进来，等于让同一处差异在两档里各记一次（坑 219 的同一件事）。
 */
export async function sampleTabbables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "summary",
      "[tabindex]",
      "[contenteditable=true]",
    ].join(",");
    const describe = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const type = tag === "input" ? element.getAttribute("type") : null;
      const role = element.getAttribute("role");
      /*
        **认不出是谁的时候，补一个 `data-slot`**（wave 149）。

        起因是一条只有两个字的账：`tabbablesOnlyReact: ["div"]`。查它是谁得
        单开一个探针——量出来是上游 `Suggestions` 那层 ScrollArea 的 viewport
        （`data-slot="scroll-area-viewport"`，wave 97 给它补的 `tabIndex={0}`），
        也就是 wave 98 已经判过「不跟」的那笔账在另一屏上的复现。
        **一条要靠探针才认得出的账，等于没有账。**

        顺手量了一下范围：`tabbablesOnly*` 与 `tabOrder` 三档共 79 行，
        **其中 59 行含裸 `div`/`span`**——四分之三认不出。

        判据取最窄的那一种：**只有 generic 标签（div/span）且没有 role 时才补**。
        有 role 的（`div(dialog)`）本来就认得出，补了只是让 59 行之外的账也跟着
        改写法。`data-slot` 是两个应用共有的 shadcn 约定（侧栏骨架合同已经在钉它），
        不像 `data-testid` 那样两边对不上（坑：wave 94 定过同一条）。
      */
      const slot =
        !role && (tag === "div" || tag === "span")
          ? element.getAttribute("data-slot")
          : null;
      return `${tag}${type ? `[${type}]` : ""}${role ? `(${role})` : ""}${
        slot ? `[${slot}]` : ""
      }`;
    };
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        if (element.hasAttribute("disabled")) return false;
        if (element.getAttribute("aria-hidden") === "true") return false;
        const tabindex = element.getAttribute("tabindex");
        if (tabindex !== null && Number(tabindex) < 0) return false;
        if (!(element instanceof HTMLElement)) return false;
        if (element.offsetParent === null && element.tagName !== "BODY")
          return false;
        return getComputedStyle(element).visibility !== "hidden";
      })
      .map(describe);
  });
}

/*
  取样前把指针挪开，**让「谁被悬停着」不再是取样面的一部分**。

  Playwright 的指针停在上一步操作留下的位置，而台账比的是**静置渲染**，
  不是「鼠标恰好停在哪颗按钮上」。两件事在这里会连起来出事：
  两个应用的布局本来就有差（`integrations` 那 4px），同一个视口坐标
  可能在一边落在按钮上、另一边落在按钮外。

  **证据链**（2026-09-17 第三十七轮，从 CI artifact 的截图与源码两头量的）：

  · 台账上飘的那几行是
    `role:button[…Docs…] background React=rgba(0,0,0,230) Vue=rgba(0,0,0,255)`；
  · `230/255 = 90%`，而两个应用的 `Button` `variant="default"` 基类**逐字相同**、
    都写着 `hover:bg-primary/90`——所以那是 **hover 态**，不是样式差异；
  · 截图里两侧同一屏的滚动位置差约 110px（React 的 Authorization scope 标题在
    y=456、Vue 在 y=346），于是同一个指针坐标落在不同元素上；
  · 同一组还有 `hit React=self Vue=div`，也是「那个坐标上压着谁」。

  **不声称它消除了那几行**——判据是同一棵树连着量到稳定（见
  `waitForFiniteAnimations` 上面那段反例）。这里改的是**取样面的定义**：
  悬停态本来就不该进台账。

  挪到 (0,0)：视口左上角，两个应用在这一点上都没有可交互元素。
  放在 `runScenario` 之后、静置之前——这样 hover 退出的过渡有时间跑完，
  再由 `waitForFiniteAnimations` 等干净。
*/
async function parkPointer(page: Page) {
  await page.mouse.move(0, 0).catch(() => undefined);
}

/*
  等到页面上**有限**的动画/过渡都跑完，再取样。

  **它补的是健壮性，没有被证明消除了任何一行台账。** 此前取样前只有一条固定的
  `settleMs = 700`：一个写死的毫秒数，稳不稳完全取决于机器快慢，
  而那正是一条会偶发红的门禁的做法——偶发红的门会被当成噪音忽略掉，等于没有门
  （记忆 `deerflow-gate-needs-an-entrypoint` 的同一形状）。

  **⚠ 这里曾经写着「这条是 CI 上 16 行里 8 行的根因，实测」。那句话是错的，
  别再照它判。** 经过是：加上这道等待后一次 CI 复量到 16 → 8，我据此写下根因；
  **同一棵树的下一次运行又回到 16 行**。三次读数摆在一起才看清——

      run1(无等待) 16 行 | run2(有等待) 8 | run3(有等待) 16
      三次并集 17 行：稳定(3/3) 8 行，飘的 9 行

  那 8 行稳定的是真差异（`integrations` mobile 的宽度 Δ4.1–4.2、
  `artifact-table-preview` 的 y 偏移），**其余 9 行是这把尺子自己在飘**，
  run2 只是一次异常采样。

  **判据：一次运行是一个样本。** 判「修好了」要同一棵树连着量到稳定；
  判「飘」两次不一致就够。**飘和修好在单次读数上长得一模一样。**
  逐行出现模式与后续判词记在
  docs/plans/vue-parity-open-accounts.md 第三十七轮条目。

  **必须排除无限循环的动画**：子任务卡片底下那层 `.ambilight` 是自动播放、
  无限循环的装饰动画（见 sampleGeometry 里 `anim=` 那段注释），
  等它「结束」会每个场景都等满超时——156 个场景 × 2 秒在本机照样绿，
  在 CI 上就是白烧一轮 25 分钟。判据用 `getComputedTiming().iterations`
  **算**出来，不用动画名单：名单会过期，而「这条动画有没有终点」是算得出来的。

  超时了**不抛**：取样本身不该变成失败源（同 `postData()` 那处的判词）。
  真有一条无限动画漏网时，它造成的差异会在几何档上照样看得见。
*/
export async function waitForFiniteAnimations(page: Page, timeout = 2_000) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running")
          .every(
            (animation) =>
              animation.effect?.getComputedTiming().iterations === Infinity,
          ),
      undefined,
      { timeout },
    )
    .catch(() => undefined);
}

export async function captureScenario(
  page: Page,
  base: string,
  scenario: ParityScenario,
  dimension: ParityDimension,
  state: ParityState,
  settleMs = 700,
): Promise<ParityCapture> {
  const requests: string[] = [];
  const requestBodies: { key: string; body: string }[] = [];
  const onRequest = (request: Request) => {
    const normalized = normalizeRequest(request.method(), request.url());
    if (!normalized) return;
    requests.push(normalized);
    /*
      `postData()` 对没有体的请求返回 null；对上传那类二进制体可能抛。
      抛了就当没体——**不让取样本身变成失败源**，而漏掉的那一条会在
      requests 档上照样看得见（它的 method/path 还在）。
    */
    let raw: string | null;
    try {
      raw = request.postData();
    } catch {
      raw = null;
    }
    if (raw !== null && raw !== "")
      requestBodies.push({
        key: normalized,
        body: normalizeRequestBody(raw),
      });
  };
  page.on("request", onRequest);
  try {
    await runScenario(page, base, scenario, dimension, state);
    await parkPointer(page);
    await page.waitForTimeout(settleMs);
    await waitForFiniteAnimations(page);
    const rawAria = await page.locator("body").ariaSnapshot();
    const aria = normalizeAriaSnapshot(rawAria);
    /*
      同一份原始快照再归一一次、**这次保住缩进**：`aria` 那份把层级塌掉了
      （见 aria-parity.mjs 里 `\s{2,}` 那段），层级比对只能从这一份来。
    */
    const ariaTree = normalizeAriaTree(rawAria);
    const geometry = await sampleGeometry(page, scenario, state);
    const focus = await describeFocus(page);
    const tabbables = await sampleTabbables(page);
    return {
      aria,
      ariaTree,
      requests,
      requestBodies,
      geometry,
      focus,
      tabbables,
      url: new URL(page.url()).pathname,
    };
  } finally {
    page.off("request", onRequest);
  }
}
