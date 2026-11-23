import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TodoList } from "@/components/workspace/todo-list";

/*
  Three affordances that are easy to lose in a class string and that no other
  test looks at. Each one was a real defect until 2026-09-05:

  1. The dialog close button had no size class at all, so its hit area was
     exactly the 16px glyph — below the 24x24 minimum in WCAG 2.5.8.
  2. The switch had no `cursor-pointer`. Tailwind 4's preflight does not give
     buttons a pointer cursor, so it read as non-interactive under the mouse.
  3. The to-do panel's collapse control was a `<header>` with an onClick
     handler: unreachable by keyboard (WCAG 2.1.1) and silent about its state.

  These assert rendered attributes rather than the source string, so a
  refactor that keeps the behaviour keeps the tests.
*/
afterEach(cleanup);

describe("interactive affordances", () => {
  it("gives the dialog close button a 28px target and a pointer cursor", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    const classes = close.className.split(/\s+/);
    // size-7 is 1.75rem = 28px, comfortably over the 24x24 minimum.
    expect(classes).toContain("size-7");
    expect(classes).toContain("cursor-pointer");
  });

  it("gives the switch a pointer cursor", () => {
    render(<Switch aria-label="Notifications" />);

    const toggle = screen.getByRole("switch", { name: "Notifications" });
    expect(toggle.className.split(/\s+/)).toContain("cursor-pointer");
  });

  /*
    The attachment chip's remove button is invisible (`opacity-0`) until the
    chip is hovered. Without a focus-visible escape hatch a keyboard user
    lands focus on a fully transparent control (WCAG 2.4.7 / 2.4.11).

    This one asserts the class list rather than a rendered attribute: the
    behaviour lives entirely in a CSS variant, so there is nothing else to
    read. Rendering the chip needs a live attachment context, so the source is
    the cheapest place to pin it.
  */
  it("keeps the attachment remove button visible while it has focus", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/ai-elements/prompt-input.tsx"),
      "utf8",
    );
    // Strip comments first: the note above this class list quotes it verbatim.
    const stripped = source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^\s*\/\/.*$/gm, "");
    const removeButton = /className="absolute inset-0 size-5[^"]*"/.exec(
      stripped,
    )?.[0];
    expect(removeButton).toBeTruthy();
    expect(removeButton).toContain("focus-visible:opacity-100");
    expect(removeButton).toContain("focus-visible:pointer-events-auto");
  });

  /*
    Both <Toaster /> call sites must go through `@/components/ui/sonner`, not
    through `sonner` directly. The wrapper is the only place that binds the
    theme, the popover colour tokens and the lucide type icons; importing the
    library's Toaster silently skips all three, and sonner's `theme` prop
    defaults to "light", so toasts stayed light while the app was dark.

    Measured on 2026-09-05 against the built app: the rendered icon was
    sonner's own 20x20 asset and the toast background was rgb(255,255,255)
    rather than the popover token.
  */
  it("renders every toaster through the wrapper that binds theme and tokens", () => {
    for (const file of [
      "src/app/workspace/workspace-content.tsx",
      "src/app/showcase/[thread_id]/layout.tsx",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, `${file} still renders a Toaster`).toContain("<Toaster");
      expect(source, `${file} imports Toaster from sonner directly`).toContain(
        'from "@/components/ui/sonner"',
      );
      expect(source).not.toMatch(
        /import\s*\{[^}]*Toaster[^}]*\}\s*from\s*"sonner"/,
      );
    }
  });

  it("exposes the to-do panel collapse control as a button with its state", () => {
    render(
      <TodoList
        todos={[{ content: "Ship the release", status: "in_progress" }]}
      />,
    );

    // The panel starts collapsed, so the control starts at aria-expanded=false.
    const toggle = screen.getByRole("button", { name: /To-dos/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
