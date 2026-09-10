import { describe, expect, it } from "vitest";

import { mergeThreadSnapshot } from "@/core/threads/thread-snapshot";
import type { AgentThread } from "@/core/threads/types";

/*
  收 `Partial`，因为这组用例要造的正是**摘要版线程**：`POST /threads/search`
  的投影只返回 `{"title": display_name}` 一个字段（后端事实，同一句写在
  tests/e2e/utils/mock-api.ts 的 threadChannelValues 注解里）。
  `AgentThreadState` 把 `messages` 写成必填，与上游 `frontend/src/core/threads/types.ts:34`
  一致，所以放宽只发生在夹具这一层，被测函数的入参类型不动。
*/
function thread(values: Partial<AgentThread["values"]>): AgentThread {
  return {
    thread_id: "thread-1",
    created_at: "2026-08-13T00:00:00Z",
    updated_at: "2026-08-13T00:00:00Z",
    metadata: {},
    status: "idle",
    values: values as AgentThread["values"],
    interrupts: {},
  };
}

describe("mergeThreadSnapshot", () => {
  it("retains detailed state when a later list summary only updates the title", () => {
    const detailed = thread({
      title: "Old title",
      artifacts: ["reports/mobile-summary.md"],
      messages: [{ type: "ai", content: "Complete" }],
    });
    const summary = thread({ title: "Current title" });

    expect(mergeThreadSnapshot(detailed, summary).values).toEqual({
      title: "Current title",
      artifacts: ["reports/mobile-summary.md"],
      messages: [{ type: "ai", content: "Complete" }],
    });
  });
});
