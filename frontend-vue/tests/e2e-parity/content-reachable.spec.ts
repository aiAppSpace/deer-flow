/*
  【文件职责】     每一个对照终态里，被裁掉的内容都有办法滚到——基线字号与 200% 文本各一遍。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/scenarios.ts 的 runScenario · support/settle.ts · support/context-options.ts
  【边界与注意】   **两个应用都跑**，理由与 keyboard-trap 同一条：台账按定义只报
                   「两边不一致」，上游单边回归没有任何门禁看得见。而这一条第一次
                   跑出来的那笔账**恰好在本仓**（见下面读数），所以两侧都要守。

                   **不变量直接说出来**：

                       任何一个 overflow:hidden 的盒子里装不下的内容，
                       都要有一条路能滚到它。

                   ── 为什么要有这条门禁（第五十二轮实测）──
                   `scheduled-tasks` 这一屏，本仓的内容壳
                   （`layouts/workspace.vue` 那层 `relative min-h-0 flex-1`）
                   `clientH 800 / scrollH 1886`，**裁掉 1086px 而整页 `docScrollable=0`、
                   祖先没有能滚的、里面也没有滚动容器**——表单从「Prompt」那一行
                   往下一个像素都够不到。同一屏上游 `docScrollable=1086`，滚到底
                   之后末尾那颗控件 `y 4403 → 27`、`inView false → true`。
                   **注意这不是 200% 才有的问题：基线字号下就已经裁掉 1086px**，
                   放大只是把它放大到 4375px。已改成 `overflow-y-auto`。

                   ⚠ **「裁掉」不等于「丢了」**，这是这把尺子最容易报错的地方：
                   上游 `branch-thread` 的消息列 `div.relative.flex-1.overflow-y-hidden`
                   在 200% 下裁掉 **998px**，看着比本仓那条还大——而它是
                   `use-stick-to-bottom` 的 `StickToBottom`，**滚动条在内层**，
                   内容完全够得到。所以判据必须是「裁掉 **且** 全链路滚不动」，
                   只判「裁掉」会把这一条报成缺陷。

                   ⚠ **两档字号都要量。** 只量基线会漏掉「放大之后才装不下」的，
                   只量 200% 会把「本来就装不下」说成是缩放的锅——
                   `scheduled-tasks` 正是两档都中，而它的根因与字号无关。

                   ⚠ **`PROBE_WIDTH` 这类外部 viewport 是无效的**（第五十二轮踩过）：
                   `runScenario` → `applyDimension` 会 `setViewportSize(VIEWPORTS[...])`，
                   把 context 的 viewport 覆盖掉。所以每个终态量的是**它自己那一档**
                   （desktop 1280×800 / tablet 768×1024 / mobile 375×812），
                   要换断点得在 `runScenario` **之后**再设。

                   ⚠ **这份文件里的字段名别和词典的叶子名撞上**（第五十二轮踩过两次）：
                   `scripts/i18n-manager.mjs` 判一个词典 key 「被引用」用的是
                   **叶子名**是否以属性访问出现过（它自己的注释里写明是有意为之，
                   免得 `const { common } = t` 那种间接访问被误判成未引用）。
                   本轮那个字段原来叫「描述」的英文缩写（d-e-s-c），于是
                   `scheduledTasks.recipes.*` 底下那三条同名叶子从 unused 翻成 used，
                   `make i18n-check` 当场红。改叫 `label` 才绿。
                   **正确的处理是改字段名，不是 `make i18n-refresh`**——
                   刷基线等于把一次巧合记成事实，把这道门禁磨钝。

                   ⚠ **而且第二次红是这段注释自己造成的**：那把尺子**不剥注释**，
                   所以上面这段话里只要写出那个词的属性访问形态，它就照样算一次引用。
                   这是本仓第五次踩「守卫扫源文本前先剥注释」——**写判词的时候
                   不要把违规样本原样写进被扫的文件**，拆开写（如上面的 d-e-s-c）。

                   ⚠ **放大必须用 `page.addStyleTag`，不能用 `addInitScript`**
                   （第五十一轮踩过：后者不落地，自检读回 `root=16px`，
                   于是同一个「0 条」拿了两次假读数）。这里保留了 `root=` 自检，
                   并且**把它断言掉**——尺子没放大而报 0 条，和真的 0 条长得一模一样。
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

/*
  门限。**不是拍脑袋定的**，是按第五十二轮那次全量读数的两个簇之间取的：

      噪声簇   侧栏那四条 `peer/menu-button` 与 `router-link-active`：
               基线 2px、200% 下 4px，**两个应用逐字相同**。
               32px 高的按钮里文字基线溢出 2px，看不出来也够不着，两边一样。
      真账簇   `scheduled-tasks` 1086 / 4375（本仓单边，已修）
               `integrations` 41x（两边相同，第五十四轮已两边同改）

  24px 落在两簇中间：比噪声的 6 倍还高，比最小的真账还低一半。
  ⚠ 门限调低之前先想清楚：低于 24 会把那一族 2px 的噪声全放进来，
  而两张登记表现在都是空的，噪声一进来就是红。
  ⚠ 第五十二轮列在这里的第三条（`thread-list-pin#mobile-drawer` 50 / 100）
  **不在这个簇里**——它是尺子把 `p-4 sr-only` 当成了内容，见 `clippedAway`。
*/
const THRESHOLD_PX = 24;

/*
  **纵向**的登记表：**第五十四轮清空，现在一条都没有。**

  清空之前它只有一条 `thread-list-pin#mobile-drawer`（50y 基线 / 100y 200%，
  两个应用逐字相同），而那一条**根本不是账**：命中的元素是 Sheet 的
  `<SheetHeader className="sr-only">`，读数与判词写在上面 `clippedAway` 那一段。
  尺子认出读屏器专用内容之后它自己就不见了，**不是把它豁免掉的**。

  ⚠ **这张表要一直是空的。** 纵向裁掉是「内容掉到看不见的地方」，
  第五十二轮 `scheduled-tasks` 那条真缺陷就是这个形状。
  下面那条断言的说明里也写着「这一条不许加豁免」——真报出东西就去修产品，
  或者证明它像上面那条一样根本没画在屏幕上，而不是往这里加一行。
*/
const VERTICAL_KNOWN: Record<string, string> = {};

/*
  **横向**的登记表（棘轮）：**第五十四轮清空，现在一条都没有。**

  ⚠ **横向和纵向不是同一件事，所以分两张表**：
  纵向裁掉是「内容掉到看不见的地方」，那是第五十二轮抓到的那条缺陷的形状；
  横向裁掉是**固定宽度的盒子在 200% 文本下装不下**，属于 **WCAG 1.4.10（Reflow）**，
  与这条门禁主攻的 1.4.4 是两条不同的标准条款。把它们混在一个断言里，
  结果就是第五十二轮那次：两个应用**同时**红，而报出来的东西一条也不是对照缺陷。

  ── 第五十四轮把这 11 行还清的经过（读数逐条留档）──

  清空前的 11 行是三处，**没有一处是「两边一样所以不算」**：

      thread-list-pin#mobile-drawer  165x / 304x   两应用逐字相同
        → **尺子的洞**：命中的是 `p-4 sr-only` 的 Sheet 页头，屏幕上不画。
          见上面 `clippedAway`。**不是改了产品才没的。**

      browser-feature               217x           两应用逐字相同（层不同）
        → **真缺陷，两边同改。** 侧栏格宽度按视口百分比算（~307px），
          而里面每件都按 rem：200% 下这条工具条要 524px。实测那一档
          URL 框 / 实时控制键 / **关闭按钮**三件 `inViewport=false`
          （关闭键 x 起 1433，视口 1280）——面板关不掉。
          两边给 header 加 `flex-wrap`、给 URL 表单加
          `@max-[12rem]:basis-full`。改后两应用同为 `clips=0`，
          关闭键 `x=[1107,1171] fullyInView=true`，基线那档一格没动。

      integrations ×3 × 两应用      41x            六行逐字相同
        → **真缺陷，两边同改。** `md:grid-cols-4` 是视口断点而格里按 rem 排，
          200% 下四列还是 166px 而状态徽标涨到 151px。换成
          `grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]`（rem 门限自己重排，
          顺带吃掉 3/4 那个三元）。改后两应用同为 `clips=0`。

      react/sidecar-chat            70x            **只有上游**
        → **真缺陷，两边同改——而查它的时候掉出本仓的另一半。**
          上游那一侧 `flex-1` 的假想尺寸是 0，行永远挤不满也就永远不换行，
          左组拿到 113px 去装 183px，自己把档位标签裁掉 70px。
          本仓同一行不裁（只有 13x，够不到门限）**但发送键被推出视口**：
          实测 200% 下本仓 `x=[1229,1293]` / 视口 1280（出界 13px），
          上游 `x=[1159,1223]` 完整在内。两边改法见各自文件头的注释。

  ⚠ **分栏格那几条（`+200~232x`）从来不在这张表里**，不是漏了：
  它们有内层滚动容器，判定为**够得到**。这正是这把尺子与 zz-zoom 的区别。

  ⚠ **往这张表里加行之前先问「它是不是画在屏幕上的」**——第五十四轮 11 行里
  有 3 行是尺子把读屏器专用内容当成了内容。加行是最后一步，不是第一步。
*/
const HORIZONTAL_KNOWN: Record<string, string> = {};

type Clip = { label: string; dy: number; dx: number };

/** 量「这一屏有哪些内容被裁掉了，而且滚不到」。 */
function unreachableClips(threshold: number) {
  /*
    **读屏器专用内容整个不画在屏幕上，所以「裁掉」对它没有意义。**

    ⚠ 认它**不能用 1×1**（第五十四轮实测）：Sheet 的页头是
    `<SheetHeader className="sr-only">`，而 `SheetHeader` 自带 `p-4`——
    `p-4` 压过 `sr-only` 的 `padding:0`，盒子因此是 **32×32**（200% 下 64×64），
    1×1 那条一个都拦不住。于是 `thread-list-pin#mobile-drawer` 这一条
    **在两个应用上逐字相同地**被报成「裁掉 50y/165x（200% 下 100y/304x）」，
    两轮都挂在登记表里当成欠账——而它一个像素都没画出来过。

    认它的是**把自己整个裁没**的那两条声明，也正是 `sr-only` 藏起来的手段：

        clip: rect(0px, 0px, 0px, 0px)      （Tailwind v4 的 `sr-only`）
        clip-path: inset(50%)               （同一目的的现代写法）

    ⚠ 判据是「**屏幕上画不画得出来**」，不是「类名叫不叫 sr-only」：
    扫类名会漏掉自己手写这两条声明的地方，也会被 `sr-only` 被别的类推翻时骗过。
  */
  const clippedAway = (cs: CSSStyleDeclaration) => {
    const rect = /^rect\((.+)\)$/.exec(cs.clip ?? "");
    if (rect) {
      const [top, right, bottom, left] = rect[1]!
        .split(/,\s*|\s+/)
        .map((part) => Number.parseFloat(part));
      if (
        [top, right, bottom, left].every((n) => Number.isFinite(n)) &&
        (bottom! - top! <= 0 || right! - left! <= 0)
      )
        return true;
    }
    return /^inset\(50%\s*\)?$/.test(cs.clipPath ?? "");
  };
  const canScroll = (el: Element) => {
    const cs = getComputedStyle(el);
    const oy = cs.overflowY;
    const ox = cs.overflowX;
    return (
      ((oy === "auto" || oy === "scroll" || oy === "overlay") &&
        el.scrollHeight - el.clientHeight > 1) ||
      ((ox === "auto" || ox === "scroll" || ox === "overlay") &&
        el.scrollWidth - el.clientWidth > 1)
    );
  };
  const de = document.documentElement;
  const docScrolls =
    de.scrollHeight - de.clientHeight > 1 ||
    de.scrollWidth - de.clientWidth > 1;
  const out: Clip[] = [];
  /*
    反空转之三：上面那条 `clippedAway` **必须真的挡下过东西**。
    它是一条「跳过」分支——写错了（选择器变了、Tailwind 换了藏法）只会让它
    一次都不命中，而那时候这把尺子**照样绿**，只是多报几条被登记表吸收掉的噪声。
    这个计数回传出去、在用例里断言 > 0，那条分支才有人守着。
  */
  let clippedAwaySkips = 0;
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    const hidesY = cs.overflowY === "hidden" || cs.overflowY === "clip";
    const hidesX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    if (!hidesY && !hidesX) return;
    /* 1px×1px 的盒子天生就在裁，不是缺陷。 */
    if (el.clientWidth <= 1 || el.clientHeight <= 1) return;
    /* 读屏器专用内容：屏幕上一个像素都不画，见上面 `clippedAway` 的判词。 */
    if (clippedAway(cs)) {
      clippedAwaySkips += 1;
      return;
    }
    /* 有意截断：truncate / line-clamp 就是「切掉并给出省略号」，设计如此。 */
    if (cs.textOverflow === "ellipsis") return;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") return;
    const dy = hidesY ? el.scrollHeight - el.clientHeight : 0;
    const dx = hidesX ? el.scrollWidth - el.clientWidth : 0;
    if (dy < threshold && dx < threshold) return;
    /* 够得到吗：整页能滚 / 祖先能滚 / 里面有能滚的，任一成立就算够得到。 */
    if (docScrolls) return;
    let ancestor: Element | null = el.parentElement;
    while (ancestor && ancestor !== document.body) {
      if (canScroll(ancestor)) return;
      ancestor = ancestor.parentElement;
    }
    if (Array.from(el.querySelectorAll("*")).some(canScroll)) return;
    out.push({
      label:
        `${el.tagName.toLowerCase()}` +
        `.${(el.className?.toString?.() ?? "").split(/\s+/).slice(0, 3).join(".").slice(0, 44)}` +
        `"${(el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 24) ?? ""}"`,
      dy,
      dx,
    });
  });
  return { clips: out, clippedAwaySkips };
}

const readRootPx = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

for (const [name, base] of APPS) {
  test(`${name}: 被裁掉的内容都滚得到（基线与 200% 文本）`, async ({
    browser,
  }) => {
    test.setTimeout(900_000);
    const lost: string[] = [];
    const horizontalNew: string[] = [];
    const unreachableScenarios: string[] = [];
    let scanned = 0;
    /*
      反空转之一：这把尺子**必须在某处报出过「有盒子在裁」**。
      全场一个裁剪都没找到，说明选择器/计算样式那一层坏了，而它长得和「全都没问题」
      一模一样（第三十九轮：十轮绿的门禁量的是一块空面板）。
    */
    let clippersSeenAtAll = 0;
    /* 反空转之二：放大到底有没有落地。`addInitScript` 那条坑就是这么来的。 */
    const zoomRootPx: number[] = [];
    /* 反空转之三：读屏器专用那条跳过分支有没有真的命中过，见 `clippedAway`。 */
    let clippedAwaySkips = 0;

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
          /*
            `runScenario` 在 `state.steps` 之后**不再 settle**（capture.ts 是自己
            补的那一道）。少了它会读在 animate-in 中段——第四十四轮踩过。
          */
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
            clippersSeenAtAll += (await page.evaluate(unreachableClips, 1))
              .clips.length;
            const survey = await page.evaluate(unreachableClips, THRESHOLD_PX);
            clippedAwaySkips += survey.clippedAwaySkips;
            for (const clip of survey.clips) {
              const where = `${key}[${phase}]: 裁掉 ${clip.dy}y/${clip.dx}x 且滚不到 ${clip.label}`;
              /*
                纵横**分开记**：两者是不同的标准条款，混在一个断言里会让
                「横向那一族两边一样」把「纵向真丢了内容」盖住（第五十二轮实证）。
              */
              if (clip.dy >= THRESHOLD_PX && !VERTICAL_KNOWN[key])
                lost.push(where);
              if (
                clip.dx >= THRESHOLD_PX &&
                !HORIZONTAL_KNOWN[`${name}/${key}`]
              )
                horizontalNew.push(where);
            }
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
      lost,
      "【纵向】这些终态里有内容被竖着裁掉了，而且整页、祖先、内层都滚不到——" +
        "用户够不着（WCAG 1.4.4 / 2.1.1）。**这一条不许加豁免**：" +
        "第五十二轮抓到的 `scheduled-tasks` 就是这个形状，而且它基线字号就在丢。" +
        "⚠ 报出来先看是不是「滚动条在内层」那一类（见文件头 StickToBottom 那条）",
    ).toEqual([]);
    expect(
      horizontalNew,
      "【横向】这些终态在 200% 文本下把内容横着裁掉了且滚不到（WCAG 1.4.10 Reflow）——" +
        "**没登记在 HORIZONTAL_KNOWN 里的一律算新增**。要么它是真的新回归，" +
        "要么你刚改的东西让某处固定宽度的盒子装不下了。" +
        "⚠ 别直接往登记表里加——先判它是两边共有还是单边，把读数写进那张表的注释",
    ).toEqual([]);
    expect(
      unreachableScenarios,
      "这些终态跑不到位，门禁因此什么都没量到（空转就是失守）",
    ).toEqual([]);
    expect(scanned, "一个终态都没量到").toBeGreaterThan(0);
    expect(
      clippersSeenAtAll,
      "整场一个 overflow:hidden 的裁剪都没找到——这把尺子坏了，不是应用干净了",
    ).toBeGreaterThan(0);
    expect(
      zoomRootPx.every((px) => px === ZOOM_ROOT_PX),
      `放大没落地：根字号读回 ${[...new Set(zoomRootPx)].join("/")}，应为 ${ZOOM_ROOT_PX}`,
    ).toBe(true);
    expect(
      clippedAwaySkips,
      "「读屏器专用内容」那条跳过分支一次都没命中——它写错了也会长成这样，" +
        "而那时候这把尺子照样绿（多报的噪声会被登记表吸收）。" +
        "⚠ 真的一个 sr-only 都没有了，就把这条断言连同 `clippedAway` 一起删掉，别调成 >= 0",
    ).toBeGreaterThan(0);
  });
}
