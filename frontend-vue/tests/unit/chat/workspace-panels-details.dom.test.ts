import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import MessageDetailsPanel from "@/components/workspace/message-details/MessageDetailsPanel.vue";
import { provideMessageDetails } from "@/components/workspace/message-details/context";
import { enUS } from "@/core/i18n/locales/en-US";

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("exposes the real splitter and preserves the detail owner's explicit return focus when closing", async () => {
  let details!: ReturnType<typeof provideMessageDetails>;
  const Content = defineComponent({ setup: () => () => h("p", "Snapshot") });
  const wrapper = mount(
    defineComponent({
      setup() {
        details = provideMessageDetails("thread-a");
        return () =>
          h(
            WorkspacePanels,
            {
              open: details.open.value,
              panelSize: 35,
              onCollapse: () => details.close(),
            },
            {
              main: () =>
                h(
                  "button",
                  {
                    "aria-label": "Used skills",
                    onClick: (event: MouseEvent) =>
                      details.select(
                        { id: "s1", title: "SKILL.md", content: Content },
                        event.currentTarget as HTMLElement,
                      ),
                  },
                  "Skills",
                ),
              panel: () => h(MessageDetailsPanel),
            },
          );
      },
    }),
    { attachTo: document.body },
  );
  await flushPromises();
  const handle = wrapper.get('[data-slot="resizable-handle"]');
  expect(handle.attributes("aria-disabled")).toBe("true");
  const trigger = wrapper.get('button[aria-label="Used skills"]');
  await trigger.trigger("click");
  await flushPromises();
  expect(handle.attributes("aria-disabled")).toBeUndefined();
  expect(wrapper.get("h2").element).toBe(document.activeElement);
  await wrapper.get("section").trigger("keydown", { key: "Escape" });
  await flushPromises();
  expect(document.activeElement).toBe(trigger.element);
  expect(handle.attributes("tabindex")).toBe("-1");
  wrapper.unmount();
});
