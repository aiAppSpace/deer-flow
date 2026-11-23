/*
  【文件职责】     两条上游页面的欢迎区目标/待办合同出处。
  【架构位置】     node 上游必要结构；Vue行为在agent-chat-consumer-contracts.dom.test.ts真实挂载。
  【主要导出】     Vitest cases
  【依赖关系】     两条 React chat/Agent page；缺席时保留原有两条声明 skip。
  【边界与注意】   Vue的普通/Agent欢迎slot、goal/todo让位与恢复由真实消费者验证。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** 坑 59：先剥注释，否则锚点串会在解释它的注释里被找到。 */
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

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

describe("欢迎区让位给目标与待办", () => {
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
