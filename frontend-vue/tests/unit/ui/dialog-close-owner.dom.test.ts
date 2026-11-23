import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
const wrappers: ReturnType<typeof mount>[] = [];
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
}
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  await settle();
});
async function fixture(
  options: {
    explicit?: boolean;
    retained?: boolean;
    close?: (event: Event) => void;
  } = {},
) {
  const open = ref(false);
  const disabled = ref(false);
  const removed = ref(false);
  const inert = ref(false);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Dialog, { open: true }, () =>
          h(DialogContent, { closeLabel: "Close" }, () => [
            h(DialogTitle, () => "Parent"),
            h(DialogDescription, () => "Parent scope"),
            removed.value
              ? null
              : h("span", { inert: inert.value }, [
                  h(
                    "button",
                    {
                      "data-opener": "",
                      disabled: disabled.value,
                      onClick: () => (open.value = true),
                    },
                    "Opener",
                  ),
                ]),
            h("button", { "data-newer": "" }, "New owner"),
            h("input", { "aria-label": "Draft", value: "preserved" }),
            h(
              Dialog,
              {
                open: open.value,
                unmountOnHide: !options.retained,
                "onUpdate:open": (next: boolean) => (open.value = next),
              },
              () => [
                options.explicit
                  ? h(DialogTrigger, () => h("button", "Explicit trigger"))
                  : null,
                h(
                  DialogContent,
                  {
                    closeLabel: "Close",
                    "data-close-child": "",
                    onCloseAutoFocus: options.close,
                  },
                  () => [
                    h(DialogTitle, () => "Child"),
                    h(DialogDescription, () => "Child scope"),
                    h(
                      "button",
                      {
                        "data-confirm": "",
                        onClick: () => (open.value = false),
                      },
                      "Confirm",
                    ),
                  ],
                ),
              ],
            ),
          ]),
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await settle();
  const opener = document.querySelector<HTMLButtonElement>("[data-opener]")!;
  const newer = document.querySelector<HTMLButtonElement>("[data-newer]")!;
  opener.focus();
  opener.click();
  await settle();
  const child = document
    .querySelector("[data-confirm]")!
    .closest<HTMLElement>('[role="dialog"]')!;
  expect(child.contains(document.activeElement)).toBe(true);
  const close = async () => {
    disabled.value = false;
    open.value = false;
    await settle();
    expect(child.isConnected).toBe(!!options.retained);
  };
  return {
    wrapper,
    open,
    disabled,
    removed,
    inert,
    opener,
    newer,
    child,
    close,
  };
}
describe("Dialog nested close owner", () => {
  it("returns a programmatic dialog to its actual opener", async () => {
    const f = await fixture();
    await f.close();
    expect(document.activeElement).toBe(f.opener);
  });
  it("returns after a pending disabled opener becomes enabled at completion", async () => {
    const f = await fixture();
    f.disabled.value = true;
    await settle();
    expect(f.opener.disabled).toBe(true);
    await f.close();
    expect(document.activeElement).toBe(f.opener);
  });
  it("returns on Escape and preserves the parent modal", async () => {
    const f = await fixture();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle();
    expect(f.child.isConnected).toBe(false);
    expect(document.activeElement).toBe(f.opener);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
  it("retains explicit trigger ownership over a programmatic active element", async () => {
    const f = await fixture({ explicit: true });
    await f.close();
    expect(document.activeElement?.textContent).toBe("Explicit trigger");
  });
  it("honors caller preventDefault without restoring the opener", async () => {
    const f = await fixture({ close: (event) => event.preventDefault() });
    await f.close();
    expect(document.activeElement).not.toBe(f.opener);
  });
  it("honors caller redirection with preventDefault", async () => {
    const f = await fixture({
      close: (event) => {
        event.preventDefault();
        f.newer.focus();
      },
    });
    await f.close();
    expect(document.activeElement).toBe(f.newer);
  });
  it("does not restore an opener whose owner unmounted", async () => {
    const f = await fixture();
    f.wrapper.unmount();
    const route = document.createElement("button");
    document.body.append(route);
    route.focus();
    await settle();
    expect(document.activeElement).toBe(route);
    route.remove();
  });
  it("honors preventDefault for a retained content close", async () => {
    const f = await fixture({
      retained: true,
      close: (event) => event.preventDefault(),
    });
    await f.close();
    expect(document.activeElement).not.toBe(f.opener);
  });
  it("honors redirect for a retained content close", async () => {
    const f = await fixture({
      retained: true,
      close: (event) => {
        event.preventDefault();
        f.newer.focus();
      },
    });
    await f.close();
    expect(document.activeElement).toBe(f.newer);
  });
  it("captures each retained programmatic opening separately", async () => {
    const f = await fixture({ retained: true });
    await f.close();
    f.newer.focus();
    f.open.value = true;
    await settle();
    await f.close();
    expect(document.activeElement).toBe(f.newer);
  });
  it("does not steal new focus after retained content closes", async () => {
    const f = await fixture({ retained: true });
    f.open.value = false;
    await flushPromises();
    f.newer.focus();
    await settle();
    expect(document.activeElement).toBe(f.newer);
  });
  for (const newer of [false, true])
    it(`retains animated child until exit and preserves ${newer ? "new focus" : "opener"}`, async () => {
      const style = document.createElement("style");
      style.textContent =
        '[data-close-child] {animation-name:enter;animation-duration:200ms;} [data-close-child][data-state="closed"] {animation-name:exit;}';
      document.head.append(style);
      try {
        const f = await fixture();
        const start = new Event("animationstart", { bubbles: true });
        Object.defineProperty(start, "animationName", { value: "enter" });
        f.child.dispatchEvent(start);
        f.open.value = false;
        await flushPromises();
        expect(f.child.isConnected).toBe(true);
        if (newer) f.newer.focus();
        const end = new Event("animationend", { bubbles: true });
        Object.defineProperty(end, "animationName", { value: "exit" });
        f.child.dispatchEvent(end);
        await settle();
        expect(f.child.isConnected).toBe(false);
        expect(document.activeElement).toBe(newer ? f.newer : f.opener);
      } finally {
        style.remove();
      }
    });
  for (const state of ["removed", "disabled", "inert"] as const)
    it(`returns to the parent when the opener is ${state}`, async () => {
      const f = await fixture();
      f[state].value = true;
      f.open.value = false;
      await settle();
      expect(document.activeElement).toBe(
        document.querySelector('[role="dialog"]'),
      );
    });
  it("does not let a retired child close restore into a reopened child", async () => {
    const f = await fixture();
    f.open.value = false;
    await flushPromises();
    f.open.value = true;
    await settle();
    expect(
      document
        .querySelector("[data-confirm]")
        ?.closest('[role="dialog"]')
        ?.contains(document.activeElement),
    ).toBe(true);
  });
  for (const state of ["removed", "disabled", "inert"] as const)
    it(`ignores an explicit trigger that became ${state}`, async () => {
      const f = await fixture({ explicit: true });
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-slot="dialog-trigger"]',
      )!;
      if (state === "removed") trigger.remove();
      else if (state === "disabled") trigger.disabled = true;
      else trigger.setAttribute("inert", "");
      await f.close();
      expect(document.activeElement).toBe(f.opener);
    });
});

async function nonModalFixture(
  options: { explicit?: boolean; retained?: boolean; cancel?: boolean } = {},
) {
  const open = ref(false);
  const events: Event[] = [];
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h("div", [
          h(
            "button",
            { "data-nonmodal-opener": "", onClick: () => (open.value = true) },
            "Open nonmodal",
          ),
          h("button", { "data-outside": "" }, "Outside"),
          h(
            Dialog,
            {
              open: open.value,
              modal: false,
              unmountOnHide: !options.retained,
              "onUpdate:open": (next: boolean) => (open.value = next),
            },
            () => [
              options.explicit
                ? h(DialogTrigger, () =>
                    h("button", { "data-explicit": "" }, "Declared opener"),
                  )
                : null,
              h(
                DialogContent,
                {
                  closeLabel: "Close",
                  onCloseAutoFocus: (event: Event) => {
                    events.push(event);
                    if (options.cancel) event.preventDefault();
                  },
                },
                () => [
                  h(DialogTitle, () => "Nonmodal"),
                  h(DialogDescription, () => "Nonmodal scope"),
                  h(
                    "button",
                    {
                      "data-nonmodal-close": "",
                      onClick: () => (open.value = false),
                    },
                    "Finish",
                  ),
                ],
              ),
            ],
          ),
        ]),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await settle();
  const opener = document.querySelector<HTMLButtonElement>(
    "[data-nonmodal-opener]",
  )!;
  opener.focus();
  opener.click();
  await settle();
  const closeButton = document.querySelector<HTMLButtonElement>(
    "[data-nonmodal-close]",
  )!;
  closeButton.focus();
  return {
    open,
    opener,
    events,
    closeButton,
    outside: document.querySelector<HTMLButtonElement>("[data-outside]")!,
  };
}
describe("public nonmodal close ownership", () => {
  for (const retained of [false, true]) {
    it(`restores the captured programmatic opener with retained=${retained}`, async () => {
      const f = await nonModalFixture({ retained });
      f.closeButton.click();
      await settle();
      expect(document.activeElement).toBe(f.opener);
      expect(f.events).toHaveLength(1);
    });
    it(`preserves the declared trigger with retained=${retained}`, async () => {
      const f = await nonModalFixture({ retained, explicit: true });
      f.closeButton.click();
      await settle();
      expect(document.activeElement).toBe(
        document.querySelector("[data-explicit]"),
      );
      expect(f.events).toHaveLength(1);
    });
    it(`honors caller cancellation with retained=${retained}`, async () => {
      const f = await nonModalFixture({
        retained,
        explicit: true,
        cancel: true,
      });
      f.closeButton.click();
      await settle();
      expect(f.events).toHaveLength(1);
      expect(document.activeElement).not.toBe(
        document.querySelector("[data-explicit]"),
      );
    });
    for (const explicit of [false, true])
      it(`preserves outside interaction with retained=${retained} explicit=${explicit}`, async () => {
        const f = await nonModalFixture({ retained, explicit });
        f.outside.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
        );
        f.outside.focus();
        await settle();
        expect(f.open.value).toBe(false);
        expect(document.activeElement).toBe(f.outside);
      });
  }
});

for (const newer of ["none", "control", "scope"] as const) {
  it(`restores surviving outer trigger when both scopes depart unless newer ${newer} owns focus`, async () => {
    const parentOpen = ref(false);
    const childOpen = ref(false);
    const newOpen = ref(false);
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h("div", [
            h("button", { "data-route": "" }, "Route"),
            h(
              Dialog,
              {
                open: parentOpen.value,
                "onUpdate:open": (v: boolean) => (parentOpen.value = v),
              },
              () => [
                h(DialogTrigger, () =>
                  h("button", { "data-outer": "" }, "Outer opener"),
                ),
                h(DialogContent, { closeLabel: "Close" }, () => [
                  h(DialogTitle, () => "Parent"),
                  h(DialogDescription, () => "Parent scope"),
                  h(
                    "button",
                    {
                      "data-open-child": "",
                      onClick: () => (childOpen.value = true),
                    },
                    "Child opener",
                  ),
                  h(Dialog, { open: childOpen.value }, () =>
                    h(DialogContent, { closeLabel: "Close" }, () => [
                      h(DialogTitle, () => "Child"),
                      h(DialogDescription, () => "Child scope"),
                      h("button", { "data-child-focus": "" }, "Child control"),
                    ]),
                  ),
                ]),
              ],
            ),
            h(Dialog, { open: newOpen.value }, () =>
              h(DialogContent, { closeLabel: "Close" }, () => [
                h(DialogTitle, () => "New scope"),
                h(DialogDescription, () => "New scope description"),
                h("button", { "data-new-scope": "" }, "New control"),
              ]),
            ),
          ]),
      }),
      { attachTo: document.body },
    );
    wrappers.push(wrapper);
    await settle();
    const opener = document.querySelector<HTMLButtonElement>("[data-outer]")!;
    opener.focus();
    opener.click();
    await settle();
    const childOpener =
      document.querySelector<HTMLButtonElement>("[data-open-child]")!;
    childOpener.focus();
    childOpener.click();
    await settle();
    document.querySelector<HTMLButtonElement>("[data-child-focus]")!.focus();
    parentOpen.value = false;
    if (newer === "scope") newOpen.value = true;
    await flushPromises();
    const route = document.querySelector<HTMLButtonElement>("[data-route]")!;
    if (newer === "control") route.focus();
    await settle();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(
      newer === "scope" ? 1 : 0,
    );
    expect(document.activeElement).toBe(
      newer === "scope"
        ? document.querySelector("[data-new-scope]")
        : newer === "control"
          ? route
          : opener,
    );
  });
}
