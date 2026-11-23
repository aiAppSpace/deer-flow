import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const wrappers: VueWrapper[] = [];
afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await flushPromises();
  document.body.replaceChildren();
});
async function setup(
  kind:
    "button" | "input" | "empty" | "custom" | "links" | "redirect" | "radio",
  onOpenAutoFocus?: (event: Event) => void,
) {
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Dialog, { defaultOpen: true }, () =>
          h(
            DialogContent,
            {
              closeLabel: "Close",
              showClose: kind !== "empty",
              onOpenAutoFocus:
                onOpenAutoFocus ??
                (kind === "custom"
                  ? (event: Event) => {
                      event.preventDefault();
                      document
                        .querySelector<HTMLElement>("[data-help]")!
                        .focus();
                    }
                  : undefined),
            },
            () => [
              h(DialogTitle, () => "Plugin settings"),
              h(
                DialogDescription,
                () => "Choose an action or read setup instructions.",
              ),
              h(
                "a",
                { href: "https://example.test/setup", "data-help": "" },
                "Setup documentation",
              ),
              ...(kind === "button" ? [h("button", "Install")] : []),
              ...(kind === "input"
                ? [h("input", { value: "existing name" })]
                : []),
              ...(kind === "radio"
                ? [
                    h("input", {
                      type: "radio",
                      name: "scope",
                      value: "first",
                    }),
                    h("input", {
                      type: "radio",
                      name: "scope",
                      value: "second",
                      checked: true,
                    }),
                  ]
                : []),
              ...(kind === "redirect"
                ? [
                    h(
                      "button",
                      {
                        onFocus: () =>
                          document
                            .querySelector<HTMLElement>("[data-help]")!
                            .focus(),
                      },
                      "Redirect to help",
                    ),
                    h("button", "Later action"),
                  ]
                : []),
            ],
          ),
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
  return document.querySelector<HTMLElement>('[role="dialog"]')!;
}

it("starts on the first action while keeping the preceding setup link available", async () => {
  const host = await setup("button");
  expect(document.activeElement?.textContent).toBe("Install");
  expect(host.querySelector<HTMLAnchorElement>("[data-help]")!.tabIndex).toBe(
    0,
  );
});
it("selects editable initial input text", async () => {
  const host = await setup("input");
  const input = host.querySelector("input")!;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
});
it("uses the content host when there are only informational links", async () => {
  const host = await setup("empty");
  expect(document.activeElement).toBe(host);
});
it("honors an explicit caller target and cancellation", async () => {
  const host = await setup("custom");
  expect(document.activeElement).toBe(host.querySelector("[data-help]"));
});

it("starts on Close when documentation is the only preceding content", async () => {
  const host = await setup("links");
  expect(document.activeElement).toBe(
    host.querySelector('[data-slot="dialog-close"]'),
  );
});
it("leaves a focus-handler redirect on its chosen link", async () => {
  const host = await setup("redirect");
  expect(document.activeElement).toBe(host.querySelector("[data-help]"));
});
it("lets the caller cancel before default focus without supplying a new target", async () => {
  const previous = document.activeElement;
  let received: Event | undefined;
  let wasPrevented: boolean | undefined;
  const host = await setup("button", (event) => {
    received = event;
    wasPrevented = event.defaultPrevented;
    event.preventDefault();
  });
  expect(received?.target).toBe(host);
  expect(wasPrevented).toBe(false);
  expect(document.activeElement).toBe(previous);
});

it("enters the first same-name radio without changing the checked option", async () => {
  const host = await setup("radio");
  const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(document.activeElement).toBe(radios[0]);
  expect(radios[0]!.checked).toBe(false);
  expect(radios[1]!.checked).toBe(true);
});

it("keeps radio boundary wrapping on the checked option after initial entry", async () => {
  const host = await setup("radio");
  host.querySelector("[data-help]")!.remove();
  host.querySelector('[data-slot="dialog-close"]')!.remove();
  await flushPromises();
  const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  for (const edge of ["start", "end"]) {
    host
      .querySelector<HTMLElement>(`[data-dialog-focus-sentinel="${edge}"]`)!
      .focus();
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[0]!.checked).toBe(false);
    expect(radios[1]!.checked).toBe(true);
  }
});
