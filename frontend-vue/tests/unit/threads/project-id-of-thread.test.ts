/*
  【文件职责】     钉住「会话归属哪个项目」的判定，尤其是空串的处理。
  【架构位置】     纯函数单测
  【主要导出】     无；Vitest cases
  【依赖关系】     core/threads/utils
  【边界与注意】   **空串必须按未归属处理**：Gateway 清空归属时写的是空串而不是删键，
                   把它当成有效 id 会在侧栏分组里凭空多出一个 id 为空的项目组，
                   而那一组永远点不开。
*/
import { describe, expect, it } from "vitest";

import {
  THREAD_PROJECT_METADATA_KEY,
  projectIdOfThread,
} from "@/core/threads/utils";

const withMetadata = (metadata: Record<string, unknown>) =>
  ({ metadata }) as Parameters<typeof projectIdOfThread>[0];

describe("projectIdOfThread", () => {
  it("取出合法的项目 id", () => {
    expect(
      projectIdOfThread(withMetadata({ [THREAD_PROJECT_METADATA_KEY]: "p-1" })),
    ).toBe("p-1");
  });

  it.each([
    ["空串（Gateway 清空归属时写的就是它）", ""],
    ["数字", 42],
    ["null", null],
    ["对象", {}],
  ])("%s 一律按未归属", (_label, value) => {
    expect(
      projectIdOfThread(withMetadata({ [THREAD_PROJECT_METADATA_KEY]: value })),
    ).toBeNull();
  });

  it("没有这个键时按未归属", () => {
    expect(projectIdOfThread(withMetadata({}))).toBeNull();
  });
});
