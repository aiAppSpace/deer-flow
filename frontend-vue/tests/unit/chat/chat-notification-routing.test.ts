/*
  【文件职责】     守住聊天面上「哪条提示走 toaster、哪条留在页面里」这条分界线。
  【架构位置】     L3 单元测试（AgentChat 只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue
  【边界与注意】   AgentChat 只读源码，理由与 followup-chip-guards.test.ts 相同：
                   挂载它要连上 stream/threads/query 一整套。

                   **对照台账天生看不见这一簇**（第⑥类：只在某种后端状态下才分叉）。
                   replay gap 要假 Gateway 制造断流、分支失败要后端拒收、发送失败要
                   线程创建抛异常——没有一个对照场景会走到，判据写歪了不会有门禁变红。

                   当前 React 的发送失败走 toast，Vue 采用相同出口。失败后可重试的
                   文本、附件和引用保留在 composer 原位置；提交成功回调才清理它们。
                   composer-workflow.dom.test.ts 覆盖保留与重试，本文件只约束播报接线。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/* 注释先剥掉：下面钉的每一条在文件里都同时出现在解释它的注释里。 */
function sourceOf(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

const agentChat = sourceOf("../../../app/components/chat/AgentChat.vue");
const messageList = sourceOf("../../../app/components/chat/MessageList.vue");

describe("流的两条播报走 workspace toaster", () => {
  /*
    上游 `core/threads/hooks.ts:1805` 是 `toast.warning`。
    **wave 73 之前本仓把 warning 折进 info**，理由是「toaster 一个图标都不画，
    两档没有可观察差别」——补上类型图标之后那条理由就不成立了。
  */
  it("routes the replay-gap warning to the toaster", () => {
    expect(agentChat).toContain("warn: (message) =>\n      toast.warning(");
    expect(agentChat).not.toContain("warn: (message) =>\n      toast.info(");
  });

  /* 上游 `:1846` 是 toast.error；toaster 会把 error 播成 assertive。 */
  it("routes stream errors to the toaster", () => {
    expect(agentChat).toContain("error: (message) => toast.error(message),");
  });

  /*
    此前这两条 push 进一个**只增不减**的 `warnings` 数组。数组没了，这条断言就是
    「不许把它加回来」——一次性的警告挂在屏幕上不走是它最明显的症状。
  */
  it("keeps no ever-growing warnings array", () => {
    expect(agentChat).not.toContain("warnings");
  });
});

describe("LLM retry toast host", () => {
  it("connects the stream's plain message callback to the workspace toast owner", () => {
    expect(agentChat).toContain(
      "message: (message) => toast.message(message),",
    );
  });
});

/*
  「改完重跑会丢掉这一轮之后的消息」这句提醒，上游写在编辑框与两颗按钮之间
  （message-list-item.tsx:530）。本仓此前没有——用户按下「Update and rerun」之前
  看不到任何关于后果的说明，而这是一个**会丢内容**的操作。
  `common.editRerunWarning` 也因此一直躺在 unused 里（wave 35）。
*/
describe("编辑并重跑的提醒", () => {
  it("warns about the consequence before the two buttons", () => {
    const box = messageList.slice(
      messageList.indexOf(
        'v-if="editState && editState.messageId === message.id"',
      ),
      messageList.indexOf("$i18n.t.value.common.updateAndRerun"),
    );
    expect(box).toContain("$i18n.t.value.common.editRerunWarning");
    // 要在两颗按钮**之前**，与上游同序：看到警告再决定按哪一颗。
    expect(box.indexOf("editRerunWarning")).toBeLessThan(
      box.indexOf("$i18n.t.value.common.cancel"),
    );
  });
});

describe("分支通知的生产接线", () => {
  // chat-conversation-actions.dom.test.ts executes the real command owner:
  // rejection keeps its message/fallback and success is announced before navigation.
  it("connects conversation commands to the workspace toast and page navigation", () => {
    const commands = agentChat.slice(
      agentChat.indexOf("} = useChatConversationActions({"),
      agentChat.indexOf("async function adoptPreparedThread("),
    );
    expect(commands).toContain("  toast,");
    expect(commands).toContain("navigate: (path) => router.push(path)");
    expect(agentChat).toContain('@branch="branch"');
  });
});
