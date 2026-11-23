import { describe, expect, it } from "vitest";

import { isCompositionConfirmEnter, isImeComposing } from "@/core/input/ime";

describe("isImeComposing", () => {
  it.each([
    [{ isComposing: true, keyCode: 13 }, false],
    [{ isComposing: false, keyCode: 229 }, false],
    [{ isComposing: false, keyCode: 13 }, true],
  ])("protects composition variants", (event, active) => {
    expect(isImeComposing(event, active)).toBe(true);
  });

  it("allows ordinary Enter", () => {
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
  });
});

describe("composition confirmation Enter", () => {
  const event = {
    key: "Enter",
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
  };
  it("suppresses only the first 50ms after compositionend", () => {
    expect(isCompositionConfirmEnter(event, 100, 100)).toBe(true);
    expect(isCompositionConfirmEnter(event, 100, 149)).toBe(true);
    expect(isCompositionConfirmEnter(event, 100, 150)).toBe(false);
    expect(isCompositionConfirmEnter(event, 100, 99)).toBe(false);
  });
  it("keeps Shift+Enter and active composition out of confirmation detection", () => {
    expect(
      isCompositionConfirmEnter({ ...event, shiftKey: true }, 100, 110),
    ).toBe(false);
    expect(
      isCompositionConfirmEnter({ ...event, keyCode: 229 }, 100, 110),
    ).toBe(false);
    expect(
      isCompositionConfirmEnter({ ...event, isComposing: true }, 100, 110),
    ).toBe(false);
  });
});
