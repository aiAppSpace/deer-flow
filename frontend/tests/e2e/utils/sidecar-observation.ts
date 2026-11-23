export type PaneFrame = {
  time: number;
  paneWidth: number;
  paneOwner: number | null;
};
export type PaneTransition = {
  time: number;
  target: "pane" | "aside";
  property: string;
  durationMs: number;
  paneOwner: number | null;
};
export type PaneObservation = {
  frames: { paneWidth: number }[];
  lifecycle: PaneFrame[];
  transitions: PaneTransition[];
};

// The pane owns opening animation before its message viewport is attached.
// Require the same physical owner and an intermediate width during its actual
// native transition; a zero-to-final jump cannot satisfy this evidence.
export function hasOpeningPaneAnimation(observation: PaneObservation): boolean {
  return observation.transitions.some((event) => {
    if (
      event.paneOwner === null ||
      event.target !== "pane" ||
      !/^(width|flex-grow|flex-basis)$/.test(event.property) ||
      event.durationMs <= 0
    )
      return false;
    const frames = observation.lifecycle.filter(
      (frame) => frame.paneOwner === event.paneOwner,
    );
    const start = frames.filter((frame) => frame.time <= event.time).at(-1);
    const end = frames.find(
      (frame) => frame.time >= event.time + event.durationMs,
    );
    if (!start || !end || end.paneWidth <= start.paneWidth) return false;
    return frames.some(
      (frame) =>
        frame.time > event.time &&
        frame.time < event.time + event.durationMs &&
        frame.paneWidth > start.paneWidth &&
        frame.paneWidth < end.paneWidth,
    );
  });
}
