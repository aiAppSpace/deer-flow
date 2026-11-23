import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { getAPIClient } from "@/core/api/api-client";
import { createThreadObservation } from "@/core/diagnostics/parity-observation";
import { createThread } from "@/core/threads/api";
import type { AgentThread } from "@/core/threads/types";

export type ChatSubmissionOwner = Readonly<{
  revision: number;
  threadId: string;
  projectId: string | null;
  userId: string | null;
  agentName: string | null;
}>;

/** A draft, its pre-created thread and all awaiting submissions share one owner. */
export function useChatThreadOwner(options: {
  threadId: MaybeRefOrGetter<string | null>;
  projectId: MaybeRefOrGetter<string | null>;
  userId: MaybeRefOrGetter<string | null>;
  agentName: MaybeRefOrGetter<string | null | undefined>;
  onCreated: (thread: AgentThread) => void;
  onProjectUnavailable: () => void;
  observation?: Readonly<{
    surface: string;
    path: MaybeRefOrGetter<string>;
    mock: MaybeRefOrGetter<boolean>;
  }>;
}) {
  const draftThreadId = ref(globalThis.crypto.randomUUID());
  const preparedThreadId = ref<string | null>(null);
  let revision = 0;
  let disposed = false;
  let mounted = false;
  const observer = options.observation
    ? createThreadObservation(options.observation.surface)
    : null;
  const observationScope = () => ({
    account: toValue(options.userId),
    project: toValue(options.projectId),
    agent: toValue(options.agentName) ?? null,
    path: options.observation ? toValue(options.observation.path) : "",
  });
  function recordAllocation(raw: string, reason: string) {
    if (!observer || disposed) return;
    observer.allocation(raw, reason, observationScope());
    observer.bind(raw, toValue(options.projectId));
  }
  const consumptionObservation = computed(
    () => observer?.lease(capture().threadId, observationScope()) ?? null,
  );
  function recordSelection() {
    if (!observer || !mounted || disposed) return;
    const owner = capture();
    observer.select(
      owner.threadId,
      toValue(options.threadId) === null,
      options.observation ? toValue(options.observation.mock) : false,
      observationScope(),
      consumptionObservation.value,
    );
  }
  recordAllocation(draftThreadId.value, "initial");
  onMounted(() => {
    mounted = true;
    observer?.resume();
    recordSelection();
  });
  let pending: { revision: number; promise: Promise<string> } | null = null;
  function reset() {
    revision += 1;
    pending = null;
    preparedThreadId.value = null;
    const nextDraft = globalThis.crypto.randomUUID();
    // Record this already-generated candidate before the ref write can wake
    // a child query. Selection remains owned by the existing mounted path.
    recordAllocation(nextDraft, "scope-reset");
    draftThreadId.value = nextDraft;
    recordSelection();
  }
  watch(
    [
      () => toValue(options.threadId),
      () => toValue(options.projectId),
      () => toValue(options.userId),
      () => toValue(options.agentName),
    ],
    (
      [thread, , user, agent],
      [previousThread, , previousUser, previousAgent],
    ) => {
      // Attaching a file or accepting the first run adopts this exact draft.
      // Losing ?project during that replacement does not create another owner.
      if (
        previousThread === null &&
        thread === draftThreadId.value &&
        user === previousUser &&
        agent === previousAgent
      ) {
        recordSelection();
        return;
      }
      if (
        thread !== null &&
        thread === previousThread &&
        user === previousUser &&
        agent === previousAgent
      ) {
        recordSelection();
        return;
      }
      reset();
    },
    { flush: "sync" },
  );
  // Presentation changes do not reset the product owner, but remain part of
  // its observed selection. Keep this separate from the identity reset watch.
  if (observer && options.observation) {
    const observation = options.observation;
    watch(
      [() => toValue(observation.path), () => toValue(observation.mock)],
      recordSelection,
      { flush: "sync" },
    );
  }
  function capture(): ChatSubmissionOwner {
    return {
      revision,
      threadId: toValue(options.threadId) ?? draftThreadId.value,
      projectId: toValue(options.projectId),
      userId: toValue(options.userId),
      agentName: toValue(options.agentName) ?? null,
    };
  }
  function owns(owner: ChatSubmissionOwner) {
    return !disposed && owner.revision === revision;
  }
  function assertCurrent(owner: ChatSubmissionOwner) {
    if (!owns(owner))
      throw new DOMException("The conversation changed.", "AbortError");
  }
  async function ensureThread(owner = capture()): Promise<string> {
    assertCurrent(owner);
    if (toValue(options.threadId)) return owner.threadId;
    if (preparedThreadId.value) return preparedThreadId.value;
    if (pending?.revision === owner.revision) return pending.promise;
    const promise = (async () => {
      const metadata = owner.agentName ? { agent_name: owner.agentName } : {};
      let created: AgentThread;
      try {
        // Both create URLs reach the same idempotent Gateway route. Project
        // admission must happen on the first insert, before any run or upload.
        created = owner.projectId
          ? await createThread(owner.threadId, owner.projectId, metadata)
          : await getAPIClient().threads.create({
              threadId: owner.threadId,
              metadata,
            });
        assertCurrent(owner);
        if (
          owner.projectId &&
          created.metadata?.deerflow_project_id !== owner.projectId
        ) {
          // An idempotent response may describe a previously unassigned row.
          // Never infer membership from the requested project or move it here.
          throw new Error("The conversation was not created in the project.");
        }
      } catch (error) {
        if (owner.projectId && owns(owner)) options.onProjectUnavailable();
        throw error;
      }
      preparedThreadId.value = created.thread_id;
      observer?.prepared(owner.threadId, created.thread_id);
      options.onCreated(created);
      return created.thread_id;
    })();
    pending = { revision: owner.revision, promise };
    try {
      return await promise;
    } finally {
      if (pending?.promise === promise) pending = null;
    }
  }
  onScopeDispose(() => {
    observer?.pause();
    disposed = true;
    reset();
  });
  return {
    consumptionObservation,
    draftThreadId,
    preparedThreadId,
    capture,
    owns,
    assertCurrent,
    ensureThread,
    reset,
  };
}
