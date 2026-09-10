/*
  【文件职责】     固定分隔符预览 composable 的**结果归属**与 Worker 生命周期。
  【架构位置】     测试
  【依赖关系】     app/composables/useDelimitedPreview.ts
  【边界与注意】   这里守的坏结果都很具体：换文件时画出上一份的表、Worker 晚到的
                   回话覆盖掉新结果、面板收起后线程还在烧 CPU、卸载后 Worker 泄漏、
                   解析卡死后永远 loading、失败后自己反复重试。
                   用 effectScope 而不是挂组件跑——这个 composable 不碰 DOM，
                   挂组件只会把「谁触发了重跑」藏进渲染时机里。
*/

import { effectScope, nextTick, ref, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDelimitedPreview } from "@/composables/useDelimitedPreview";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  complete() {
    this.onmessage?.({ data: { result: sample } } as MessageEvent);
  }
}

const sample = {
  rows: [["a"]],
  columnCount: 1,
  limited: false,
  unevenRows: false,
};

const lastWorker = () => FakeWorker.instances.at(-1)!;

interface Harness {
  content: Ref<string>;
  delimiter: Ref<"," | "\t">;
  truncated: Ref<boolean>;
  active: Ref<boolean>;
  identity: Ref<string>;
  preview: ReturnType<typeof useDelimitedPreview>;
  stop: () => void;
}

function mount(overrides: Partial<Record<string, unknown>> = {}): Harness {
  const content = ref((overrides.content as string) ?? "a");
  const delimiter = ref<"," | "\t">((overrides.delimiter as "," | "\t") ?? ",");
  const truncated = ref((overrides.truncated as boolean) ?? false);
  const active = ref((overrides.active as boolean) ?? true);
  const identity = ref((overrides.identity as string) ?? "file-a");
  const scope = effectScope();
  const preview = scope.run(() =>
    useDelimitedPreview({ content, delimiter, truncated, active, identity }),
  )!;
  scopes.push(scope);
  return {
    content,
    delimiter,
    truncated,
    active,
    identity,
    preview,
    stop: () => scope.stop(),
  };
}

let scopes: ReturnType<typeof effectScope>[] = [];

describe("useDelimitedPreview", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    scopes = [];
    vi.stubGlobal("Worker", FakeWorker);
    vi.useFakeTimers();
  });
  afterEach(() => {
    for (const scope of scopes) scope.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("只在 active 时启动，成功后复用结果，无关变化不重跑", async () => {
    const h = mount({ active: false });
    expect(FakeWorker.instances).toHaveLength(0);

    h.active.value = true;
    await nextTick();
    expect(h.preview.status.value).toBe("loading");
    lastWorker().complete();
    expect(h.preview.result.value).toEqual(sample);
    expect(h.preview.status.value).toBe("ready");
    // 拿到结果就该把线程放掉，不留着。
    expect(lastWorker().terminate).toHaveBeenCalledTimes(1);

    h.active.value = false;
    await nextTick();
    h.active.value = true;
    await nextTick();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(h.preview.status.value).toBe("ready");
  });

  it("输入变了就终止旧 Worker，并丢弃它晚到的回话", async () => {
    const h = mount();
    const old = lastWorker();
    const late = old.onmessage!;

    h.identity.value = "file-b";
    await nextTick();
    expect(old.terminate).toHaveBeenCalled();
    expect(h.preview.result.value).toBeUndefined();

    const current = lastWorker();
    late({ data: { result: sample } } as MessageEvent);
    expect(h.preview.result.value).toBeUndefined();
    // 晚到的回话不能顺手把**当前**那个 Worker 连同它的超时一起收掉：
    // 收掉了新请求就再也不会返回，界面永远停在 loading。
    expect(current.terminate).not.toHaveBeenCalled();

    current.complete();
    expect(h.preview.result.value).toEqual(sample);
    // 更晚到的回话也不能把已经画出来的结果打回 loading。
    late({ data: { result: sample } } as MessageEvent);
    expect(h.preview.status.value).toBe("ready");

    h.identity.value = "file-c";
    await nextTick();
    // 上一份的表格不能在新文件解析出来之前先画一帧。
    expect(h.preview.result.value).toBeUndefined();
  });

  it("面板收起和作用域销毁都会终止在跑的 Worker", async () => {
    const h = mount();
    const first = lastWorker();

    h.active.value = false;
    await nextTick();
    expect(first.terminate).toHaveBeenCalled();

    h.active.value = true;
    await nextTick();
    const second = lastWorker();
    expect(second).not.toBe(first);

    h.stop();
    expect(second.terminate).toHaveBeenCalled();
  });

  it("5 秒后超时，且只有显式 retry 才重来", async () => {
    const h = mount();
    vi.advanceTimersByTime(4999);
    expect(h.preview.status.value).toBe("loading");
    vi.advanceTimersByTime(1);
    expect(h.preview.status.value).toBe("error");
    expect(lastWorker().terminate).toHaveBeenCalled();

    h.active.value = false;
    await nextTick();
    h.active.value = true;
    await nextTick();
    expect(FakeWorker.instances).toHaveLength(1);

    h.preview.retry();
    await nextTick();
    expect(FakeWorker.instances).toHaveLength(2);
    lastWorker().complete();
    expect(h.preview.status.value).toBe("ready");
  });

  it("Worker 造不出来、跑挂了、回话读不了，都归为 error", async () => {
    const h = mount();
    lastWorker().onerror?.();
    expect(h.preview.status.value).toBe("error");

    h.preview.retry();
    await nextTick();
    lastWorker().onmessage?.({ data: { error: "syntax" } } as MessageEvent);
    expect(h.preview.status.value).toBe("error");

    h.preview.retry();
    await nextTick();
    lastWorker().onmessageerror?.();
    expect(h.preview.status.value).toBe("error");

    vi.stubGlobal("Worker", undefined);
    h.preview.retry();
    await nextTick();
    expect(h.preview.status.value).toBe("error");
  });

  it("内容、分隔符、截断标记任一变化都让旧结果失效", async () => {
    const h = mount();
    lastWorker().complete();

    h.content.value = "b";
    await nextTick();
    expect(h.preview.result.value).toBeUndefined();
    lastWorker().complete();

    h.delimiter.value = "\t";
    await nextTick();
    expect(h.preview.result.value).toBeUndefined();
    lastWorker().complete();

    h.truncated.value = true;
    await nextTick();
    expect(h.preview.result.value).toBeUndefined();
    expect(FakeWorker.instances).toHaveLength(4);
  });

  it("投递前先截到上限，且不切开代理对", async () => {
    const h = mount({ content: "a".repeat(1_048_575) + "😀tail" });
    await nextTick();
    expect(lastWorker().postMessage).toHaveBeenCalledWith({
      content: "a".repeat(1_048_575),
      delimiter: ",",
      // 自己截过一刀，末尾那条记录同样按残记录处理。
      truncated: true,
    });
    expect(h.preview.status.value).toBe("loading");
  });
});
