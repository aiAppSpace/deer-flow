import { expect, test } from "./support/test";

import {
  keyboardTraversalCycle,
  walkKeyboardTraversal,
} from "./support/keyboard-focus";

const fixtures = [
  {
    name: "unchanged finite document",
    count: 4,
    kind: "none",
    expected: true,
    finalCount: 4,
  },
  {
    name: "finite page append",
    count: 4,
    kind: "append",
    trigger: 3,
    expected: true,
    finalCount: 8,
  },
  {
    name: "finite dismissal",
    count: 4,
    kind: "remove",
    trigger: 1,
    expected: true,
    finalCount: 3,
  },
  {
    name: "bounded extra keys after finite pagination",
    count: 84,
    kind: "append",
    trigger: 19,
    expected: true,
    finalCount: 88,
  },
  {
    name: "late transition cannot buy another budget",
    count: 84,
    kind: "append",
    trigger: 83,
    expected: false,
    finalCount: 88,
  },
  {
    name: "unbounded growing list",
    count: 2,
    kind: "infinite",
    expected: false,
  },
  {
    name: "real stationary trap",
    count: 2,
    kind: "stationary",
    expected: false,
  },
  {
    name: "prefix into incomplete loop",
    count: 3,
    kind: "prefix-loop",
    expected: false,
  },
  {
    name: "nonfocusable DOM noise cannot legitimize a partial loop",
    count: 3,
    kind: "noisy-prefix-loop",
    expected: false,
  },
] as const;

for (const fixture of fixtures)
  test(`finite keyboard topology: ${fixture.name}`, async ({ page }) => {
    await page.setContent("<body><main></main></body>");
    await page.evaluate((value) => {
      const main = document.querySelector("main")!;
      let count = 0;
      const add = () => {
        const button = document.createElement("button");
        button.textContent = `Action ${++count}`;
        main.append(button);
        return button;
      };
      for (let index = 0; index < value.count; index += 1) add();
      const buttons = [...main.querySelectorAll("button")];
      if (value.kind === "append")
        buttons[value.trigger]!.addEventListener(
          "focus",
          () => {
            for (let index = 0; index < 4; index += 1) add();
          },
          { once: true },
        );
      if (value.kind === "remove")
        buttons[value.trigger]!.addEventListener(
          "focus",
          () => buttons[2]!.remove(),
          { once: true },
        );
      if (value.kind === "infinite")
        main.addEventListener("focusin", (event) => {
          if (event.target === main.lastElementChild) add();
        });
      if (value.kind === "stationary")
        main.addEventListener("keydown", (event) => {
          if (event.key === "Tab") event.preventDefault();
        });
      if (value.kind === "prefix-loop" || value.kind === "noisy-prefix-loop")
        buttons[2]!.addEventListener("focus", () => {
          if (value.kind === "noisy-prefix-loop") {
            const span = document.createElement("span");
            span.textContent = "Ordinary update";
            main.append(span);
          }
          buttons[1]!.focus();
        });
    }, fixture);
    const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
    const cycle = keyboardTraversalCycle(walk);
    expect(walk.sequence.length).toBeGreaterThanOrEqual(60);
    expect(walk.extraPresses).toBeLessThanOrEqual(fixture.count + 2);
    expect(cycle !== undefined).toBe(fixture.expected);
    if (fixture.expected) {
      expect(JSON.parse(cycle!) as string[]).toHaveLength(fixture.finalCount);
      await expect(page.locator("button")).toHaveCount(fixture.finalCount);
    }
    if (fixture.kind === "noisy-prefix-loop")
      expect(walk.capacityChanged).toBe(false);
  });
