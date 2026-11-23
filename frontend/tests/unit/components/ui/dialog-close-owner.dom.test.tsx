import { afterEach, describe, expect, it } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// These mount the public component and installed Radix. No focus callback mock.
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 10));
});
async function fixture(
  options: {
    explicit?: boolean;
    close?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  } = {},
) {
  let update!: (state: {
    open: boolean;
    disabled?: boolean;
    removed?: boolean;
    inert?: boolean;
  }) => void;
  function Fixture() {
    const [state, setState] = useState({
      open: false,
      disabled: false,
      removed: false,
      inert: false,
    });
    update = (next) =>
      setState({ disabled: false, removed: false, inert: false, ...next });
    return (
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Parent</DialogTitle>
          <DialogDescription>Parent scope</DialogDescription>
          {!state.removed && (
            <span inert={state.inert}>
              <button
                disabled={state.disabled}
                data-opener
                onClick={() => update({ open: true })}
              >
                Opener
              </button>
            </span>
          )}
          <button data-newer>New owner</button>
          <input aria-label="Draft" defaultValue="preserved" />
          <Dialog open={state.open} onOpenChange={(open) => update({ open })}>
            {options.explicit && (
              <DialogTrigger>Explicit trigger</DialogTrigger>
            )}
            <DialogContent data-close-child="" onCloseAutoFocus={options.close}>
              <DialogTitle>Child</DialogTitle>
              <DialogDescription>Child scope</DialogDescription>
              <button data-confirm onClick={() => update({ open: false })}>
                Confirm
              </button>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  }
  const mounted = render(<Fixture />);
  const opener = document.querySelector<HTMLButtonElement>("[data-opener]")!;
  const newer = document.querySelector<HTMLButtonElement>("[data-newer]")!;
  act(() => opener.focus());
  fireEvent.click(opener);
  await waitFor(() =>
    expect(document.querySelector("[data-confirm]")).not.toBeNull(),
  );
  const child = document
    .querySelector<HTMLElement>("[data-confirm]")!
    .closest<HTMLElement>('[role="dialog"]')!;
  await waitFor(() =>
    expect(child.contains(document.activeElement)).toBe(true),
  );
  const close = async () => {
    act(() => update({ open: false }));
    await waitFor(() => expect(child.isConnected).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };
  return { ...mounted, opener, newer, child, update, close };
}

describe("Dialog nested close owner", () => {
  it("returns a programmatic dialog to the actual opener", async () => {
    const f = await fixture();
    await f.close();
    expect(document.activeElement).toBe(f.opener);
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="Draft"]')!
        .value,
    ).toBe("preserved");
  });
  it("returns after a pending disabled opener becomes enabled at completion", async () => {
    const f = await fixture();
    act(() => f.update({ open: true, disabled: true }));
    expect(f.opener.disabled).toBe(true);
    await f.close();
    expect(document.activeElement).toBe(f.opener);
  });
  it("returns on Escape while preserving the parent modal", async () => {
    const f = await fixture();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(f.child.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(f.opener));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
  it("retains an explicit trigger's declared ownership", async () => {
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
  it("does not steal a newer focus acquired before deferred close autofocus", async () => {
    const f = await fixture();
    act(() => f.update({ open: false }));
    act(() => f.newer.focus());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(f.newer);
  });
  it("does not restore an opener whose owner unmounted", async () => {
    const f = await fixture();
    f.unmount();
    const route = document.createElement("button");
    document.body.append(route);
    route.focus();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(route);
    route.remove();
  });
  for (const state of ["removed", "disabled", "inert"] as const) {
    it(`uses the surviving parent when the opener is ${state}`, async () => {
      const f = await fixture();
      act(() => f.update({ open: false, [state]: true }));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const parent = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(document.activeElement).toBe(parent);
    });
  }
  it("does not let an old close steal focus from a reopened child", async () => {
    const f = await fixture();
    act(() => f.update({ open: false }));
    act(() => f.update({ open: true }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(
      document
        .querySelector("[data-confirm]")
        ?.closest('[role="dialog"]')
        ?.contains(document.activeElement),
    ).toBe(true);
  });

  for (const newer of [false, true])
    it(`retains animated child until exit and preserves ${newer ? "new focus" : "opener"}`, async () => {
      const style = document.createElement("style");
      style.textContent =
        '[data-close-child] {animation-name: enter; animation-duration:200ms;} [data-close-child][data-state="closed"] {animation-name:exit;}';
      document.head.append(style);
      try {
        const f = await fixture();
        const start = new Event("animationstart", { bubbles: true });
        Object.defineProperty(start, "animationName", { value: "enter" });
        f.child.dispatchEvent(start);
        act(() => f.update({ open: false }));
        expect(f.child.isConnected).toBe(true);
        if (newer) act(() => f.newer.focus());
        const end = new Event("animationend", { bubbles: true });
        Object.defineProperty(end, "animationName", { value: "exit" });
        act(() => {
          f.child.dispatchEvent(end);
        });
        await waitFor(() => expect(f.child.isConnected).toBe(false));
        await waitFor(() =>
          expect(document.activeElement).toBe(newer ? f.newer : f.opener),
        );
      } finally {
        style.remove();
      }
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

for (const newer of ["none", "control", "scope"] as const) {
  it(`restores surviving outer trigger when both scopes depart unless newer ${newer} owns focus`, async () => {
    let close!: () => void;
    function Fixture() {
      const [parent, setParent] = useState(false);
      const [child, setChild] = useState(false);
      const [next, setNext] = useState(false);
      close = () => {
        setParent(false);
        if (newer === "scope") setNext(true);
      };
      return (
        <>
          <button data-route>Route</button>
          <Dialog open={parent} onOpenChange={setParent}>
            <DialogTrigger data-outer>Outer opener</DialogTrigger>
            <DialogContent>
              <DialogTitle>Parent</DialogTitle>
              <DialogDescription>Parent scope</DialogDescription>
              <button data-open-child onClick={() => setChild(true)}>
                Child opener
              </button>
              <Dialog open={child}>
                <DialogContent>
                  <DialogTitle>Child</DialogTitle>
                  <DialogDescription>Child scope</DialogDescription>
                  <button data-child-focus>Child control</button>
                </DialogContent>
              </Dialog>
            </DialogContent>
          </Dialog>
          <Dialog open={next}>
            <DialogContent>
              <DialogTitle>New scope</DialogTitle>
              <DialogDescription>New scope description</DialogDescription>
              <button data-new-scope>New control</button>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Fixture />);
    const opener = document.querySelector<HTMLButtonElement>("[data-outer]")!;
    act(() => opener.focus());
    fireEvent.click(opener);
    const childOpener =
      document.querySelector<HTMLButtonElement>("[data-open-child]")!;
    act(() => childOpener.focus());
    fireEvent.click(childOpener);
    act(() =>
      document.querySelector<HTMLButtonElement>("[data-child-focus]")!.focus(),
    );
    act(() => close());
    const route = document.querySelector<HTMLButtonElement>("[data-route]")!;
    if (newer === "control") act(() => route.focus());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
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
