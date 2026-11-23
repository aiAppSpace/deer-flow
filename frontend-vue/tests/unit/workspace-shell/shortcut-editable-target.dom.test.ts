import { describe, expect, it } from "vitest";

import { isWorkspaceShortcutEditableTarget } from "@/core/workspace-shell/shortcuts";

describe("global keyboard ownership", () => {
  it.each(["input", "textarea", "select", "[contenteditable=true]"])(
    "recognizes %s as an editable shortcut owner",
    (selector) => {
      document.body.innerHTML =
        selector === "[contenteditable=true]"
          ? '<div contenteditable="true"><span id="target"></span></div>'
          : `<${selector} id="target"></${selector}>`;
      expect(
        isWorkspaceShortcutEditableTarget(document.querySelector("#target")),
      ).toBe(true);
    },
  );

  it("allows shortcuts from ordinary controls", () => {
    document.body.innerHTML = '<button id="target">Toggle</button>';
    expect(
      isWorkspaceShortcutEditableTarget(document.querySelector("#target")),
    ).toBe(false);
  });
});
