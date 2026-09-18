/*
  【文件职责】     每一个对照终态里，键盘焦点都不会被某个元素永久吸住。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/settle.ts · support/context-options.ts
  【边界与注意】   **两个应用都跑**，这一条和 narrow-screen-overflow 不同，理由是实测：
                   2026-09-18 第四十四轮量出来的那一条**在上游那一侧**，而
                   `settings-narrow-screen` / `narrow-screen-overflow` 都只跑本仓，
                   台账又按定义只报「两边不一致」——上游单边回归此前没有任何门禁看得见。
                   跑两个应用在这一条上不是浪费：它抓到的那一条只有上游有。

                   **不变量直接说出来，不绕元素的属性**：

                       从任一终态起连按 Tab，焦点不会被某个元素永久吸住。

                   量法：装一个 focusin 记录器 → 连按 PRESSES 次 Tab → 读一次日志
                   → 再按 TAIL 次 → 再读一次。**后一段一条新记录都没有**、
                   而 `document.activeElement` 还停在一个具体元素上，就是吸住了。

                   **为什么不按「tabbables 清单」判**：台账里的 `tabbables` 是
                   取样时刻的**静态 DOM 扫描**（见 capture.ts 的 sampleTabbables），
                   它回答「谁看起来可聚焦」，回答不了「按下去会去哪」。
                   第四十四轮那条缺陷两边的 tabbables 完全一样——
                   差的是上游把 Tab 这个**按键**吞掉了。

                   ── 本轮抓到的那一条（判词留着，省得下一个人重查）──
                   `browser-feature` 这一屏，两边前 14 个落点逐字相同；落到浏览器
                   面板那个 `div` 之后，**上游的焦点再也出不来**：其后 26 次 Tab
                   一次 focusin 都没有，`activeElement` 仍是它，页面里 iframe 数为 0。
                   根因在 `browser-view-panel.tsx`：`Tab` 在 FORWARDED_NAMED_KEYS 里，
                   面板拿到判定就 `preventDefault()`，**而不管 `sendInput` 有没有
                   真送出去**——那一屏还停在 "Connecting to live"，于是键被吞、
                   人出不来（WCAG 2.1.2）。本仓一直是对的：它只在
                   `stream.sendInput(input) === "sent"` 时才吞。已两边同改成本仓这一侧。

                   **变异验证做过**（签入前必做）：把上游那个 `if (!sendInput(input))`
                   撤回成 `sendInput(input);`，这条门禁当场红，报的就是

                       browser-feature: 停在 div"Browser…Connecting to live bro"，
                       其后 10 次 Tab 无变化

                   还原后 `1 passed (2.9m)`。**它不是潜在守卫，是会红的那一条。**

                   ⚠ **`activeElement` 落在 `body` 上不算吸住**，这是实测定的：
                   `artifact-preview` / `artifact-panel-resize` 那一屏有一个 iframe
                   （两个应用都是 `frames: 1`），tab 走到它之后 `activeElement`
                   变成 `body`——焦点离开了这份文档，不是被某个元素扣着。
                   `artifact-batched-stream` 没有 iframe，但同样会走到 `body`。
                   **两个应用在这一条上逐条相同**，所以它是无头环境的边界、不是缺陷。
                   翻案判据：哪天两边在「会不会落到 body」上分叉，那才是账。

                   ⚠ **「一次都没动」不是绿**，它是另一种失守：连按 PRESSES 次
                   Tab 而一条 focusin 都没有，只有在**某个浮层接管了键盘**时才正当
                   （菜单/列表框把 Tab 吃掉是 Radix 与 reka 共有的行为）。
                   实测有五个终态落在这一支，两个应用完全相同：
                   `thread-history` / `thread-list-pin` / `ui-polish-mobile` /
                   `user-message-plain-text` / `workspace-changes#reasoning-menu`，
                   各自都有一个可见的 `[role=menu]`。
                   **写成规则而不是清单**：清单会烂掉，而「有没有浮层接管」不会。
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

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

/*
  30 次足够走到吸住点：本轮那一条在第 14 个落点就吸住了，而取样面里最长的
  一圈是 40 个不同落点（`thread-list-infinite-scroll` / `integrations#change-app`）。
  再补 10 次是**判词那一段**——它要证明的不是「走了多远」，是「还动不动」。
*/
const PRESSES = 30;
const TAIL = 10;

const INSTALL_FOCUS_LOG = () => {
  const scope = globalThis as unknown as { __focusStops?: string[] };
  scope.__focusStops = [];
  document.addEventListener(
    "focusin",
    (event) => {
      const element = event.target as Element | null;
      if (element && "tagName" in element)
        scope.__focusStops!.push(element.tagName.toLowerCase());
    },
    true,
  );
};

const READ = () => {
  const scope = globalThis as unknown as { __focusStops?: string[] };
  const active = document.activeElement;
  const overlay = Array.from(
    document.querySelectorAll('[role="menu"],[role="listbox"],[role="dialog"]'),
  ).some((element) => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  return {
    stops: scope.__focusStops?.length ?? 0,
    active:
      active === document.body
        ? "body"
        : (active?.tagName.toLowerCase() ?? "none"),
    describe:
      active && active !== document.body
        ? `${active.tagName.toLowerCase()}` +
          `${active.getAttribute("data-slot") ? `[${active.getAttribute("data-slot")}]` : ""}` +
          `"${(active.getAttribute("aria-label") ?? active.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}"`
        : "",
    overlay,
  };
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

for (const [app, base] of APPS) {
  test(`${app}：Tab 不会被某个元素吸住`, async ({ browser }) => {
    test.setTimeout(1_800_000);

    const trapped: string[] = [];
    const deadWithoutOverlay: string[] = [];
    const unreachable: string[] = [];

    for (const { key, scenario, state } of CASES) {
      /*
        跑终态自己声明的那一档维度；没声明就用场景的第一档，再没有才回默认。
        **不这么做就会假红**：`thread-list-pin#mobile-drawer` 只在移动端存在，
        在桌面上连 settle 都走不到。
      */
      const dimension =
        state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION;
      const context = await browser.newContext({ ...PARITY_CONTEXT_OPTIONS });
      const page = await context.newPage();
      try {
        await runScenario(page, base, scenario, dimension, state, 30_000);
        /*
          `runScenario` 在 `state.steps` 之后**不再 settle**（capture.ts 是自己
          补的那一道）。少了它，交互步骤刚开的浮层还在 animate-in 里，
          几何与可聚焦性都还没稳——第四十四轮第一次跑探针就是栽在这里。
        */
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        await page.evaluate(INSTALL_FOCUS_LOG);
        for (let i = 0; i < PRESSES; i += 1) await page.keyboard.press("Tab");
        const first = await page.evaluate(READ);
        for (let i = 0; i < TAIL; i += 1) await page.keyboard.press("Tab");
        const second = await page.evaluate(READ);

        if (first.stops === 0 && second.stops === 0) {
          // 见文件头：一次都没动，只有浮层接管键盘时才正当。
          if (!second.overlay) deadWithoutOverlay.push(key);
          continue;
        }
        if (second.stops === first.stops && second.active !== "body") {
          trapped.push(
            `${key}: 停在 ${second.describe}，其后 ${TAIL} 次 Tab 无变化`,
          );
        }
      } catch (error) {
        unreachable.push(
          `${key}: ${String(error).split("\n")[0]?.slice(0, 90)}`,
        );
      } finally {
        await context.close();
      }
    }

    expect(
      trapped,
      "这些终态把键盘焦点扣住了：焦点进得去、出不来（WCAG 2.1.2）。别把 Tab 当成可以无条件吞掉的键——见文件头那条读数",
    ).toEqual([]);
    expect(
      deadWithoutOverlay,
      "这些终态按了 Tab 焦点一步都没动，而页面上没有任何接管键盘的浮层——要么这一屏压根没有可聚焦的东西，要么有人把 Tab 吞了",
    ).toEqual([]);
    expect(
      unreachable,
      "这些终态跑不到位，门禁因此什么都没量到（空转就是失守，见 AGENTS 的判据）",
    ).toEqual([]);
  });
}
