/*
  【文件职责】     钉住 `workspace-changes#changes-panel` 的 diff 锚点真的指得到夹具里的行，
                   而且 addition / deletion / hunk 三档各有且只有一个锚点。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/e2e-parity/support/scenarios.ts · app/core/workspace-changes/summary.ts
  【边界与注意】   **为什么要有它**：这三个锚点是 2026-09-12 才挂上的，挂上当场量出
                   `y Δ4`（面板纵向内边距本仓写成了 `p-5`，上游是 `px-5 py-4`）。
                   而锚点一旦指不到东西，`sampleGeometry` 两边都记 `null`，
                   `diffGeometry` 直接跳过——**台账 0 行，没有任何用例会红**
                   （线索 131 的形状：尺子坏了会让它守的那件事静默全绿）。
                   夹具里那段 diff 只是一个字符串字面量，改它不需要碰这三行正则。

                   **判据不是「有三个锚点」**（那只是把一个数字写死在两处），
                   而是**三档各被盖住一次**：三档各是一条独立的 class 串
                   （`bg-emerald-500/10 …` / `bg-red-500/10 …` / `bg-sky-500/10 …`，
                   各带自己的 `dark:` 变体），只挂一行，另外两档塌了照样全绿。
                   行的归类走产品代码自己的 `getWorkspaceChangeLineClass`，
                   不在这里重写一份——重写一份就会有两份规则各自漂移。

                   **零豁免**：`meta`（`--- ` / `+++ `）与 `context` 两档故意不要求盖到。
                   它们不是「漏了」：`meta` 只有 `text-muted-foreground`、`context` 只有
                   `text-foreground`，两条都是别处已经取样过几十次的前景色，
                   没有自己的 `dark:` 变体，也就没有这一档要守的那件事。
                   哪天它们长出自己的配色，判据要一起改——这句话就是那时的翻案依据。
*/

import { describe, expect, it } from "vitest";

import { getWorkspaceChangeLineClass } from "../../../app/core/workspace-changes/summary";
import {
  PARITY_SCENARIOS,
  scenarioStates,
} from "../../e2e-parity/support/scenarios";

const scenario = PARITY_SCENARIOS.find(
  (candidate) => candidate.id === "workspace-changes",
);
const state = scenario
  ? scenarioStates(scenario).find(
      (candidate) => candidate.id === "changes-panel",
    )
  : undefined;

/** 夹具里那一份 diff，按行拆开。 */
function fixtureDiffLines(): string[] {
  const route = (scenario?.routes ?? []).find((candidate) =>
    candidate.pattern.includes("workspace-changes"),
  );
  const json = route?.json as { files?: { diff?: string }[] } | undefined;
  return (json?.files ?? []).flatMap((file) => (file.diff ?? "").split("\n"));
}

/** `steps` 里所有按整行正则定位的文本锚点。 */
function textAnchors(): RegExp[] {
  return (state?.steps ?? []).flatMap((step) => {
    if (step.kind !== "visible") return [];
    const target = step.target;
    if (!("text" in target) || typeof target.text === "string") return [];
    return [target.text];
  });
}

describe("workspace-changes 的 diff 锚点", () => {
  it("场景与终态还在（改了 id 要在这里先红，而不是静默零锚点）", () => {
    expect(scenario, "找不到 workspace-changes 场景").toBeDefined();
    expect(state, "找不到 changes-panel 终态").toBeDefined();
    expect(fixtureDiffLines().length).toBeGreaterThan(3);
  });

  it("每个文本锚点都恰好命中夹具里的一行", () => {
    const lines = fixtureDiffLines();
    for (const anchor of textAnchors()) {
      const hits = lines.filter((line) => anchor.test(line));
      expect(
        hits,
        `${anchor} 在夹具的 diff 里命中了 ${hits.length} 行——` +
          "锚点指不到东西时两边都记 null，台账会安静地报 0 行",
      ).toHaveLength(1);
    }
  });

  it("addition / deletion / hunk 三档各被一个锚点盖住", () => {
    const lines = fixtureDiffLines();
    const covered = textAnchors().map((anchor) =>
      getWorkspaceChangeLineClass(
        lines.find((line) => anchor.test(line)) ?? "",
      ),
    );
    expect([...covered].sort()).toEqual(["addition", "deletion", "hunk"]);
  });
});
