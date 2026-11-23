/*
  【文件职责】     消息 HIL 提交的 pending、响应确认与会话生命周期。
  【架构位置】     L3 composable
  【主要导出】     useMessageHumanInput
  【依赖关系】     Vue · core/messages/human-input
  【边界与注意】   不持有 run；旧提交不能移除新身份同 request id 的 pending 或播报旧错误。
*/
import { onUnmounted, ref, watch } from "vue";

import {
  shouldClearPendingHumanInputOnThreadError,
  type HumanInputRequest,
  type HumanInputResponse,
  type HumanInputThreadState,
} from "@/core/messages/human-input";

export function useMessageHumanInput(options: {
  owner: () => readonly [string | null | undefined, string | undefined];
  state: () => HumanInputThreadState;
  streaming: () => boolean;
  threadError: () => unknown;
  submit: () =>
    | ((
        request: HumanInputRequest,
        response: HumanInputResponse,
      ) => boolean | undefined | Promise<boolean | undefined>)
    | undefined;
  dispatch: (request: HumanInputRequest, response: HumanInputResponse) => void;
  notifyError: (message: string) => void;
}) {
  const pendingHumanInputs = ref(new Set<string>());
  const operations = new Map<string, object>();
  let previousError = options.threadError();
  let disposed = false;

  function clearPending() {
    operations.clear();
    pendingHumanInputs.value = new Set();
  }
  watch(
    options.owner,
    () => {
      clearPending();
      previousError = options.threadError();
    },
    { flush: "sync" },
  );
  watch(options.state, (state) => {
    if (!pendingHumanInputs.value.size) return;
    const remaining = new Set(pendingHumanInputs.value);
    for (const id of state.answeredResponses.keys()) {
      remaining.delete(id);
      operations.delete(id);
    }
    pendingHumanInputs.value = remaining;
  });
  watch(options.threadError, (currentError) => {
    const clear = shouldClearPendingHumanInputOnThreadError({
      currentError,
      previousError,
      pendingRequestCount: pendingHumanInputs.value.size,
    });
    previousError = currentError;
    if (clear) clearPending();
  });
  watch(options.streaming, (streaming, previousStreaming) => {
    if (previousStreaming && !streaming) clearPending();
  });
  onUnmounted(() => {
    disposed = true;
    clearPending();
  });

  async function handleHumanInputSubmit(
    request: HumanInputRequest,
    response: HumanInputResponse,
  ) {
    const id = request.request_id;
    if (disposed || pendingHumanInputs.value.has(id)) return;
    const operation = {};
    operations.set(id, operation);
    pendingHumanInputs.value = new Set([...pendingHumanInputs.value, id]);
    const isCurrent = () => !disposed && operations.get(id) === operation;
    function removePending() {
      operations.delete(id);
      const next = new Set(pendingHumanInputs.value);
      next.delete(id);
      pendingHumanInputs.value = next;
    }
    try {
      const submit = options.submit();
      if (submit) {
        const accepted = await submit(request, response);
        if (isCurrent() && accepted === false) removePending();
      } else {
        options.dispatch(request, response);
      }
    } catch (error) {
      if (!isCurrent()) return;
      removePending();
      options.notifyError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { pendingHumanInputs, handleHumanInputSubmit };
}
