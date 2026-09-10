/*
  【文件职责】     把 Memory document 渲染成上游那份 markdown，并给出事实行的呈现规则。
  【架构位置】     L3
  【主要导出】     buildMemorySectionGroups · summariesToMarkdown · filterMemoryDocument ·
                   confidenceToLevelKey · upperFirst · isMemorySummaryEmpty
  【依赖关系】     memory/types · core/utils/datetime
  【边界与注意】   与 React 的 memory-settings-page.tsx（`formatMemorySection` /
                   `buildMemorySectionGroups` / `summariesToMarkdown` /
                   `confidenceToLevelKey`）同判据。

                   **摘要区是一份 markdown 文档，不是一叠卡片。** 上游把六个小节按
                   「用户上下文 / 历史背景」两组拼成 `## / ### / > 引用 / ---` 的
                   markdown，再交给 SafeStreamdown 渲染；本仓原来是六张手写 `<article>`。
                   两者在可访问性树上完全不同（标题层级、blockquote、code、分隔线），
                   而这一屏此前从没被取样过，所以台账一行都没报（线索 103 的又一例）。

                   **空小节要照样出现，写成 `(empty)`。** 本仓原来直接把空小节过滤掉，
                   于是「个人上下文」这一栏存在与否取决于它有没有内容——用户看不出
                   是「没有」还是「这个功能不存在」。分组标题也因此没了意义。

                   置信度只念**档位**不念数字（`confidenceLevel.veryHigh/high/normal`）：
                   0.92 对用户没有意义，「很高」有。非有限数字落到 `unknown` 那一档。
*/

import { formatTimeAgo } from "@/core/utils/datetime";

import type { MemorySection, UserMemory } from "./types";
import type { MemoryViewFilter } from "./view-model";

export type MemorySectionView = {
  title: string;
  summary: string;
  updatedAt: string;
};

export type MemorySectionGroup = {
  title: string;
  sections: MemorySectionView[];
};

/** 文档里出现的每一条文案，由调用点从词典里取好传进来。 */
export type MemoryDocumentLabels = {
  overview: string;
  lastUpdated: string;
  userContext: string;
  work: string;
  personal: string;
  topOfMind: string;
  historyBackground: string;
  recentMonths: string;
  earlierContext: string;
  longTermBackground: string;
  updatedAt: string;
  empty: string;
};

export type ConfidenceLevelKey = "veryHigh" | "high" | "normal" | "unknown";

export function confidenceToLevelKey(confidence: unknown): ConfidenceLevelKey {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "unknown";
  }
  const value = Math.min(1, Math.max(0, confidence));
  if (value >= 0.85) return "veryHigh";
  if (value >= 0.65) return "high";
  return "normal";
}

export function upperFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildMemorySectionGroups(
  memory: UserMemory,
  labels: MemoryDocumentLabels,
): MemorySectionGroup[] {
  const view = (title: string, section: MemorySection): MemorySectionView => ({
    title,
    summary: section.summary,
    updatedAt: section.updatedAt,
  });
  return [
    {
      title: labels.userContext,
      sections: [
        view(labels.work, memory.user.workContext),
        view(labels.personal, memory.user.personalContext),
        view(labels.topOfMind, memory.user.topOfMind),
      ],
    },
    {
      title: labels.historyBackground,
      sections: [
        view(labels.recentMonths, memory.history.recentMonths),
        view(labels.earlierContext, memory.history.earlierContext),
        view(labels.longTermBackground, memory.history.longTermBackground),
      ],
    },
  ];
}

export function isMemorySummaryEmpty(memory: UserMemory) {
  return [
    memory.user.workContext,
    memory.user.personalContext,
    memory.user.topOfMind,
    memory.history.recentMonths,
    memory.history.earlierContext,
    memory.history.longTermBackground,
  ].every((section) => section.summary.trim() === "");
}

function formatMemorySection(
  section: MemorySectionView,
  labels: MemoryDocumentLabels,
  locale: string | undefined,
): string {
  /*
    空小节用一段 `<span>` 而不是纯文本：上游就是这么写的，它要的是「灰掉的
    (empty)」而不是一句会被读成正文的话。markdown 渲染器允许内联 HTML。
  */
  const content =
    section.summary.trim() ||
    `<span class="text-muted-foreground">${labels.empty}</span>`;
  return [
    `### ${section.title}`,
    content,
    "",
    section.updatedAt &&
      `> ${labels.updatedAt}: \`${formatTimeAgo(section.updatedAt, locale)}\``,
  ]
    .filter(Boolean)
    .join("\n");
}

export function summariesToMarkdown(
  memory: UserMemory,
  sectionGroups: MemorySectionGroup[],
  labels: MemoryDocumentLabels,
  locale: string | undefined,
): string {
  const parts: string[] = [];
  parts.push(`## ${labels.overview}`);
  parts.push(
    `- **${labels.lastUpdated}**: \`${formatTimeAgo(memory.lastUpdated, locale)}\``,
  );

  for (const group of sectionGroups) {
    parts.push(`\n## ${group.title}`);
    for (const section of group.sections) {
      parts.push(formatMemorySection(section, labels, locale));
    }
  }

  /*
    每个 `##` 前面插一条 `---`（第一个除外）。上游是逐行扫一遍加进去的，不是在
    拼接时插——因为小节正文自己可能以 `##` 开头，那种行同样要被分隔线隔开。
  */
  const out: string[] = [];
  let index = 0;
  for (const line of parts.join("\n\n").split("\n")) {
    index += 1;
    if (index !== 1 && line.startsWith("## ")) {
      if (out.length === 0 || out[out.length - 1] !== "---") out.push("---");
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * 搜索与筛选。判据与 React 的 `filteredSectionGroups` / `filteredFacts` /
 * `shouldRender*` 一一对应。
 *
 * 注意 `shouldRenderFactsBlock` 里那条 `filter === "facts"`：只筛事实时，即使
 * 一条都没有也要把区块渲染出来，否则「没有事实」这句话没地方说。
 */
export function filterMemoryDocument(
  memory: UserMemory,
  query: string,
  filter: MemoryViewFilter,
  labels: MemoryDocumentLabels,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const sectionGroups = buildMemorySectionGroups(memory, labels);
  const filteredSectionGroups = sectionGroups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) =>
        normalizedQuery
          ? `${section.title} ${section.summary}`
              .toLowerCase()
              .includes(normalizedQuery)
          : true,
      ),
    }))
    .filter((group) => group.sections.length > 0);

  const facts = memory.facts.filter((fact) =>
    normalizedQuery
      ? `${fact.content} ${fact.category}`
          .toLowerCase()
          .includes(normalizedQuery)
      : true,
  );

  const showSummaries = filter !== "facts";
  const showFacts = filter !== "summaries";
  return {
    sectionGroups: filteredSectionGroups,
    facts,
    fullyEmpty: isMemorySummaryEmpty(memory) && memory.facts.length === 0,
    showSummaries:
      showSummaries &&
      (filteredSectionGroups.length > 0 || normalizedQuery === ""),
    showFacts:
      showFacts &&
      (facts.length > 0 || normalizedQuery === "" || filter === "facts"),
    hasMatches:
      (showSummaries && filteredSectionGroups.length > 0) ||
      (showFacts && facts.length > 0),
    query: normalizedQuery,
  };
}
