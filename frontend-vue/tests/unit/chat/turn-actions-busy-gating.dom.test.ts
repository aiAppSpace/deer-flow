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
                   `welcome-yields-to-goal` 只能扫源码（夹具喂不出那个组合），
                   这一条可以真挂上去点，所以就真挂上去。
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

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
  return mount(MessageList, {
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
        StreamMarkdown: { template: "<div data-testid='markdown' />" },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
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

  /*
    **分支那个 pending 位必须在请求两侧都被动过。** 只声明不置位、
    或者只在成功那一支清掉（catch 里有 `return`），都会让按钮永远停在禁用上
    或者永远点得动——两种都和「写对了」长得一模一样。
  */
  it("分支请求两侧都动了那个 pending 位", () => {
    expect(source).toContain("branchPending.value = true;");
    expect(source).toMatch(/finally \{[\s\S]*?branchPending\.value = false;/);
  });
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
