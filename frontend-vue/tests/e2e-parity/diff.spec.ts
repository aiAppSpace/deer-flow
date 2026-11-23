/*
  【文件职责】     把每个场景在两个应用上的样本比出差异，并钉住一份只能缩短的清单。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/capture.ts · support/scenarios.ts · baseline/parity-diff.json
  【边界与注意】   这就是「还差哪些」的机器答案。它**不是**一份写在散文里的清单，
                   因为散文清单会先于代码过期，也会被下一个读者当成已经决定不做的东西。

                   钉的是差异本身而不是差异条数。条数只能告诉你「变多了」，
                   而清单能告诉你变的是哪一条；更重要的是，条数相同、内容全换了
                   这种情况，按条数比对完全看不见。

                   一次跑完全部场景写进**一份**基线，是为了让「某个场景消失了」
                   和「某个场景多出来了」同样会红。分成一个场景一份文件的话，
                   删掉一份文件是静默的。

                   刷新基线：`make parity-accept`。刷新前先看清楚每一条变化是修好了
                   还是新坏了——accept 只是记录，不是判断。
*/

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { expect, test } from "./support/test";

import { captureScenario } from "./support/capture";
import { createCapturePage } from "./support/capture-page";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  type ParityState,
  scenarioStates,
  type ParityDimension,
} from "./support/scenarios";

import { type DiffEntry, addedRows } from "./support/ledger";
import {
  buildDiffEntry,
  countPseudoSamples,
  countRequestBodySamples,
} from "./support/diff-entry";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";
const ACCEPT = process.env.PARITY_ACCEPT === "1";
/** Explicit diagnostic override; formal acceptance never enables it. */
const ACCEPT_GROW = process.env.PARITY_ACCEPT_GROW === "1";

/** A filtered diagnostic records observations but cannot compare or accept a baseline. */
const ONLY = process.env.PARITY_ONLY?.trim();

const BASELINE = new URL("../../baseline/parity-diff.json", import.meta.url);
const REPORT = new URL(
  "../../test-results/e2e-parity/report.json",
  import.meta.url,
);

// UI remains in scope. buildDiffEntry keeps the existing 2px geometry tolerance.

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/**
 * 台账的键。
 *
 * 有具名终态时插一段 `#终态`；没有 `states` 的场景键**逐字不变**——
 * 加这一档不能让既有的 39 个样本换名字（换了名字，台账会一次报出
 * 「全部消失 + 全部新增」，而那和真差异长得一模一样）。
 */
function key(
  scenarioId: string,
  state: ParityState,
  dimension: ParityDimension,
) {
  const suffix = state.id ? `#${state.id}` : "";
  return `${scenarioId}${suffix}/${dimension.viewport}/${dimension.theme}/${dimension.locale}`;
}

// This file owns one manual recording per app/scenario. Disable automatic
// fixture tracing at file scope so both recorders never compete for a context.
// Capture invariants use the suite recorder in capture-invariants.spec.ts.
test.use({ trace: "off" });
test("每个场景的双向差异都与签入的清单一致", async ({ browser }) => {
  // The historical calibration is 2,400,000ms for 195 samples. Scale only
  // the whole-run budget with the live registry; per-step limits and coverage stay fixed.
  const sampleCount = PARITY_SCENARIOS.reduce(
    (total, scenario) =>
      total +
      scenarioStates(scenario).reduce(
        (states, state) =>
          states +
          (state.dimensions ?? scenario.dimensions ?? [DEFAULT_DIMENSION])
            .length,
        0,
      ),
    0,
  );
  test.setTimeout(
    Math.max(2_400_000, Math.ceil((2_400_000 * sampleCount) / 195)),
  );

  const entries: Record<string, DiffEntry> = {};
  /*
  伪元素那一档**取到了东西**的锚点数。

  这一档在干净树上是 0 行——而 0 行有两种：**算出来的 0** 和**没算的 0**。
  `pseudo()` 里但凡写错一句（比如把 `content` 的判断写反、或者
  `getComputedStyle` 少传第二个参数），它会永远返回 `none`，两边一致，
  台账 0 行，**而且没有任何一条用例会红**（线索 131 的形状：
  尺子坏了会让它守的那件事静默全绿）。
  所以这里数一下真的采到伪元素的锚点，下面断言它不是 0。
*/
  let pseudoSamples = 0;
  let bodySamples = 0;
  /** 只有 `PARITY_ONLY` 时才收：两边的完整请求序列。 */
  const rawRequests: Record<string, { react: string[]; vue: string[] }> = {};
  const rawTabbables: Record<string, { react: string[]; vue: string[] }> = {};

  for (const scenario of PARITY_SCENARIOS) {
    if (ONLY && scenario.id !== ONLY) continue;
    for (const state of scenarioStates(scenario))
      for (const dimension of state.dimensions ??
        scenario.dimensions ?? [DEFAULT_DIMENSION]) {
        /*
      一个场景一个 context，不是一个 page。

      起初两个 page 共用整条用例的 context，实测在 channels 上超时：那条场景
      靠路由覆盖换掉 providers 列表，而在一个跑了几十次导航的长命 context 里
      它偶发拿不到。取样之间必须互不影响——这跟归一化只在必要处抹信息是同一条
      纪律：样本的差异只能来自被测应用，不能来自它排在第几个跑。
    */
        const captureDirectory = join(
          dirname(REPORT.pathname),
          "captures",
          key(scenario.id, state, dimension).replaceAll("/", "--"),
        );
        mkdirSync(captureDirectory, { recursive: true });
        const owned: {
          app: string;
          capture: Awaited<ReturnType<typeof createCapturePage>>;
          tracing: boolean;
        }[] = [];
        const failures: unknown[] = [];
        let succeeded = false;
        let vue!: Awaited<ReturnType<typeof captureScenario>>;
        let react!: Awaited<ReturnType<typeof captureScenario>>;
        try {
          for (const app of ["vue", "react"]) {
            const capture = await createCapturePage(browser);
            const item = { app, capture, tracing: false };
            owned.push(item);
            await capture.context.tracing.start({
              screenshots: true,
              snapshots: true,
              sources: true,
            });
            item.tracing = true;
          }
          vue = await captureScenario(
            owned[0]!.capture.page,
            VUE_APP,
            scenario,
            dimension,
            state,
          );
          react = await captureScenario(
            owned[1]!.capture.page,
            REACT_APP,
            scenario,
            dimension,
            state,
          );
          succeeded = true;
        } catch (error) {
          failures.push(error);
        } finally {
          // Archive each available page and attempt every owned cleanup even if
          // another construction, trace or close operation failed.
          for (const { app, capture, tracing } of owned) {
            await capture.page
              .screenshot({
                path: join(captureDirectory, `${app}.png`),
                fullPage: true,
                animations: "disabled",
              })
              .catch(() => undefined);
            if (tracing) {
              try {
                await capture.context.tracing.stop(
                  succeeded
                    ? {}
                    : { path: join(captureDirectory, `${app}-trace.zip`) },
                );
              } catch (error) {
                failures.push(error);
              }
            }
            try {
              await capture.close();
            } catch (error) {
              failures.push(error);
            }
          }
        }
        if (failures.length === 1) throw failures[0];
        if (failures.length)
          throw new AggregateError(
            failures,
            "Parity pair failed; capture and cleanup errors retained",
            { cause: failures[0] },
          );

        pseudoSamples += countPseudoSamples(react, vue);
        bodySamples += countRequestBodySamples(react, vue);
        const entryKey = key(scenario.id, state, dimension);
        entries[entryKey] = buildDiffEntry(react, vue);
        /*
        诊断模式下把**两边的请求原样**留下来。台账那一档只报差集，
        而查「谁多发了一次」要看的是完整序列与它们的顺序——没有这个，
        下一步只能靠猜。
      */
        if (ONLY) {
          rawRequests[entryKey] = {
            react: [...react.requests],
            vue: [...vue.requests],
          };
          /*
          **可 tab 清单也留全的。** `tabbablesOnly*` 报的是差集，
          而查「这颗到底是谁、它在两边各排第几」要看完整序列——
          第三十一轮查 `div[scroll-area-viewport]` 那族（64 个投影）时，
          光看差集把人绕进了「两边 primitive 都写了 tabindex，那差异从哪来」
          的死胡同，只能靠完整序列才看得出是**用在哪**不一样。
        */
          rawTabbables[entryKey] = {
            react: [...react.tabbables],
            vue: [...vue.tabbables],
          };
        }
      }
  }

  /*
  **算出来的 0 与没算的 0 不是一回事。**

  实测这一档在整套里只被 **4** 个锚点样本碰到（技能页那颗选中的 tab 的
  `::after`，两种语言 × 两个应用）——不是取样面漏了，是**整个仓库用伪元素的
  地方就这么少**：本仓 4 份组件、上游 5 份用到 `before:` / `after:`。
  数少不等于可以不守：那 4 个样本量的正是 `line` 档选中态的全部视觉主体，
  而 wave 145 的 N2 证明过，它一塌下来别的档一行都不会报。

  这条断言挡的是「`pseudo()` 写坏了→永远返回 `none`→两边一致→台账 0 行→
  没有任何用例会红」。数字变了要**看一眼再改**，不要顺手调低。
*/
  if (!ONLY) {
    expect(
      pseudoSamples,
      "伪元素这一档一个样本都没采到——先确认 pseudo() 还在工作，再改这个阈值",
    ).toBeGreaterThanOrEqual(4);
    /*
    请求体这一档同理（第三十轮新加）。阈值取一个**远低于实测**的数：
    它挡的是「采集整个坏掉→永远空数组→静默 0 行」，不是「今天恰好采到几条」。
    数字变了要先看一眼再改，别顺手调低——与上面那条伪元素断言同一条纪律。
  */
    expect(
      bodySamples,
      "请求体这一档一个样本都没采到——先确认 postData() 那段还在工作，再改这个阈值",
    ).toBeGreaterThanOrEqual(10);
  }

  mkdirSync(dirname(REPORT.pathname), { recursive: true });
  /*
  **诊断模式也要落盘**（第四十八轮修）。

  这里原来写着「不写报告」，而 `writeFileSync(REPORT, ...)` 在下面的 `return`
  之后——于是 `PARITY_ONLY` 的那次 CI 跑**什么产物都没有**：
  `gh run download -n parity-failures` 报 `no valid artifacts found`
  （`if-no-files-found: ignore` 把空目录静默吞掉），结论只剩下几万行日志里的
  一段 `console.log`。而 workflow 那一步的 `if: failure() || inputs.parity_only != ''`
  配着一整段注释写明「PARITY_ONLY 这次跑**唯一的产物**就是这份 report」
  ——**两处对不上，而且是「拿不到东西」和「量过、没问题」长得一模一样的那种。**

  诊断模式多写两份：`rawRequests` / `rawTabbables` 只有 ONLY 才收，
  而查「谁多发了一次请求」「那颗可 tab 的到底排第几」要看的正是完整序列，
  差集看不出来。整套模式保持原来的形状（顶层就是 entries），不给读它的人换格式。
*/
  writeFileSync(
    REPORT,
    JSON.stringify(
      ONLY ? { entries, rawRequests, rawTabbables } : entries,
      null,
      2,
    ),
  );

  if (ONLY) {
    /*
    诊断模式：把这一个场景的差异打出来就结束，**不比基线、不 accept**。
    要它一条都没有匹配上也算错——`PARITY_ONLY` 拼错了不该静默地「全绿」。
  */
    expect(
      Object.keys(entries),
      `PARITY_ONLY=${ONLY} 没有匹配到任何场景——检查 id 拼写`,
    ).not.toEqual([]);
    /*
    **把两条取样计数也打出来。** 诊断模式下最容易误读的就是「某一档空着」
    ——它有两种：两边一样，和**压根没采到**。这两个数把它们分开。
  */
    console.log(
      `PARITY_ONLY=${ONLY} 取样计数：伪元素 ${pseudoSamples} / 请求体 ${bodySamples}\n` +
        `${JSON.stringify(entries, null, 2)}\n` +
        `REQUESTS\n${JSON.stringify(rawRequests, null, 2)}\n` +
        `TABBABLES\n${JSON.stringify(rawTabbables, null, 2)}`,
    );
    return;
  }

  if (ACCEPT) {
    const previous = existsSync(BASELINE)
      ? ((
          (await import(BASELINE.href, { with: { type: "json" } })).default as {
            entries?: Record<string, DiffEntry>;
          }
        ).entries ?? {})
      : {};
    const added = addedRows(previous, entries);
    if (!ACCEPT_GROW) {
      expect(
        added,
        "台账只能缩短，而这次 accept 会**新增**下面这些行。先逐条弄清楚是新坏的" +
          "还是有意接受的；确实要接受就 PARITY_ACCEPT_GROW=1 再跑一次，" +
          "并在提交说明里写清楚每一行是什么。基线这次没有被改写。",
      ).toEqual([]);
    }
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          $comment:
            "React 与 Vue 在每个对照场景上的双向差异。这份清单只能缩短：修好一条就从这里删一条，" +
            "新出现一条会让 e2e-parity 立刻红。空数组是目标状态，不是「还没测」。" +
            "刷新用 make parity-accept——它会逐行比对新旧，**有新增行就拒写**，" +
            "真要接受得 PARITY_ACCEPT_GROW=1 再跑一次（wave 85 之前这句「只能缩短」" +
            "没有任何机器在守，accept 是无条件覆盖）。" +
            "键是 场景/断点/主题/语言；aria* 是可访问性树的双向逐行差异，" +
            "requests* 是产品 API 请求的多重集差异，geometry 是锚点的盒模型与色板差异。",
          entries,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  expect(existsSync(BASELINE), "基线不存在：先跑一次 make parity-accept").toBe(
    true,
  );
  const baseline = (await import(BASELINE.href, { with: { type: "json" } }))
    .default as { entries: Record<string, DiffEntry> };

  expect(
    entries,
    "对照差异与 baseline/parity-diff.json 不一致：修好的从清单里删掉，" +
      "新出现的先弄清楚是真差异还是取样不稳定，再决定是修代码还是 make parity-accept。",
  ).toEqual(baseline.entries);
});
