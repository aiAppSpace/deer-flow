/*
  【文件职责】     把已加载的扁平会话页投影成一棵**安全的**分支谱系。
  【架构位置】     L3 纯函数（不依赖 Vue）
  【主要导出】     ThreadBranchEntry · isBranchThread · flattenThreadBranches
  【依赖关系】     ./types · ./utils(isThreadPinned)
  【边界与注意】   **不变量：任何畸形元数据都不能让一条已加载的会话从列表里消失。**
                   只有「已加载 + 同一固定分区 + 非自身 + 不成环」的父线程才能收养子线程；
                   其余情况（父未加载、parent id 不是字符串、跨 pinned 分区、自环、成环）
                   一律把子线程留在顶层。

                   **末尾那次「再 emit 一遍全部线程」在逻辑正确时是不可达的**：成环被剔除后，
                   每个非根节点的父链必然终止于某个根，所以所有线程本来就都会被 emit 到。
                   它是防「将来改坏上面某一步」的保险，不是当前的承重件——
                   2026-09-10 变异验证确认：删掉它测试全绿，而删掉剔除成环那一步测试会红。
                   保留它是有意的（与上游一致），但别把它当成正确性的依据。
*/

import type { AgentThread } from "./types";
import { isThreadPinned } from "./utils";

const THREAD_BRANCH_METADATA_KEY = "deerflow_branch";
const THREAD_BRANCH_PARENT_METADATA_KEY = "branch_parent_thread_id";

export interface ThreadBranchEntry {
  thread: AgentThread;
  parentThread?: AgentThread;
  depth: number;
  isLastSibling: boolean;
}

function recencyOfThread(thread: AgentThread) {
  const timestamp = Date.parse(thread.updated_at ?? thread.created_at ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function branchParentId(thread: AgentThread | null | undefined) {
  if (thread?.metadata?.[THREAD_BRANCH_METADATA_KEY] !== true) {
    return null;
  }
  const parentId = thread.metadata?.[THREAD_BRANCH_PARENT_METADATA_KEY];
  if (typeof parentId !== "string") {
    return null;
  }
  return parentId.trim() || null;
}

export function isBranchThread(thread: AgentThread | null | undefined) {
  return branchParentId(thread) !== null;
}

export function flattenThreadBranches(
  threads: readonly AgentThread[],
): ThreadBranchEntry[] {
  if (threads.length < 2) {
    return threads.map((thread) => ({
      thread,
      depth: 0,
      isLastSibling: true,
    }));
  }

  const byId = new Map(threads.map((thread) => [thread.thread_id, thread]));
  const sourceIndex = new Map(
    threads.map((thread, index) => [thread.thread_id, index]),
  );

  // 第一遍：只留下「结构上可能成立」的父子关系。
  const candidateParentByChild = new Map<string, string>();
  for (const thread of threads) {
    const parentId = branchParentId(thread);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (
      !parent ||
      parent.thread_id === thread.thread_id ||
      isThreadPinned(parent) !== isThreadPinned(thread)
    ) {
      continue;
    }
    candidateParentByChild.set(thread.thread_id, parent.thread_id);
  }

  const hasCyclicAncestry = (threadId: string) => {
    const visited = new Set<string>([threadId]);
    let parentId = candidateParentByChild.get(threadId);
    while (parentId) {
      if (visited.has(parentId)) {
        return true;
      }
      visited.add(parentId);
      parentId = candidateParentByChild.get(parentId);
    }
    return false;
  };

  // 第二遍：剔掉成环的，剩下的才是真父子。
  const parentByChild = new Map<string, string>();
  for (const [childId, parentId] of candidateParentByChild) {
    if (!hasCyclicAncestry(childId)) {
      parentByChild.set(childId, parentId);
    }
  }

  const childrenByParent = new Map<string, AgentThread[]>();
  for (const thread of threads) {
    const parentId = parentByChild.get(thread.thread_id);
    if (!parentId) continue;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(thread);
    childrenByParent.set(parentId, children);
  }

  // 固定住的父线程保持来源顺序；其余按子线程的新近度排。
  for (const [parentId, children] of childrenByParent) {
    const parent = byId.get(parentId);
    if (!parent || isThreadPinned(parent)) continue;
    children.sort(
      (left, right) =>
        recencyOfThread(right) - recencyOfThread(left) ||
        (sourceIndex.get(left.thread_id) ?? 0) -
          (sourceIndex.get(right.thread_id) ?? 0),
    );
  }

  /** 一棵子树的新近度取「自身与全部后代里最新的那个」，这样有新回复的分支会把整组顶上去。 */
  const groupRecencyCache = new Map<string, number>();
  const groupRecency = (thread: AgentThread): number => {
    const cached = groupRecencyCache.get(thread.thread_id);
    if (cached !== undefined) return cached;
    const recency = (childrenByParent.get(thread.thread_id) ?? []).reduce(
      (latest, child) => Math.max(latest, groupRecency(child)),
      recencyOfThread(thread),
    );
    groupRecencyCache.set(thread.thread_id, recency);
    return recency;
  };

  const roots = threads.filter(
    (thread) => !parentByChild.has(thread.thread_id),
  );
  roots.sort((left, right) => {
    const pinnedDifference =
      Number(isThreadPinned(right)) - Number(isThreadPinned(left));
    if (pinnedDifference) return pinnedDifference;
    if (isThreadPinned(left)) {
      return (
        (sourceIndex.get(left.thread_id) ?? 0) -
        (sourceIndex.get(right.thread_id) ?? 0)
      );
    }
    return (
      groupRecency(right) - groupRecency(left) ||
      (sourceIndex.get(left.thread_id) ?? 0) -
        (sourceIndex.get(right.thread_id) ?? 0)
    );
  });

  const entries: ThreadBranchEntry[] = [];
  const emitted = new Set<string>();
  const emit = (
    thread: AgentThread,
    depth: number,
    isLastSibling: boolean,
    parentThread?: AgentThread,
  ) => {
    if (emitted.has(thread.thread_id)) return;
    emitted.add(thread.thread_id);
    entries.push({ thread, parentThread, depth, isLastSibling });
    const children = childrenByParent.get(thread.thread_id) ?? [];
    children.forEach((child, index) =>
      emit(child, depth + 1, index === children.length - 1, thread),
    );
  };

  roots.forEach((root) => emit(root, 0, true));
  // 保险（逻辑正确时不可达，见文件头）：畸形谱系不许让任何一条已加载的会话消失。
  threads.forEach((thread) => emit(thread, 0, true));
  return entries;
}
