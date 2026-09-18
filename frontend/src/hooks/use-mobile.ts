import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function getServerSnapshot() {
  return false;
}

/*
  Read any media query as a boolean, with the same hydration contract as
  `useIsMobile`: the server snapshot is `false`, and the first post-hydration
  render reports the real value.

  This exists because a control that is hidden with a `sm:` utility can still
  own an *open* overlay, and neither Radix nor Reka closes that overlay when the
  trigger's box collapses to 0x0 — the popper just re-anchors to the origin.
  Measured at a 700px viewport with the reasoning-effort menu open, resizing to
  600px (crossing `sm`): the trigger goes to `[0, 0, 0]` while the menu stays
  `aria-expanded="true"` and parks itself at `[0, 4, 280]`, floating in dead
  space far from the composer. Both apps did this, identically. Resizing from
  1280px hid the shared bug, because crossing `md` remounts this subtree and the
  remount closed the menu — which is why it first looked like a Vue-only defect.
*/
export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}

/*
  Whether this render is still the hydration pass.

  `useIsMobile()` deliberately reports `false` while hydrating, because the
  server has no viewport and the markup has to match. The cost is that a
  viewport-branched tree renders its *desktop* branch once on a phone before the
  post-hydration render can correct it — and a subtree that is thrown away one
  render later still runs its effects, so its queries still hit the network.
  That is exactly what happened to the workspace sidebar: on a 375px viewport
  `/workspace/chats/new` fired `GET /api/features`, `GET /api/channels/providers`
  and `POST /api/threads/search` for a sidebar the user never saw, while
  `/workspace/scheduled-tasks` — same layout, same hook — happened to win the
  race and fired none of them. Non-deterministic, and wasteful either way.

  This is the standard React 18 hydration probe: the server snapshot is `false`
  and the client snapshot is `true`, so it flips exactly once, in the first
  post-hydration render, without scheduling an extra one of its own. Callers use
  it to hold back a subtree whose correct shape is not knowable until then.
*/
const unsubscribeNever = () => {
  // The store never changes, so there is nothing to tear down.
};
const subscribeNever = () => unsubscribeNever;

export function useIsHydrated() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
