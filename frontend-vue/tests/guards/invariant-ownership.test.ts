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

/*
  条目行长这样：`| A1  | …` 或 `| **L9**  | …`（加粗的是后补的条目）。

  **正则原来写的是 `/^[A-N]\d+$/`**（wave 150 改）。合同表实际是 **A–S 共 19 组、
  221 条**——`O` `P` `Q` `R` `S` 五组一共 **45 条从来没被读过**。
  更要命的是下面那条用例的名字叫「读取到**完整**的合同」，而它断言的是
  `组数 === 14`：**那个 14 恰恰因为 O–S 看不见才成立**，等于把缺口钉死——
  再加一组 `T`，没有任何机器会响。同一形状的坑此前踩过（线索 229：
  「checkout 共有 219 个」由一个看不见 checkout 的数字撑着）。
*/
function declaredInvariants(): string[] {
  const found: string[] = [];
  for (const line of invariants.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (/^[A-Z]\d+$/.test(first)) found.push(first);
  }
  return found;
}

/**
 * 文档开头那句「全表 **A–S 共 19 组**」里写的字母区间与组数。
 *
 * **这句话此前没有任何机器在核。** 它是文档里当规则用的一句话——
 * 「全表」这个词是判据本身：读的人靠它判断自己有没有漏看整整一组。
 */
function claimedGroups(): { last: string; count: number } {
  const match = invariants.match(
    /全表\s*\*\*A[–-]([A-Z])\s*共\s*(\d+)\s*组\*\*/,
  );
  if (!match)
    throw new Error("BEHAVIOR_CONTRACTS.md 开头那句「全表 A–X 共 N 组」不见了");
  return { last: match[1]!, count: Number(match[2]) };
}

describe("Vue 行为合同结构", () => {
  const declared = declaredInvariants();

  it("读取到完整的合同，而不是解析失败后假绿", () => {
    // 阈值按实测（wave 150：221 条）留余量；真正的判据是下面那条双向核对。
    expect(declared.length).toBeGreaterThanOrEqual(200);
  });

  it("文档开头那句「全表 A–X 共 N 组」与表里实际的组恰好相等（双向）", () => {
    /*
      **两个方向都要查**：
      - 表里出现了文档没声明的组（加了 `T` 却忘了改那句话）；
      - 文档声明了表里没有的组（删掉一整组却忘了改那句话）。
      只查一个方向，会在池子变化之后静默留下一句过期的「全表」（坑 186）。
      而且组必须**从 A 连续**——中间缺一个字母，「A–S 共 19 组」这句话就不成立。
    */
    const claimed = claimedGroups();
    const actual = [...new Set(declared.map((id) => id[0]))].sort();
    const expectedLetters = Array.from({ length: claimed.count }, (_, index) =>
      String.fromCharCode("A".charCodeAt(0) + index),
    );
    expect(
      actual,
      "合同表里的组与文档开头那句「全表 A–X 共 N 组」对不上：改了表就同时改那句话",
    ).toEqual(expectedLetters);
    expect(expectedLetters.at(-1)).toBe(claimed.last);
  });

  it("条目 id 唯一", () => {
    const seen = new Map<string, number>();
    for (const id of declared) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(
      [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    ).toEqual([]);
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
  new URL("../../app/composables/useMCPConfig.ts", import.meta.url),
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
    expect(threadSidebar).toContain('role="alert"');
  });

  it("keeps thread server state in Vue Query and routes deletes through the sidecar cascade", () => {
    expect(threadQueries).toContain("useInfiniteQuery");
    expect(threadQueries).toContain("fetchInfiniteThreadsPage");
    expect(threadQueries).toContain("deleteThreadCascade");
    expect(threadQueries).not.toContain("defineStore");
  });

  it("updates one MCP server through the single query owner before authoritative re-read", () => {
    expect(toolSettings).toContain("updateMCPServerState");
    expect(toolSettings).toContain("MCP_CONFIG_QUERY_KEY");
    expect(toolSettings).toContain("invalidateQueries");
    expect(toolSettings).not.toContain("defineStore");
  });

  it("does not reintroduce React DOM or fixed-timer shims in Vue panel behavior", () => {
    expect(workspacePanels).not.toContain('data-slot="resizable-');
    expect(workspacePanels).not.toContain("data-separator");
    expect(workspacePanels).not.toContain("flexGrow");
    expect(workspacePanels).not.toContain("animationTimer");
    expect(agentChat).not.toContain("artifactOpenTimer");
    expect(messageList).not.toContain("AIMessageChunk");
  });
});
