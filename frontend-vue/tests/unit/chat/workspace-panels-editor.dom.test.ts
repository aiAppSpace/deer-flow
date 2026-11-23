import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { EditorView } from "@codemirror/view";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import CodeEditor from "@/components/ui/code-editor/CodeEditor.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});

function press(
  element: HTMLElement,
  key: string,
  modifiers: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    keyCode: key === "Escape" ? 27 : key.toUpperCase().charCodeAt(0),
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  element.dispatchEvent(event);
  return event;
}

async function setup() {
  const open = ref(true);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          WorkspacePanels,
          {
            open: open.value,
            panelSize: 35,
            panelKey: "artifacts",
            onCollapse: () => {
              open.value = false;
            },
          },
          {
            main: () => h("button", "Chat"),
            panel: () =>
              h(CodeEditor, { modelValue: "alpha beta", autofocus: true }),
          },
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await expect.poll(() => wrapper.find(".cm-content").exists()).toBe(true);
  await flushPromises();
  await expect.poll(() => wrapper.find("textarea").exists()).toBe(false);
  const view = EditorView.findFromDOM(
    wrapper.get(".cm-content").element as HTMLElement,
  );
  if (!view) throw new Error("real editor missing");
  return { open, view, wrapper };
}

describe("desktop panel keyboard ownership", () => {
  it("leaves native search Escape and restored editor focus with CodeMirror", async () => {
    const { open, view, wrapper } = await setup();
    const mod = /Mac/.test(navigator.platform)
      ? { metaKey: true }
      : { ctrlKey: true };
    press(view.contentDOM, "f", mod);
    const search = view.dom.querySelector<HTMLInputElement>(
      '.cm-search input[name="search"]',
    );
    expect(search).not.toBeNull();
    // The native suite checks search autofocus; focus its actual input here
    // to isolate the bubbling Escape and the enclosing panel's ownership.
    search!.focus();
    expect(document.activeElement).toBe(search);
    expect(press(search!, "Escape").defaultPrevented).toBe(true);
    await flushPromises();
    expect(view.dom.querySelector(".cm-search")).toBeNull();
    expect(open.value).toBe(true);
    expect(wrapper.get("#artifacts").attributes("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(view.contentDOM);
  });

  it("does not add a desktop-wide Escape dismissal absent from React", async () => {
    const { open, view } = await setup();
    press(view.contentDOM, "Escape");
    await flushPromises();
    expect(open.value).toBe(true);
  });
});
