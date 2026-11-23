/*
  【文件职责】     把 browser 连接状态机适配为 Vue refs，并唯一管理帧缓冲与 scope 生命周期。
  【架构位置】     L3
  【主要导出】     useBrowserStream
  【依赖关系】     browser connection core · browser-api · frame-buffer · Vue scope
  【边界与注意】   controller 是 transport 唯一 owner；关闭 Live 保留末帧，换线程/销毁才回收。
*/

import { onScopeDispose, ref, watch, type Ref } from "vue";

import {
  BrowserConnectionController,
  type BrowserConnectionSnapshot,
} from "@/core/browser/connection";
import type { BrowserInputEvent } from "@/core/browser/protocol";

import { browserStreamURL } from "./browser-api";
import { LatestBrowserFrameBuffer } from "./frame-buffer";

export type { BrowserInputEvent } from "@/core/browser/protocol";

export function useBrowserStream(
  threadId: Ref<string>,
  enabled: Ref<boolean>,
  seedUrl?: Ref<string | undefined>,
  callbacks: {
    onNavigationRejected?: (
      url: string | undefined,
      message: string | undefined,
    ) => void;
    onReconnectExhausted?: () => void;
  } = {},
) {
  const status = ref<BrowserConnectionSnapshot["status"]>("idle");
  const frameUrl = ref<string | null>(null);
  const liveUrl = ref<string | null>(null);
  const title = ref("");
  const tabs = ref<BrowserConnectionSnapshot["tabs"]>([]);
  const error = ref<string | null>(null);
  const rejectedUrl = ref<string | null>(null);
  const reconnectAttempt = ref(0);
  const canRetry = ref(false);
  const buffer = new LatestBrowserFrameBuffer((url) => (frameUrl.value = url));
  let currentThreadId: string | undefined;

  function publish(snapshot: BrowserConnectionSnapshot) {
    status.value = snapshot.status;
    liveUrl.value = snapshot.liveUrl;
    title.value = snapshot.title;
    tabs.value = snapshot.tabs;
    error.value = snapshot.error;
    rejectedUrl.value = snapshot.rejectedUrl;
    reconnectAttempt.value = snapshot.reconnectAttempt;
    canRetry.value = snapshot.canRetry;
  }

  const controller = new BrowserConnectionController({
    buildUrl: browserStreamURL,
    onState: publish,
    onFrame(frame) {
      if (frame instanceof Blob) {
        buffer.push(
          frame.type === "image/jpeg"
            ? frame
            : new Blob([frame], { type: "image/jpeg" }),
        );
      } else if (frame instanceof ArrayBuffer) {
        buffer.push(new Blob([frame], { type: "image/jpeg" }));
      } else {
        buffer.replaceWithUrl(`data:image/jpeg;base64,${frame}`);
      }
    },
    onNavigationRejected: callbacks.onNavigationRejected,
    onReconnectExhausted: callbacks.onReconnectExhausted,
  });

  watch(
    [threadId, enabled],
    ([nextThreadId, nextEnabled]) => {
      if (nextThreadId !== currentThreadId) {
        currentThreadId = nextThreadId;
        buffer.dispose();
      }
      if (nextEnabled && nextThreadId) {
        controller.start(nextThreadId, seedUrl?.value);
      } else {
        controller.stop();
      }
    },
    { immediate: true },
  );

  watch(
    () => seedUrl?.value,
    (nextSeed) => {
      if (enabled.value) controller.updateSeed(nextSeed);
    },
  );

  onScopeDispose(() => {
    controller.dispose();
    buffer.dispose();
  });

  return {
    status,
    frameUrl,
    liveUrl,
    title,
    tabs,
    error,
    rejectedUrl,
    reconnectAttempt,
    canRetry,
    sendInput: (event: BrowserInputEvent) => controller.sendInput(event),
    retry: () => controller.retry(),
    clearError: () => controller.clearError(),
  };
}
