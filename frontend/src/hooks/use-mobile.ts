import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
