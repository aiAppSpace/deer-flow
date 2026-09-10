/*
  【文件职责】     固定「复制一条定时任务」的草稿内容，以及运行状态的取值集合。
  【架构位置】     测试
  【依赖关系】     app/core/scheduled-tasks/form.ts · types.ts
  【边界与注意】   复制**只改标题**：其余字段照抄，因为复制的意义就是「和这条一样，
                   我再改两处」。标题必须变——不变的话列表里两条一模一样，
                   谁也分不出哪条是新的。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  draftForScheduledTask,
  duplicateScheduledTaskDraft,
} from "@/core/scheduled-tasks/form";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

function task(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "task-1",
    title: "Daily digest",
    prompt: "Summarise yesterday",
    context_mode: "reuse_thread",
    thread_id: "thread-9",
    schedule_type: "cron",
    schedule_spec: { cron: "0 9 * * *" },
    timezone: "Asia/Shanghai",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as unknown as ScheduledTask;
}

describe("复制一条定时任务", () => {
  it("只有标题带后缀，其余逐字照抄", () => {
    const original = draftForScheduledTask(task());
    const copy = duplicateScheduledTaskDraft(task(), " (copy)");
    expect(copy.title).toBe("Daily digest (copy)");
    expect({ ...copy, title: original.title }).toEqual(original);
  });

  it("复用会话模式下把线程 id 也带过去", () => {
    // 复制出来的那条如果丢了线程 id，它会变成「每次新开会话」——语义完全不同。
    const copy = duplicateScheduledTaskDraft(task(), " (copy)");
    expect(copy.contextMode).toBe("reuse_thread");
    expect(copy.threadId).toBe("thread-9");
  });

  it("排程与时区一并照抄", () => {
    const copy = duplicateScheduledTaskDraft(task(), " (copy)");
    expect(copy.schedule.schedule_type).toBe("cron");
    expect(copy.schedule.schedule_spec.cron).toBe("0 9 * * *");
    expect(copy.schedule.timezone).toBe("Asia/Shanghai");
  });

  it("后缀是调用方给的（走词典），不是写死的", () => {
    expect(duplicateScheduledTaskDraft(task(), "（副本）").title).toBe(
      "Daily digest（副本）",
    );
  });
});

/*
  页面把这三件事接在一起：换草稿、清掉上一次的报错、重挂表单再滚回去。

  定时任务页依赖整条 Vue Query 数据链，本仓没有挂载它的用例（其余
  scheduled-tasks 用例全是 core 纯函数或单个子组件）。所以这里钉源码顺序，
  行为的那一半由子组件用例（reuse-notice-and-duplicate.dom.test.ts）覆盖。
*/
describe("页面把复制接起来", () => {
  const source = readFileSync("app/pages/workspace/scheduled-tasks.vue", "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");

  it("换草稿 → 清报错 → 重挂表单 → 滚回去，顺序不能乱", () => {
    const body = source.slice(
      source.indexOf("async function duplicateTask("),
      source.indexOf("\n}", source.indexOf("async function duplicateTask(")),
    );
    const order = [
      "duplicateScheduledTaskDraft(",
      "formError.value = null",
      "createFormKey.value += 1",
      "scrollIntoView(",
    ].map((needle) => body.indexOf(needle));
    expect(
      order.every((index) => index >= 0),
      body,
    ).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("滚回去发生在 nextTick 之后：表单还没重挂就滚，滚的是旧节点", () => {
    const body = source.slice(source.indexOf("async function duplicateTask("));
    expect(body.indexOf("await nextTick()")).toBeLessThan(
      body.indexOf("scrollIntoView("),
    );
  });
});
