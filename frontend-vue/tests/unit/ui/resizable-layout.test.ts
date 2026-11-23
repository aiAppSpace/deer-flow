import { describe, expect, it } from "vitest";

import {
  declaredLayout,
  paneRange,
  resizeLayout,
} from "@/components/ui/resizable/layout";

const panels = [
  { id: "main", minSize: 30 },
  { id: "side", minSize: 20, collapsible: true },
];
describe("pane allocation used by the real captured divider", () => {
  it("enforces expanded constraints and the collapsed midpoint without losing total width", () => {
    expect(declaredLayout(panels, [28, 72])).toEqual([30, 70]);
    expect(declaredLayout(panels, [91, 9])).toEqual([100, 0]);
    expect(declaredLayout(panels, [90, 10])).toEqual([80, 20]);
    expect(paneRange(panels, 0)).toEqual({ min: 30, max: 100 });
  });

  it("keeps the original pointer snapshot through collapse and reversal", () => {
    const initial = [60, 40];
    const closed = resizeLayout(initial, initial, panels, 0, 40, false);
    expect(closed).toEqual([100, 0]);
    expect(resizeLayout(initial, closed, panels, 0, 5, false)).toEqual([
      65, 35,
    ]);
    expect(resizeLayout(initial, closed, panels, 0, 0, false)).toEqual(initial);
  });

  it("uses the actual 5-point keyboard step and jumps across the collapsed gap", () => {
    expect(resizeLayout([60, 40], [60, 40], panels, 0, 5, true)).toEqual([
      65, 35,
    ]);
    expect(resizeLayout([80, 20], [80, 20], panels, 0, 5, true)).toEqual([
      100, 0,
    ]);
    expect(resizeLayout([100, 0], [100, 0], panels, 0, -5, true)).toEqual([
      80, 20,
    ]);
    expect(resizeLayout([100, 0], [100, 0], panels, 0, -9.9, false)).toEqual([
      100, 0,
    ]);
    expect(resizeLayout([100, 0], [100, 0], panels, 0, -10, false)).toEqual([
      80, 20,
    ]);
    const leftCollapsible = [panels[1]!, panels[0]!];
    expect(
      resizeLayout([0, 100], [0, 100], leftCollapsible, 0, 10, false),
    ).toEqual([0, 100]);
    expect(
      resizeLayout([0, 100], [0, 100], leftCollapsible, 0, 10.1, false),
    ).toEqual([20, 80]);
  });

  it("distributes exhausted adjacent capacity through four panes while respecting bounds", () => {
    const four = [
      { id: "main", minSize: 20, maxSize: 80 },
      { id: "a" },
      { id: "b" },
      { id: "c", minSize: 5 },
    ];
    const initial = [55, 15, 15, 15];
    expect(resizeLayout(initial, initial, four, 0, 40, false)).toEqual([
      80, 0, 5, 15,
    ]);
    expect(resizeLayout(initial, initial, four, 1, -50, false)).toEqual([
      20, 0, 65, 15,
    ]);
  });

  it("rejects impossible and invalid declarations rather than publishing corrupt geometry", () => {
    expect(() => declaredLayout(panels, [50, 40])).toThrow(/totaling 100/);
    expect(() => declaredLayout(panels, [NaN, 40])).toThrow(/finite/);
    expect(() =>
      declaredLayout([{ id: "same" }, { id: "same" }], [50, 50]),
    ).toThrow(/unique/);
    expect(() =>
      declaredLayout(
        [
          { id: "a", minSize: 60 },
          { id: "b", minSize: 60 },
        ],
        [50, 50],
      ),
    ).toThrow(/cannot accommodate/);
    expect(() =>
      declaredLayout(
        [{ id: "a", minSize: 60, maxSize: 40 }, { id: "b" }],
        [50, 50],
      ),
    ).toThrow(/inconsistent/);
  });

  it("derives accessible limits from the other panes' real aggregate capacity", () => {
    const four = [
      { id: "main", minSize: 20 },
      { id: "a", maxSize: 10 },
      { id: "b", maxSize: 10 },
      { id: "c", maxSize: 10 },
    ];
    expect(declaredLayout(four, [70, 10, 10, 10])).toEqual([70, 10, 10, 10]);
    expect(paneRange(four, 0)).toEqual({ min: 70, max: 100 });
    expect(
      resizeLayout([70, 10, 10, 10], [70, 10, 10, 10], four, 0, -5, true),
    ).toEqual([70, 10, 10, 10]);
  });
});
