import type { Page } from "@playwright/test";

/** The DOM node identity is local to one page; descriptors compare applications. */
export type KeyboardFocus = { identity: string; descriptor: string };

export type KeyboardTraversal = {
  sequence: KeyboardFocus[];
  extraPresses: number;
  capacityChanged: boolean;
  stationaryCycle?: string;
  /** First sample after the latest actual potential-node change. */
  stableFrom?: number;
};

type TraversalSnapshot = {
  potentialIds: string[];
  stableFrom: number;
  topologyChanges: { atRead: number; potentialIds: string[] }[];
  candidateIds?: string[];
  menuItemIds?: string[];
  ownerIdentity?: string;
  ownerKind?: "menu" | "dialog";
  events: { before: string; prevented: boolean }[];
};

type TraversalScope = typeof globalThis & {
  __parityKeyboardTraversal?: {
    inspect: (admission: boolean) => TraversalSnapshot;
    recordRead: () => void;
    dispose: () => void;
  };
};

export async function walkKeyboardTraversal(
  page: Page,
  pressKey: string,
  minimum: number,
  extend: boolean,
): Promise<KeyboardTraversal> {
  const sequence: KeyboardFocus[] = [];
  const initial = await page.evaluate(beginKeyboardTraversal);
  const walk: KeyboardTraversal = {
    sequence,
    extraPresses: 0,
    capacityChanged: false,
  };
  const press = async () => {
    await page.keyboard.press(pressKey);
    sequence.push(await page.evaluate(readKeyboardFocus));
  };
  const observeTopology = (snapshot: TraversalSnapshot) => {
    walk.capacityChanged = snapshot.topologyChanges.length > 0;
    walk.stableFrom = snapshot.stableFrom;
  };
  try {
    // All states still receive the complete original native-key batch, even
    // when their document changes or their focus does not move.
    for (let index = 0; index < minimum; index += 1) await press();
    const snapshot = await page.evaluate(inspectKeyboardTraversal, true);
    observeTopology(snapshot);
    if (!walk.capacityChanged)
      walk.stationaryCycle = stationaryKeyboardCycle(
        sequence,
        snapshot,
        minimum,
      );
    // Fixed at admission: later nodes never buy more keys. Finite DOM changes
    // must complete a fresh physical cycle before this same bound; continuing
    // growth cannot pass. Two slots cover the native document/Chrome boundary.
    const maximumExtra = initial.potentialIds.length + 2;
    for (
      let index = 0;
      extend &&
      keyboardTraversalCycle(walk) === undefined &&
      index < maximumExtra;
      index += 1
    ) {
      await press();
      walk.extraPresses += 1;
      observeTopology(await page.evaluate(inspectKeyboardTraversal, false));
    }
    return walk;
  } finally {
    await page.evaluate(endKeyboardTraversal);
  }
}

export function keyboardTraversalCycle(walk: KeyboardTraversal) {
  if (walk.capacityChanged) {
    if (walk.stableFrom === undefined) return undefined;
    return canonicalKeyboardCycle(walk.sequence.slice(walk.stableFrom));
  }
  return canonicalKeyboardCycle(walk.sequence) ?? walk.stationaryCycle;
}

/** Admission describes observed native Tab behavior, never overlay existence.
 * A stationary container with several tabbable children remains a failure.
 */
function stationaryKeyboardCycle(
  sequence: KeyboardFocus[],
  snapshot: TraversalSnapshot,
  minimum: number,
): string | undefined {
  const stops = sequence.filter((stop) => stop.identity !== "(body)");
  const first = stops[0];
  if (
    !first ||
    stops.some(
      (stop) =>
        stop.identity !== first.identity ||
        stop.descriptor !== first.descriptor,
    ) ||
    snapshot.events.length !== minimum
  )
    return undefined;
  const trapped = snapshot.events.every(
    (event) => event.prevented && event.before === first.identity,
  );
  const candidate =
    snapshot.candidateIds?.length === 1 &&
    snapshot.candidateIds[0] === first.identity;
  if (
    (snapshot.ownerKind === "menu" &&
      (snapshot.menuItemIds?.length ?? 0) > 0 &&
      (snapshot.ownerIdentity === first.identity ||
        snapshot.menuItemIds?.includes(first.identity)) &&
      trapped &&
      stops.length === minimum) ||
    (snapshot.ownerKind === "dialog" &&
      candidate &&
      trapped &&
      stops.length === minimum) ||
    (!snapshot.ownerKind &&
      candidate &&
      stops.length > 1 &&
      sequence.some((stop) => stop.identity === "(body)") &&
      snapshot.events.every((event) => !event.prevented))
  )
    return JSON.stringify([first.descriptor]);
  return undefined;
}

/** Serialized callbacks install only an observer and page-local WeakMaps.
 * Candidate identities are read alongside each focus sample, so a real finite
 * DOM transition has an exact cutover without changing the native key sequence.
 */
export function beginKeyboardTraversal(): TraversalSnapshot {
  const scope = globalThis as TraversalScope & {
    __parityKeyboardFocus?: { nodes: WeakMap<Element, string>; next: number };
  };
  if (scope.__parityKeyboardTraversal)
    throw new Error("A keyboard traversal observer is already active");
  const identities = (scope.__parityKeyboardFocus ??= {
    nodes: new WeakMap<Element, string>(),
    next: 0,
  });
  const identity = (element: Element | null) => {
    if (!element || element === document.body) return "(body)";
    let id = identities.nodes.get(element);
    if (id === undefined) {
      id = String(++identities.next);
      identities.nodes.set(element, id);
    }
    return id;
  };
  // Include hidden/disabled/roving nodes conservatively. Attribute or visibility
  // changes do not enlarge a finite capacity; replacement/new nodes do.
  const selector =
    "a[href],area[href],button,input,select,textarea,iframe,object,embed,summary,audio[controls],video[controls],[tabindex],[contenteditable],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio]";
  const potential = () =>
    Array.from(document.querySelectorAll<HTMLElement>(selector));
  let reads = 0;
  let stableFrom = 0;
  let previous = potential().map(identity);
  const topologyChanges: TraversalSnapshot["topologyChanges"] = [];
  // Observe at the same boundary as the focus sample. No focus, markup or key
  // is changed. A finite transition must still complete its final physical
  // cycle inside the original admission-derived key budget.
  const observePotential = () => {
    const current = potential().map(identity);
    if (
      current.length !== previous.length ||
      current.some((id, index) => id !== previous[index])
    ) {
      stableFrom = reads;
      topologyChanges.push({ atRead: reads, potentialIds: current });
      previous = current;
    }
    return current;
  };
  const recordRead = () => {
    observePotential();
    reads += 1;
  };
  const visible = (element: HTMLElement) => {
    if (element.closest("[inert]") || element.matches(":disabled"))
      return false;
    const style = getComputedStyle(element);
    return (
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      element.getClientRects().length > 0
    );
  };
  const events: { event: KeyboardEvent; before: string }[] = [];
  const keydown = (event: KeyboardEvent) => {
    if (
      event.isTrusted &&
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    )
      events.push({ event, before: identity(document.activeElement) });
  };
  document.addEventListener("keydown", keydown, true);
  const inspect = (admission: boolean): TraversalSnapshot => {
    const nodes = potential();
    const base: TraversalSnapshot = {
      potentialIds: observePotential(),
      stableFrom,
      topologyChanges,
      events: admission
        ? events.map(({ event, before }) => ({
            before,
            prevented: event.defaultPrevented,
          }))
        : [],
    };
    if (!admission) return base;
    const active = document.activeElement;
    const menu = active?.closest('[role="menu"]');
    const dialog = active?.closest('[role="dialog"],[role="alertdialog"]');
    const owner = menu ?? dialog;
    base.ownerKind = menu ? "menu" : dialog ? "dialog" : undefined;
    base.ownerIdentity = owner ? identity(owner) : undefined;
    const candidates = nodes.filter(
      (node) =>
        node !== owner &&
        (!owner || owner.contains(node)) &&
        visible(node) &&
        node.tabIndex >= 0,
    );
    base.candidateIds = candidates.map(identity);
    if (menu)
      base.menuItemIds = nodes
        .filter(
          (node) =>
            node.closest('[role="menu"]') === menu &&
            visible(node) &&
            node.getAttribute("aria-disabled") !== "true" &&
            node.matches(
              '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]',
            ),
        )
        .map(identity);
    return base;
  };
  scope.__parityKeyboardTraversal = {
    inspect,
    recordRead,
    dispose: () => document.removeEventListener("keydown", keydown, true),
  };
  return inspect(false);
}

export function inspectKeyboardTraversal(
  admission: boolean,
): TraversalSnapshot {
  const study = (globalThis as TraversalScope).__parityKeyboardTraversal;
  if (!study) throw new Error("No keyboard traversal observer is active");
  return study.inspect(admission);
}

export function endKeyboardTraversal() {
  const scope = globalThis as TraversalScope;
  scope.__parityKeyboardTraversal?.dispose();
  delete scope.__parityKeyboardTraversal;
}

/** This callback is serialized by Playwright, so it must be self-contained. */
export function readKeyboardFocus(): KeyboardFocus {
  (globalThis as TraversalScope).__parityKeyboardTraversal?.recordRead();
  const element = document.activeElement;
  if (!element || element === document.body)
    return { identity: "(body)", descriptor: "(body)" };
  const scope = globalThis as typeof globalThis & {
    __parityKeyboardFocus?: { nodes: WeakMap<Element, string>; next: number };
  };
  const identities = (scope.__parityKeyboardFocus ??= {
    nodes: new WeakMap<Element, string>(),
    next: 0,
  });
  let identity = identities.nodes.get(element);
  if (identity === undefined) {
    identity = String(++identities.next);
    identities.nodes.set(element, identity);
  }
  const text = (element as HTMLElement).innerText?.trim();
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("placeholder") ??
    (text || element.getAttribute("title")) ??
    "";
  const descriptor =
    `${element.tagName.toLowerCase()}` +
    `${element.getAttribute("role") ? `(${element.getAttribute("role")})` : ""}` +
    `"${label.trim().replace(/\s+/g, " ")}"`;
  return { identity, descriptor };
}

/** Edges connect different physical document stops. Returning from browser
 * chrome to the same iframe is not a second node; distinct same-name controls
 * must still keep their semantic self-edge.
 */
export function keyboardFocusTransitions(
  sequence: KeyboardFocus[],
): Set<string> {
  const edges = new Set<string>();
  let previous: KeyboardFocus | undefined;
  for (const stop of sequence) {
    if (stop.identity === "(body)") continue;
    if (previous && previous.identity !== stop.identity)
      edges.add(`${previous.descriptor} → ${stop.descriptor}`);
    previous = stop;
  }
  return edges;
}

export function keyboardRingClosed(sequence: KeyboardFocus[]): boolean {
  return canonicalKeyboardCycle(sequence) !== undefined;
}

/** Compare a complete physical cycle, retaining repeated semantic names.
 * Rotation only removes the arbitrary starting point; it never sorts stops.
 * A changing traversal must not borrow a partial repeated segment as its ring.
 */
/** Native focus restoration can visit a real control twice in one complete
 * round (for example document -> toast -> return control -> toast -> document).
 * Preserve those repeated physical visits. Unlike a simple cycle, this shape
 * requires two full repetitions and matching remaining samples; a prefix that
 * falls into a smaller loop still cannot pass.
 */
export function canonicalKeyboardCycle(
  sequence: KeyboardFocus[],
): string | undefined {
  const simple = canonicalSimpleKeyboardCycle(sequence);
  if (simple !== undefined) return simple;
  const documentStops = sequence.filter((stop) => stop.identity !== "(body)");
  const stops = documentStops.filter(
    (stop, index) =>
      index === 0 || stop.identity !== documentStops[index - 1]!.identity,
  );
  for (let size = 2; size * 2 <= stops.length; size += 1) {
    const cycle = stops.slice(0, size);
    if (
      stops.slice(size).some((stop, offset) => {
        const expected = cycle[offset % size]!;
        return (
          stop.identity !== expected.identity ||
          stop.descriptor !== expected.descriptor
        );
      })
    )
      continue;
    const names = cycle.map((stop) => stop.descriptor);
    return names
      .map((_, start) =>
        JSON.stringify([...names.slice(start), ...names.slice(0, start)]),
      )
      .sort()[0];
  }
  return undefined;
}

function canonicalSimpleKeyboardCycle(
  sequence: KeyboardFocus[],
): string | undefined {
  const documentStops = sequence.filter((stop) => stop.identity !== "(body)");
  const stops = documentStops.filter(
    (stop, index) =>
      index === 0 || stop.identity !== documentStops[index - 1]!.identity,
  );
  const visited = new Map<string, number>();
  for (const [index, stop] of stops.entries()) {
    const first = visited.get(stop.identity);
    if (first === undefined) {
      visited.set(stop.identity, index);
      continue;
    }
    if (first !== 0) return undefined;
    const cycle = stops.slice(first, index);
    if (
      stops.slice(index).some((later, offset) => {
        const expected = cycle[offset % cycle.length]!;
        return (
          later.identity !== expected.identity ||
          later.descriptor !== expected.descriptor
        );
      })
    )
      return undefined;
    const names = cycle.map((entry) => entry.descriptor);
    return names
      .map((_, start) =>
        JSON.stringify([...names.slice(start), ...names.slice(0, start)]),
      )
      .sort()[0];
  }
  return undefined;
}
