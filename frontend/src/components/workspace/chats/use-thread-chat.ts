"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createThreadObservation,
  type ThreadObservationScope,
} from "@/core/diagnostics/parity-observation";
import { SHOWCASE_ROUTE_PREFIX } from "@/core/threads/static-demo";
import { uuid } from "@/core/utils/uuid";

export const THREAD_CHAT_RESET_EVENT = "deer-flow:thread-chat-reset";

type ThreadChatResetDetail = {
  deletedThreadId: string;
  nextPath: string;
  force?: boolean;
  claimFocus?: (focus: () => void) => void;
};

export function resetThreadChatAfterDelete(detail: ThreadChatResetDetail) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ThreadChatResetDetail>(THREAD_CHAT_RESET_EVENT, {
      detail,
    }),
  );
}

// Sentinel distinguishing "no identity minted yet" from a minted identity
// whose scope is a project-less new chat (project === null).
const NEW_CHAT_SCOPE_UNSET = Symbol("deerflow.newChatScopeUnset");

type ThreadObservationContext = Readonly<{
  surface: string;
  account: string | null;
  agent: string | null;
}>;

export function useThreadChat(
  focusComposer?: (threadId: string) => void,
  observation?: ThreadObservationContext,
) {
  const { thread_id: threadIdFromParams } = useParams<{ thread_id: string }>();
  const pathname = usePathname();
  // Native adoption updates the public pathname, but Next retains the old
  // route tree. Back can therefore mount a persisted chat with params="new".
  // Resolve its owner before the first consumer render, not only in an effect.
  const pathThreadId =
    /^\/(?:workspace\/(?:agents\/[^/]+\/)?chats|showcase)\/([^/]+)\/?$/.exec(
      pathname,
    )?.[1];
  const threadIdFromPath = pathThreadId
    ? decodeURIComponent(pathThreadId)
    : threadIdFromParams;
  const isNewRoute = pathThreadId !== undefined && threadIdFromPath === "new";
  // The browser URL can lead the reactive pathname during native adoption.
  // It only helps recognize that accepted local run; an arriving public route
  // still owns the thread identity and Showcase mode before the URL commits.
  const actualPathname =
    typeof window === "undefined" ? pathname : window.location.pathname;
  const newThreadIdRef = useRef<string | null>(null);

  const searchParams = useSearchParams();
  // Only interactive owners opt in. Title/read-only hook callers never register.
  // Render allocations remain local candidates until their exact value commits.
  const observationRef = useRef<
    ReturnType<typeof createThreadObservation> | undefined
  >(undefined);
  if (observationRef.current === undefined)
    observationRef.current = observation
      ? createThreadObservation(observation.surface)
      : null;
  const observationScope: ThreadObservationScope = {
    account: observation?.account ?? null,
    agent: observation?.agent ?? null,
    project: isNewRoute ? searchParams.get("project") : null,
    path: pathname,
  };
  const committedObservationScope = useRef(observationScope);
  const [threadId, setThreadIdState] = useState(() => {
    if (threadIdFromPath === "new") {
      // The reactive route may precede the browser URL commit. Share this
      // initial identity with the following effect instead of minting twice.
      if (newThreadIdRef.current === null) {
        newThreadIdRef.current = uuid();
        observationRef.current?.allocation(
          newThreadIdRef.current,
          "initial",
          observationScope,
        );
      }
      return newThreadIdRef.current;
    }
    return threadIdFromPath;
  });

  const [isNewThreadState, setIsNewThreadState] = useState(
    () => threadIdFromPath === "new",
  );
  // An arriving persisted route wins over the leaving browser URL. Conversely,
  // a new route owns its draft/project before that URL commits. An accepted
  // native adoption can already have local isNew=false while pathname is /new.
  const isNewPath =
    isNewRoute && (isNewThreadState || actualPathname.endsWith("/new"));
  if (isNewPath && !newThreadIdRef.current) {
    newThreadIdRef.current = uuid();
    observationRef.current?.allocation(
      newThreadIdRef.current,
      "render-new-route",
      observationScope,
    );
  }

  const resetToNewThread = useCallback(() => {
    const nextThreadId = uuid();
    observationRef.current?.allocation(
      nextThreadId,
      "reset",
      committedObservationScope.current,
    );
    // This is the actual existing scope binding, not a new route-derived owner.
    if (typeof newChatScopeRef.current !== "symbol")
      observationRef.current?.bind(nextThreadId, newChatScopeRef.current);
    newThreadIdRef.current = nextThreadId;
    setIsNewThreadState(true);
    setThreadIdState(nextThreadId);
    return nextThreadId;
  }, []);

  useEffect(() => {
    if (isNewRoute) {
      const previousDraft = newThreadIdRef.current;
      const nextThreadId = previousDraft ?? uuid();
      if (previousDraft === null)
        observationRef.current?.allocation(
          nextThreadId,
          "route-effect",
          committedObservationScope.current,
        );
      newThreadIdRef.current = nextThreadId;
      setIsNewThreadState(true);
      setThreadIdState(nextThreadId);
      return;
    }
    newThreadIdRef.current = null;
    // Keep a departing new page's local owner until its successor mounts;
    // non-chat paths have no thread identity to pass to downstream hooks.
    if (threadIdFromPath === "new") {
      return;
    }
    setIsNewThreadState(false);
    setThreadIdState(threadIdFromPath);
  }, [isNewRoute, pathname, threadIdFromPath]);

  // A new-chat identity is minted for the entry scope (the new chat's
  // `project` query). The sidebar "New chat" link can leave
  // `/new?project=…` for plain `/new` without a pathname change, so the
  // pathname sync above keeps the old identity — which may already be
  // pre-created under the previous project, and whose in-flight submission
  // would otherwise survive the navigation. Re-mint whenever the project
  // scope changes while still on a new-chat path.
  const newChatScopeRef = useRef<string | null | symbol>(NEW_CHAT_SCOPE_UNSET);
  useEffect(() => {
    const project = isNewPath ? searchParams.get("project") : null;
    if (!isNewPath) {
      newChatScopeRef.current = NEW_CHAT_SCOPE_UNSET;
      return;
    }
    if (newChatScopeRef.current === project) {
      return;
    }
    const previousScope = newChatScopeRef.current;
    newChatScopeRef.current = project;
    if (previousScope === NEW_CHAT_SCOPE_UNSET) {
      if (newThreadIdRef.current !== null)
        observationRef.current?.bind(newThreadIdRef.current, project);
      return;
    }
    // Scope changed (project added, removed, or swapped): the old identity
    // belongs to the previous scope, so allocate a fresh one. The threadId
    // flip also runs every fence keyed on `threadId` (composer goal aborts,
    // chat-page submission epoch).
    const nextThreadId = uuid();
    observationRef.current?.allocation(
      nextThreadId,
      "project-scope",
      committedObservationScope.current,
    );
    observationRef.current?.bind(nextThreadId, project);
    newThreadIdRef.current = nextThreadId;
    setIsNewThreadState(true);
    setThreadIdState(nextThreadId);
  }, [isNewPath, pathname, searchParams]);

  useEffect(() => {
    const handleReset = (event: Event) => {
      const detail = (event as CustomEvent<ThreadChatResetDetail>).detail;
      if (!detail?.nextPath) {
        return;
      }

      const currentPathname = window.location.pathname;
      const isDeletingCurrentThread =
        detail.force === true ||
        detail.deletedThreadId === threadId ||
        detail.deletedThreadId === threadIdFromPath ||
        currentPathname.endsWith(`/${detail.deletedThreadId}`);

      if (!isDeletingCurrentThread) {
        return;
      }

      // URL replacement is owned by the caller's Next router action; this hook
      // only resets local chat state so the router state and browser URL stay
      // in sync.
      const nextThreadId = resetToNewThread();
      // Only the main page supplies this callback. Titles and other readers
      // can observe the reset without claiming the composer's completion.
      if (focusComposer && detail.deletedThreadId === threadId)
        detail.claimFocus?.(() => focusComposer(nextThreadId));
    };

    window.addEventListener(THREAD_CHAT_RESET_EVENT, handleReset);
    return () =>
      window.removeEventListener(THREAD_CHAT_RESET_EVENT, handleReset);
  }, [focusComposer, resetToNewThread, threadId, threadIdFromPath]);

  const setThreadId = useCallback((nextThreadId: string) => {
    newThreadIdRef.current = null;
    setThreadIdState(nextThreadId);
  }, []);

  const setIsNewThread = useCallback((nextIsNewThread: boolean) => {
    if (!nextIsNewThread) {
      newThreadIdRef.current = null;
    }
    setIsNewThreadState(nextIsNewThread);
  }, []);

  const isMock =
    pathname.startsWith(`${SHOWCASE_ROUTE_PREFIX}/`) ||
    searchParams.get("mock") === "true";
  const selectedThreadId = isNewPath
    ? (newThreadIdRef.current ?? threadId)
    : threadId;
  const selectedIsNew = isNewPath ? true : isNewThreadState;
  const {
    account: observationAccount,
    project: observationProject,
    agent: observationAgent,
    path: observationPath,
  } = observationScope;
  const consumptionObservation = useMemo(
    () =>
      observationRef.current?.lease(selectedThreadId, {
        account: observationAccount,
        project: observationProject,
        agent: observationAgent,
        path: observationPath,
      }) ?? null,
    [
      selectedThreadId,
      observationAccount,
      observationProject,
      observationAgent,
      observationPath,
    ],
  );
  useLayoutEffect(() => {
    observationRef.current?.resume();
    committedObservationScope.current = observationScope;
    if (pathThreadId === undefined) observationRef.current?.retire();
    else
      observationRef.current?.select(
        selectedThreadId,
        selectedIsNew,
        isMock,
        observationScope,
        consumptionObservation,
      );
  });
  useLayoutEffect(() => {
    const observer = observationRef.current;
    return () => observer?.pause();
  }, []);
  return {
    consumptionObservation,
    threadId: selectedThreadId,
    setThreadId,
    isNewThread: selectedIsNew,
    setIsNewThread,
    isMock,
  };
}
