/*
  【文件职责】     收起成图标条之后，两个应用对同一颗导航键给出**同一种**悬停提示，
                   而且那颗键**仍然有可访问名**。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts（复用 `sidebar-collapsed` 场景）· support/react-preview.ts
  【边界与注意】   **对照台账天生看不见这一屏的这件事**，所以它才需要一份自己的用例：
                   `aria` 档比的是可访问名（两边相同），`geometry` 档不取
                   `title` / `data-*`，于是「一边弹原生气泡、另一边什么都没有」
                   在十一个档上全是 0 行。第二十四轮把两个应用并排放进真浏览器才量出来：
                   本仓四颗键挂着 `title="New chat"` 之类，上游四颗 `title` 全是 `null`
                   且悬停没有任何浮层——**上游自己的 `SidebarMenuButton` 早就支持
                   `tooltip` 参数（`ui/sidebar.tsx`），workspace 侧栏一个都没传。**

                   **两条断言缺一不可，而第二条是这一轮真踩出来的。**
                   摘掉本仓那个 `title` 的第一版里，三颗键**从可访问性树上消失了**
                   ——它们的可访问名本来就来自那个 `title`，而上游的来自一直留在
                   DOM 里、只是被 `overflow-hidden` 裁掉的 `<span>`。
                   本仓当时写的是 `v-if="sidebarExpanded"`，收起时把标签整个删掉。
                   **一个只查「有没有 tooltip」的用例会给那一版放行。**

                   悬停用 `toPass()` 包起来（wave 113）：tooltip 要靠**持续悬停**
                   一段时间才打开，那个窗口里任何一次重渲都会卸载 trigger、吃掉计时器，
                   而 `hover()` 那一步**不报错**，症状是等到超时才说找不到元素。
                   **这里不断言「多久出现」**：延迟已经在 primitive 那一层对齐成 0
                   （上游 `ui/sidebar.tsx` 的 `SidebarProvider` 写着 `delayDuration={0}`，
                   本仓 `SidebarMenuButton.vue` 显式压回 0，理由写在那份文件头），
                   而把一个毫秒数钉进 e2e 只会得到一条随负载变红的门禁——
                   要守延迟就去守那个 prop，不要守秒表。
*/

import { expect, test, type Page } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/** 收起态下四条导航入口的可访问名（上游写死英文那一套之外，这几条走词典的 en-US）。 */
const ENTRIES = ["New chat", "Chats", "Agents", "Scheduled tasks"] as const;

type Affordance = {
  entry: string;
  /** 原生 `title`：两边都必须是 null——它是本仓当年的临时做法。 */
  nativeTitle: string | null;
  /** 持续悬停之后，这颗键的 `aria-describedby` 指向的那段文字。 */
  tooltipText: string;
};

async function readAffordances(
  page: Page,
  base: string,
): Promise<Affordance[]> {
  const scenario = PARITY_SCENARIOS.find((s) => s.id === "sidebar-collapsed")!;
  await runScenario(
    page,
    base,
    scenario,
    DEFAULT_DIMENSION,
    scenarioStates(scenario)[0]!,
  );

  const out: Affordance[] = [];
  for (const entry of ENTRIES) {
    /*
      **先按可访问名找得到**，这本身就是一条断言：收起态下标签被裁掉但不能被删掉。
      找不到时 `getAttribute` 会超时并带上元素名，比先 `count()` 再断言更好读。
    */
    const link = page.getByRole("link", { name: entry, exact: true }).first();
    await expect(link, `收起态下「${entry}」在可访问性树上找不到`).toHaveCount(
      1,
    );
    const nativeTitle = await link.getAttribute("title");

    /*
      **按这颗键自己的 `aria-describedby` 读，不要数全局的 `[role="tooltip"]`。**
      第一版就是数全局的，结果在「移开鼠标之后浮层应当消失」那一步红了：
      reka 把内容同时投影到一个常驻的 `role="tooltip"` 节点上供读屏器读
      （见 `ui/tooltip/TooltipContent.vue` 的文件头），**鼠标移开它也不消失**。
      改成读 `aria-describedby` 之后既不需要那个拆卸断言，
      量到的也确实是「这颗键被这段文字描述着」——比「屏幕上有个浮层」更贴近合同。
    */
    await expect(async () => {
      await link.hover();
      await expect(link).toHaveAttribute("aria-describedby", /\S/, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    const describedBy = await link.getAttribute("aria-describedby");
    const tooltipText = (
      (await page.locator(`[id="${describedBy}"]`).textContent()) ?? ""
    ).trim();

    out.push({ entry, nativeTitle, tooltipText });
    await page.mouse.move(0, 0);
  }
  return out;
}

test("收起态的四颗导航键：两个应用给出同一种悬停提示", async ({ browser }) => {
  test.setTimeout(180_000);

  const measured: Record<string, Affordance[]> = {};
  for (const [app, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    // 一应用一 context：两边把侧栏态存在**同名** cookie 里（见 scenarios.spec 的注释）。
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    measured[app] = await readAffordances(page, base);
    await context.close();
  }

  const expected: Affordance[] = ENTRIES.map((entry) => ({
    entry,
    nativeTitle: null,
    tooltipText: entry,
  }));
  expect(
    measured.vue,
    "本仓收起态的悬停提示不再是「没有原生 title + 浮层写着这颗键的名字」",
  ).toEqual(expected);
  expect(
    measured.react,
    "上游收起态的悬停提示变了——它的 SidebarMenuButton 自带 tooltip 参数，" +
      "workspace 侧栏必须一直传着它（第二十四轮之前一个都没传，收起后毫无反馈）",
  ).toEqual(expected);
});
