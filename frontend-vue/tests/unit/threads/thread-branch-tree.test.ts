/*
  【文件职责】     钉住分支谱系投影的安全不变量与排序。
  【架构位置】     纯函数单测
  【主要导出】     无；Vitest cases
  【依赖关系】     core/threads/thread-branch-tree
  【边界与注意】   最要紧的一条是**任何畸形元数据都不能让一条已加载的会话消失**——
                   分页只加载半棵谱系、父线程在另一页、元数据被写坏，都属于日常情形，
                   而「少了一条会话」在 UI 上没有任何提示。所以每种畸形都单独有一条用例。
*/
import { describe, expect, it } from "vitest";

import {
  flattenThreadBranches,
  isBranchThread,
} from "@/core/threads/thread-branch-tree";
import type { AgentThread } from "@/core/threads/types";

function thread(
  id: string,
  metadata: Record<string, unknown> = {},
  updatedAt = "2026-07-01T00:00:00Z",
): AgentThread {
  return {
    thread_id: id,
    updated_at: updatedAt,
    created_at: updatedAt,
    metadata,
  } as unknown as AgentThread;
}

function branchOf(parentId: unknown, extra: Record<string, unknown> = {}) {
  return { deerflow_branch: true, branch_parent_thread_id: parentId, ...extra };
}

const ids = (entries: ReturnType<typeof flattenThreadBranches>) =>
  entries.map((e) => e.thread.thread_id);

describe("flattenThreadBranches 的安全不变量", () => {
  it.each([
    ["父线程没被加载", [thread("a"), thread("b", branchOf("missing"))]],
    ["parent id 不是字符串", [thread("a"), thread("b", branchOf(42))]],
    ["parent id 是空白串", [thread("a"), thread("b", branchOf("   "))]],
    ["自己认自己当父", [thread("a"), thread("b", branchOf("b"))]],
    [
      "跨 pinned 分区",
      [thread("a", { deerflow_pinned: true }), thread("b", branchOf("a"))],
    ],
    ["父子成环", [thread("a", branchOf("b")), thread("b", branchOf("a"))]],
  ])("%s —— 会话仍然全部出现，且留在顶层", (_label, input) => {
    const entries = flattenThreadBranches(input);
    expect(ids(entries).sort()).toEqual(input.map((t) => t.thread_id).sort());
    expect(entries.every((e) => e.depth === 0)).toBe(true);
  });

  it("三层成环也不会丢会话、不会无限递归", () => {
    const input = [
      thread("a", branchOf("c")),
      thread("b", branchOf("a")),
      thread("c", branchOf("b")),
    ];
    const entries = flattenThreadBranches(input);
    expect(ids(entries).sort()).toEqual(["a", "b", "c"]);
  });

  it("合法父子会形成层级，且子线程不重复出现", () => {
    const entries = flattenThreadBranches([
      thread("parent"),
      thread("child", branchOf("parent")),
    ]);
    expect(ids(entries)).toEqual(["parent", "child"]);
    expect(entries[1]?.depth).toBe(1);
    expect(entries[1]?.parentThread?.thread_id).toBe("parent");
    expect(entries[1]?.isLastSibling).toBe(true);
  });

  it("单条或空输入直接返回顶层项", () => {
    expect(flattenThreadBranches([])).toEqual([]);
    expect(ids(flattenThreadBranches([thread("only")]))).toEqual(["only"]);
  });
});

describe("排序", () => {
  it("固定住的排在前面，并保持来源顺序", () => {
    const entries = flattenThreadBranches([
      thread("plain", {}, "2026-07-09T00:00:00Z"),
      thread("pin-b", { deerflow_pinned: true }, "2026-07-01T00:00:00Z"),
      thread("pin-a", { deerflow_pinned: true }, "2026-07-02T00:00:00Z"),
    ]);
    // 固定的两条按来源顺序（pin-b 在前），不按新近度。
    expect(ids(entries)).toEqual(["pin-b", "pin-a", "plain"]);
  });

  it("子线程更新会把整组顶到前面", () => {
    const entries = flattenThreadBranches([
      thread("old-root", {}, "2026-07-01T00:00:00Z"),
      thread("fresh-child", branchOf("old-root"), "2026-07-20T00:00:00Z"),
      thread("mid-root", {}, "2026-07-10T00:00:00Z"),
    ]);
    // old-root 自身很旧，但它有一条 7-20 的子线程，整组应当排在 mid-root 之前。
    expect(ids(entries)).toEqual(["old-root", "fresh-child", "mid-root"]);
  });
});

describe("isBranchThread", () => {
  it("只有带合法 parent id 的才算分支", () => {
    expect(isBranchThread(thread("a", branchOf("p")))).toBe(true);
    expect(isBranchThread(thread("a", branchOf("  ")))).toBe(false);
    expect(isBranchThread(thread("a", { deerflow_branch: true }))).toBe(false);
    expect(isBranchThread(thread("a"))).toBe(false);
    expect(isBranchThread(null)).toBe(false);
  });
});
