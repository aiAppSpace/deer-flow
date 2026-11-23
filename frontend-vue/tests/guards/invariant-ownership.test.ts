/*
  【文件职责】     守住行为合同的条目格式，以及若干「所有权只有一处」的源码不变量。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     frontend-vue/BEHAVIOR_CONTRACTS.md · app/** 若干所有权关键文件
  【边界与注意】   源码断言只钉「谁是唯一 owner」这类会被无声破坏的结构事实，
                   不钉实现细节。行为正确性仍由对应 unit/E2E/协议测试负责。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const invariants = readFileSync(
  fileURLToPath(new URL("../../BEHAVIOR_CONTRACTS.md", import.meta.url)),
  "utf8",
);

/** 合同条目支持加粗 ID；字母范围不随当前组数收窄。 */
function declaredInvariants(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (/^[A-Z]\d+[a-z]*$/.test(first)) found.push(first);
  }
  return found;
}

/** 文首声明与标题、合同表行必须互相对应，不能靠历史条数判定完整。 */
function contractProblems(
  source: string,
  declared = declaredInvariants(source),
): string[] {
  const problems: string[] = [];
  const match = source.match(/全表\s*\*\*A[–-]([A-Z])\s*共\s*(\d+)\s*组\*\*/);
  if (!match) return ["缺少全表组数声明"];
  const expectedGroups = Array.from({ length: Number(match[2]) }, (_, index) =>
    String.fromCharCode("A".charCodeAt(0) + index),
  );
  if (!expectedGroups.length || expectedGroups.at(-1) !== match[1])
    problems.push("组数声明的区间不连续");
  const sections = source.split(/(?=^## )/m).flatMap((section) => {
    const heading = /^## ([A-Z])\./.exec(section);
    return heading ? [{ group: heading[1]!, source: section }] : [];
  });
  const groups = sections.map(({ group }) => group);
  if (groups.join(",") !== expectedGroups.join(","))
    problems.push("合同标题与声明的组不一致");
  const rows: string[] = [];
  for (const section of sections) {
    const table = /\|\s*#\s*\|[^\n]*\n((?:\|[^\n]*(?:\n|$))+)/.exec(
      section.source,
    );
    const entries = (table?.[1] ?? "")
      .split("\n")
      .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line));
    if (!entries.length) problems.push(`${section.group} 组没有合同表行`);
    for (const entry of entries) {
      const id = (entry.split("|")[1] ?? "").replaceAll("*", "").trim();
      if (!new RegExp(`^${section.group}\\d+[a-z]*$`).test(id))
        problems.push(`非法或跨组合同 ID：${id}`);
      rows.push(id);
    }
  }
  if (!declared.length || rows.join(",") !== declared.join(","))
    problems.push("解析结果没有覆盖全部合同表行");
  if (new Set(declared).size !== declared.length) problems.push("合同 ID 重复");
  return problems;
}

describe("Vue 行为合同结构", () => {
  const declared = declaredInvariants(invariants);

  it("读取到完整的合同，而不是解析失败后假绿", () => {
    expect(contractProblems(invariants, declared)).toEqual([]);
  });

  it("文档开头那句「全表 A–X 共 N 组」与表里实际的组恰好相等（双向）", () => {
    const match = invariants.match(
      /全表\s*\*\*A[–-]([A-Z])\s*共\s*(\d+)\s*组\*\*/,
    )!;
    const actual = [...new Set(declared.map((id) => id[0]))].sort();
    const expectedLetters = Array.from(
      { length: Number(match[2]) },
      (_, index) => String.fromCharCode("A".charCodeAt(0) + index),
    );
    expect(
      actual,
      "合同表里的组与文档开头那句「全表 A–X 共 N 组」对不上：改了表就同时改那句话",
    ).toEqual(expectedLetters);
    expect(expectedLetters.at(-1)).toBe(match[1]);
  });

  it("条目 id 唯一", () => {
    const seen = new Map<string, number>();
    for (const id of declared) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(
      [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    ).toEqual([]);
  });

  const fixture = (last = "B") => {
    const groups = Array.from({ length: last.charCodeAt(0) - 64 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    return (
      `全表 **A–${last} 共 ${groups.length} 组**\n` +
      groups
        .map(
          (group) =>
            `## ${group}. 合同\n| # | 约束 |\n| --- | --- |\n| **${group}1** | 行为 |\n`,
        )
        .join("\n")
    );
  };

  it("读取后续字母组与加粗 ID，规模较小的完整合同同样有效", () => {
    expect(contractProblems(fixture())).toEqual([]);
    expect(declaredInvariants(fixture("Z"))).toContain("Z1");
    expect(contractProblems(fixture("Z"))).toEqual([]);
    expect(contractProblems(fixture().replace("B1", "B1a"))).toEqual([]);
  });

  it("拒绝空扫描、漏掉后续组、空组、跨组和重复 ID", () => {
    const source = fixture();
    expect(contractProblems(source, [])).toContain(
      "解析结果没有覆盖全部合同表行",
    );
    expect(contractProblems(source, ["A1"])).toContain(
      "解析结果没有覆盖全部合同表行",
    );
    expect(contractProblems(source.replace("| **B1** | 行为 |", ""))).toContain(
      "B 组没有合同表行",
    );
    expect(contractProblems(source.replace("**B1**", "**A2**"))).toContain(
      "非法或跨组合同 ID：A2",
    );
    expect(
      contractProblems(source.replace("**B1**", "**Binvalid**")),
    ).toContain("非法或跨组合同 ID：Binvalid");
    expect(contractProblems(source + "| A1 | 重复 |\n")).toContain(
      "合同 ID 重复",
    );
    expect(contractProblems(source.replace("全表", "合同"))).toContain(
      "缺少全表组数声明",
    );
    expect(contractProblems(source.replace("共 2 组", "共 3 组"))).toContain(
      "组数声明的区间不连续",
    );
  });
});

const agentChat = readFileSync(
  new URL("../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);
const messageList = readFileSync(
  new URL("../../app/components/chat/MessageList.vue", import.meta.url),
  "utf8",
);
const workspacePanels = readFileSync(
  new URL(
    "../../app/components/workspace/WorkspacePanels.vue",
    import.meta.url,
  ),
  "utf8",
);
const browserStream = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/useBrowserStream.ts",
    import.meta.url,
  ),
  "utf8",
);
const browserApi = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/browser-api.ts",
    import.meta.url,
  ),
  "utf8",
);
const browserPanel = readFileSync(
  new URL(
    "../../app/components/workspace/browser-view/BrowserPanel.vue",
    import.meta.url,
  ),
  "utf8",
);
const threadSidebar = readFileSync(
  new URL("../../app/components/workspace/ThreadSidebar.vue", import.meta.url),
  "utf8",
);
const threadQueries = readFileSync(
  new URL("../../app/composables/useThreads.ts", import.meta.url),
  "utf8",
);
const toolSettings = readFileSync(
  new URL("../../app/composables/useScopedMCPConfig.ts", import.meta.url),
  "utf8",
);

describe("所有权不变量", () => {
  it("keeps browser frames binary/legacy compatible and emits one click per physical click", () => {
    expect(browserApi).toContain('frame_format: "binary"');
    expect(browserStream).toContain("BrowserConnectionController");
    expect(browserStream).toContain("LatestBrowserFrameBuffer");
    expect(browserPanel).toContain('@click="clickFrame"');
    expect(browserPanel).toContain('type: "click"');
    expect(browserPanel).not.toContain('type: "down"');
    expect(browserPanel).not.toContain('type: "up"');
  });

  it("keeps thread rename fail-closed and the dialog open after a failed write", () => {
    expect(threadQueries).toContain("apiClient.threads.updateState(threadId");
    expect(threadSidebar).toMatch(
      /await threads\.rename[\s\S]*renameThreadId\.value = null;[\s\S]*catch \(cause\)/,
    );
    expect(threadSidebar).toContain("toast.error(");
  });

  it("keeps thread server state in Vue Query and routes deletes through the sidecar cascade", () => {
    expect(threadQueries).toContain("useInfiniteQuery");
    expect(threadQueries).toContain("fetchInfiniteThreadsPage");
    expect(threadQueries).toContain("deleteThreadCascade");
    expect(threadQueries).not.toContain("defineStore");
  });

  it("updates one MCP server through the single query owner before authoritative re-read", () => {
    expect(toolSettings).toContain("updateMCPServerState");
    expect(toolSettings).toContain(
      '["mcpConfig", toValue(scope), user.value?.id]',
    );
    expect(toolSettings).toContain("requestKey");
    expect(toolSettings).toContain("captureWorkspaceQueryOwner");
    expect(toolSettings).toContain("invalidateQueries");
    expect(toolSettings).not.toContain("defineStore");
  });

  it("keeps Vue panel DOM and business owners independent of React shims", () => {
    expect(workspacePanels).not.toContain('data-slot="resizable-');
    expect(workspacePanels).not.toContain("data-separator");
    expect(workspacePanels).not.toContain("flexGrow");
    // Presentation deadlines belong to WorkspacePanels. Their cancellation,
    // reversal and owner retirement are exercised by the mounted lifecycle suite.
    expect(agentChat).not.toContain("artifactOpenTimer");
    expect(messageList).not.toContain("AIMessageChunk");
  });
});
