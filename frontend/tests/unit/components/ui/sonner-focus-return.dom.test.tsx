import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

rs.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
import { Toaster } from "@/components/ui/sonner";

afterEach(() => {
  cleanup();
  toast.dismiss();
  rs.restoreAllMocks();
  document.body.innerHTML = "";
});

async function setup() {
  const entry = document.createElement("button");
  const other = document.createElement("button");
  document.body.append(entry, other);
  entry.textContent = "Entry";
  other.textContent = "Other";
  const reveal = rs
    .spyOn(entry, "scrollIntoView")
    .mockImplementation(() => undefined);
  const wrapper = render(<Toaster />);
  act(() => {
    toast.success("Saved notice", { duration: 60_000 });
  });
  const text = await screen.findByText("Saved notice");
  const item = text.closest("li")!;
  act(() => {
    entry.focus();
    entry.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "t",
        code: "KeyT",
        altKey: true,
        bubbles: true,
      }),
    );
    item.focus();
  });
  return { entry, other, item, reveal, wrapper };
}

describe("Sonner actual returned focus visibility", () => {
  it("reveals only the entry actually restored when leaving the list", async () => {
    const { entry, item, reveal } = await setup();
    await act(() =>
      item.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          code: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(entry);
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
  });

  it("also reveals restoration when the last toast disappears", async () => {
    const { entry, reveal } = await setup();
    act(() => {
      toast.dismiss();
    });
    await waitFor(() => expect(document.activeElement).toBe(entry));
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
  });

  it("does not reveal an entry while moving within the toast and retires its listener", async () => {
    const { entry, item, reveal, wrapper } = await setup();
    const inner = document.createElement("button");
    item.append(inner);
    act(() => inner.focus());
    expect(reveal).not.toHaveBeenCalled();
    wrapper.unmount();
    reveal.mockClear();
    entry.blur();
    entry.focus();
    expect(reveal).not.toHaveBeenCalled();
  });
});
