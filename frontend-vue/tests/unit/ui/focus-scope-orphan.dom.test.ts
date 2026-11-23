import { flushPromises, mount } from "@vue/test-utils";
import { FocusScope } from "reka-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  vi.useFakeTimers();
  wrappers
    .splice(0)
    .reverse()
    .forEach((wrapper) => wrapper.unmount());
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
  await flushPromises();
});

// Happy DOM does not blur when disabled is assigned. Model Chromium's observed
// native null-relatedTarget blur before disabling (disabled blur is also a no-op
// here); keep the real component and MutationObserver intact.
function disableAndBlur(button: HTMLButtonElement) {
  button.blur();
  button.disabled = true;
  expect(button.isConnected).toBe(true);
  expect(document.activeElement).toBe(document.body);
}

async function scope(options: Record<string, unknown> = {}) {
  const wrapper = mount(FocusScope, {
    props: { trapped: true, ...options },
    slots: {
      default: () => [
        h("button", { "data-action": "" }, "Install"),
        h("span", "Loading"),
        h("input", { "aria-label": "New draft" }),
      ],
    },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  await flushPromises();
  return {
    wrapper,
    host: wrapper.element as HTMLElement,
    button: wrapper.get("button").element as HTMLButtonElement,
    child: wrapper.get("span").element,
    input: wrapper.get("input").element as HTMLInputElement,
  };
}

async function settleMutations() {
  await flushPromises();
  await flushPromises();
}

describe("maintained Reka FocusScope orphan recovery", () => {
  it("characterizes Happy DOM disabled focus separately from Chromium", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    button.disabled = true;
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("recovers a retained disabled control after a child is removed", async () => {
    const { host, button, child } = await scope();
    button.focus();
    disableAndBlur(button);
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
    expect(host.contains(button)).toBe(true);
  });

  it("recovers the same orphan in the actual application Dialog", async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(Dialog, { open: true }, () =>
            h(DialogContent, { closeLabel: "Close" }, () => [
              h(DialogTitle, () => "Install integration"),
              h(DialogDescription, () => "Installing"),
              h("button", { "data-install": "" }, "Install"),
              h("span", { "data-loading": "" }, "Loading"),
            ]),
          ),
      }),
      { attachTo: document.body },
    );
    wrappers.push(wrapper);
    await flushPromises();
    const host = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const button = host.querySelector<HTMLButtonElement>("[data-install]")!;
    button.focus();
    disableAndBlur(button);
    host.querySelector("[data-loading]")!.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
  });

  it("preserves recovery when the previously focused control itself is removed", async () => {
    const { host, button } = await scope();
    button.focus();
    button.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
  });

  it("does not restore for attribute changes or additions without removal", async () => {
    const { host, button } = await scope();
    button.focus();
    disableAndBlur(button);
    host.setAttribute("data-loading", "true");
    host.append(document.createElement("span"));
    await settleMutations();
    expect(document.activeElement).toBe(document.body);
  });

  it("preserves a newer interior input after the old focused control is removed", async () => {
    const { button, input } = await scope();
    button.focus();
    input.focus();
    input.setSelectionRange(0, 0);
    button.remove();
    await settleMutations();
    expect(document.activeElement).toBe(input);
  });

  it("does not let a paused outer scope steal focus from a live nested scope", async () => {
    const outer = await scope();
    outer.button.focus();
    const inner = await scope();
    inner.input.focus();
    outer.button.remove();
    await settleMutations();
    expect(document.activeElement).toBe(inner.input);
  });

  it("leaves a paused outer scope inactive when inner autofocus is canceled on body", async () => {
    const outer = await scope();
    outer.button.focus();
    disableAndBlur(outer.button);
    await scope({ onMountAutoFocus: (event: Event) => event.preventDefault() });
    outer.child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(document.body);
  });

  it("resumes the outer trap after the nested scope actually unmounts", async () => {
    const outer = await scope();
    const inner = await scope();
    // Reka removes the inner scope in its existing zero-delay unmount task.
    // Drain that lifecycle explicitly before testing the resumed owner.
    vi.useFakeTimers();
    inner.wrapper.unmount();
    wrappers.splice(wrappers.indexOf(inner.wrapper), 1);
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    await flushPromises();
    outer.button.focus();
    disableAndBlur(outer.button);
    outer.child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(outer.host);
  });

  it.each([{ trapped: false }, { present: false }])(
    "does not recover after ownership is deactivated: %j",
    async (props) => {
      const { wrapper, button, child } = await scope();
      button.focus();
      await wrapper.setProps(props);
      disableAndBlur(button);
      child.remove();
      await settleMutations();
      expect(document.activeElement).toBe(document.body);
    },
  );

  it("does not take focus while initially hidden, and recovers once present", async () => {
    const { wrapper, button, child, host } = await scope({ present: false });
    expect(document.activeElement).toBe(document.body);
    await wrapper.setProps({ present: true });
    await flushPromises();
    button.focus();
    disableAndBlur(button);
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
  });

  it("honors caller autofocus cancellation until the scope has owned focus", async () => {
    const { child } = await scope({
      onMountAutoFocus: (event: Event) => event.preventDefault(),
    });
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(document.body);
  });

  it("does not recover from a previous opening after the caller cancels reopen autofocus", async () => {
    let cancelReopen = false;
    let mountCount = 0;
    const { wrapper, button, child } = await scope({
      onMountAutoFocus: (event: Event) => {
        mountCount++;
        if (cancelReopen) event.preventDefault();
      },
    });
    button.focus();
    await wrapper.setProps({ present: false });
    button.blur();
    expect(document.activeElement).toBe(document.body);
    cancelReopen = true;
    await wrapper.setProps({ present: true });
    await flushPromises();
    expect(mountCount).toBe(2);
    expect(document.activeElement).toBe(document.body);
    expect(button.isConnected).toBe(true);
    expect(button.disabled).toBe(false);
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(document.body);
  });

  it("recovers current-lifetime focus acquired after canceled reopen autofocus", async () => {
    let cancelReopen = false;
    const { wrapper, host, button, child } = await scope({
      onMountAutoFocus: (event: Event) => {
        if (cancelReopen) event.preventDefault();
      },
    });
    button.focus();
    await wrapper.setProps({ present: false });
    button.blur();
    cancelReopen = true;
    await wrapper.setProps({ present: true });
    await flushPromises();
    expect(document.activeElement).toBe(document.body);
    button.focus();
    expect(document.activeElement).toBe(button);
    disableAndBlur(button);
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
  });

  it("owns an already focused interior candidate when the same scope becomes present again", async () => {
    const { wrapper, host, button, child } = await scope();
    button.focus();
    await wrapper.setProps({ present: false });
    expect(document.activeElement).toBe(button);
    await wrapper.setProps({ present: true });
    await flushPromises();
    expect(document.activeElement).toBe(button);
    disableAndBlur(button);
    child.remove();
    await settleMutations();
    expect(document.activeElement).toBe(host);
  });

  it("preserves a newer redirected external target in a non-trapping child scope", async () => {
    const outer = await scope();
    outer.button.focus();
    const inner = await scope({ trapped: false });
    inner.input.focus();
    outer.button.remove();
    await settleMutations();
    expect(document.activeElement).toBe(inner.input);
  });

  it("preserves an intentional external target chosen after the old control is removed", async () => {
    const { button } = await scope();
    const external = document.createElement("input");
    document.body.append(external);
    try {
      button.focus();
      button.remove();
      external.focus();
      expect(document.activeElement).toBe(external);
      await settleMutations();
      expect(document.activeElement).toBe(external);
    } finally {
      external.remove();
    }
  });

  it("does not let removal in an inactive present=false scope rob a live external input", async () => {
    const { wrapper, button } = await scope();
    button.focus();
    await wrapper.setProps({ present: false });
    const external = document.createElement("input");
    document.body.append(external);
    try {
      button.remove();
      external.focus();
      await settleMutations();
      expect(document.activeElement).toBe(external);
    } finally {
      external.remove();
    }
  });

  it("does not recover into a closed force-mounted dialog", async () => {
    const open = ref(true);
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(Dialog, { open: open.value }, () =>
            h(
              DialogContent,
              {
                forceMount: true,
                closeLabel: "Close",
                onCloseAutoFocus: (event: Event) => event.preventDefault(),
              },
              () => [
                h(DialogTitle, () => "Install integration"),
                h(DialogDescription, () => "Installing"),
                h("button", { "data-install": "" }, "Install"),
                h("span", { "data-loading": "" }, "Loading"),
              ],
            ),
          ),
      }),
      { attachTo: document.body },
    );
    wrappers.push(wrapper);
    await flushPromises();
    const host = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const button = host.querySelector<HTMLButtonElement>("[data-install]")!;
    button.focus();
    open.value = false;
    await nextTick();
    disableAndBlur(button);
    host.querySelector("[data-loading]")!.remove();
    await settleMutations();
    expect(document.activeElement).toBe(document.body);
  });
});
