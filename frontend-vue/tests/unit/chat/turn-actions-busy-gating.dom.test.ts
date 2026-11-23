/*
  【文件职责】     钉住「上传中 / 分支请求在飞」时，三颗回合操作各自该不该点得动。
  【架构位置】     单测（dom）
  【主要导出】     无
  【依赖关系】     components/chat/MessageList.vue
  【边界与注意】   判据逐条照上游 `chats/chat-page.tsx:466-497` 那三串：

                   - `canRegenerate` 有 `!isUploading`，**没有** `!branchThread.isPending`；
                   - `canBranch`     = canRegenerate + `!branchThread.isPending`；
                   - `canEdit`       = canBranch + `!hasGoal && !hasOpenHumanInputCard`。

                   **那条不对称是判据本身，不是抠字眼**：分支请求在飞的时候重跑
                   仍然是合法操作，所以重跑那颗不跟着禁用。测里因此有一条
                   「分支在飞时重跑仍然可点」——它同时挡住「顺手把三颗一起禁掉」
                   这种看起来更整齐的写法。

                   **钉的是行为不是源码串**：上一轮那条
                   `agent-chat-consumer-contracts` 覆盖父组件的目标/待办让位，
                   这一条可以真挂上去点，所以就真挂上去。
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

/** 一个完整回合：人类一条（带 id）+ 助手一条，三颗键的前提条件都满足。 */
const TURN = [
  { id: "msg-human-1", type: "human", content: "Hello" },
  {
    id: "msg-ai-1",
    type: "ai",
    run_id: "run-1",
    content: "Hello from DeerFlow!",
    additional_kwargs: {},
    feedback: null,
  },
] as unknown as Message[];

function mountList(extra: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = mount(MessageList, {
    props: {
      messages: TURN,
      rawMessages: TURN,
      streaming: false,
      loading: false,
      threadId: "thread-1",
      interactive: true,
      ...extra,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        // The action contracts use the real list and controls, not the renderer.
        MessageMarkdown: {
          props: ["content"],
          template: "<div data-testid='markdown'>{{ content }}</div>",
        },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: {
          props: { runId: String, disabled: Boolean },
          template:
            '<button :data-run-id="runId" :disabled="disabled">View changes</button>',
        },
        SubtaskCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function byLabel(wrapper: ReturnType<typeof mountList>, label: string) {
  return wrapper
    .findAll("button")
    .filter((button) => button.attributes("aria-label") === label);
}

const BRANCH = enUS.common.branch;
const REGENERATE = enUS.common.regenerate;
const EDIT = enUS.messages.actions.editAndRerun;

/*
  上面三条钉的是 `MessageList` 收到 prop 之后怎么做，**钉不到「谁把 prop 传进来」**
  ——把调用点那两行删掉，上面三条照样全绿。那一半只能扫源码
  （挂 `AgentChat` 要整条流与路由，代价远大于它能多钉住的东西）。

  坑 59：先剥注释，否则锚点串会在解释它的注释里被找到。
*/
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("调用点把这两样真传进去了", () => {
  const source = stripComments(
    readFileSync(
      resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
      "utf8",
    ),
  );

  it("MessageList 拿得到 uploading 与 branchPending", () => {
    expect(source).toContain(':uploading="localUploading"');
    expect(source).toContain(':branch-pending="branchPending"');
  });

  // The production operation owner is mounted in chat-conversation-actions:
  // pending spans the request, clears before navigation/on error, rejects
  // direct reentry and discards results after an account/conversation change.
});

/*
  **agent 会话上没有分支入口**（第二十九轮）。

  判词不是「照抄上游」——是查后端定的：分支接口
  （`backend/app/gateway/routers/threads.py:1052-1058`）建新线程时写的是
  `metadata=branch_metadata`，继承 project、继承标题序号，**唯独不继承
  `agent_name`**，而 agent 归属就存在线程行的这个元数据里
  （`core/threads/utils.ts:47`）。也就是说这颗键点下去会造出一条
  服务端不认为属于这个 agent 的线程。

  上游关掉它的办法是**不传 `onBranchTurn`**（agent 会话页只传 `canRegenerate`
  与 `canEdit`，而 `message-list.tsx:890` 的渲染条件里有 `onBranchTurn &&`）。
  本仓一个组件服务两条路由，所以做成显式的 `canBranch`。

  **翻案判据**：后端让分支继承 agent 归属之后，这一条连同上游那一侧一起重判。
*/
describe("agent 会话上的分支入口", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("canBranch 关掉时整颗不画，而另外两颗照常", async () => {
    const wrapper = mountList({ canBranch: false });
    expect(
      wrapper.findAll("[data-testid='markdown']").map((node) => node.text()),
    ).toContain("Hello from DeerFlow!");
    await flushPromises();
    expect(byLabel(wrapper, BRANCH)).toHaveLength(0);
    expect(byLabel(wrapper, REGENERATE)).toHaveLength(1);
    expect(byLabel(wrapper, EDIT)).toHaveLength(1);
  });

  // The ordinary/Agent prop transition is exercised through the actual parent in agent-chat-consumer-contracts.dom.test.ts.
});

describe("上传中 / 分支在飞时的回合操作", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  /*
    形状先断言：闲着的时候三颗都在、都点得动。少了这一条，下面那几条
    「禁用了」在「压根没画出来」的情况下照样绿（坑 176 的同一条）。
  */
  it("闲着的时候三颗都在，而且都点得动", async () => {
    const wrapper = mountList({});
    await flushPromises();

    expect(byLabel(wrapper, BRANCH)).toHaveLength(1);
    expect(byLabel(wrapper, REGENERATE)).toHaveLength(1);
    expect(byLabel(wrapper, EDIT)).toHaveLength(1);
    expect(byLabel(wrapper, BRANCH)[0]?.attributes("disabled")).toBeUndefined();
    expect(
      byLabel(wrapper, REGENERATE)[0]?.attributes("disabled"),
    ).toBeUndefined();
  });

  it("上传中：分支与重跑都画着但点不动，编辑并重跑整颗收起", async () => {
    const wrapper = mountList({ uploading: true });
    await flushPromises();

    expect(byLabel(wrapper, BRANCH)[0]?.attributes("disabled")).toBeDefined();
    expect(
      byLabel(wrapper, REGENERATE)[0]?.attributes("disabled"),
    ).toBeDefined();
    expect(byLabel(wrapper, EDIT)).toHaveLength(0);
  });

  it("分支请求在飞：分支点不动、编辑收起，而重跑仍然可点", async () => {
    const wrapper = mountList({ branchPending: true });
    await flushPromises();

    expect(byLabel(wrapper, BRANCH)[0]?.attributes("disabled")).toBeDefined();
    expect(byLabel(wrapper, EDIT)).toHaveLength(0);
    // 上游 canRegenerate 里没有 !branchThread.isPending——这一条挡的是
    // 「三颗一起禁掉」那种看起来更整齐的写法。
    expect(
      byLabel(wrapper, REGENERATE)[0]?.attributes("disabled"),
    ).toBeUndefined();
  });
});

describe("workspace changes belong to their own completed turn", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });
  it("a new streaming turn keeps the earlier run's change action available", async () => {
    const messages = [
      ...TURN,
      { id: "human-2", type: "human", content: "Next request" },
      {
        id: "ai-2",
        type: "ai",
        run_id: "run-2",
        content: "Still working",
        additional_kwargs: {},
        feedback: null,
      },
    ] as Message[];
    const wrapper = mountList({
      messages,
      rawMessages: messages,
      streaming: true,
    });
    await flushPromises();
    expect(
      wrapper.get('button[data-run-id="run-1"]').attributes("disabled"),
    ).toBeUndefined();
    // Unresolved streaming text belongs to the processing panel, so it has no
    // change card yet. Reasoning plus answer text becomes a real assistant bubble.
    expect(wrapper.find('button[data-run-id="run-2"]').exists()).toBe(false);
    const answering = messages.map((message) =>
      message.id === "ai-2"
        ? {
            ...message,
            additional_kwargs: { reasoning_content: "Checked the output" },
          }
        : message,
    );
    await wrapper.setProps({ messages: answering, rawMessages: answering });
    await flushPromises();
    expect(
      wrapper.get('button[data-run-id="run-1"]').attributes("disabled"),
    ).toBeUndefined();
    expect(
      wrapper.get('button[data-run-id="run-2"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(
      wrapper.get('button[data-run-id="run-1"]').attributes("disabled"),
    ).toBeUndefined();
    expect(
      wrapper.get('button[data-run-id="run-2"]').attributes("disabled"),
    ).toBeUndefined();
  });
});
