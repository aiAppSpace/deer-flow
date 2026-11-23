/** Actual AgentChat → WorkspacePanels → native splitter, with the real business coordinator. */
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, nextTick, onMounted, onUnmounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import { installPointerCaptureFixture } from "../helpers/pointer-capture";

import {
  agentChatAccount,
  agentChatBrowserControlEnabled,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

vi.mock("@/composables/useSidecarSession", () => ({
  // Transport is irrelevant to presentation. The real useChatPanels/useSidecar
  // and AgentChat still decide open/close, kind priority and actual child props.
  useSidecarSession: () => ({
    ready: ref(true),
    restore: vi.fn(async () => "sidecar-a"),
  }),
}));

const mountedConsumers: VueWrapper[] = [];
let capture: ReturnType<typeof installPointerCaptureFixture>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  capture = installPointerCaptureFixture();
});
afterEach(async () => {
  for (const wrapper of mountedConsumers.splice(0))
    if (wrapper.exists()) wrapper.unmount();
  await flushPromises();
  capture.restore();
  vi.useRealTimers();
});

function panelProbe(name: string) {
  const mounted = vi.fn();
  const unmounted = vi.fn();
  const component = defineComponent({
    name,
    props: { active: Boolean, readonly: Boolean, threadId: String },
    emits: ["close", "discard"],
    setup(props, { emit }) {
      const input = ref("");
      onMounted(mounted);
      onUnmounted(unmounted);
      return () =>
        h("section", { "data-testid": name }, [
          h("input", {
            value: input.value,
            onInput: (event: Event) => {
              if (event.target instanceof HTMLInputElement)
                input.value = event.target.value;
            },
          }),
          h("button", { onClick: () => emit("close") }, "Close panel"),
          h(
            "button",
            { "data-testid": "discard-panel", onClick: () => emit("discard") },
            "Discard panel",
          ),
          h("output", `${props.active}/${props.readonly}`),
        ]);
    },
  });
  return { component, mounted, unmounted };
}

async function subject(
  props: { demo?: boolean; agentName?: string } = {},
  threadId = "thread-a",
) {
  const sidecar = panelProbe("SidecarPresentationProbe");
  const browser = panelProbe("BrowserPresentationProbe");
  const artifact = panelProbe("ArtifactPresentationProbe");
  agentChatBrowserControlEnabled.value = true;
  const mounted = mountAgentChatHarness(props, {
    realPanels: true,
    threadId,
    panelStubs: {
      SidecarPanel: sidecar.component,
      BrowserPanel: browser.component,
      ArtifactOverview: artifact.component,
      ArtifactPanel: artifact.component,
      MessageDetailsPanel: false,
    },
  });
  mountedConsumers.push(mounted.wrapper);
  await flushPromises();
  const panels = mounted.panels;
  if (!panels)
    throw new Error("Fixture did not mount the actual useChatPanels owner");
  expect(
    mounted.wrapper.findAll("[data-panel]"),
    mounted.wrapper.html(),
  ).toHaveLength(2);
  const openSidecar = async () => {
    panels.sidecar.sidecarThreadId.value = "sidecar-a";
    panels.sidecar.open.value = true;
    await flushPromises();
    await vi.advanceTimersByTimeAsync(280);
    return mounted.wrapper.getComponent(sidecar.component);
  };
  return { ...mounted, panels, sidecar, browser, artifact, openSidecar };
}

describe("AgentChat consumes the common panel presentation owner", () => {
  it("keeps the exact sidecar instance during close while revoking its actual active prop immediately", async () => {
    const source = await subject();
    const child = await source.openSidecar();
    expect(child.props("active")).toBe(true);
    expect(child.props("readonly")).toBe(false);
    await child.get("button").trigger("click");
    await flushPromises();
    expect(source.panels.sidecar.open.value).toBe(false);
    const closing = source.wrapper.findComponent(source.sidecar.component);
    expect(closing.exists()).toBe(true);
    expect(closing.vm).toBe(child.vm);
    expect(closing.props("active")).toBe(false);
    expect(closing.props("readonly")).toBe(false);
    await vi.advanceTimersByTimeAsync(279);
    expect(source.sidecar.unmounted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(source.sidecar.unmounted).toHaveBeenCalledOnce();
  });

  it("preserves a local child draft on close→open before exit instead of creating another sidecar view", async () => {
    const source = await subject();
    const child = await source.openSidecar();
    await child.get("input").setValue("unfinished child input");
    await child.get("button").trigger("click");
    await vi.advanceTimersByTimeAsync(100);
    source.panels.sidecar.open.value = true;
    await flushPromises();
    const reopened = source.wrapper.getComponent(source.sidecar.component);
    expect(reopened.vm).toBe(child.vm);
    expect(reopened.get("input").element.value).toBe("unfinished child input");
    await vi.advanceTimersByTimeAsync(280);
    expect(source.wrapper.getComponent(source.sidecar.component).vm).toBe(
      child.vm,
    );
    expect(source.sidecar.mounted).toHaveBeenCalledOnce();
    expect(source.sidecar.unmounted).not.toHaveBeenCalled();
  });

  it("retains the browser view for exit but preserves the real business close and inactive transport admission", async () => {
    const source = await subject();
    source.panels.openBrowserFrame({ screenshot: "frame-a" });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(280);
    const child = source.wrapper.getComponent(source.browser.component);
    expect(child.props("active")).toBe(true);
    await child.get("button").trigger("click");
    await flushPromises();
    expect(source.panels.browserOpen.value).toBe(false);
    expect(source.panels.browserFrame.value?.screenshot).toBe("frame-a");
    const closing = source.wrapper.findComponent(source.browser.component);
    expect(closing.exists()).toBe(true);
    expect(closing.props("active")).toBe(false);
    await vi.advanceTimersByTimeAsync(280);
    expect(source.browser.unmounted).toHaveBeenCalledOnce();
  });

  it("replaces a kind immediately without duplicating panels or changing the real business priority", async () => {
    const source = await subject();
    await source.openSidecar();
    source.panels.showArtifacts();
    await flushPromises();
    expect(source.panels.activePanel.value).toBe("artifacts");
    expect(
      source.wrapper.findComponent(source.sidecar.component).exists(),
    ).toBe(false);
    expect(
      source.wrapper.findAllComponents(source.artifact.component),
    ).toHaveLength(1);
    source.panels.openBrowserFrame({ screenshot: "frame-b" });
    await flushPromises();
    expect(source.panels.activePanel.value).toBe("browser");
    expect(
      source.wrapper.findComponent(source.artifact.component).exists(),
    ).toBe(false);
    expect(
      source.wrapper.findAllComponents(source.browser.component),
    ).toHaveLength(1);
  });

  it.each(["thread", "agent", "account"])(
    "retires closing content immediately when its %s owner changes",
    async (kind) => {
      const source = await subject();
      const child = await source.openSidecar();
      await child.get("button").trigger("click");
      await flushPromises();
      if (kind === "thread") source.route.params.thread_id = "thread-b";
      else if (kind === "agent")
        await source.wrapper.setProps({ agentName: "writer" });
      else
        agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
      await flushPromises();
      expect(
        source.wrapper.findComponent(source.sidecar.component).exists(),
      ).toBe(false);
      expect(source.panels.sidecar.sidecarThreadId.value).toBeNull();
      await vi.advanceTimersByTimeAsync(500);
      expect(
        source.wrapper.findComponent(source.sidecar.component).exists(),
      ).toBe(false);
    },
  );

  it("keeps readonly admission on retained showcase content", async () => {
    const source = await subject({ demo: true });
    const child = await source.openSidecar();
    expect(child.props("readonly")).toBe(true);
    await child.get("button").trigger("click");
    await flushPromises();
    const closing = source.wrapper.findComponent(source.sidecar.component);
    expect(closing.exists()).toBe(true);
    expect(closing.props("readonly")).toBe(true);
    expect(closing.props("active")).toBe(false);
  });

  it.each(["account", "thread"])(
    "retires the previous panel view on %s A→B→A within one Vue flush",
    async (kind) => {
      const source = await subject();
      const oldChild = await source.openSidecar();
      await oldChild.get("input").setValue("private old-account draft");
      if (kind === "account") {
        agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
        agentChatAccount.value = {
          tag: "authenticated",
          user: { id: "alice" },
        };
      } else {
        source.route.params.thread_id = "thread-b";
        source.route.params.thread_id = "thread-a";
      }
      await nextTick();
      expect(source.panels.sidecar.open.value).toBe(false);
      expect(source.panels.sidecar.sidecarThreadId.value).toBeNull();
      expect(
        source.wrapper.findComponent(source.sidecar.component).exists(),
      ).toBe(false);
      const freshChild = await source.openSidecar();
      expect(freshChild.vm).not.toBe(oldChild.vm);
      expect(freshChild.get("input").element.value).toBe("");
    },
  );

  it.each(["account", "thread"])(
    "cancels the actual held gesture on %s A→B→A within one Vue flush",
    async (kind) => {
      const source = await subject();
      await source.openSidecar();
      const group = source.wrapper.get(".workspace-panels");
      const handle = group.get('[role="separator"]');
      for (const pane of group.findAll("[data-panel]"))
        vi.spyOn(pane.element, "getBoundingClientRect").mockImplementation(
          () =>
            new DOMRect(
              0,
              0,
              Number(pane.attributes("data-panel-size")) * 10,
              500,
            ),
        );
      const pointer = (type: string, x: number) =>
        handle.element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 19,
            button: 0,
            isPrimary: true,
            clientX: x,
            bubbles: true,
            cancelable: true,
          }),
        );
      pointer("pointerdown", 600);
      pointer("pointermove", 650);
      await nextTick();
      expect(capture.captures.has(19)).toBe(true);
      expect(
        group.get('[data-panel-id="side"]').attributes("data-panel-size"),
      ).toBe("35");
      if (kind === "account") {
        agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
        agentChatAccount.value = {
          tag: "authenticated",
          user: { id: "alice" },
        };
      } else {
        source.route.params.thread_id = "thread-b";
        source.route.params.thread_id = "thread-a";
      }
      await nextTick();
      expect(capture.captures.size).toBe(0);
      pointer("pointermove", 1000);
      pointer("pointerup", 1000);
      await nextTick();
      expect(source.panels.artifactPanel.panelSize.value).toBe(40);
      expect(source.panels.sidecar.open.value).toBe(false);
      await source.openSidecar();
      expect(
        group.get('[data-panel-id="side"]').attributes("data-panel-size"),
      ).toBe("40");
      pointer("pointerdown", 600);
      pointer("pointermove", 700);
      pointer("pointerup", 700);
      await nextTick();
      expect(source.panels.artifactPanel.panelSize.value).toBe(30);
      expect(source.panels.sidecar.open.value).toBe(true);
    },
  );

  it("preserves business discard immediately rather than restoring a cached sidecar id during exit", async () => {
    const source = await subject();
    const child = await source.openSidecar();
    await child.get('[data-testid="discard-panel"]').trigger("click");
    await nextTick();
    expect(source.panels.sidecar.open.value).toBe(false);
    expect(source.panels.sidecar.sidecarThreadId.value).toBeNull();
    expect(source.panels.sidecar.activeReferences.value).toEqual([]);
    expect(
      source.wrapper.getComponent(source.sidecar.component).props("active"),
    ).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    source.panels.sidecar.open.value = true;
    await nextTick();
    expect(source.panels.sidecar.sidecarThreadId.value).toBeNull();
    expect(source.wrapper.getComponent(source.sidecar.component).vm).toBe(
      child.vm,
    );
  });

  it("adopts the prepared draft UUID without retiring its actual sidecar business state", async () => {
    const source = await subject({}, "new");
    const uuid: unknown = source.composer().props("targetThreadId");
    if (typeof uuid !== "string")
      throw new Error("Expected actual prepared draft UUID");
    source.panels.sidecar.sidecarThreadId.value = "prepared-sidecar";
    source.panels.sidecar.open.value = true;
    await nextTick();
    // Sidecar's production view requires a committed route thread. Observe the
    // actual shared layout owner before adoption without inventing that view.
    const presentation = source.wrapper.getComponent(WorkspacePanels);
    const preparedOwner = presentation.props("ownerKey");
    source.route.params.thread_id = uuid;
    await nextTick();
    expect(source.panels.sidecar.sidecarThreadId.value).toBe(
      "prepared-sidecar",
    );
    expect(source.panels.sidecar.open.value).toBe(true);
    expect(
      source.wrapper.getComponent(source.sidecar.component).props("active"),
    ).toBe(true);
    expect(presentation.props("ownerKey")).toBe(preparedOwner);
  });

  it("mounts real message details on first select and lets its explicit return focus win at close", async () => {
    const source = await subject();
    const origin = source.wrapper.get(
      '[data-testid="composer-consumer"]',
    ).element;
    if (!(origin instanceof HTMLElement))
      throw new Error("Expected actual main consumer");
    origin.tabIndex = 0;
    const Content = defineComponent({
      setup: () => () => h("p", "Selected snapshot"),
    });
    source.panels.messageDetails.select(
      { id: "details-a", title: "Detail A", content: Content },
      origin,
    );
    await flushPromises();
    expect(source.wrapper.get("#artifacts h2").element).toBe(
      document.activeElement,
    );
    expect(source.wrapper.get("#artifacts section").text()).toContain(
      "Selected snapshot",
    );
    source.panels.messageDetails.close();
    await flushPromises();
    expect(document.activeElement).toBe(origin);
    expect(source.wrapper.find("#artifacts section").exists()).toBe(false);
    expect(source.panels.messageDetails.open.value).toBe(false);
    await vi.advanceTimersByTimeAsync(280);
    expect(source.wrapper.find("#artifacts > div").exists()).toBe(false);
  });

  it("does not focus a detail that is closed before its first mount continuation returns", async () => {
    const source = await subject();
    const origin = source.wrapper.get(
      '[data-testid="composer-consumer"]',
    ).element;
    if (!(origin instanceof HTMLElement))
      throw new Error("Expected actual main consumer");
    origin.tabIndex = 0;
    const Content = defineComponent({ setup: () => () => h("p", "Snapshot") });
    source.panels.messageDetails.select(
      { id: "late", title: "Late detail", content: Content },
      origin,
    );
    await nextTick();
    source.panels.messageDetails.close();
    await flushPromises();
    expect(document.activeElement).toBe(origin);
    expect(source.wrapper.find("#artifacts h2").exists()).toBe(false);
  });

  it.each(["agent", "account"])(
    "retires real message details on same-thread %s change and never revives them on return",
    async (kind) => {
      const source = await subject();
      const Content = defineComponent({
        setup: () => () => h("p", "Private old-owner detail"),
      });
      source.panels.messageDetails.select({
        id: "old-owner",
        title: "Old owner detail",
        content: Content,
      });
      await flushPromises();
      expect(source.wrapper.get("#artifacts section").text()).toContain(
        "Private old-owner detail",
      );
      if (kind === "agent")
        await source.wrapper.setProps({ agentName: "writer" });
      else
        agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
      await nextTick();
      expect(source.panels.messageDetails.open.value).toBe(false);
      expect(source.panels.messageDetails.selectedDetail.value).toBeNull();
      expect(source.wrapper.find("#artifacts section").exists()).toBe(false);
      if (kind === "agent")
        await source.wrapper.setProps({ agentName: undefined });
      else
        agentChatAccount.value = {
          tag: "authenticated",
          user: { id: "alice" },
        };
      await flushPromises();
      await vi.advanceTimersByTimeAsync(500);
      expect(source.panels.messageDetails.selectedDetail.value).toBeNull();
      expect(source.wrapper.find("#artifacts section").exists()).toBe(false);
    },
  );

  it("keeps a dirty artifact in the actual open consumer when its unique draft owner rejects close", async () => {
    const source = await subject();
    const panel = source.panels.artifactPanel;
    panel.select("note.md");
    panel.draftOwner.reconcile("note.md", {
      content: "old",
      sha256: "a".repeat(64),
    });
    panel.draftOwner.beginEdit("note.md");
    panel.draftOwner.update("note.md", "unsaved edit");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(280);
    const child = source.wrapper.getComponent(source.artifact.component);
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    try {
      await child.get("button").trigger("click");
      await flushPromises();
      expect(confirm).toHaveBeenCalledOnce();
      expect(panel.open.value).toBe(true);
      expect(panel.hasUnsavedDrafts.value).toBe(true);
      expect(source.wrapper.getComponent(source.artifact.component).vm).toBe(
        child.vm,
      );
      expect(source.wrapper.get("#artifacts").attributes("aria-hidden")).toBe(
        "false",
      );
      expect(source.wrapper.get(".workspace-panels").classes()).not.toContain(
        "workspace-panels--animating",
      );
    } finally {
      confirm.mockReset();
    }
  });

  it.each(["account", "thread"])(
    "retires detail ownership on a %s A→B→A transition within one Vue flush",
    async (kind) => {
      const source = await subject();
      const Content = defineComponent({
        setup: () => () => h("p", "Retired account snapshot"),
      });
      source.panels.messageDetails.select({
        id: "account-a",
        title: "Account A",
        content: Content,
      });
      await flushPromises();
      expect(source.panels.messageDetails.open.value).toBe(true);
      if (kind === "account") {
        agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
        agentChatAccount.value = {
          tag: "authenticated",
          user: { id: "alice" },
        };
      } else {
        source.route.params.thread_id = "thread-b";
        source.route.params.thread_id = "thread-a";
      }
      await nextTick();
      expect(source.panels.messageDetails.open.value).toBe(false);
      expect(source.panels.messageDetails.selectedDetail.value).toBeNull();
      expect(source.wrapper.find("#artifacts section").exists()).toBe(false);
    },
  );

  it("does not let a retired account's pending detail close restore its previous focus", async () => {
    const source = await subject();
    const origin = source.wrapper.get(
      '[data-testid="composer-consumer"]',
    ).element;
    if (!(origin instanceof HTMLElement))
      throw new Error("Expected actual main consumer");
    origin.tabIndex = 0;
    const Content = defineComponent({
      setup: () => () => h("p", "Retired snapshot"),
    });
    source.panels.messageDetails.select(
      { id: "retired", title: "Retired", content: Content },
      origin,
    );
    await flushPromises();
    source.panels.messageDetails.close();
    agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    const currentFocus = document.createElement("button");
    document.body.append(currentFocus);
    try {
      currentFocus.focus();
      await flushPromises();
      expect(document.activeElement).toBe(currentFocus);
      expect(source.panels.messageDetails.selectedDetail.value).toBeNull();
      expect(source.wrapper.find("#artifacts h2").exists()).toBe(false);
    } finally {
      currentFocus.remove();
    }
  });

  it("keeps only the new owner's detail and heading when an old first-mount continuation is pending", async () => {
    const source = await subject();
    const OldContent = defineComponent({
      setup: () => () => h("p", "Old account data"),
    });
    const CurrentContent = defineComponent({
      setup: () => () => h("p", "Current account data"),
    });
    source.panels.messageDetails.select({
      id: "old",
      title: "Old account",
      content: OldContent,
    });
    await nextTick();
    agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    source.panels.messageDetails.select({
      id: "current",
      title: "Current account",
      content: CurrentContent,
    });
    await flushPromises();
    expect(source.panels.messageDetails.selectedDetail.value?.id).toBe(
      "current",
    );
    const heading = source.wrapper.get("#artifacts h2");
    expect(heading.text()).toBe("Current account");
    expect(document.activeElement).toBe(heading.element);
    expect(source.wrapper.get("#artifacts section").text()).toContain(
      "Current account data",
    );
    expect(source.wrapper.text()).not.toContain("Old account data");
  });
});
