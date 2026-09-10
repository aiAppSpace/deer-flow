/*
  【文件职责】     固定 Gateway ToolMessage browser_view 静态帧提取与线程隔离合同。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/browser/frame.ts
  【边界与注意】   只接受服务端消息元数据，不从 UI 文本或 artifact 名称猜测。
*/

import { describe, expect, it } from "vitest";

import {
  latestBrowserViewFrame,
  reconcileBrowserMessageFrame,
} from "@/core/browser/frame";

describe("latestBrowserViewFrame", () => {
  it("returns the newest valid Gateway browser_view metadata", () => {
    expect(
      latestBrowserViewFrame([
        {
          type: "tool",
          id: "tool-1",
          tool_call_id: "call-tool-1",
          content: "first",
          additional_kwargs: {
            browser_view: {
              screenshot: "/mnt/user-data/outputs/.browser-frames/one.png",
              url: "https://one.example",
              title: "One",
            },
          },
        },
        { type: "ai", id: "ai-1", content: "done" },
        {
          type: "tool",
          id: "tool-2",
          tool_call_id: "call-tool-2",
          content: "second",
          additional_kwargs: {
            browser_view: {
              screenshot: "/mnt/user-data/outputs/.browser-frames/two.png",
              url: "https://two.example",
              title: "Two",
            },
          },
        },
      ]),
    ).toEqual({
      screenshot: "/mnt/user-data/outputs/.browser-frames/two.png",
      url: "https://two.example",
      title: "Two",
    });
  });

  it("rejects malformed, non-tool, and empty screenshot metadata", () => {
    expect(
      latestBrowserViewFrame([
        {
          type: "ai",
          id: "ai-1",
          content: "not authoritative",
          additional_kwargs: {
            browser_view: { screenshot: "/wrong.png" },
          },
        },
        {
          type: "tool",
          id: "tool-1",
          tool_call_id: "call-tool-1",
          content: "bad",
          additional_kwargs: { browser_view: { screenshot: "" } },
        },
      ]),
    ).toBeNull();
  });

  it("does not let an already-observed message frame overwrite a newer REST frame", () => {
    const messageFrame = {
      screenshot: "/browser/message.png",
      url: "https://message.example",
    };
    const restFrame = {
      screenshot: "/browser/rest.png",
      url: "https://rest.example",
    };
    expect(
      reconcileBrowserMessageFrame(restFrame, messageFrame, messageFrame),
    ).toEqual({
      display: restFrame,
      observed: messageFrame,
      changed: false,
    });
    const nextMessageFrame = {
      screenshot: "/browser/next-message.png",
      url: "https://next.example",
    };
    expect(
      reconcileBrowserMessageFrame(restFrame, messageFrame, nextMessageFrame),
    ).toEqual({
      display: nextMessageFrame,
      observed: nextMessageFrame,
      changed: true,
    });
  });
});
