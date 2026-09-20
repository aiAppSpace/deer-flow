/*
  【文件职责】     每一层浮层（菜单/对话框/列表框/提示）都完整落在视口里——基线字号与 200% 文本各一遍。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/settle.ts · support/context-options.ts
  【边界与注意】   **两个应用都跑**，理由与 keyboard-trap / content-reachable 同一条：
                   台账按定义只报「两边不一致」，而这一类**上游单边的回归没有任何门禁看得见**
                   ——这条门禁第一次跑出来的那两行**恰好就只在上游**（见下面登记表）。

                   **不变量直接说出来**：

                       浮层的矩形要整个落在视口里。

                   ── 为什么要有这条门禁（第五十五/五十六轮实测）──
                   第五十五轮开「点得动吗 × 200% 文本」那个面时，掉出来的是
                   **移动端抽屉自己比屏幕还宽**：`18rem` 在 200% 下 = 576px，
                   而它只在手机宽度（375px）上出现。整个抽屉挂在屏幕外，
                   它自己的 ⋯ 触发器落在 x=511，里面每一层都继承这份溢出。
                   同一形状第五十四轮出现过三次（浏览器工具条 524>307、
                   集成状态格四列、sidecar 页脚），第五十六轮又出现一次
                   （这颗 ⋯ 菜单 384>375）。**一共五次，此前没有任何门禁守它。**

                   ⚠ **判据是「整个落在视口里」，不是「比视口窄」**：
                   后者弱得多——一层 344px 的子菜单放在 375px 的屏幕上完全装得下，
                   **却可以被摆到 x=201、右边缘 545**（上游实测就是这样）。
                   「宽度」那一版在全套上报 **0 行**，而「位置」这一版报出 2 行真账。

                   ⚠ **两档字号都要量。** 抽屉那条是 200% 才现形的；
                   而下面登记的上游子菜单**基线字号就已经在视口外**——
                   只量一档会各漏掉一半。

                   ⚠ **放大必须用 `page.addStyleTag`**（第五十一轮踩过：
                   `addInitScript` 不落地，自检读回 root=16px，于是「0 行」是假的）。
                   这里保留 `root=` 自检**并且断言掉它**。
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

/** 200% 文本：WCAG 1.4.4 的门槛就是 200%。16px → 32px。 */
const ZOOM_ROOT_PX = 32;

/** 量哪些层：有 popper 定位、会被摆到视口外的那几类角色。 */
const LAYER_SELECTOR =
  "[role=menu],[role=dialog],[role=listbox],[role=tooltip]";

/*
  登记表（棘轮）：登记 = 已量过、已判；**没登记的一律红**。

  ⚠ 现在**只有两行，而且是同一条账的两档**：

      react/thread-list-pin#mobile-drawer  基线  x=[246,427]  视口 375（右边溢出 52px）
      react/thread-list-pin#mobile-drawer  200%  x=[201,544]  视口 375（右边溢出 169px）

  那是会话 ⋯ 菜单里 **Export 子菜单**。**本仓同一处 0 行**：reka 把它翻到左边
  （基线 x=[194,375] / 200% x=[31,375]），完整可见；Radix 不翻也不移。

  **两边的子菜单宽度是逐字相同的**（基线 181 / 200% 343，第五十八轮起被
  `max-w-[calc(100vw-1rem)]` 夹住），差的**只有 x** ——
  所以这不是尺寸问题，是两个 primitive 的碰撞策略不同。

  ⚠ **那条视口 clamp 是这条门禁自己在 CI 上逼出来的**（第五十八轮收尾）：
  本仓这颗子菜单在 macOS 上量到 344 正好装得下，**Linux 上是 384、溢出 9px**
  ——内容一样，`Export as Markdown` 在 Linux 的字体回退里更宽。
  **「macOS 上装得下」不等于装得下。** 内容撑开的浮层在手机宽度 × 200% 文本下
  本来就贴着边，靠的是运气而不是约束。

  ⚠ **三条改法都被读数否掉了，别重走**（全文见 open-accounts 第五十五/五十六轮）：

      sticky="always"                     读数一格没动；Radix 的 shift 是
                                          crossAxis:false，右侧子菜单根本不在那条轴上移
      给 SubContent 加 max-w-(available)  上游被夹到 129px、条目换行，
                                          **基线当场退化**；本仓那个值是 375，夹不住
                                          （换成 `calc(100vw-1rem)` 才对：基线 359px
                                           不咬、200% 343px 才咬）
      改成 portal 让变量生效              ✗ 本仓「不 portal」是 wave 95 拿
                                          可访问性树读数判的，不能为这个翻

  **翻案判据**：哪天 Radix 把子菜单也翻进视口、或者本仓这一处也跑到视口外，
  就从这里删掉/改掉。**别因为它一直红着就把断言放宽。**
*/
const KNOWN_OUTSIDE: Record<string, string> = {
  "react/thread-list-pin#mobile-drawer[基线]":
    "Export 子菜单 x=[246,427]/vw=375——上游单边，Radix 不把子菜单翻进视口（本仓 reka 会）",
  "react/thread-list-pin#mobile-drawer[200%]":
    "同上，200% 下 x=[201,545]/vw=375",
};

/** 量「这一屏有哪些浮层没有整个落在视口里」。 */
function layersOutsideViewport(args: { selector: string }) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rows: string[] = [];
  let seen = 0;
  document.querySelectorAll(args.selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    /* 没渲染出来的层不算——它不在屏幕上，谈不上「落在视口里」。 */
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    seen += 1;
    /*
      **只判横向**。纵向溢出在这一族里是常态（长菜单本来就要滚），
      而且「竖着掉没了还滚不到」已经由 content-reachable 守着——
      两条门禁各守一个不变量（判词 4h）。
    */
    if (r.left >= -0.5 && r.right <= vw + 0.5) return;
    rows.push(
      `${el.getAttribute("role") ?? el.tagName.toLowerCase()}` +
        `"${(el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 24) ?? ""}"` +
        ` x=[${Math.round(r.left)},${Math.round(r.right)}] vw=${vw} vh=${vh}`,
    );
  });
  return { rows: rows.sort(), seen };
}

const readRootPx = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

for (const [name, base] of APPS) {
  test(`${name}: 浮层都完整落在视口里（基线与 200% 文本）`, async ({
    browser,
  }) => {
    test.setTimeout(900_000);
    const outside: string[] = [];
    const unreachableScenarios: string[] = [];
    let scanned = 0;
    /*
      反空转之一：**整场必须看见过浮层**。选择器写错、或者场景没跑到位，
      结果都长成「一层都没越界」——和真的干净一模一样（第三十九轮实证）。
      第五十六轮实测这个数在两个应用上都是 62。
    */
    let layersSeen = 0;
    /* 反空转之二：放大到底有没有落地（第五十一轮那条坑）。 */
    const zoomRootPx: number[] = [];

    for (const scenario of PARITY_SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        const dimension =
          state.dimensions?.[0] ??
          scenario.dimensions?.[0] ??
          DEFAULT_DIMENSION;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        try {
          await runScenario(page, base, scenario, dimension, state, 30_000);
          /* `runScenario` 在 state.steps 之后不再 settle（第四十四轮）。 */
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);

          for (const phase of ["基线", "200%"] as const) {
            if (phase === "200%") {
              await page.addStyleTag({
                content: `html{font-size:${ZOOM_ROOT_PX}px !important}`,
              });
              await waitForFiniteAnimations(page);
              await waitForDomQuiet(page);
              zoomRootPx.push(await page.evaluate(readRootPx));
            }
            const survey = await page.evaluate(layersOutsideViewport, {
              selector: LAYER_SELECTOR,
            });
            layersSeen += survey.seen;
            if (KNOWN_OUTSIDE[`${name}/${key}[${phase}]`]) continue;
            for (const row of survey.rows)
              outside.push(`${key}[${phase}]: ${row}`);
          }
          scanned += 1;
        } catch (error) {
          unreachableScenarios.push(
            `${key}: ${String(error).split("\n")[0]?.slice(0, 90)}`,
          );
        } finally {
          await context.close();
        }
      }

    expect(
      outside,
      "这些浮层没有整个落在视口里——用户够不着它露在外面的那部分（WCAG 1.4.10）。" +
        "⚠ 报出来先问是不是**容器自己比视口还宽**（第五十四/五十五轮那五次都是：" +
        "`rem` 写的尺寸遇上视口给的空间），那一类要改容器，不是改 popper。" +
        "⚠ **别直接往 KNOWN_OUTSIDE 里加行**——先判它是两边共有还是单边，" +
        "把读数与翻案判据写进那张表的注释",
    ).toEqual([]);
    expect(
      unreachableScenarios,
      "这些终态跑不到位，门禁因此什么都没量到（空转就是失守）",
    ).toEqual([]);
    expect(scanned, "一个终态都没量到").toBeGreaterThan(0);
    expect(
      layersSeen,
      "整场一层浮层都没看见——这把尺子坏了，不是应用干净了",
    ).toBeGreaterThan(0);
    expect(
      zoomRootPx.every((px) => px === ZOOM_ROOT_PX),
      `放大没落地：根字号读回 ${[...new Set(zoomRootPx)].join("/")}，应为 ${ZOOM_ROOT_PX}`,
    ).toBe(true);
  });
}
