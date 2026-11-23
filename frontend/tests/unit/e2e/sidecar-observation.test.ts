import { describe, expect, it } from "@rstest/core";

import {
  hasOpeningPaneAnimation,
  type PaneObservation,
} from "../../e2e/utils/sidecar-observation";

// Native RED attachment 69-00: content first appears after the 280ms pane transition.
const observation = (): PaneObservation => ({
  frames: [{ paneWidth: 409.203125 }, { paneWidth: 409.203125 }],
  lifecycle: [
    { time: 65.4, paneWidth: 0, paneOwner: 1 },
    { time: 76.1, paneWidth: 45.9375, paneOwner: 1 },
    { time: 84.8, paneWidth: 82.296875, paneOwner: 1 },
    { time: 101.5, paneWidth: 141.734375, paneOwner: 1 },
    { time: 409, paneWidth: 409.203125, paneOwner: 1 },
  ],
  transitions: [
    {
      time: 75.2,
      target: "pane",
      property: "flex-grow",
      durationMs: 280,
      paneOwner: 1,
    },
  ],
});

describe("native sidecar pane animation evidence", () => {
  it("accepts intermediate native pane widths before message content attaches", () => {
    expect(hasOpeningPaneAnimation(observation())).toBe(true);
  });
  it("rejects an instantaneous zero-to-final jump even with a transition event", () => {
    const sample = observation();
    sample.frames = [{ paneWidth: 0 }, { paneWidth: 409.203125 }];
    sample.lifecycle = [sample.lifecycle[0]!, sample.lifecycle.at(-1)!];
    expect(hasOpeningPaneAnimation(sample)).toBe(false);
  });
  it("rejects width samples belonging to a different physical pane", () => {
    const sample = observation();
    sample.frames = [{ paneWidth: 0 }, { paneWidth: 409.203125 }];
    sample.transitions[0]!.paneOwner = 2;
    expect(hasOpeningPaneAnimation(sample)).toBe(false);
  });
  it("rejects intermediate widths occurring after the actual transition", () => {
    const sample = observation();
    sample.frames = [{ paneWidth: 0 }, { paneWidth: 409.203125 }];
    sample.lifecycle = sample.lifecycle.map((frame, index) =>
      index === 0 ? frame : { ...frame, time: frame.time + 500 },
    );
    expect(hasOpeningPaneAnimation(sample)).toBe(false);
  });
  for (const invalid of [
    "missing event",
    "aside opacity",
    "zero duration",
    "missing pane owner",
  ] as const) {
    it(`rejects ${invalid}`, () => {
      const sample = observation();
      sample.frames = [{ paneWidth: 0 }, { paneWidth: 409.203125 }];
      if (invalid === "missing event") sample.transitions = [];
      if (invalid === "aside opacity")
        sample.transitions[0] = {
          ...sample.transitions[0]!,
          target: "aside",
          property: "opacity",
        };
      if (invalid === "zero duration") sample.transitions[0]!.durationMs = 0;
      if (invalid === "missing pane owner")
        sample.transitions[0]!.paneOwner = null;
      expect(hasOpeningPaneAnimation(sample)).toBe(false);
    });
  }
  it("rejects a closing pane transition", () => {
    const sample = observation();
    sample.lifecycle = sample.lifecycle.map((frame) => ({
      ...frame,
      paneWidth: 409.203125 - frame.paneWidth,
    }));
    expect(hasOpeningPaneAnimation(sample)).toBe(false);
  });
});
