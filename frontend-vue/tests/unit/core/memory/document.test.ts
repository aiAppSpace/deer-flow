/*
  【文件职责】     钉住记忆摘要那份 markdown 的形状，与事实行四项元数据的呈现规则。
  【架构位置】     L3 测试
  【依赖关系】     core/memory/document
  【边界与注意】   摘要区在页面上是**一份 markdown 文档**，所以这里断言的是那份
                   markdown 的文本，而不是渲染结果——渲染器由 MessageMarkdown 负责，
                   两个应用共用同一套元素样式镜像。

                   时间一律传 locale 与固定时刻，避免断言随「今天是哪天」漂移：
                   `formatTimeAgo` 是相对量，所以这里只断言它**出现在该出现的位置**，
                   具体措辞由 core/utils/datetime 自己的用例负责。
*/

import { describe, expect, it } from "vitest";

import {
  buildMemorySectionGroups,
  confidenceToLevelKey,
  filterMemoryDocument,
  isMemorySummaryEmpty,
  summariesToMarkdown,
  upperFirst,
  type MemoryDocumentLabels,
} from "@/core/memory/document";
import type { UserMemory } from "@/core/memory/types";

const LABELS: MemoryDocumentLabels = {
  overview: "Overview",
  lastUpdated: "Last updated",
  userContext: "User context",
  work: "Work",
  personal: "Personal",
  topOfMind: "Top of mind",
  cognitiveStyle: "Thinking style",
  historyBackground: "History",
  recentMonths: "Recent months",
  earlierContext: "Earlier context",
  longTermBackground: "Long-term background",
  updatedAt: "Updated at",
  empty: "(empty)",
};

function makeMemory(overrides: Partial<UserMemory> = {}): UserMemory {
  const section = (summary: string, updatedAt = "2026-08-01T00:00:00Z") => ({
    summary,
    updatedAt,
  });
  return {
    version: "1.0",
    lastUpdated: "2026-08-02T00:00:00Z",
    user: {
      workContext: section("Works on parity."),
      personalContext: section("", ""),
      topOfMind: section("Ship wave 22."),
      cognitiveStyle: section("", ""),
    },
    history: {
      recentMonths: section("Shipped waves."),
      earlierContext: section("", ""),
      longTermBackground: section("Long project."),
    },
    facts: [],
    ...overrides,
  };
}

describe("confidenceToLevelKey", () => {
  it("maps the three bands and refuses anything that is not a finite number", () => {
    expect(confidenceToLevelKey(1)).toBe("veryHigh");
    expect(confidenceToLevelKey(0.85)).toBe("veryHigh");
    expect(confidenceToLevelKey(0.849)).toBe("high");
    expect(confidenceToLevelKey(0.65)).toBe("high");
    expect(confidenceToLevelKey(0.649)).toBe("normal");
    expect(confidenceToLevelKey(0)).toBe("normal");
    for (const value of [undefined, null, "0.9", Number.NaN, Infinity]) {
      expect(confidenceToLevelKey(value)).toBe("unknown");
    }
  });

  /*
    越界值照样落进两端的档位。**这一条不是 clamp 的守卫**：把 `Math.min/max`
    去掉这两句仍然成立（4 >= 0.85、-1 两个阈值都不过），所以 clamp 在这个函数的
    输出上没有独立可观察的效果——它是照抄上游留着的（上游还额外返回被 clamp 的
    数值，但调用点没用）。这里断言的是「越界输入不会掉进 unknown」这条行为。
  */
  it("keeps out-of-range numbers inside the bands instead of falling to unknown", () => {
    expect(confidenceToLevelKey(4)).toBe("veryHigh");
    expect(confidenceToLevelKey(-1)).toBe("normal");
  });
});

describe("upperFirst", () => {
  it("capitalises only the first character and tolerates an empty string", () => {
    expect(upperFirst("preference")).toBe("Preference");
    expect(upperFirst("")).toBe("");
    expect(upperFirst("a")).toBe("A");
  });
});

describe("buildMemorySectionGroups", () => {
  it("keeps the six sections in two named groups, empty ones included", () => {
    const groups = buildMemorySectionGroups(makeMemory(), LABELS);
    expect(groups.map((group) => group.title)).toEqual([
      "User context",
      "History",
    ]);
    expect(
      groups.flatMap((group) => group.sections.map((s) => s.title)),
    ).toEqual([
      "Work",
      "Personal",
      "Top of mind",
      "Thinking style",
      "Recent months",
      "Earlier context",
      "Long-term background",
    ]);
  });
});

describe("summariesToMarkdown", () => {
  const markdown = () =>
    summariesToMarkdown(
      makeMemory(),
      buildMemorySectionGroups(makeMemory(), LABELS),
      LABELS,
      "en-US",
    );

  it("opens with the overview bullet before any group", () => {
    const lines = markdown().split("\n").filter(Boolean);
    expect(lines[0]).toBe("## Overview");
    expect(lines[1]).toMatch(/^- \*\*Last updated\*\*: `.+`$/);
  });

  it("puts a rule before every group heading but not before the first", () => {
    const lines = markdown().split("\n");
    const headings = lines
      .map((line, index) => ({ line, index }))
      .filter((entry) => entry.line.startsWith("## "));
    expect(headings).toHaveLength(3);
    expect(lines[headings[0]!.index - 1]).not.toBe("---");
    for (const heading of headings.slice(1)) {
      expect(lines[heading.index - 1]).toBe("---");
    }
  });

  /*
    空小节要**出现**，写成一段灰掉的 `(empty)`。整段过滤掉的话，用户看不出
    「个人上下文」是没有内容还是这个功能不存在，分组标题也就没了意义。
  */
  it("renders an empty section as a muted (empty) instead of dropping it", () => {
    const text = markdown();
    expect(text).toContain("### Personal");
    expect(text).toContain(
      '<span class="text-muted-foreground">(empty)</span>',
    );
    expect(text.match(/\(empty\)/g)).toHaveLength(3);
  });

  it("quotes the updated-at line only for sections that have one", () => {
    const text = markdown();
    // 四个有内容的小节各一条；三个空小节的 updatedAt 也是空的，所以没有。
    expect(text.match(/^> Updated at: `/gm)).toHaveLength(4);
  });
});

describe("isMemorySummaryEmpty", () => {
  it("is true only when all seven summaries are blank", () => {
    expect(isMemorySummaryEmpty(makeMemory())).toBe(false);
    const blank = makeMemory();
    for (const key of [
      "workContext",
      "personalContext",
      "topOfMind",
      "cognitiveStyle",
    ] as const) {
      blank.user[key].summary = "   ";
    }
    for (const key of [
      "recentMonths",
      "earlierContext",
      "longTermBackground",
    ] as const) {
      blank.history[key].summary = "";
    }
    expect(isMemorySummaryEmpty(blank)).toBe(true);
    blank.user.cognitiveStyle.summary = "Prefers concrete examples";
    expect(isMemorySummaryEmpty(blank)).toBe(false);
  });
});

describe("filterMemoryDocument", () => {
  const withFacts = () =>
    makeMemory({
      facts: [
        {
          id: "a",
          content: "Prefers Chinese",
          category: "preference",
          confidence: 0.9,
          createdAt: "2026-08-01T00:00:00Z",
          source: "manual",
        },
        {
          id: "b",
          content: "Uses the monorepo",
          category: "context",
          confidence: 0.7,
          createdAt: "2026-08-01T00:00:00Z",
          source: "thread-1",
        },
      ],
    });

  it("matches sections on title plus summary and facts on content plus category", () => {
    const byTitle = filterMemoryDocument(
      withFacts(),
      "personal",
      "all",
      LABELS,
    );
    expect(
      byTitle.sectionGroups.flatMap((g) => g.sections.map((s) => s.title)),
    ).toEqual(["Personal"]);

    // 只命中正文、不命中标题的查询——少了 summary 那一半这里会空。
    const bySummary = filterMemoryDocument(
      withFacts(),
      "parity",
      "all",
      LABELS,
    );
    expect(
      bySummary.sectionGroups.flatMap((g) => g.sections.map((s) => s.title)),
    ).toEqual(["Work"]);

    const byCategory = filterMemoryDocument(
      withFacts(),
      "preference",
      "all",
      LABELS,
    );
    expect(byCategory.facts.map((fact) => fact.id)).toEqual(["a"]);

    // 只命中 category、不命中正文——少了 category 那一半这里会空。
    const byContent = filterMemoryDocument(
      withFacts(),
      "monorepo",
      "all",
      LABELS,
    );
    expect(byContent.facts.map((fact) => fact.id)).toEqual(["b"]);
  });

  it("hides the other half when a filter is picked", () => {
    const facts = filterMemoryDocument(withFacts(), "", "facts", LABELS);
    expect(facts.showSummaries).toBe(false);
    expect(facts.showFacts).toBe(true);

    const summaries = filterMemoryDocument(
      withFacts(),
      "",
      "summaries",
      LABELS,
    );
    expect(summaries.showSummaries).toBe(true);
    expect(summaries.showFacts).toBe(false);
  });

  /*
    只筛事实时，即使一条都不剩也要把区块渲染出来——否则「还没有事实」这句话没有
    地方可说，页面看起来像是加载失败了。
  */
  it("keeps the facts block for an empty facts-only view", () => {
    const empty = filterMemoryDocument(makeMemory(), "", "facts", LABELS);
    expect(empty.facts).toEqual([]);
    expect(empty.showFacts).toBe(true);

    /*
      空查询时第二条子句 `normalizedQuery === ""` 已经让区块留下了，所以
      `filter === "facts"` 那一条只有在**查询非空且一条都没匹配上**时才看得见。
      不带这一句的话，删掉那条子句这条用例照样绿。
    */
    const searched = filterMemoryDocument(withFacts(), "zzz", "facts", LABELS);
    expect(searched.facts).toEqual([]);
    expect(searched.showFacts).toBe(true);
    expect(searched.showSummaries).toBe(false);
  });

  it("separates a fruitless search from a memory that is genuinely empty", () => {
    const noMatch = filterMemoryDocument(withFacts(), "zzz", "all", LABELS);
    expect(noMatch.hasMatches).toBe(false);
    expect(noMatch.fullyEmpty).toBe(false);

    const blank = makeMemory();
    blank.user.workContext.summary = "";
    blank.user.topOfMind.summary = "";
    blank.history.recentMonths.summary = "";
    blank.history.longTermBackground.summary = "";
    const empty = filterMemoryDocument(blank, "", "all", LABELS);
    expect(empty.fullyEmpty).toBe(true);
    expect(empty.hasMatches).toBe(true);
  });
});
