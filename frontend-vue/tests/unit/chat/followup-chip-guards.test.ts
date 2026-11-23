/*
  【文件职责】     follow-up 的 Composer 事件契约与确认框必要结构。
  【架构位置】     node 结构守卫；实际 AgentChat 消费者行为见 agent-chat-followups.dom.test.ts。
  【主要导出】     Vitest cases
  【依赖关系】     AgentChat.vue · ChatComposer.vue
  【边界与注意】   查询 admission、完成回调和显示条件由真实 mounted owner/DOM 验证；
                   确认框的交互与焦点由 composer-workflow.dom.test.ts 验证。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/* 结构检查只读取可执行模板和事件声明。 */
function sourceOf(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

const agentChat = sourceOf("../../../app/components/chat/AgentChat.vue");
const composer = sourceOf("../../../app/components/chat/ChatComposer.vue");

describe("follow-up parent wiring", () => {
  /* 判据来自 composer 内部两个外面看不见的状态，靠这条 emit 送出来。 */
  it("takes the composer's own blockers through an emit", () => {
    expect(agentChat).toContain("@followups-suppressed-change=");
    expect(composer).toContain("followupsSuppressedChange: [value: boolean];");
    // Actual picker, skill, Escape and disposal behavior is exercised by
    // composer-mentions.dom.test.ts; this guard owns only the parent wiring.
  });
});

describe("follow-up confirm dialog", () => {
  /*
    上游是真 `<Dialog>`（input-box.tsx:2765）。手搓副本的特征是 `aria-modal="true"`
    写在一个 `absolute` 定位的 div 上——它只是在**说**自己是模态，浏览器不会因此
    拦住焦点，Escape 也关不掉。这条钉的是那个副本没有回来。
  */
  it("is a real Dialog, not an absolutely positioned look-alike", () => {
    expect(composer).toContain("<DialogTitle>");
    expect(composer).toContain("<DialogDescription>");
    expect(composer).toContain(':close-label="$i18n.t.value.primitives.close"');
    expect(composer).not.toContain('aria-modal="true"');
    expect(composer).not.toContain("absolute right-0 bottom-full left-0 z-50");
  });

  /* 上游只画标题与描述，不把待发的那句建议再渲染一遍。 */
  it("does not echo the pending suggestion back", () => {
    expect(composer).not.toContain("{{ pendingFollowup }}");
  });
});
