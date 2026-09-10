/*
  【文件职责】     把一段 CSV/TSV 文本交给 Worker 解析，并把「谁的结果」管住。
  【架构位置】     L3（Vue 适配层）
  【主要导出】     useDelimitedPreview
  【依赖关系】     vue · @/core/artifacts/delimited-preview-types
  【边界与注意】   这里真正难的不是解析，是**结果与请求的对应关系**：

                   - 结果不是 ref 里存的 status，而是从 settled 结果**派生**出来的：
                     只有 settled 里记的那次请求和当前请求一致才算数。换文件时
                     上一份的表格因此不会先画出来再被替换掉。
                   - Worker 回话晚于切换是常态（terminate 不保证消息不进队列），
                     所以 `finish` 第一件事就是看自己这次是不是已经被取消了。
                     漏掉那道检查不只是画错结果：它会顺着清理逻辑把**当前**那次的
                     Worker 和超时一起收掉，于是界面永远停在 loading。
                   - `active=false` 会**真的终止** Worker：面板收起时留着一个跑
                     1 MiB 解析的线程，纯属白烧用户的 CPU。
                   - 超时是兜底而不是装饰：病态输入能让解析长时间不返回，
                     没有这条超时，UI 会永远停在 loading。
                   - 失败**不自动重试**。自动重试对「文件本身就是坏的」这种
                     主要失败原因没有帮助，只会反复烧 5 秒 CPU；重来由用户点。
*/

import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import { createDelimitedPreviewWorker } from "@/core/artifacts/delimited-preview-worker-factory";
import {
  DELIMITED_INPUT_LIMIT,
  DELIMITED_TIMEOUT_MS,
  type DelimitedPreviewResponse,
  type DelimitedPreviewResult,
} from "@/core/artifacts/delimited-preview-types";

interface DelimitedRequest {
  content: string;
  delimiter: "," | "\t";
  truncated: boolean;
  identity: string;
  attempt: number;
}

function sameRequest(a: DelimitedRequest, b: DelimitedRequest): boolean {
  return (
    a.identity === b.identity &&
    a.attempt === b.attempt &&
    a.delimiter === b.delimiter &&
    a.truncated === b.truncated &&
    // content 同源时是同一个字符串引擎会短路；不同源才逐字符比。
    a.content === b.content
  );
}

interface SettledPreview {
  request: DelimitedRequest;
  status: "ready" | "error";
  result?: DelimitedPreviewResult;
}

export function useDelimitedPreview(options: {
  content: MaybeRefOrGetter<string>;
  delimiter: MaybeRefOrGetter<"," | "\t">;
  truncated: MaybeRefOrGetter<boolean>;
  active: MaybeRefOrGetter<boolean>;
  /** 同一份内容换了文件也要重解析——用它区分。 */
  identity: MaybeRefOrGetter<string>;
}) {
  const attempt = ref(0);

  const prefix = computed(() => {
    const content = toValue(options.content);
    let end = Math.min(content.length, DELIMITED_INPUT_LIMIT);
    // 字符预算正好切在代理对中间时，别把半个字符发过去。
    if (end < content.length) {
      const last = content.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end--;
    }
    return content.slice(0, end);
  });

  const request = computed<DelimitedRequest>(() => ({
    content: prefix.value,
    delimiter: toValue(options.delimiter),
    // 我们自己截过一刀也算截断，末尾那条残记录同样不能显示。
    truncated:
      toValue(options.truncated) ||
      prefix.value.length < toValue(options.content).length,
    identity: toValue(options.identity),
    attempt: attempt.value,
  }));

  const settled = shallowRef<SettledPreview>();

  /**
   * 一次解析尝试：取消标记和它自己的 Worker、定时器绑在一起。
   * 回调是跨时间的——回话到达时 `current` 可能早就是别人了，所以每个回调
   * 认自己捕获的这个 run，而不是去读 `current`。
   */
  interface PreviewRun {
    cancelled: boolean;
    worker?: Worker;
    timer?: ReturnType<typeof setTimeout>;
  }

  let current: PreviewRun | undefined;

  /** 取消并释放**这一次**尝试；谁是当前那一次，由 stop/start 记。 */
  function stop() {
    const run = current;
    current = undefined;
    if (!run) return;
    run.cancelled = true;
    if (run.timer !== undefined) clearTimeout(run.timer);
    run.timer = undefined;
    run.worker?.terminate();
    run.worker = undefined;
  }

  function start(pending: DelimitedRequest) {
    stop();
    const run: PreviewRun = { cancelled: false };
    current = run;
    const finish = (response: DelimitedPreviewResponse) => {
      if (run.cancelled) return;
      stop();
      settled.value =
        "result" in response
          ? { request: pending, status: "ready", result: response.result }
          : { request: pending, status: "error" };
    };
    run.timer = setTimeout(
      () => finish({ error: "timeout" }),
      DELIMITED_TIMEOUT_MS,
    );
    try {
      const worker = createDelimitedPreviewWorker();
      run.worker = worker;
      worker.onmessage = (event: MessageEvent<DelimitedPreviewResponse>) =>
        finish(event.data);
      worker.onerror = () => finish({ error: "worker unavailable" });
      worker.onmessageerror = () => finish({ error: "invalid worker message" });
      worker.postMessage({
        content: pending.content,
        delimiter: pending.delimiter,
        truncated: pending.truncated,
      });
    } catch {
      finish({ error: "worker unavailable" });
    }
  }

  watch(
    [request, () => toValue(options.active)] as const,
    ([pending, active]) => {
      if (!active) {
        stop();
        return;
      }
      const done = settled.value;
      // 已经有这次请求的答案了（成功或失败都算），不要重跑；重来走 retry。
      if (done && sameRequest(done.request, pending)) {
        stop();
        return;
      }
      start(pending);
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  const answer = computed(() => {
    const done = settled.value;
    return done && sameRequest(done.request, request.value) ? done : undefined;
  });

  return {
    result: computed(() => answer.value?.result),
    status: computed(() => answer.value?.status ?? "loading"),
    retry: () => {
      attempt.value += 1;
    },
  };
}
