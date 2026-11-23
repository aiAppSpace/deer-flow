/*
  【文件职责】     多面板百分比约束、折叠吸附和相邻分隔线尺寸分配。
  【架构位置】     L2
  【主要导出】     declaredLayout、paneRange、resizeLayout、sameLayout
  【依赖关系】     同目录 ResizablePanel 类型；不读取 DOM 或业务状态。
  【边界与注意】   纯布局策略；声明尺寸修正不产生用户事件。
*/
import type { ResizablePanel } from "./types";

const EPSILON = 0.000001;
const equal = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const minimum = (panel: ResizablePanel) =>
  panel.collapsible ? (panel.collapsedSize ?? 0) : (panel.minSize ?? 0);

function constrain(size: number, panel: ResizablePanel) {
  const min = panel.minSize ?? 0;
  const collapsed = panel.collapsedSize ?? 0;
  if (size < min) {
    size = panel.collapsible && size < (collapsed + min) / 2 ? collapsed : min;
  }
  return Math.min(panel.maxSize ?? 100, size);
}

export function sameLayout(a: readonly number[], b: readonly number[]) {
  return (
    a.length === b.length && a.every((size, index) => equal(size, b[index]!))
  );
}

/** Declarative sizes are authoritative. Constraint repair never emits user events. */
export function declaredLayout(
  panels: readonly ResizablePanel[],
  sizes: readonly number[],
) {
  if (
    panels.length < 2 ||
    panels.length !== sizes.length ||
    new Set(panels.map((panel) => panel.id)).size !== panels.length ||
    panels.some((panel) => !panel.id)
  )
    throw new Error(
      "ResizablePanels requires unique pane ids and one size for each pane",
    );
  if (
    sizes.some((size) => !Number.isFinite(size) || size < 0) ||
    !equal(
      sizes.reduce((sum, size) => sum + size, 0),
      100,
    )
  )
    throw new Error(
      "ResizablePanels sizes must be finite percentages totaling 100",
    );
  for (const panel of panels) {
    const min = panel.minSize ?? 0,
      max = panel.maxSize ?? 100,
      collapsed = panel.collapsedSize ?? 0;
    if (
      ![min, max, collapsed].every(Number.isFinite) ||
      min < 0 ||
      max > 100 ||
      min > max ||
      collapsed < 0 ||
      collapsed > min
    )
      throw new Error("ResizablePanels pane constraints are inconsistent");
  }
  const layout = sizes.map((size, index) => constrain(size, panels[index]!));
  let remaining = 100 - layout.reduce((sum, size) => sum + size, 0);
  for (let index = 0; index < layout.length && !equal(remaining, 0); index++) {
    const next = constrain(layout[index]! + remaining, panels[index]!);
    remaining -= next - layout[index]!;
    layout[index] = next;
  }
  if (!equal(remaining, 0))
    throw new Error(
      "ResizablePanels constraints cannot accommodate the declared layout",
    );
  return layout;
}

/** Move a divider, distributing any exhausted neighbor capacity away from that divider. */
export function resizeLayout(
  initial: readonly number[],
  previous: readonly number[],
  panels: readonly ResizablePanel[],
  divider: number,
  delta: number,
  keyboard: boolean,
) {
  if (!Number.isFinite(delta) || equal(delta, 0)) return [...initial];
  const grow = delta > 0 ? divider : divider + 1;
  const shrink = delta > 0 ? divider + 1 : divider;
  const direction = delta > 0 ? 1 : -1;
  if (keyboard) {
    const growing = panels[grow]!,
      shrinking = panels[shrink]!;
    if (
      growing.collapsible &&
      equal(initial[grow]!, growing.collapsedSize ?? 0)
    )
      delta =
        direction *
        Math.max(Math.abs(delta), (growing.minSize ?? 0) - initial[grow]!);
    if (
      shrinking.collapsible &&
      equal(initial[shrink]!, shrinking.minSize ?? 0)
    )
      delta =
        direction *
        Math.max(
          Math.abs(delta),
          initial[shrink]! - (shrinking.collapsedSize ?? 0),
        );
  } else {
    const growing = panels[grow]!;
    const min = growing.minSize ?? 0,
      collapsed = growing.collapsedSize ?? 0;
    if (
      growing.collapsible &&
      initial[grow]! < min &&
      initial[grow]! + Math.abs(delta) < min
    ) {
      const halfway = (min - collapsed) / 2;
      const beforeSnap =
        direction > 0 ? Math.abs(delta) <= halfway : Math.abs(delta) < halfway;
      delta = direction * (beforeSnap ? 0 : min - collapsed);
    }
  }
  const indices = (start: number, step: number) => {
    const result: number[] = [];
    for (let index = start; index >= 0 && index < panels.length; index += step)
      result.push(index);
    return result;
  };
  const growIndices = indices(grow, -direction),
    shrinkIndices = indices(shrink, direction);
  const capacity = growIndices.reduce(
    (sum, index) => sum + (panels[index]!.maxSize ?? 100) - initial[index]!,
    0,
  );
  const requested = Math.min(Math.abs(delta), capacity);
  const next = [...initial];
  let transferred = 0;
  for (const index of shrinkIndices) {
    const size = constrain(
      initial[index]! - (requested - transferred),
      panels[index]!,
    );
    transferred += initial[index]! - size;
    next[index] = size;
    if (transferred >= requested - EPSILON) break;
  }
  let remaining = transferred;
  for (const index of growIndices) {
    const size = constrain(next[index]! + remaining, panels[index]!);
    remaining -= size - next[index]!;
    next[index] = size;
    if (equal(remaining, 0)) break;
  }
  // A collapsed jump may exceed a neighbor's capacity. Keep the last valid layout.
  return equal(remaining, 0) ? next : [...previous];
}

export function paneRange(panels: readonly ResizablePanel[], index: number) {
  const panel = panels[index]!;
  const otherMin = panels.reduce(
    (sum, other, otherIndex) =>
      sum + (otherIndex === index ? 0 : minimum(other)),
    0,
  );
  const otherMax = panels.reduce(
    (sum, other, otherIndex) =>
      sum + (otherIndex === index ? 0 : (other.maxSize ?? 100)),
    0,
  );
  return {
    min: Math.max(minimum(panel), 100 - otherMax),
    max: Math.min(panel.maxSize ?? 100, 100 - otherMin),
  };
}
