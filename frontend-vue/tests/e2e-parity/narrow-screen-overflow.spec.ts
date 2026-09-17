/*
  【文件职责】     每一个对照终态在最窄的受支持屏上都不把东西推出视口。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/context-options.ts
  【边界与注意】   **只跑一个应用。** 问的是「这一屏溢不溢出」，不是「两边一不一样」
                   ——这一类缺陷两边往往一样坏，而**台账按定义看不见那种**。
                   跑两个应用只会让时间翻倍，抓到的还是同一条。

                   **为什么值得常驻**（2026-09-18 第三十八轮）：把它当一次性探针跑过一遍，
                   43 个可达状态里量出 **1 条真缺陷**——`subtask-card` 折叠头右侧那格
                   漏抄了 `min-w-0`，360px 上从 144 涨到 214、撑破 164px 的父格，
                   **把状态图标推到 364–380，整个跑出视口**。
                   那一条此前**所有门禁都没看见**：台账要两边不一致才报，而这一处
                   在窄屏上根本没被采样（那个场景当时只有 desktop/zh/dark 三维）。

                   **判据不是「有没有裁剪祖先」，是「用户滚得到吗」。**
                   第一版写成「往上走，遇到 `overflow` 非 `visible` 的祖先就不算」，
                   **变异验证当场证明它没用**：把 `subtask-card` 那颗 `min-w-0` 撤掉，
                   门禁照样绿——因为消息列表本身是 `overflow-auto`，于是它里面的
                   一切都被判成「被裁掉了，不算」。

                   **判定规则前后错了两版，每一版都是变异验证按回来的**，
                   经过写在这里，省得下一个人再走一遍：

                   - **第一版**「元素右边界越过视口、且有裁剪祖先就不算」：
                     撤掉 `subtask-card` 的 `min-w-0` 之后门禁**照样绿**——
                     消息列表本身是 `overflow-y-auto`，于是它里面的一切
                     都被判成「被裁掉了」。
                   - **第二版**「算最近裁剪祖先的可滚动右界」：**当场误报 36 条**。
                     那个算式要把祖先的边框与内边距都算对，而 `scrollWidth`
                     的原点是内边距盒左边、不是 `getBoundingClientRect().left`。
                     **判据里不要做这种算术**——它自己就会错，而且错得很像读数。
                   - **第三版**「越过视口、且没有可滚祖先」：又是绿的。
                     实测那条链上**几乎每一层都 `scrollWidth > clientWidth`**
                     （`sw=234 cw=194`、`sw=330 cw=290`…）——
                     **`scrollWidth > clientWidth` 在 `overflow: visible` 的盒子上
                     根本不代表能滚**，它只是说「内容溢出了」。

                   **最终把不变量直接说出来，不再绕元素的位置**：

                       360px 上，不该有任何容器需要横向滚动。

                   量法：computed `overflow-x` 是 `auto` / `scroll`
                   **而且** `scrollWidth > clientWidth` 的元素，就是一个
                   「用户得横着拖才能看全」的地方。真正需要横滚的那几处
                   （宽表格之类）登记进 `HORIZONTAL_SCROLLERS`，各写理由。

                   这一条恰好把两个实测样本分开：
                   `subtask-card` 那颗被推出去的图标，使消息列表
                   `overflow-y-auto` 变成 `sw=365 cw=360`——**多出 5px 的横滚
                   是没人想要的**，报；`artifact-table-preview` 的 CSV 预览表
                   `sw=588 cw=317`，那是**有意**的横滚区，登记豁免。

                   **两张表，不是快照数字。** 可达集与 `MOBILE_UNREACHABLE` 必须恰好
                   划分全部终态：新增状态无处可去，必须显式选一边。
                   **反向也查**：表里有、实际却到得了的，同样报错——否则这张表会
                   像线索 186 的清单一样烂掉。
                   （`e2e-suite-contract` 的文件头写过为什么不钉 `checked === 43`
                   这类快照数：加一个用例就得改守卫，而真正会出事的它反而看不见。）

                   ⚠ **`runScenario` 会按 `VIEWPORTS[viewport]` 设视口**（mobile = 375），
                   **覆盖 `newContext` 里的 viewport**。要量 360 必须在它之后再压一次。
                   第三十八轮没注意时量出「43 个状态全溢出」——那是拿 361 去卡一个
                   375 宽的页面。**探针里凡是「全都红」，先怀疑探针。**
*/

import { expect, test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";

/** 最窄的受支持宽度。360 是常见的 Android 宽度。 */
const WIDTH = 360;

/*
  **有意做成横向滚动区的地方。**

  写成**规则**而不是选择器清单：选择器会随类名漂，而「这里面装的是什么」不会。
  两类都是实测撞出来的，各自的读数写在旁边。
*/
const DELIBERATE_HORIZONTAL_SCROLL = `
  装着表格的滚动区（列宽由数据决定，窄屏横滚就是这一屏本来的交互——
  实测 artifact-table-preview 在 360px 下 sw=588 cw=317）；
  以及 <pre>（代码/差异块，长行横滚是它的本分——实测
  workspace-changes#changes-panel 的 pre sw=291 cw=288）。
`;

/*
  **窄屏下走不到的终态，连同它卡在哪一步**（2026-09-18 逐条量出来的定位器）。

  ⚠ **「到不了」不等于「没问题」**，只等于**那条路径是按桌面写的**：
  十四条里十二条的根因是同一个——桌面侧栏在手机上不渲染（换成 Sheet 抽屉），
  于是 `[data-sidebar='sidebar']` 以及侧栏里那些会话行的定位器永远解析不到。
  想把它们纳进来，要先给场景补一条「先开抽屉」的步骤，那是另一笔账。
*/
const MOBILE_UNREACHABLE: Record<string, string> = {
  sidebar: "侧栏本身：`[data-sidebar='sidebar'] a[href='/workspace/chats']`",
  "agent-create-name-step":
    "侧栏里的「新建对话」：`[data-sidebar='sidebar'] a[href='/workspace/chats/new']`",
  channels: "侧栏本身：`[data-sidebar='sidebar']`",
  "channels#runtime-config": "同 `channels`：`[data-sidebar='sidebar']`",
  "channels#runtime-config-edit": "同 `channels`：`[data-sidebar='sidebar']`",
  "channels#settings-panel": "同 `channels`：`[data-sidebar='sidebar']`",
  "channels#settings-panel-connected":
    "同 `channels`：`[data-sidebar='sidebar']`",
  "thread-history": "侧栏会话行：`getByText('First conversation')`",
  "thread-list-pin": "侧栏会话行：`getByText('Newest chat')`",
  "thread-title-sync":
    "侧栏行内的 ⋯：`getByRole('button', { name: /^(More|更多)$/ })`",
  "browser-feature": "`getByText(/^(Browser|浏览器)$/)`",
  "sidecar-chat": "`getByText(/^(Side chat|侧边对话)$/)`",
  "workspace-changes#reasoning-menu":
    "输入区的推理深度键：`getByRole('button', { name: /^(Reasoning Effort|推理深度)[:：]/ })`",
  "artifact-batched-stream":
    '`[role="combobox"]` 解析得到但点不动（被别的东西挡着）',
};

type Case = {
  key: string;
  scenario: (typeof PARITY_SCENARIOS)[number];
  state: ReturnType<typeof scenarioStates>[number];
};

const CASES: Case[] = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => ({
    /*
      ⚠ **没有显式 `states` 的场景，`scenarioStates` 合成的 id 是空串**
      （不是 `"default"`）；有显式 states 的默认那条才叫 `"default"`。
      两种都要归成「无后缀」，否则键会长成 `sidebar#` 而和下面那张表对不上
      ——第三十八轮第一版就是这么让门禁报出九条假「走不到了」的。
    */
    key: `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`,
    scenario,
    state,
  })),
);

test("每个终态在 360px 上都不把东西推出视口", async ({ browser }) => {
  test.setTimeout(1_800_000);

  const overflowing: string[] = [];
  const unexpectedlyUnreachable: string[] = [];
  const unexpectedlyReachable: string[] = [];

  for (const { key, scenario, state } of CASES) {
    const expectedUnreachable = key in MOBILE_UNREACHABLE;
    const context = await browser.newContext({
      ...PARITY_CONTEXT_OPTIONS,
      viewport: { width: WIDTH, height: 812 },
    });
    const page = await context.newPage();
    try {
      await runScenario(
        page,
        VUE_APP,
        scenario,
        { viewport: "mobile", theme: "light", locale: "en-US" },
        state,
        // 预期到不了的给短超时：它们就是来证明「仍然到不了」的。
        expectedUnreachable ? 4_000 : 30_000,
      );
      if (expectedUnreachable) {
        unexpectedlyReachable.push(key);
        continue;
      }
      // ⚠ 见文件头：applyDimension 刚把视口设回 375，这里才是 360。
      await page.setViewportSize({ width: WIDTH, height: 812 });
      await page.waitForTimeout(600);
      void DELIBERATE_HORIZONTAL_SCROLL;
      const escaped = await page.evaluate(() => {
        /*
          「需要横着拖才能看全」的地方：能滚（`overflow-x` 是 auto/scroll）
          **而且**真的溢出了（`scrollWidth > clientWidth`）。见文件头的判词。
        */
        return Array.from(document.querySelectorAll("*"))
          .filter((element) => {
            const overflowX = getComputedStyle(element).overflowX;
            if (overflowX !== "auto" && overflowX !== "scroll") return false;
            if (element.scrollWidth <= element.clientWidth + 1) return false;
            // 见 DELIBERATE_HORIZONTAL_SCROLL。
            if (element.tagName === "PRE") return false;
            if (element.querySelector("table")) return false;
            return true;
          })
          .slice(0, 4)
          .map(
            (element) =>
              `${element.tagName.toLowerCase()} ` +
              `sw=${element.scrollWidth} cw=${element.clientWidth} ` +
              `cls=${(element.className?.toString?.() ?? "").slice(0, 55)}`,
          );
      });
      if (escaped.length > 0)
        overflowing.push(`${key}: ${escaped.join(" | ")}`);
    } catch {
      if (!expectedUnreachable) unexpectedlyUnreachable.push(key);
    } finally {
      await context.close();
    }
  }

  expect(
    overflowing,
    "这些终态在 360px 上需要横向滚动——要么修内容，要么说明它本来就该横滚、并把判据补进 DELIBERATE_HORIZONTAL_SCROLL（见文件头）",
  ).toEqual([]);
  expect(
    unexpectedlyUnreachable,
    "这些终态在窄屏下走不到了——要么修那条路径，要么登记进 MOBILE_UNREACHABLE 并写清卡在哪一步",
  ).toEqual([]);
  expect(
    unexpectedlyReachable,
    "这些终态已经走得到了，请从 MOBILE_UNREACHABLE 里删掉（表里有、实际没有，同样是失守）",
  ).toEqual([]);
});
