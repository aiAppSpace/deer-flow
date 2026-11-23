/*
  【文件职责】     固定唯一 draft owner 的 switch/close/route/beforeunload/exit 生命周期。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/composables/useArtifactDraft.ts
  【边界与注意】   beforeunload 只在 dirty 窗口注册；scope dispose 必须移除 listener。
*/

import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArtifactDraft } from "@/composables/useArtifactDraft";

const routeGuards = vi.hoisted(() => ({
  leave: undefined as undefined | (() => boolean),
  update: undefined as undefined | (() => boolean),
}));

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: (guard: () => boolean) => {
    routeGuards.leave = guard;
  },
  onBeforeRouteUpdate: (guard: () => boolean) => {
    routeGuards.update = guard;
  },
}));

const SHA = "a".repeat(64);

function mountOwner(confirm = vi.fn(() => false)) {
  let owner!: ReturnType<typeof useArtifactDraft>;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = useArtifactDraft({ confirm });
        return () => null;
      },
    }),
  );
  return { owner, wrapper, confirm };
}

describe("useArtifactDraft", () => {
  beforeEach(() => {
    routeGuards.leave = undefined;
    routeGuards.update = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses one confirmation decision for file switch, panel close, and route leave", () => {
    const confirm = vi.fn(() => false);
    const { owner, wrapper } = mountOwner(confirm);
    owner.reconcile("/a.txt", { content: "server", sha256: SHA });
    owner.beginEdit("/a.txt");
    owner.update("/a.txt", "draft");

    expect(owner.requestLeave("/a.txt")).toBe(false);
    expect(routeGuards.leave?.()).toBe(false);
    expect(routeGuards.update?.()).toBe(false);
    expect(owner.records["/a.txt"]?.draftContent).toBe("draft");

    confirm.mockReturnValue(true);
    expect(owner.requestLeave("/a.txt")).toBe(true);
    expect(owner.records["/a.txt"]?.draftContent).toBe("server");
    expect(owner.editingPath.value).toBeNull();
    wrapper.unmount();
  });

  it("exits editing without discarding the draft or asking to leave the file", () => {
    const { owner, wrapper, confirm } = mountOwner();
    owner.reconcile("/a.txt", { content: "server", sha256: SHA });
    owner.beginEdit("/a.txt");
    owner.update("/a.txt", "draft");
    expect(owner.requestExitEdit("/a.txt")).toBe(true);
    expect(owner.editingPath.value).toBeNull();
    expect(owner.records["/a.txt"]?.draftContent).toBe("draft");
    expect(owner.hasUnsavedDrafts.value).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("registers beforeunload only while dirty and removes it on discard or scope dispose", () => {
    const add = vi.spyOn(globalThis, "addEventListener");
    const remove = vi.spyOn(globalThis, "removeEventListener");
    const { owner, wrapper } = mountOwner();
    owner.reconcile("/a.txt", { content: "server", sha256: SHA });
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    owner.update("/a.txt", "draft");
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    const event = new Event("beforeunload", { cancelable: true });
    globalThis.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    owner.discard("/a.txt");
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    owner.update("/a.txt", "another draft");
    wrapper.unmount();
    expect(remove).toHaveBeenLastCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});
