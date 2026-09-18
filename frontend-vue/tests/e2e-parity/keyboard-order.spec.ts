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
  40 次足够走完取样面里最长的一圈：实测最长的两个
  （`thread-list-infinite-scroll` / `integrations#change-app`）各有 40 个不同落点。
*/
const PRESSES = 40;

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

test("两个应用按 Tab 走的是同一条环", async ({ browser }) => {
  test.setTimeout(1_800_000);

  const mismatched: string[] = [];
  const unreachable: string[] = [];
  const allBody: string[] = [];
  let distinctStops = 0;

  async function walk(base: string, item: Case): Promise<string[]> {
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
        await page.keyboard.press("Tab");
        sequence.push(await page.evaluate(ACTIVE));
      }
      return sequence;
    } finally {
      await context.close();
    }
  }

  for (const item of CASES) {
    let vue: string[];
    let react: string[];
    try {
      vue = await walk(VUE_APP, item);
      react = await walk(REACT_APP, item);
    } catch (error) {
      unreachable.push(
        `${item.key}: ${String(error).split("\n")[0]?.slice(0, 90)}`,
      );
      continue;
    }

    const vueStops = new Set(vue.filter((stop) => stop !== "(body)"));
    distinctStops += vueStops.size;
    if (vueStops.size === 0) allBody.push(item.key);

    const vueLinks = transitions(vue);
    const reactLinks = transitions(react);
    const onlyVue = onlyIn(vueLinks, reactLinks);
    const onlyReact = onlyIn(reactLinks, vueLinks);
    if (onlyVue.length > 0 || onlyReact.length > 0) {
      mismatched.push(
        `${item.key}: 只在本仓 ${JSON.stringify(onlyVue.slice(0, 3))}` +
          ` / 只在上游 ${JSON.stringify(onlyReact.slice(0, 3))}`,
      );
    }
  }

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
