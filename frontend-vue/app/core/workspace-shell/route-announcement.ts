import type { HistoryState, RouteLocationNormalized } from "vue-router";

const CONTINUATION_STATE_KEY = "deerflowRouteAnnouncementToken";

/** One app owns one pending same-page URL replacement; history is only correlation. */
export function createRouteAnnouncements() {
  type Intent = {
    token: string;
    from: RouteLocationNormalized;
    target: string;
    owns: () => boolean;
  };
  let pending: Intent | null = null;

  function preservePage(options: Omit<Intent, "token">) {
    const intent: Intent = { ...options, token: crypto.randomUUID() };
    pending = intent;
    return {
      state: { [CONTINUATION_STATE_KEY]: intent.token },
      cancel() {
        if (pending === intent) pending = null;
      },
    };
  }

  function consume(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: HistoryState,
  ) {
    const intent = pending;
    // Every successful departure retires the prior disposition. A late failed
    // replace's finally can cancel only its own token, never a newer intent.
    pending = null;
    return Boolean(
      intent &&
      !to.redirectedFrom &&
      intent.from === from &&
      intent.target === to.fullPath &&
      state[CONTINUATION_STATE_KEY] === intent.token &&
      intent.owns(),
    );
  }

  return { preservePage, consume };
}
