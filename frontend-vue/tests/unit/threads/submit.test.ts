/*
  【文件职责】     提交请求体的构造：run context 的档位推导与附件透传。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/threads/submit.ts
  【边界与注意】   `buildRunContext` 在上游是**两处逐字重复**的对象字面量
                   （首次发送与重跑各一份）。合并之后必须有测试钉住推导表，
                   否则「重跑用了与首次发送不同的推理档位」这种分叉会一直
                   在 UI 上看不出来。
*/

import { describe, expect, it } from "vitest";

import {
  buildRunContext,
  buildThreadSubmitMessages,
  hasToolResult,
} from "@/core/threads/submit";
import type { Message } from "@/core/types/message";

describe("buildRunContext", () => {
  it.each([
    ["ultra", { thinking: true, plan: true, subagent: true, effort: "high" }],
    ["pro", { thinking: true, plan: true, subagent: false, effort: "medium" }],
    [
      "thinking",
      { thinking: true, plan: false, subagent: false, effort: "low" },
    ],
    [
      "flash",
      { thinking: false, plan: false, subagent: false, effort: undefined },
    ],
  ] as const)("mode=%s 推导出固定的四个字段", (mode, expected) => {
    const context = buildRunContext({ mode });
    expect(context).toMatchObject({
      thinking_enabled: expected.thinking,
      is_plan_mode: expected.plan,
      subagent_enabled: expected.subagent,
      reasoning_effort: expected.effort,
    });
  });

  /*
    **`thread_id` 不在 context 里**（wave 216 去掉，两边同改）。
    Gateway 的 `build_run_config` 写着 `context["thread_id"] = thread_id`，
    取的是 **URL 路径**里的那一个，客户端传什么都会被当场覆盖；
    上游那一侧发的还是错的（提交时预生成的 draft id，不是后端真建出来的线程）。
    一个服务端保证丢弃、且有一侧一直发错的字段，两边都不发才是对的。
  */
  it("不带 thread_id：服务端按 URL 路径覆盖，传了也是空转", () => {
    expect(buildRunContext({ mode: "flash" })).not.toHaveProperty("thread_id");
  });

  it("显式给的 reasoning_effort 覆盖 mode 推导", () => {
    expect(
      buildRunContext({ mode: "ultra", reasoning_effort: "minimal" }),
    ).toMatchObject({ reasoning_effort: "minimal" });
  });

  it("extraContext 在最外层被 context 覆盖", () => {
    const context = buildRunContext(
      { mode: "flash", agent_name: "a" },
      {
        agent_name: "b",
        extra: 1,
      },
    );
    expect(context).toMatchObject({ agent_name: "a", extra: 1 });
  });
});

describe("buildThreadSubmitMessages", () => {
  it("只有附件时也带上 files，没有附件时不写这个键", () => {
    const withFiles = buildThreadSubmitMessages({
      text: "hi",
      filesForSubmit: [{ filename: "a.txt", size: 1, status: "uploaded" }],
    });
    expect(withFiles[0]?.additional_kwargs?.files).toHaveLength(1);

    const without = buildThreadSubmitMessages({ text: "hi" });
    expect(without[0]?.additional_kwargs).not.toHaveProperty("files");
  });

  it("additionalInputMessages 排在用户消息之前", () => {
    const extra = { id: "x", type: "human", content: "ctx" } as Message;
    const built = buildThreadSubmitMessages({
      text: "hi",
      additionalInputMessages: [extra],
    });
    expect(built).toHaveLength(2);
    expect(built[0]).toBe(extra);
  });
});

describe("hasToolResult", () => {
  it("按 tool_call_id 关联，而不是只看名字", () => {
    const messages = [
      {
        type: "ai",
        id: "a",
        content: "",
        tool_calls: [{ id: "call-1", name: "search", args: {} }],
      },
      { type: "tool", id: "t", content: "ok", tool_call_id: "call-1" },
    ] as unknown as Message[];
    expect(hasToolResult(messages, "search")).toBe(true);
    expect(hasToolResult(messages, "other")).toBe(false);
  });
});
