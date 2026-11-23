import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { afterEach, beforeEach, expect, it, rstest } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

let styles: HTMLStyleElement;
beforeEach(() => {
  styles = document.createElement("style");
  // Presence must retain the closed popup just as the real exit animation does.
  styles.textContent =
    '[data-life-popup] { animation-name: enter; animation-duration: 200ms; } [data-life-popup][data-state="closed"] { animation-name: exit; }';
  document.head.append(styles);
});
afterEach(() => {
  cleanup();
  styles.remove();
});

function OwnedTooltip({
  name,
  controlled,
}: {
  name: string;
  controlled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Root {...(controlled ? { open, onOpenChange: setOpen } : {})}>
      <Tooltip.Trigger>{name}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content data-life-popup="" data-testid={`${name}-popup`}>
          {name} description
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

for (const modal of [true, false])
  it(`retains the actual Sheet host ref and frame boundaries during Tooltip layer updates, modal=${modal}`, async () => {
    const disposeHost = rstest.fn();
    const attachHost = rstest.fn((_host: HTMLDivElement | null) => disposeHost);
    const view = render(
      <Sheet defaultOpen modal={modal}>
        <SheetContent
          ref={attachHost}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetTitle>Frame owner</SheetTitle>
          <SheetDescription>
            Tooltip layer updates preserve the live host.
          </SheetDescription>
          <Tooltip.Provider delayDuration={0}>
            <OwnedTooltip name="First" controlled={false} />
            <OwnedTooltip name="Second" controlled={false} />
          </Tooltip.Provider>
          <iframe title="Report" srcDoc="<body tabindex='0'>Report</body>" />
          <button>Last action</button>
        </SheetContent>
      </Sheet>,
    );
    const host = screen.getByRole("dialog");
    const guards = () => [
      ...host.querySelectorAll("[data-dialog-focus-guard]"),
    ];
    await waitFor(() => expect(guards()).toHaveLength(2));
    const initialGuards = guards();
    attachHost.mockClear();
    disposeHost.mockClear();
    for (const name of ["First", "Second", "First"]) {
      const trigger = screen.getByRole("button", { name });
      act(() => trigger.focus());
      await waitFor(() =>
        expect(trigger.getAttribute("data-state")).toBe("instant-open"),
      );
      expect(screen.getByRole("dialog")).toBe(host);
      expect(attachHost).not.toHaveBeenCalled();
      expect(disposeHost).not.toHaveBeenCalled();
      expect(guards()).toEqual(initialGuards);
      expect(initialGuards.every((node) => node.isConnected)).toBe(true);
      expect(document.activeElement).toBe(trigger);
    }
    const first = screen.getByRole("button", { name: "First" });
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("closed"),
    );
    expect(attachHost).not.toHaveBeenCalled();
    expect(disposeHost).not.toHaveBeenCalled();
    expect(guards()).toEqual(initialGuards);
    view.unmount();
    expect(disposeHost).toHaveBeenCalledTimes(1);
    expect(initialGuards.every((node) => !node.isConnected)).toBe(true);
  });

for (const controlled of [false, true])
  it(`reopens its own exiting popup while closing other owners, controlled=${controlled}`, async () => {
    render(
      <Tooltip.Provider delayDuration={0}>
        <OwnedTooltip name="First" controlled={controlled} />
        <OwnedTooltip name="Second" controlled={controlled} />
        <button>Outside</button>
      </Tooltip.Provider>,
    );
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    act(() => first.focus());
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("instant-open"),
    );
    act(() => second.focus());
    await waitFor(() =>
      expect(second.getAttribute("data-state")).toBe("instant-open"),
    );
    expect(first.getAttribute("data-state")).toBe("closed");
    expect(screen.getByTestId("First-popup").getAttribute("data-state")).toBe(
      "closed",
    );
    act(() => first.focus());
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("instant-open"),
    );
    expect(second.getAttribute("data-state")).toBe("closed");
    expect(document.activeElement).toBe(first);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(first.getAttribute("data-state")).toBe("closed");
  });

it("retires closed tooltip layers before the next Escape reaches their containing modal", async () => {
  const originalPointerEvents = document.body.style.pointerEvents;
  render(
    <Dialog.Root defaultOpen>
      <Dialog.Trigger>Open modal</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content onOpenAutoFocus={(event) => event.preventDefault()}>
          <Dialog.Title>Tooltip host</Dialog.Title>
          <Dialog.Description>Controls with animated hints</Dialog.Description>
          <Tooltip.Provider delayDuration={0}>
            <OwnedTooltip name="First" controlled={false} />
            <OwnedTooltip name="Second" controlled={false} />
          </Tooltip.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
  );
  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });
  for (const trigger of [first, second, first]) {
    act(() => trigger.focus());
    await waitFor(() =>
      expect(trigger.getAttribute("data-state")).toBe("instant-open"),
    );
  }
  fireEvent.keyDown(first, { key: "Escape" });
  await waitFor(() => expect(first.getAttribute("data-state")).toBe("closed"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(document.activeElement).toBe(first);
  expect(document.body.style.pointerEvents).toBe("none");
  expect(screen.getByTestId("First-popup").getAttribute("data-state")).toBe(
    "closed",
  );
  expect(screen.getByTestId("Second-popup").getAttribute("data-state")).toBe(
    "closed",
  );
  fireEvent.keyDown(first, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open modal" }),
    ),
  );
  expect(document.body.style.pointerEvents).toBe(originalPointerEvents);
});

it("honors a caller preventing Escape and ignores the same key after the hint closes", async () => {
  const onEscape = rstest.fn((event: KeyboardEvent) => event.preventDefault());
  const onAllowedEscape = rstest.fn();
  function Example({ prevent }: { prevent: boolean }) {
    return (
      <Tooltip.Provider delayDuration={0}>
        <Tooltip.Root>
          <Tooltip.Trigger>Guarded</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              data-life-popup=""
              data-testid="guarded-popup"
              onEscapeKeyDown={prevent ? onEscape : onAllowedEscape}
            >
              Guarded description
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }
  const view = render(<Example prevent />);
  const trigger = screen.getByRole("button", { name: "Guarded" });
  act(() => trigger.focus());
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("instant-open"),
  );
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(onEscape).toHaveBeenCalledTimes(1);
  expect(trigger.getAttribute("data-state")).toBe("instant-open");
  view.rerender(<Example prevent={false} />);
  fireEvent.keyDown(trigger, { key: "Escape" });
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("closed"),
  );
  expect(onAllowedEscape).toHaveBeenCalledTimes(1);
  const popup = screen.getByTestId("guarded-popup");
  view.rerender(<Example prevent />);
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(onEscape).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("guarded-popup")).toBe(popup);
  expect(document.activeElement).toBe(trigger);
});

it("a force-mounted closed hint has no dismissal or outside interaction ownership", async () => {
  const onEscape = rstest.fn();
  const onOutside = rstest.fn();
  render(
    <Tooltip.Provider>
      <Tooltip.Root open={false}>
        <Tooltip.Trigger>Closed</Tooltip.Trigger>
        <Tooltip.Portal forceMount>
          <Tooltip.Content
            forceMount
            onEscapeKeyDown={onEscape}
            onPointerDownOutside={onOutside}
          >
            Force-mounted description
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <button>Outside</button>
    </Tooltip.Provider>,
  );
  // Radix arms outside-pointer detection one task after mounting.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const outside = screen.getByRole("button", { name: "Outside" });
  act(() => outside.focus());
  fireEvent.keyDown(outside, { key: "Escape" });
  fireEvent.pointerDown(outside, { pointerType: "mouse" });
  expect(onEscape).not.toHaveBeenCalled();
  expect(onOutside).not.toHaveBeenCalled();
  expect(screen.getByRole("tooltip")).toBeTruthy();
});

it("preserves outside-pointer cancellation and retires the callback when the hint closes", async () => {
  const preventedOutside = rstest.fn((event: Event) => event.preventDefault());
  const allowedOutside = rstest.fn();
  function Example({ prevent }: { prevent: boolean }) {
    return (
      <Tooltip.Provider delayDuration={0}>
        <Tooltip.Root>
          <Tooltip.Trigger>Pointer hint</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              data-life-popup=""
              data-testid="pointer-popup"
              onPointerDownOutside={prevent ? preventedOutside : allowedOutside}
            >
              Pointer description
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <button>Outside</button>
      </Tooltip.Provider>
    );
  }
  const view = render(<Example prevent />);
  const trigger = screen.getByRole("button", { name: "Pointer hint" });
  const outside = screen.getByRole("button", { name: "Outside" });
  act(() => trigger.focus());
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("instant-open"),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  fireEvent.pointerDown(outside, { pointerType: "mouse" });
  expect(preventedOutside).toHaveBeenCalledTimes(1);
  expect(trigger.getAttribute("data-state")).toBe("instant-open");
  view.rerender(<Example prevent={false} />);
  fireEvent.pointerDown(outside, { pointerType: "mouse" });
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("closed"),
  );
  expect(allowedOutside).toHaveBeenCalledTimes(1);
  const popup = screen.getByTestId("pointer-popup");
  fireEvent.pointerDown(outside, { pointerType: "mouse" });
  expect(allowedOutside).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("pointer-popup")).toBe(popup);
});

it("preserves close notifications from a tooltip without the new identity", async () => {
  render(
    <Tooltip.Provider delayDuration={0}>
      <OwnedTooltip name="Legacy peer" controlled={false} />
    </Tooltip.Provider>,
  );
  const trigger = screen.getByRole("button", { name: "Legacy peer" });
  act(() => trigger.focus());
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("instant-open"),
  );
  act(() => {
    document.dispatchEvent(new CustomEvent("tooltip.open"));
  });
  await waitFor(() =>
    expect(trigger.getAttribute("data-state")).toBe("closed"),
  );
});

it("closes a hovered peer when another tooltip opens without a blur", async () => {
  render(
    <Tooltip.Provider delayDuration={0}>
      <OwnedTooltip name="Hovered" controlled={false} />
      <OwnedTooltip name="Focused" controlled={false} />
    </Tooltip.Provider>,
  );
  const hovered = screen.getByRole("button", { name: "Hovered" });
  const focused = screen.getByRole("button", { name: "Focused" });
  fireEvent.pointerMove(hovered, { pointerType: "mouse" });
  await waitFor(() =>
    expect(hovered.getAttribute("data-state")).toBe("delayed-open"),
  );
  expect(document.activeElement).not.toBe(hovered);
  act(() => focused.focus());
  await waitFor(() =>
    expect(focused.getAttribute("data-state")).toBe("instant-open"),
  );
  expect(hovered.getAttribute("data-state")).toBe("closed");
});

for (const close of ["Escape", "ancestor scroll"])
  it(`preserves ${close} after reopening an exiting tooltip`, async () => {
    render(
      <Tooltip.Provider delayDuration={0}>
        <div data-testid="scroll-owner">
          <OwnedTooltip name="Reopened" controlled={false} />
        </div>
        <button>Outside</button>
        <div data-testid="unrelated-scroll" />
      </Tooltip.Provider>,
    );
    const trigger = screen.getByRole("button", { name: "Reopened" });
    act(() => trigger.focus());
    await waitFor(() =>
      expect(trigger.getAttribute("data-state")).toBe("instant-open"),
    );
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(trigger.getAttribute("data-state")).toBe("closed");
    act(() => trigger.focus());
    await waitFor(() =>
      expect(trigger.getAttribute("data-state")).toBe("instant-open"),
    );
    fireEvent.scroll(screen.getByTestId("unrelated-scroll"));
    expect(trigger.getAttribute("data-state")).toBe("instant-open");
    if (close === "Escape") fireEvent.keyDown(trigger, { key: "Escape" });
    else fireEvent.scroll(screen.getByTestId("scroll-owner"));
    await waitFor(() =>
      expect(trigger.getAttribute("data-state")).toBe("closed"),
    );
    expect(document.activeElement).toBe(trigger);
  });

for (const controlled of [false, true])
  it(`Escape closes the reopened owner while a later peer is still exiting, controlled=${controlled}`, async () => {
    render(
      <Tooltip.Provider delayDuration={0}>
        <OwnedTooltip name="First" controlled={controlled} />
        <OwnedTooltip name="Second" controlled={controlled} />
      </Tooltip.Provider>,
    );
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    act(() => first.focus());
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("instant-open"),
    );
    const firstPopup = screen.getByTestId("First-popup");
    act(() => second.focus());
    await waitFor(() =>
      expect(second.getAttribute("data-state")).toBe("instant-open"),
    );
    const secondPopup = screen.getByTestId("Second-popup");
    expect(firstPopup.getAttribute("data-state")).toBe("closed");
    act(() => first.focus());
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("instant-open"),
    );
    expect(screen.getByTestId("First-popup")).toBe(firstPopup);
    expect(screen.getByTestId("Second-popup")).toBe(secondPopup);
    expect(secondPopup.getAttribute("data-state")).toBe("closed");
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() =>
      expect(first.getAttribute("data-state")).toBe("closed"),
    );
    expect(document.activeElement).toBe(first);
    // Closing retires interaction ownership without discarding exit animation DOM.
    expect(screen.getByTestId("First-popup")).toBe(firstPopup);
    expect(firstPopup.getAttribute("data-state")).toBe("closed");
  });
