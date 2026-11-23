import { expect, test } from "./support/test";

import {
  canonicalKeyboardCycle,
  keyboardRingClosed,
  keyboardTraversalCycle,
  readKeyboardFocus,
  walkKeyboardTraversal,
  type KeyboardFocus,
} from "./support/keyboard-focus";

test("native traversal does not mistake sixty same-name nodes for a closed ring", async ({
  page,
}) => {
  await page.setContent(
    Array.from({ length: 64 }, () => '<a href="#chat">Open chat</a>').join(""),
  );
  const markup = await page.locator("body").innerHTML();
  const sequence: KeyboardFocus[] = [];
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    sequence.push(await page.evaluate(readKeyboardFocus));
  }
  expect(new Set(sequence.map((stop) => stop.descriptor)).size).toBe(1);
  expect(new Set(sequence.map((stop) => stop.identity)).size).toBe(60);
  expect(keyboardRingClosed(sequence)).toBe(false);
  expect(await page.locator("body").innerHTML()).toBe(markup);
});

test("a finite native ring longer than sixty is measured through physical closure in both directions", async ({
  page,
}) => {
  for (const key of ["Tab", "Shift+Tab"]) {
    await page.setContent(
      Array.from({ length: 64 }, () => '<a href="#chat">Open chat</a>').join(
        "",
      ),
    );
    const markup = await page.locator("body").innerHTML();
    const walk = await walkKeyboardTraversal(page, key, 60, true);
    expect(walk.sequence.length).toBeGreaterThan(60);
    expect(walk.sequence.length).toBeLessThanOrEqual(126);
    expect(walk.extraPresses).toBe(walk.sequence.length - 60);
    expect(
      new Set(
        walk.sequence
          .filter((stop) => stop.identity !== "(body)")
          .map((stop) => stop.identity),
      ).size,
    ).toBe(64);
    expect(JSON.parse(keyboardTraversalCycle(walk)!)).toHaveLength(64);
    expect(walk.capacityChanged).toBe(false);
    expect(await page.locator("body").innerHTML()).toBe(markup);
  }
});

test("a growing native traversal cannot borrow an expanding capacity or a repeated semantic name", async ({
  page,
}) => {
  await page.setContent("<button>Next</button>");
  await page.evaluate(() =>
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const button = document.createElement("button");
      button.textContent = "Next";
      document.body.append(button);
      button.focus();
    }),
  );
  const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
  // The original admitted capacity is one; growth cannot enlarge its 1 + 2 extra budget.
  expect(walk.sequence).toHaveLength(63);
  expect(walk.extraPresses).toBe(3);
  expect(walk.capacityChanged).toBe(true);
  expect(keyboardTraversalCycle(walk)).toBeUndefined();
  expect(
    await page.evaluate(() => "__parityKeyboardTraversal" in globalThis),
  ).toBe(false);

  // A late finite change has to prove its own physical cycle. Earlier visits
  // cannot close it, and the original two-candidate budget stays fixed.
  await page.setContent("<button>First</button><button>Second</button>");
  await page.evaluate(() => {
    let presses = 0;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || ++presses !== 60) return;
      for (let index = 0; index < 8; index += 1) {
        const added = document.createElement("button");
        added.textContent = `Late control ${index}`;
        document.body.append(added);
      }
    });
  });
  const changedRing = await walkKeyboardTraversal(page, "Tab", 60, true);
  expect(changedRing.sequence).toHaveLength(64);
  expect(changedRing.extraPresses).toBe(4);
  expect(keyboardRingClosed(changedRing.sequence)).toBe(false);
  expect(changedRing.capacityChanged).toBe(true);
  expect(keyboardTraversalCycle(changedRing)).toBeUndefined();
});

test("native Tab admission recognizes a populated menu without calling unmoving focus a physical ring", async ({
  page,
}) => {
  for (const initial of ["item", "content"]) {
    await page.setContent(
      '<div role="menu" tabindex="-1"><button role="menuitem">First</button><button role="menuitem" tabindex="-1">Last</button></div>',
    );
    await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]')!;
      menu.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Tab") event.preventDefault();
        if (key === "ArrowDown") (menu.lastElementChild as HTMLElement).focus();
      });
      (menu.firstElementChild as HTMLElement).focus();
    });
    if (initial === "content") await page.getByRole("menu").focus();
    const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
    expect(walk.sequence).toHaveLength(60);
    expect(keyboardRingClosed(walk.sequence)).toBe(false);
    expect(keyboardTraversalCycle(walk)).toBe(
      JSON.stringify([walk.sequence[0]!.descriptor]),
    );
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Last" })).toBeFocused();
    expect(
      await page.evaluate(() => "__parityKeyboardTraversal" in globalThis),
    ).toBe(false);
  }
});

test("a sole dialog candidate admits actual trapped Tab in both directions", async ({
  page,
}) => {
  for (const key of ["Tab", "Shift+Tab"]) {
    await page.setContent(
      '<div role="dialog" tabindex="-1"><button>Close</button></div>',
    );
    await page.evaluate(() => {
      document
        .querySelector('[role="dialog"]')!
        .addEventListener("keydown", (event) => {
          if ((event as KeyboardEvent).key === "Tab") event.preventDefault();
        });
      document.querySelector("button")!.focus();
    });
    const walk = await walkKeyboardTraversal(page, key, 60, true);
    expect(walk.sequence).toHaveLength(60);
    expect(keyboardRingClosed(walk.sequence)).toBe(false);
    expect(keyboardTraversalCycle(walk)).toBe(
      JSON.stringify(['button"Close"']),
    );
  }
});

test("a single document input proves its native unprevented Chrome boundary and return", async ({
  page,
}) => {
  await page.setContent('<input aria-label="Only input">');
  const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
  expect(walk.sequence).toHaveLength(60);
  expect(walk.sequence.some((stop) => stop.identity === "(body)")).toBe(true);
  expect(
    walk.sequence.filter((stop) => stop.identity !== "(body)").length,
  ).toBeGreaterThan(1);
  expect(keyboardRingClosed(walk.sequence)).toBe(false);
  expect(keyboardTraversalCycle(walk)).toBe(
    JSON.stringify(['input"Only input"']),
  );
});

test("fake overlays, empty menus and a multi-candidate stationary container stay failures", async ({
  page,
}) => {
  for (const markup of [
    "<button>Swallows Tab</button>",
    '<div role="menu" tabindex="0">Empty menu</div>',
    '<div role="dialog" tabindex="0">Empty overlay</div>',
    '<div role="dialog" tabindex="-1"><button>First</button><button>Last</button></div>',
  ]) {
    await page.setContent(markup);
    await page.evaluate(() => {
      document.body.addEventListener("keydown", (event) => {
        if (event.key === "Tab") event.preventDefault();
      });
      (document.body.firstElementChild as HTMLElement).focus();
    });
    const walk = await walkKeyboardTraversal(page, "Shift+Tab", 60, true);
    expect(keyboardTraversalCycle(walk)).toBeUndefined();
    expect(walk.sequence.length).toBeGreaterThanOrEqual(60);
    expect(walk.sequence.length).toBeLessThanOrEqual(65);
  }
});

test("replacing focus nodes cannot turn a changing native walk into a stable finite cycle", async ({
  page,
}) => {
  await page.setContent(
    Array.from({ length: 64 }, (_, index) => `<button>${index}</button>`).join(
      "",
    ),
  );
  await page.evaluate(() => {
    let presses = 0;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && ++presses >= 61) {
        const button = document.querySelector("button")!;
        button.replaceWith(button.cloneNode(true));
      }
    });
  });
  const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
  // Replacements keep changing identity; they never replenish the 64 + 2 extra budget.
  expect(walk.sequence).toHaveLength(126);
  expect(walk.extraPresses).toBe(66);
  expect(walk.capacityChanged).toBe(true);
  expect(keyboardTraversalCycle(walk)).toBeUndefined();
});

test("native observer cleanup survives a failed key operation without changing document focus or markup", async ({
  page,
}) => {
  await page.setContent("<button>Retained focus</button>");
  const retained = page.getByRole("button");
  await retained.focus();
  const markup = await page.locator("body").innerHTML();
  const original = page.keyboard.press.bind(page.keyboard);
  page.keyboard.press = async () => {
    throw new Error("native key operation failed");
  };
  try {
    await expect(walkKeyboardTraversal(page, "Tab", 60, true)).rejects.toThrow(
      "native key operation failed",
    );
  } finally {
    page.keyboard.press = original;
  }
  expect(
    await page.evaluate(() => "__parityKeyboardTraversal" in globalThis),
  ).toBe(false);
  await expect(retained).toBeFocused();
  expect(await page.locator("body").innerHTML()).toBe(markup);
});

test("native title-only table actions retain separate names and physically close", async ({
  page,
}) => {
  await page.setContent(
    ["Copy table", "Download table", "View fullscreen"]
      .map((title) => `<button title="${title}"></button>`)
      .join(""),
  );
  const sequence: KeyboardFocus[] = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    sequence.push(await page.evaluate(readKeyboardFocus));
  }
  expect(
    [...new Set(sequence.map((stop) => stop.descriptor))]
      .filter((name) => name !== "(body)")
      .sort(),
  ).toEqual([
    'button"Copy table"',
    'button"Download table"',
    'button"View fullscreen"',
  ]);
  expect(keyboardRingClosed(sequence)).toBe(true);
});

test("an unmoving native focus never satisfies physical ring closure", async ({
  page,
}) => {
  await page.setContent('<div tabindex="0" role="menu">Menu</div>');
  await page.locator('[role="menu"]').evaluate((element) => {
    element.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Tab") event.preventDefault();
    });
    (element as HTMLElement).focus();
  });
  const sequence: KeyboardFocus[] = [];
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    sequence.push(await page.evaluate(readKeyboardFocus));
  }
  expect(new Set(sequence.map((stop) => stop.identity)).size).toBe(1);
  expect(sequence[0]!.descriptor).toBe('div(menu)"Menu"');
  expect(keyboardRingClosed(sequence)).toBe(false);
});

test("native cycles with the same semantic edges retain their physical multiplicity", async ({
  page,
}) => {
  const sequences: KeyboardFocus[][] = [];
  for (const names of [
    ["A", "B", "A", "C"],
    ["A", "B", "A", "B", "A", "C"],
  ]) {
    await page.setContent(
      names.map((name) => `<button>${name}</button>`).join(""),
    );
    const sequence: KeyboardFocus[] = [];
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press("Tab");
      sequence.push(await page.evaluate(readKeyboardFocus));
    }
    expect(keyboardRingClosed(sequence)).toBe(true);
    sequences.push(sequence);
  }
  const semanticEdges = (sequence: KeyboardFocus[]) => {
    const names = sequence
      .filter((stop) => stop.identity !== "(body)")
      .map((stop) => stop.descriptor);
    return [
      ...new Set(names.slice(1).map((name, i) => `${names[i]}→${name}`)),
    ].sort();
  };
  expect(semanticEdges(sequences[0]!)).toEqual(semanticEdges(sequences[1]!));
  expect(canonicalKeyboardCycle(sequences[0]!)).not.toBe(
    canonicalKeyboardCycle(sequences[1]!),
  );
});
