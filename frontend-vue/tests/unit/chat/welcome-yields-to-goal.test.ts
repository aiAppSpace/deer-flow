/*
  【文件职责】     欢迎区在「有目标 / 有待办」时必须让位——两个入口的条件与上游同字。
  【架构位置】     单测（源码守卫）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue ·
                   ../frontend/src/components/workspace/chats/chat-page.tsx 与
                   ../frontend/src/app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx
                   （缺席则那两条 skipIf 跳过，本仓那条照跑）
  【边界与注意】   **台账看不见这一处**：它只在欢迎态 + 有目标时才分叉，而欢迎态
                   在上游等价于 `isNewThread`（`chat-page.tsx:92/114`），那条路由上
                   `thread.values` 根本没取过——也就是说上游这一支**只能靠
                   `/goal <目标>` 这条命令走到**（`input-box.tsx:938` 的
                   `onGoalChange`）。对照场景喂不出「新会话 + 已有目标」这个组合，
                   所以这一条钉在源码上，和账 C 同一个形状。

                   **翻案判据**：哪天对照取样面能走到「欢迎态 + 有目标」
                   （例如把 `/goal` 命令流接进 `steps`），就把这条守卫换成台账读数。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** 坑 59：先剥注释，否则锚点串会在解释它的注释里被找到。 */
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const agentChat = fileURLToPath(
  new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
);
const upstreamChatPage = fileURLToPath(
  new URL(
    "../../../../frontend/src/components/workspace/chats/chat-page.tsx",
    import.meta.url,
  ),
);
const upstreamAgentPage = fileURLToPath(
  new URL(
    "../../../../frontend/src/app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx",
    import.meta.url,
  ),
);

const read = (path: string) => stripComments(readFileSync(path, "utf8"));

/**
 * 取欢迎区那个 `<template #extraHeader>` 的开标签。
 *
 * 按 `#extraHeader` 往回找最近的 `<template`，而不是按 `v-if=` 往下找——
 * 这个文件里 `v-if` 有上百处，按它定位会命中别的块（坑 261 的同一条：
 * 按前缀找行要断言只命中一处）。
 */
function extraHeaderOpenTag(source: string): string {
  const anchor = source.indexOf("#extraHeader");
  expect(
    anchor,
    "AgentChat.vue 里找不到 #extraHeader 这个插槽",
  ).toBeGreaterThan(-1);
  const start = source.lastIndexOf("<template", anchor);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, anchor);
}

describe("欢迎区让位给目标与待办", () => {
  it("本仓两个入口共用的那个 extraHeader 同时排除目标与待办", () => {
    const tag = extraHeaderOpenTag(read(agentChat));

    expect(tag).toContain("isWelcomeMode");
    expect(tag).toContain("!activeGoal");
    expect(tag).toContain("!authoritativeTodos.length");
  });

  /*
    上游那一侧也钉住：这条守卫的**全部理由**是「照上游」，
    上游哪天自己不这么写了，本仓这一条就该重新判一次而不是继续被守着。
  */
  it.skipIf(!existsSync(upstreamChatPage))(
    "上游聊天页仍然是 isWelcomeMode && !hasGoal && !hasTodos",
    () => {
      const source = read(upstreamChatPage);

      expect(source).toMatch(
        /extraHeader=\{\s*isWelcomeMode\s*&&\s*!hasGoal\s*&&\s*!hasTodos\s*&&/,
      );
    },
  );

  it.skipIf(!existsSync(upstreamAgentPage))(
    "上游 agent 会话页也是同一串条件",
    () => {
      const source = read(upstreamAgentPage);

      expect(source).toMatch(
        /extraHeader=\{\s*isWelcomeMode\s*&&\s*!hasGoal\s*&&\s*!hasTodos\s*&&/,
      );
    },
  );
});
