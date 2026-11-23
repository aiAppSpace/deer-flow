import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalKeyboardCycle,
  keyboardFocusTransitions,
  keyboardRingClosed,
  keyboardTraversalCycle,
  readKeyboardFocus,
} from "../../e2e-parity/support/keyboard-focus";

afterEach(() => document.body.replaceChildren());

function button(text: string) {
  const element = document.createElement("button");
  element.innerText = text;
  document.body.append(element);
  return element;
}

describe("keyboard focus measurement", () => {
  const samples = (identities: string[], names: Record<string, string>) =>
    identities.map((identity) => ({
      identity,
      descriptor: names[identity] ?? identity,
    }));

  it("compares full physical cycles up to rotation without erasing duplicates", () => {
    const names = { a: "A", b: "B", c: "A", d: "C", e: "B", f: "A" };
    const short = samples(["a", "b", "c", "d", "a", "b"], names);
    const rotated = samples(["c", "d", "a", "b", "c", "d"], names);
    const longer = samples(["a", "b", "c", "e", "f", "d", "a", "b"], names);
    expect(canonicalKeyboardCycle(short)).toBe(canonicalKeyboardCycle(rotated));
    // Both have exactly A→B, B→A, A→C, C→A semantic edge sets.
    expect(canonicalKeyboardCycle(short)).not.toBe(
      canonicalKeyboardCycle(longer),
    );
  });

  it("rejects incomplete or changing physical cycles", () => {
    expect(
      canonicalKeyboardCycle(samples(["a", "b", "c"], {})),
    ).toBeUndefined();
    expect(
      canonicalKeyboardCycle(samples(["a", "b", "a", "c"], {})),
    ).toBeUndefined();
    expect(
      canonicalKeyboardCycle(samples(["a", "b", "c", "b", "c"], {})),
    ).toBeUndefined();
  });

  it("keeps distinct same-name DOM nodes separate without changing their markup", () => {
    const first = button("Open chat");
    const second = button("Open chat");
    const before = document.body.innerHTML;
    first.focus();
    const a = readKeyboardFocus();
    second.focus();
    const b = readKeyboardFocus();
    expect(a.descriptor).toBe(b.descriptor);
    expect(a.identity).not.toBe(b.identity);
    expect(document.body.innerHTML).toBe(before);
    first.focus();
    expect(readKeyboardFocus().identity).toBe(a.identity);
  });

  it("does not confuse repeated semantic names with a physical closed ring", () => {
    const nodes = [button("Open chat"), button("Other"), button("Open chat")];
    const sequence = nodes.map((node) => {
      node.focus();
      return readKeyboardFocus();
    });
    expect(keyboardRingClosed(sequence)).toBe(false);
    nodes[0]!.focus();
    expect(keyboardRingClosed([...sequence, readKeyboardFocus()])).toBe(true);
  });

  it("does not count an unmoving focus or all-body sequence as closure", () => {
    button("Stuck").focus();
    const current = readKeyboardFocus();
    expect(keyboardRingClosed(Array(60).fill(current))).toBe(false);
    document.body.replaceChildren();
    expect(keyboardRingClosed(Array(60).fill(readKeyboardFocus()))).toBe(false);
  });

  it("ignores only the document chrome sentinel when checking closure", () => {
    const a = { identity: "1", descriptor: "a" };
    const b = { identity: "2", descriptor: "b" };
    const body = { identity: "(body)", descriptor: "(body)" };
    expect(keyboardRingClosed([a, b, body, a])).toBe(true);
  });

  it("reads a title-only icon button instead of merging all table actions", () => {
    const samples = ["Copy table", "Download table", "View fullscreen"].map(
      (title) => {
        const element = button("");
        element.title = title;
        element.focus();
        return readKeyboardFocus().descriptor;
      },
    );
    expect(samples).toEqual([
      'button"Copy table"',
      'button"Download table"',
      'button"View fullscreen"',
    ]);
  });

  it("keeps the explicit accessible label and text input placeholder precedence", () => {
    const element = document.createElement("input");
    element.placeholder = "Write a message";
    element.title = "Tooltip";
    document.body.append(element);
    element.focus();
    expect(readKeyboardFocus().descriptor).toBe('input"Write a message"');
    element.setAttribute("aria-label", "Message");
    expect(readKeyboardFocus().descriptor).toBe('input"Message"');
  });

  it("uses visible button text before its tooltip", () => {
    const element = button("Export");
    element.title = "Download this conversation";
    element.focus();
    expect(readKeyboardFocus().descriptor).toBe('button"Export"');
  });

  it("does not merge names that differ after the historical thirty-character prefix", () => {
    const prefix = "A scheduled task with the same long prefix ";
    const first = button(`${prefix}one`);
    const second = button(`${prefix}two`);
    first.focus();
    const a = readKeyboardFocus();
    second.focus();
    const b = readKeyboardFocus();
    expect(a.descriptor).not.toBe(b.descriptor);
    expect(a.descriptor).toContain(`${prefix}one`);
    expect(b.descriptor).toContain(`${prefix}two`);
  });
  it("retains the repeated physical stops of native toast focus restoration", () => {
    const round = ["a", "b", "c", "toast", "c", "toast"];
    const original = samples([...round, ...round, "a"], {});
    const rotated = [...round.slice(2), ...round.slice(0, 2)];
    expect(JSON.parse(canonicalKeyboardCycle(original)!)).toHaveLength(6);
    expect(canonicalKeyboardCycle(original)).toBe(
      canonicalKeyboardCycle(samples([...rotated, ...rotated], {})),
    );
    expect(canonicalKeyboardCycle(original)).not.toBe(
      canonicalKeyboardCycle(samples(["a", "b", "c", "toast", "a"], {})),
    );
  });

  it("requires two complete repetitions for a cycle with repeated physical nodes", () => {
    expect(
      canonicalKeyboardCycle(samples(["a", "b", "a", "c", "a"], {})),
    ).toBeUndefined();
    const round = ["a", "b", "c", "toast", "c", "toast"];
    expect(
      canonicalKeyboardCycle(samples([...round, ...round, "wrong"], {})),
    ).toBeUndefined();
    expect(
      canonicalKeyboardCycle(
        samples(["entry", "c", "toast", "c", "toast", "c", "toast"], {}),
      ),
    ).toBeUndefined();
  });

  it("requires a complete cycle after the observed finite DOM cutover", () => {
    const walk = {
      sequence: samples(["retired", "a", "b", "a"], {}),
      extraPresses: 0,
      capacityChanged: true,
    };
    expect(keyboardTraversalCycle(walk)).toBeUndefined();
    expect(keyboardTraversalCycle({ ...walk, stableFrom: 1 })).toBe(
      '["a","b"]',
    );
    expect(keyboardTraversalCycle({ ...walk, stableFrom: 2 })).toBeUndefined();
  });
});

describe("physical keyboard transitions", () => {
  const first = { identity: "1", descriptor: 'iframe"Artifact preview"' };
  const second = { identity: "2", descriptor: 'a"New chat"' };
  const body = { identity: "(body)", descriptor: "(body)" };

  it("does not invent a physical transition when chrome returns to the same iframe", () => {
    expect([...keyboardFocusTransitions([first, body, first, second])]).toEqual(
      ['iframe"Artifact preview" → a"New chat"'],
    );
  });

  it("retains same-name edges between different actual controls", () => {
    expect([
      ...keyboardFocusTransitions([
        { identity: "1", descriptor: 'button"More"' },
        { identity: "2", descriptor: 'button"More"' },
      ]),
    ]).toEqual(['button"More" → button"More"']);
  });

  it("does not turn stationary focus or an incomplete walk into a closed cycle", () => {
    const stationary = [first, body, first, body, first];
    expect(keyboardFocusTransitions(stationary).size).toBe(0);
    expect(canonicalKeyboardCycle(stationary)).toBeUndefined();
    expect(
      canonicalKeyboardCycle([first, body, first, second]),
    ).toBeUndefined();
    expect([...keyboardFocusTransitions([first, second, first])]).toHaveLength(
      2,
    );
  });
});
