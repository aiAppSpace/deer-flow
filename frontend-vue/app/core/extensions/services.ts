import { getAPIClient } from "@/core/api";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { formatThreadAsJSON } from "@/core/threads/export";
import { pathOfThread } from "@/core/threads/utils";
import { readGatewayResponseError } from "@/core/api/errors";

import type {
  ConversationActionContext,
  FrontendContribution,
  FrontendServices,
} from "./contracts";

export type HostServices = Omit<FrontendServices, "callBackend">;

/** Namespace comes from the installed page snapshot, never from action input. */
export function bindFrontendServices(
  base: HostServices,
  entry: FrontendContribution,
  signal?: AbortSignal,
  isCurrent?: () => boolean,
): FrontendServices {
  function assertCurrent() {
    signal?.throwIfAborted();
    if (isCurrent && !isCurrent())
      throw new DOMException("Plugin host changed", "AbortError");
  }
  return {
    ...base,
    async conversationText(context) {
      assertCurrent();
      const result = await base.conversationText(context);
      assertCurrent();
      return result;
    },
    ...(base.latestVisibleAnswer
      ? {
          latestVisibleAnswer: async (context: ConversationActionContext) => {
            assertCurrent();
            const result = await base.latestVisibleAnswer!(context);
            assertCurrent();
            return result;
          },
        }
      : {}),
    showMessage(message) {
      assertCurrent();
      base.showMessage(message);
    },
    async callBackend(action, payload) {
      assertCurrent();
      if (!entry.backend_actions?.includes(action))
        throw new Error("Backend action not declared by this plugin");
      const response = await fetch(
        `${getBackendBaseURL()}/api/plugins/${encodeURIComponent(entry.namespace)}/actions/${encodeURIComponent(action)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(entry.viewer_id
              ? { "X-Deerflow-Plugin-Viewer": entry.viewer_id }
              : {}),
          },
          body: JSON.stringify(payload),
          ...(signal ? { signal } : {}),
        },
      );
      assertCurrent();
      if (!response.ok)
        throw await readGatewayResponseError(
          response,
          `Plugin action unavailable (${response.status})`,
        );
      const result: unknown = await response.json();
      assertCurrent();
      return result;
    },
  };
}

export async function conversationText(context: ConversationActionContext) {
  const data = await visibleConversation(context);
  return data.messages.map((message) => message.content).join("\n\n");
}

async function visibleConversation(context: ConversationActionContext) {
  const messages =
    context.messages ??
    (await getAPIClient().threads.getState(context.thread.thread_id)).values
      ?.messages ??
    [];
  // Reuse the export's visibility and internal-marker rules for both host slots.
  return JSON.parse(formatThreadAsJSON(context.thread, messages)) as {
    messages: { id?: string; type: string; content: string }[];
  };
}

export async function latestVisibleAnswer(context: ConversationActionContext) {
  const { messages } = await visibleConversation(context);
  const answer = [...messages]
    .reverse()
    .find((message) => message.type === "ai" && !!message.id);
  return answer ? { id: answer.id!, text: answer.content } : null;
}

/** Resolve live routing metadata through the authenticated host API, including legacy bookmarks. */
export async function openConversation(
  threadId: string,
  navigate: (path: string) => void,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const thread = await getAPIClient().threads.get(threadId, { signal });
  signal?.throwIfAborted();
  navigate(pathOfThread(thread));
}
