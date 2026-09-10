/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     THREAD_PINNED_METADATA_KEY / ChannelThreadSource / pathOfThread / textOfMessage / titleOfThread / documentTitleOfThread / isThreadPinned 等 11 个
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

import type { Message } from "@/core/types/message";

import type { AgentThread, AgentThreadContext } from "./types";

// Namespaced to match other internal metadata keys (``deerflow_sidecar``,
// ``deerflow_branch``) so it cannot collide with a future feature or a
// client-supplied key. Keep in sync with the backend thread_meta constant and
// the E2E mock-api constant.
export const THREAD_PINNED_METADATA_KEY = "deerflow_pinned";

export type ChannelThreadSource = {
  type: "im_channel";
  provider: string;
  label: string;
};

type ThreadRouteTarget =
  | string
  | {
      thread_id: string;
      context?: Pick<AgentThreadContext, "agent_name"> | null;
      metadata?: Record<string, unknown> | null;
    };

export function pathOfThread(
  thread: ThreadRouteTarget,
  context?: Pick<AgentThreadContext, "agent_name"> | null,
) {
  const threadId = typeof thread === "string" ? thread : thread.thread_id;
  const encodedThreadId = encodeURIComponent(threadId);
  let agentName: string | undefined;
  if (typeof thread === "string") {
    agentName = context?.agent_name;
  } else {
    agentName = thread.context?.agent_name;
    if (!agentName) {
      const metaAgent = thread.metadata?.agent_name;
      if (typeof metaAgent === "string") {
        agentName = metaAgent;
      }
    }
  }

  return agentName
    ? `/workspace/agents/${encodeURIComponent(agentName)}/chats/${encodedThreadId}`
    : `/workspace/chats/${encodedThreadId}`;
}

export function textOfMessage(message: Message) {
  if (typeof message.content === "string") {
    return message.content;
  } else if (Array.isArray(message.content)) {
    // Flat join ("") for single-line consumers (input box, titles); the rendered
    // body uses extractContentFromMessage, which joins multi-part content with "\n".
    const text = message.content
      .map((part) =>
        typeof part === "string" ? part : part.type === "text" ? part.text : "",
      )
      .join("");
    return text.length > 0 ? text : null;
  }
  return null;
}

export function titleOfThread(thread: AgentThread, fallback = "Untitled") {
  return thread.values?.title ?? fallback;
}

/**
 * 会话页的浏览器标签标题。
 *
 * 与上游 ThreadTitle 的 useEffect 同一条链
 * （frontend/src/components/workspace/thread-title.tsx）：**按「知道得最确切
 * 的优先」取名**——有标题就用标题，没有就看是不是新会话（「新对话」），
 * 再没有才在加载中落 `Loading…`，最后才是「未命名」。
 *
 * **两边同改（wave 158）**：此前 `isLoading` 排在最前面、无条件盖掉已知的名字，
 * 于是新会话交接那一刻标签页会闪一下 `Loading... - DeerFlow`。React 那侧 Next 的
 * 路由播报器（`aria-live="assertive"`）在导航时读 `document.title`，把这一闪
 * **播了出去而且再不更正**，读屏器用户听到的是「Loading...」（WCAG 4.1.3）。
 * 对照实测：它是这个场景里最后一处非确定性。
 *
 * 上游那句 `Loading...` 是写死的英文，和 primitive 的可访问名
 * 同一类，所以照抄而不进词典；放在这个 .ts 里也就不会被 i18n source guard
 * 当成漏翻的模板文案。
 *
 * 这一条本仓此前**完全没有**：会话页一个 useHead 都不设，标签页永远停在
 * nuxt.config 的根标题 "DeerFlow"。开着几个会话时分不出哪个是哪个，读屏器
 * 打开页面时也念不出这条会话的名字。
 */
export function documentTitleOfThread(options: {
  title: string | null | undefined;
  isNewThread: boolean;
  isLoading: boolean;
  appName: string;
  newChatLabel: string;
  untitledLabel: string;
}) {
  const name = options.title?.trim()
    ? options.title
    : options.isNewThread
      ? options.newChatLabel
      : options.isLoading
        ? "Loading..."
        : options.untitledLabel;
  return `${name} - ${options.appName}`;
}

/** 会话归属的项目 id 写在这个元数据键上（与 Gateway 的 `deerflow_project_id` 同名）。 */
export const THREAD_PROJECT_METADATA_KEY = "deerflow_project_id";

/**
 * 会话归属的项目 id；未归属返回 `null`。
 *
 * **空串按未归属处理**：Gateway 清空归属时写的是空串而不是删键，
 * 只判 `typeof === "string"` 会把它当成一个 id 为空的项目，分组时凭空多出一组。
 */
export function projectIdOfThread(
  thread: Pick<AgentThread, "metadata">,
): string | null {
  const projectId = thread.metadata?.[THREAD_PROJECT_METADATA_KEY];
  return typeof projectId === "string" && projectId.length > 0
    ? projectId
    : null;
}

export function isThreadPinned(thread: Pick<AgentThread, "metadata">) {
  return thread.metadata?.[THREAD_PINNED_METADATA_KEY] === true;
}

export function sortPinnedThreads<T extends Pick<AgentThread, "metadata">>(
  threads: readonly T[],
) {
  return threads
    .map((thread, index) => ({ thread, index }))
    .sort((left, right) => {
      const pinnedDiff =
        Number(isThreadPinned(right.thread)) -
        Number(isThreadPinned(left.thread));
      return pinnedDiff || left.index - right.index;
    })
    .map(({ thread }) => thread);
}

const CHANNEL_PROVIDER_LABELS: Record<string, string> = {
  buzz: "Buzz",
  dingtalk: "DingTalk",
  discord: "Discord",
  feishu: "Feishu",
  slack: "Slack",
  telegram: "Telegram",
  wechat: "WeChat",
  wecom: "WeCom",
};

function labelOfChannelProvider(provider: string) {
  return CHANNEL_PROVIDER_LABELS[provider] ?? provider;
}

export function channelSourceOfThread(
  thread: Pick<AgentThread, "metadata">,
): ChannelThreadSource | null {
  const source = thread.metadata?.channel_source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  if (Reflect.get(source, "type") !== "im_channel") {
    return null;
  }

  const provider = Reflect.get(source, "provider");
  if (typeof provider !== "string" || provider.trim().length === 0) {
    return null;
  }

  const normalizedProvider = provider.trim().toLowerCase();
  return {
    type: "im_channel",
    provider: normalizedProvider,
    label: labelOfChannelProvider(normalizedProvider),
  };
}
