/*
  【文件职责】     两个应用按 Tab 走一圈，**走的是同一条环**：落点集合与前后相邻关系相同。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/settle.ts · support/context-options.ts
  【边界与注意】   这是**对照**断言（跨两个应用），与只问单应用不变量的
                   `keyboard-trap.spec.ts` 是两件事：那条问「出不出得来」，
                   这条问「两边走的是不是同一条路」。

                   **为什么台账看不见它**：台账的 `tabbables` 是取样时刻的
                   **静态 DOM 扫描**（capture.ts 的 sampleTabbables），它回答
                   「谁看起来可聚焦」，回答不了「按下去会去哪」——次序、
                   roving-tabindex、焦点陷阱、跨 iframe 统统在它的坐标系之外。

                   ── ⚠ 量法是这条门禁的全部（第四十五轮用五跑换来的，逐条照抄）──

                   **① 只认「按完这一下之后停住的 `document.activeElement`」，
                   不认 focusin 流水。** roving-focus 的**容器**（Radix 与 reka
                   都给 group 挂 `tabindex=0`）会先吃到焦点、再立刻转给当前条目；
                   那一下在 focusin 流水里是一条记录，而**用户从来没停在那儿**。
                   实测 `integrations#skills`：上游 **43 条事件 / 40 次按键**
                   ——事件比按键还多，这就是中转的样子。按流水比会报出 5 条
                   「只在上游有的落点」（`div(tablist)"Agent Skills"` 与四处
                   `div(group)""`），**全是假的**。

                   **② 名字不能用 `textContent`**，三条都是实测逼出来的：
                   表单控件的 `textContent` 是它的默认值（上游靠 `placeholder`
                   取名、本仓写 `aria-label`）；Radix 的 ScrollArea 往容器里塞
                   `<style>`，`textContent` 会把那段 CSS 也算进名字；
                   `textContent` 不含渲染折叠，模板换行会变成真空格
                   （`🔥 GitHub` vs `🔥GitHub`）。换成
                   `aria-label ?? placeholder ?? innerText` 之后
                   **28 条差异塌到 5 条**，再换成停住序列塌到 **0 条**。

                   **③ 描述里不放 `data-slot`**：那是框架字面，两边天生不同
                   （`dropdown-menu-trigger` vs `tooltip-trigger`、`resizable-handle`）。

                   **④ 比的是「转移集合」，不是逐位序列**——因为**起点会漂**。
                   实测 `branch-thread#turn-actions`：上游**自己两跑之间**
                   同一个环整体差 15 位（settle 之后焦点停在哪取决于最后一步交互）。
                   逐位比会在这一条上间歇性地红，而两边走的明明是同一条环。
                   四次对照（跨应用两跑 + 同应用两跑）下，**转移集合差异全是 0**。

                   ⚠ **不要用 `blur()` 去钉起点**——试过，当场更坏：
                   跨应用差异 0 → **4**、同应用两跑不稳 0 → **2**。
                   菜单开着时 blur 会扰动浮层自己的焦点管理，而那正是要量的东西。

                   **`(body)` 是一个合法落点**，不是失败：走到最后一个可聚焦元素
                   之后焦点会离开这份文档（`artifact-preview` 那一屏还有 iframe）。
                   它参与比对——两边**从同一个落点**离开文档，本身就是一条判据。

                   ⚠ **别把「两边都空」当成绿**：下面两条反空转断言堵这件事。
                   第四十五轮签入时的读数：58 个终态、不同非 body 落点合计 **925**，
                   整条序列全是 `(body)` 的终态 **0 个**，最小的 6 个各 1
                   （菜单开着时 Tab 被浮层吃掉，焦点停在菜单上不动——两个应用都是）。
*/

import { expect, test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

/*
  **60 次。** 这个数是第五十轮重新量的，上一版写的是 40，配的理由是
  「实测最长的两个（`thread-list-infinite-scroll` / `integrations#change-app`）
  各有 40 个不同落点」——**那句话把读数读反了**：40 次按键拿到 40 个不同落点，
  说明的是**一圈没走完**（窗口被占满），不是「环长 40、刚好够」。

  重新量的读数（压缩掉相邻重复之后还有没有重复落点 = 闭没闭合）：

      integrations#change-app        环长 **44**（60 与 120 次按键同号，两个应用
                                     两个方向逐字相同）→ 40 次差 4 个
      thread-list-infinite-scroll    **不闭合**：40 次 39 个落点、90 次 89 个、
                                     300 次 **201–207** 个。它是无限滚动列表，
                                     Tab 走到底就加载更多，环没有边界 → 已排除，
                                     见 `UNSTABLE_RING`
      其余 56 个                     都在 40 次内闭合

  **窗口不够的后果不是「少比几个」，是「比的是两边各自窗口里的弧段」**：
  下面第 ④ 条已经承认起点会漂，转移集合能抵消旋转、**抵消不了覆盖不全**。
  第五十轮开 `Shift+Tab` 这个面时第一跑就撞上了——`thread-list-infinite-scroll`
  报出一条分叉，定点复量两个应用**逐字相同**（同一颗 `tabIndex 0` 的按钮、
  同样的 `223x32@16,2112`、两个方向同样的落点数）。**那是尺子的，不是应用的。**
  同理，第四十五轮正向那次「0 条差异」在这两条环上也不构成证据。

  60 给 44 留了 16 的余量。再往上加是有代价的：这一条用例的墙钟按
  `终态数 × 2 应用 × 2 方向 × PRESSES` 线性涨。
*/
const PRESSES = 60;
/**
 * **遍历动作本身会改变这一屏**的终态：跳过比对。
 *
 * ⚠ 排除一条就要写清为什么，否则「没量到」会长得和「量过、没问题」一模一样。
 *
 * `thread-list-infinite-scroll` 是无限滚动 + 虚拟列表。按键会让焦点元素滚进视野，
 * 滚动又触发翻页与行回收，**于是环在被走的过程中就变了**。第五十轮四组读数：
 *
 *     全套 PRESSES=40   报一条分叉（`Settings and more → Load older chats → More`
 *                       只在上游；本仓那一格是 `(body)`）
 *     全套 PRESSES=60   报**逐字相同**的那一条
 *     定点第 1 跑       两边第 5 步**都**落在 `Load older chats`；本仓 body 落点 0 次
 *     定点第 2 跑       本仓第 5 步落在 `(body)`，而那一刻按钮**从 DOM 里消失**；
 *                       body 落点 1 次。上游同样不稳（body 落点 1 次 / 2 次）
 *
 * 遍历途中的形变有读数：列表行数 `54 → 39 → 24`，那颗按钮的 y 在
 * `2112 → 687 → 1880 → 3916` 之间跳，中间几步 `absent`。
 *
 * **两跑不同号即为飘**（第四十五轮判据）。所以这不是「两边走的环不同」，
 * 是「环在被走的时候变了」——**这把尺子在这一屏上问不出那个不变量**。
 * 全套两跑之所以逐字同号，是那种负载下两边的回收相位系统性不同，
 * 不是两边的可达性不同：定点跑里两个应用**都**走到过那颗按钮，也**都**掉过 body。
 *
 * ⚠ 这是第四十五轮「钉起点的动作要先证明它不改变被测对象」的同一形状，
 * 只不过这次改变被测对象的是**遍历本身**。
 *
 * ⚠ **两个方向一起排除。** 第五十轮一度只排除 `[Tab]`（理由：翻页只由正向触发，
 * 反向的环是有界的），当场被定点跑推翻——反向同样会回收行、同样会掉 body。
 *
 * **翻案判据**：哪天这条场景的夹具改成有限条数、或列表不再虚拟化/自动翻页，
 * 把它放回比对。判据是「同一终态连跑两次，落点序列逐位相同」。
 */
const UNSTABLE_RING = new Set(["thread-list-infinite-scroll"]);

/*
  **反空转的下限**，不是快照。签入时合计 925；取 600 而不是 925，是因为它要挡的
  是「整套测量塌掉」，不是「有人加了个场景」——后者由上面那条逐终态断言管。
*/
const MIN_DISTINCT_STOPS = 600;

const ACTIVE = () => {
  const element = document.activeElement;
  if (!element || element === document.body) return "(body)";
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("placeholder") ??
    (element as HTMLElement).innerText ??
    "";
  return (
    `${element.tagName.toLowerCase()}` +
    `${element.getAttribute("role") ? `(${element.getAttribute("role")})` : ""}` +
    `"${label.trim().replace(/\s+/g, " ").slice(0, 30)}"`
  );
};

type Case = {
  key: string;
  scenario: (typeof PARITY_SCENARIOS)[number];
  state: ReturnType<typeof scenarioStates>[number];
};

const CASES: Case[] = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => ({
    // 见 narrow-screen-overflow 的同一段：匿名终态的 id 是空串，不是 "default"。
    key: `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`,
    scenario,
    state,
  })),
);

/** 相邻关系：`前一个落点 → 后一个落点`。见文件头第④条，这是旋转无关的那一层。 */
function transitions(sequence: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < sequence.length - 1; i += 1)
    out.add(`${sequence[i]} → ${sequence[i + 1]}`);
  return out;
}

function onlyIn(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

/**
 * 环闭没闭合：**压缩掉相邻重复之后**，还有没有落点出现第二次。
 *
 * ⚠ 不能用「不同落点数 < 按键数」——那把「连按两次焦点没动」也算成走回了起点。
 * 第五十轮第一版扫描就是这么写的，**把已知不闭合的 `thread-list-infinite-scroll`
 * 漏报了**（39 个落点 / 40 次按键，看着像闭合，而它 300 次按键有 201 个落点）。
 * 手上明明有一个已知答案的样本，却先读了新仪器的结论——第三十九轮的判词
 * 「先拿一个已知答案的样本验仪器」这一轮又欠了一次。
 */
function ringClosed(sequence: string[]): boolean {
  const squashed = sequence.filter((v, i) => i === 0 || v !== sequence[i - 1]);
  return squashed.length > new Set(squashed).size;
}

/**
 * 焦点被浮层吃住、整条序列一动不动的「终态×方向」：`ringClosed` 对它们是 false，
 * 但那不是「窗口不够」，是**这一屏在这个方向上本来就只有一个落点**。
 *
 * 文件头最后一段早就记过这件事（「最小的 6 个各 1——菜单开着时 Tab 被浮层吃掉，
 * 焦点停在菜单上不动，两个应用都是」）。第五十轮把它量成了一张可断言的名单，
 * 好让「环必须闭合」那条体检对其余终态真正生效。
 *
 * **这 13 个键每一个都是「本仓 1 / 上游 1」——两个应用逐字相同**，
 * 所以它们是这一屏的形状，不是分叉。
 *
 * ⚠ **键带方向，不是只按终态**：`workspace-changes#changes-panel` 正向走得动、
 * 反向一步都走不了。按终态排除会把它正向那一半的体检也一起关掉。
 *
 * ⚠ **这张名单的读数必须来自「每个方向新开一个 page」**。第五十轮第一版扫描
 * 图省事，在同一个 page 上先按 40 次 Tab 再按 40 次 Shift+Tab，
 * 于是反向的起点被正向污染了——同一个 `changes-panel`，污染的读数是
 * 「bwd 3 个落点、闭合」，干净的读数是「1 个落点」。**两次实测冲突时，
 * 信那个起点干净的。**
 */
const SINGLE_STOP = new Set([
  "thread-history[Tab]",
  "thread-history[Shift+Tab]",
  "thread-list-pin[Tab]",
  "thread-list-pin[Shift+Tab]",
  "thread-list-pin#mobile-drawer[Tab]",
  "thread-list-pin#mobile-drawer[Shift+Tab]",
  "ui-polish-mobile[Tab]",
  "ui-polish-mobile[Shift+Tab]",
  "user-message-plain-text[Tab]",
  "user-message-plain-text[Shift+Tab]",
  "workspace-changes#reasoning-menu[Tab]",
  "workspace-changes#reasoning-menu[Shift+Tab]",
  "workspace-changes#changes-panel[Shift+Tab]",
]);

const DIRECTIONS = [
  { name: "Tab", key: "Tab" },
  { name: "Shift+Tab", key: "Shift+Tab" },
] as const;

test("两个应用按 Tab / Shift+Tab 走的是同一条环", async ({ browser }) => {
  test.setTimeout(3_600_000);

  const mismatched: string[] = [];
  const unreachable: string[] = [];
  const allBody: string[] = [];
  let distinctStops = 0;

  const notClosed: string[] = [];

  async function walk(
    base: string,
    item: Case,
    pressKey: string,
  ): Promise<string[]> {
    const context = await browser.newContext({ ...PARITY_CONTEXT_OPTIONS });
    const page = await context.newPage();
    try {
      /*
        跑终态自己声明的那一档维度；没声明就用场景的第一档，再没有才回默认。
        **不这么做就会假红**：`thread-list-pin#mobile-drawer` 只在移动端存在。
      */
      const dimension =
        item.state.dimensions?.[0] ??
        item.scenario.dimensions?.[0] ??
        DEFAULT_DIMENSION;
      await runScenario(
        page,
        base,
        item.scenario,
        dimension,
        item.state,
        30_000,
      );
      /*
        `runScenario` 在 `state.steps` 之后**不再 settle**（capture.ts 是自己
        补的那一道）。少了它，交互步骤刚开的浮层还在 animate-in 里，
        可聚焦性还没稳——第四十四轮第一次跑探针就栽在这里。
      */
      await waitForFiniteAnimations(page);
      await waitForDomQuiet(page);
      const sequence: string[] = [];
      for (let i = 0; i < PRESSES; i += 1) {
        await page.keyboard.press(pressKey);
        sequence.push(await page.evaluate(ACTIVE));
      }
      return sequence;
    } finally {
      await context.close();
    }
  }

  for (const item of CASES)
    for (const direction of DIRECTIONS) {
      const label = `${item.key}[${direction.name}]`;
      let vue: string[];
      let react: string[];
      try {
        vue = await walk(VUE_APP, item, direction.key);
        react = await walk(REACT_APP, item, direction.key);
      } catch (error) {
        unreachable.push(
          `${label}: ${String(error).split("\n")[0]?.slice(0, 90)}`,
        );
        continue;
      }

      /*
        **先体检窗口，再比环。** 窗口不够时比出来的差异是「谁在窗口内」，
        不是「谁在环上」——见文件头 PRESSES 那段。
      */
      /*
        ⚠ **先跳过，不体检**：这一屏的环在被走的过程中就变了，「闭没闭合」
        对它是个没有意义的问题。第五十轮先写成「跳过比对但仍体检」，
        当场收到一条误导性的红——反向那一半报「闭合了」，看起来像是可以放回比对，
        而定点复跑证明它只是那一跑恰好稳定下来。
      */
      if (UNSTABLE_RING.has(item.scenario.id)) continue;
      if (!SINGLE_STOP.has(label) && !ringClosed(vue))
        notClosed.push(`${label} 本仓 ${new Set(vue).size} 个落点`);
      if (!SINGLE_STOP.has(label) && !ringClosed(react))
        notClosed.push(`${label} 上游 ${new Set(react).size} 个落点`);

      const vueStops = new Set(vue.filter((stop) => stop !== "(body)"));
      if (direction.name === "Tab") {
        distinctStops += vueStops.size;
        if (vueStops.size === 0) allBody.push(item.key);
      }

      const vueLinks = transitions(vue);
      const reactLinks = transitions(react);
      const onlyVue = onlyIn(vueLinks, reactLinks);
      const onlyReact = onlyIn(reactLinks, vueLinks);
      if (onlyVue.length > 0 || onlyReact.length > 0) {
        mismatched.push(
          `${label}: 只在本仓 ${JSON.stringify(onlyVue.slice(0, 3))}` +
            ` / 只在上游 ${JSON.stringify(onlyReact.slice(0, 3))}`,
        );
      }
    }

  /*
    **窗口体检**（第五十轮新加）。环没走完的时候，上面那条比对量的是弧段而不是环,
    而它**照样会绿**——十几轮来 `integrations#change-app` 就是这么过的。
    新增一个长环的终态会在这里当场红，而不是静默退回比弧段。
  */
  expect(
    notClosed,
    "这些终态的环在 PRESSES 次按键内没走完——比对量到的是两边各自窗口里的弧段，" +
      "不是同一条环。要么把 PRESSES 提到够，要么确认这一屏的环会被遍历本身改掉、\n" +
      "写进 UNSTABLE_RING 并附读数",
  ).toEqual([]);

  expect(
    mismatched,
    "两个应用的键盘遍历分叉了。⚠ 动手之前先读文件头：roving-focus 的容器中转不算落点，" +
      "名字不能用 textContent，起点会漂所以比的是相邻关系",
  ).toEqual([]);
  expect(
    allBody,
    "这些终态整条序列都停在 body 上——门禁在它们身上什么都没量到（空转就是失守）",
  ).toEqual([]);
  expect(unreachable, "这些终态跑不到位，门禁因此什么都没量到").toEqual([]);
  expect(
    distinctStops,
    `全套量到的不同落点只有 ${distinctStops} 个（签入时 925），测量塌了`,
  ).toBeGreaterThanOrEqual(MIN_DISTINCT_STOPS);
});
