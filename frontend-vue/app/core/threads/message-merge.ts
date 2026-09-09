/*
  【文件职责】     历史 / 实时 / 乐观三路消息的归并，以及上下文压缩的瞬态桥。
  【架构位置】     L3（纯 TS）
  【主要导出】     mergeMessages · mergeRenderedMessageLedger
                   computeSummarizationTransientMessages
                   resolveTransientHistoryBridge · mergeTransientHistoryBridge
                   mergeTransientHistoryBridgeOrder
                   resolveThreadTransientHistoryBridge
                   pruneConfirmedTransientMessages
                   countHumanMessagesExcludingSuperseded
                   getVisibleOptimisticMessages · areOptimisticMessagesConfirmed
                   getSummarizationMiddlewareMessages
  【依赖关系】     ./message-identity · ../messages/{utils,run-duration} · ../types/message
  【边界与注意】   这是 05 C1–C4 的实现主体，函数体逐字搬自上游——**有意不重新设计**。
                   05 C 组自己写着「建议原样复制…不要重新设计」，而本文件是全仓
                   唯一一处「原样」有明确含义的地方：`mergeMessages` 的锚点编织
                   （C2「不能在第一个锚点处切片」）和 `resolveTransientHistoryBridge`
                   的未加载页抑制（C4）都是被具体 issue 逼出来的形状，读代码看不出
                   哪一步在防什么，只有上游 2,381 行的 `message-merge.test.ts` 能
                   证明它们还成立。改这里之前先让那份测试红。

                   与上游唯一的实质差异：`EMPTY_MESSAGES` / `EMPTY_MESSAGE_IDENTITIES`
                   这两个稳定空数组在上游是为了不让 React 的 `useMemo` 依赖每帧失效；
                   Vue 侧 `computed` 是按需重算的，但这两个常量仍然保留——
                   它们同时是**默认参数的身份**，`resolveTransientHistoryBridge`
                   的 `previouslyRenderedOrder` 默认值靠引用相等做短路。
*/

import { getMessageRunId } from "../messages/run-duration";
import { isHiddenFromUIMessage } from "../messages/utils";
import type { Message } from "../types/message";

import {
  dedupeMessagesByIdentity,
  isNonEmptyString,
  messageIdentity,
} from "./message-identity";

export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_MESSAGE_IDENTITIES: readonly string[] = [];

const SUMMARIZATION_MIDDLEWARE_UPDATE_KEYS = new Set([
  "SummarizationMiddleware.before_model",
  "DeerFlowSummarizationMiddleware.before_model",
]);

export function mergeMessages(
  historyMessages: Message[],
  threadMessages: Message[],
  optimisticMessages: Message[],
): Message[] {
  const savedTurnDurations = new Map<string, number>();
  const savedRunIds = new Map<string, string>();
  for (const msg of historyMessages) {
    const identity = messageIdentity(msg);
    const runId = getMessageRunId(msg);
    if (identity && runId) {
      savedRunIds.set(identity, runId);
    }
    if (identity && msg.additional_kwargs?.turn_duration !== undefined) {
      savedTurnDurations.set(
        identity,
        msg.additional_kwargs.turn_duration as number,
      );
    }
  }

  const canonical = dedupeMessagesByIdentity(historyMessages);
  const live = dedupeMessagesByIdentity(threadMessages);
  const canonicalByIdentity = new Map(
    canonical.flatMap((message) => {
      const identity = messageIdentity(message);
      return identity ? [[identity, message] as const] : [];
    }),
  );
  const replacementByIdentity = new Map<string, Message>();
  // This uses the same identity-anchor weaving shape as
  // resolveTransientHistoryBridge, but intentionally remains separate: live
  // messages may replace canonical copies and identity-less entries survive.
  const beforeAnchor = new Map<string, Message[]>();
  let pending: Message[] = [];
  let lastAnchorIdentity: string | undefined;
  let hasSharedAnchor = false;

  // A summarized checkpoint is not necessarily a contiguous history suffix:
  // middleware may retain protected prompt/input messages at the front and a
  // recent tail at the back. Treat every shared identity as an ordering anchor,
  // replacing the canonical copy in place. New live messages are woven before
  // the next shared anchor (or after the last one), so a protected early input
  // can never be moved to the tail by global last-copy deduplication.
  for (const message of live) {
    const identity = messageIdentity(message);
    const canonicalMessage = identity
      ? canonicalByIdentity.get(identity)
      : undefined;
    if (!identity || !canonicalMessage) {
      pending.push(message);
      continue;
    }

    if (pending.length > 0 && hasSharedAnchor) {
      beforeAnchor.set(identity, [
        ...(beforeAnchor.get(identity) ?? []),
        ...pending,
      ]);
    }
    // A summarized checkpoint may start with a protected message whose true
    // canonical position is separated from this anchor by unloaded pages.
    // Suppress that ambiguous prefix instead of visually collapsing the gap.
    pending = [];
    hasSharedAnchor = true;
    lastAnchorIdentity = identity;

    // A hidden checkpoint control message must not replace a visible canonical
    // user turn that happens to reuse its identity. In every other case the
    // live checkpoint copy is fresher and replaces history without moving it.
    if (
      !isHiddenFromUIMessage(message) ||
      isHiddenFromUIMessage(canonicalMessage)
    ) {
      replacementByIdentity.set(identity, message);
    }
  }

  let canonicalAndLive: Message[];
  if (!lastAnchorIdentity) {
    canonicalAndLive = [...canonical, ...live];
  } else {
    canonicalAndLive = [];
    for (const message of canonical) {
      const identity = messageIdentity(message);
      if (identity) {
        canonicalAndLive.push(...(beforeAnchor.get(identity) ?? []));
      }
      const replacement = identity
        ? replacementByIdentity.get(identity)
        : undefined;
      canonicalAndLive.push(replacement ?? message);
    }
    // A trailing live-only segment is known to come after the last shared
    // anchor, but that anchor may not be the end of canonical history (for
    // example, another client may have persisted newer rows). Preserve the
    // canonical source order before appending the live tail.
    canonicalAndLive.push(...pending);
  }

  const merged = dedupeMessagesByIdentity([
    ...canonicalAndLive,
    ...optimisticMessages,
  ]);

  return merged.map((message) => {
    const identity = messageIdentity(message);
    if (!identity) {
      return message;
    }
    const shouldRestoreRunId =
      savedRunIds.has(identity) && !getMessageRunId(message);
    const shouldRestoreTurnDuration =
      savedTurnDurations.has(identity) &&
      message.additional_kwargs?.turn_duration === undefined;
    if (shouldRestoreRunId || shouldRestoreTurnDuration) {
      return {
        ...message,
        ...(shouldRestoreRunId ? { run_id: savedRunIds.get(identity) } : {}),
        ...(shouldRestoreTurnDuration
          ? {
              additional_kwargs: {
                ...message.additional_kwargs,
                turn_duration: savedTurnDurations.get(identity),
              },
            }
          : {}),
      } as Message;
    }
    return message;
  });
}

/**
 * Keep a run-scoped ledger of every visible message that reached a committed
 * UI frame. Live checkpoint windows can roll forward between two
 * summarization events; replacing this ledger with only the newest window
 * would make the intervening steps impossible to rescue at the next
 * RemoveMessage(ALL).
 *
 * The newest visible copy wins by identity without moving its established
 * position. Explicitly superseded messages are removed so regeneration cannot
 * revive an answer that the UI intentionally hid.
 */
export function mergeRenderedMessageLedger(
  previouslyRenderedMessages: Message[],
  visibleMessages: Message[],
  supersededMessageIds: ReadonlySet<string> = new Set<string>(),
): Message[] {
  const isEligible = (message: Message) =>
    messageIdentity(message) !== undefined &&
    (!message.id || !supersededMessageIds.has(message.id));
  const retainedPrevious =
    supersededMessageIds.size === 0
      ? previouslyRenderedMessages.filter(
          (message) => messageIdentity(message) !== undefined,
        )
      : previouslyRenderedMessages.filter(isEligible);
  const eligibleVisibleMessages = visibleMessages.filter(isEligible);
  if (retainedPrevious.length === 0) {
    return eligibleVisibleMessages;
  }
  return mergeMessages(retainedPrevious, eligibleVisibleMessages, []);
}

/**
 * Derive the live turns that context summarization is about to drop and that
 * therefore need a short-lived visual bridge until run-event history catches up.
 *
 * Summarization emits `RemoveMessage(ALL)` + a hidden summary + the retained
 * tail. Everything in the current live thread that is absent from the retained
 * visible window is being removed; we keep those (minus the summary control
 * messages already tracked) so the UI can still show the full conversation
 * (#3825). Comparing identities instead of slicing at the first retained
 * message also handles a protected early input followed by a recent tail.
 */
export function computeSummarizationTransientMessages(
  currentMessages: Message[],
  summarizationMessages: Message[],
  summarizedMessageIds: ReadonlySet<string>,
  previouslyRenderedMessages: Message[] = EMPTY_MESSAGES,
): Message[] {
  const retainedVisibleIdentities = new Set(
    summarizationMessages
      .filter((message) => message.type !== "remove")
      .filter((message) => !isHiddenFromUIMessage(message))
      .map(messageIdentity)
      .filter(isNonEmptyString),
  );

  // Updates can outrun the renderer while RemoveMessage(ALL) is applied. In
  // that case currentMessages may already be the retained post-compaction
  // window even though the previous committed UI frame still showed the
  // removed processing steps. Use that frame as the chronological base, then
  // overlay fresher live copies. This rescues only messages the user actually
  // saw and preserves the unloaded-history-gap protection in the bridge
  // resolver.
  const captureMessages =
    previouslyRenderedMessages.length > 0
      ? mergeMessages(previouslyRenderedMessages, currentMessages, [])
      : currentMessages;
  const moved: Message[] = [];
  for (const message of captureMessages) {
    const identity = messageIdentity(message);
    if (identity && retainedVisibleIdentities.has(identity)) {
      continue;
    }
    if (!summarizedMessageIds.has(message.id ?? "")) {
      moved.push(message);
    }
  }
  return moved;
}

/**
 * Overlay messages rescued from context summarization on top of the
 * (possibly stale) visible history so the merged view never drops them.
 *
 * Background (#3825): after summarization the backend removes every live
 * message (`RemoveMessage(ALL)`) while canonical run events can still be
 * waiting for the journal flush/refetch lifecycle. Reading the captured turns
 * from a synchronous transient buffer keeps the merge correct during that gap.
 *
 * Canonical history is cursor-paginated from newest to oldest. A rescued turn
 * can therefore be older than the first row in the currently loaded page even
 * though both came from the same pre-compression checkpoint. ``bridgeOrder``
 * retains identities that canonical history has already confirmed so missing
 * rescued turns can be inserted next to an overlapping anchor instead of being
 * blindly appended after the newest page. Canonical copies always win.
 */
export function resolveTransientHistoryBridge(
  visibleHistory: Message[],
  transientMessages: Message[],
  bridgeOrder: readonly string[] = transientMessages
    .map(messageIdentity)
    .filter(isNonEmptyString),
  previouslyRenderedOrder: readonly string[] = EMPTY_MESSAGE_IDENTITIES,
): Message[] {
  if (transientMessages.length === 0) {
    return visibleHistory;
  }
  const presentIdentities = new Set(
    visibleHistory.map(messageIdentity).filter(isNonEmptyString),
  );
  const missing = transientMessages.filter((message) => {
    const identity = messageIdentity(message);
    // Identity-less messages are intentionally skipped: without a stable
    // identity they cannot be matched against history to drain or dedupe, so
    // overlaying them would risk a permanent duplicate. Canonical history will
    // surface them after the run journal is flushed and the page refetches.
    return identity !== undefined && !presentIdentities.has(identity);
  });
  if (missing.length === 0) {
    return visibleHistory;
  }

  const missingByIdentity = new Map(
    missing.flatMap((message) => {
      const identity = messageIdentity(message);
      return identity ? [[identity, message] as const] : [];
    }),
  );
  // This mirrors mergeMessages' identity-anchor weaving shape, but transient
  // messages never replace canonical copies and identity-less entries are
  // intentionally excluded to avoid permanent duplicates.
  const beforeAnchor = new Map<string, Message[]>();
  const emittedMissingIdentities = new Set<string>();
  const previouslyRenderedIndex = new Map(
    previouslyRenderedOrder.map((identity, index) => [identity, index]),
  );
  let pending: Message[] = [];
  let lastAnchorIdentity: string | undefined;
  let hasCanonicalAnchor = false;

  for (const identity of bridgeOrder) {
    if (presentIdentities.has(identity)) {
      if (pending.length > 0) {
        if (hasCanonicalAnchor) {
          beforeAnchor.set(identity, [
            ...(beforeAnchor.get(identity) ?? []),
            ...pending,
          ]);
        } else {
          const anchorRenderIndex = previouslyRenderedIndex.get(identity);
          if (anchorRenderIndex !== undefined) {
            const safeRenderedPrefix = pending
              .filter((message) => {
                const pendingIdentity = messageIdentity(message);
                const renderIndex = pendingIdentity
                  ? previouslyRenderedIndex.get(pendingIdentity)
                  : undefined;
                return (
                  renderIndex !== undefined && renderIndex < anchorRenderIndex
                );
              })
              .sort((left, right) => {
                const leftIndex =
                  previouslyRenderedIndex.get(messageIdentity(left) ?? "") ??
                  Number.MAX_SAFE_INTEGER;
                const rightIndex =
                  previouslyRenderedIndex.get(messageIdentity(right) ?? "") ??
                  Number.MAX_SAFE_INTEGER;
                return leftIndex - rightIndex;
              });
            if (safeRenderedPrefix.length > 0) {
              beforeAnchor.set(identity, safeRenderedPrefix);
            }
          }
        }
      }
      // The prefix before the first loaded anchor has no trustworthy position:
      // cursor pages containing its intervening history may not be loaded yet.
      // The sole exception is a prefix whose exact relative position was
      // already committed to the previous UI frame.
      pending = [];
      hasCanonicalAnchor = true;
      lastAnchorIdentity = identity;
      continue;
    }
    const message = missingByIdentity.get(identity);
    if (message && !emittedMissingIdentities.has(identity)) {
      pending.push(message);
      emittedMissingIdentities.add(identity);
    }
  }

  // No bridge identity overlaps canonical history. This is the original
  // persistence-gap case: loaded history is older and the rescued live turns
  // belong after it.
  if (!lastAnchorIdentity) {
    return [...visibleHistory, ...missing];
  }

  // A candidate added before its ordering snapshot (or carrying an identity
  // absent from that snapshot) cannot be anchored. Keep it in capture order at
  // the trailing edge of the anchored bridge rather than dropping it.
  for (const message of missing) {
    const identity = messageIdentity(message);
    if (identity && !emittedMissingIdentities.has(identity)) {
      pending.push(message);
      emittedMissingIdentities.add(identity);
    }
  }

  const resolved: Message[] = [];
  for (const message of visibleHistory) {
    const identity = messageIdentity(message);
    if (identity) {
      resolved.push(...(beforeAnchor.get(identity) ?? []));
    }
    resolved.push(message);
    if (identity === lastAnchorIdentity) {
      resolved.push(...pending);
    }
  }
  return resolved;
}

export function mergeTransientHistoryBridge(
  currentBridge: Message[],
  capturedMessages: Message[],
): Message[] {
  const merged = dedupeMessagesByIdentity(currentBridge);
  const indexByIdentity = new Map<string, number>();
  merged.forEach((message, index) => {
    const identity = messageIdentity(message);
    if (identity) {
      indexByIdentity.set(identity, index);
    }
  });

  for (const captured of dedupeMessagesByIdentity(capturedMessages)) {
    const identity = messageIdentity(captured);
    const existingIndex = identity ? indexByIdentity.get(identity) : undefined;
    if (existingIndex === undefined) {
      if (identity) {
        indexByIdentity.set(identity, merged.length);
      }
      merged.push(captured);
      continue;
    }

    const existing = merged[existingIndex];
    if (
      existing &&
      (!isHiddenFromUIMessage(captured) || isHiddenFromUIMessage(existing))
    ) {
      // Refresh the buffered snapshot without moving its first-known
      // chronological position. Repeated compression can recapture protected
      // prefix messages before a newer tail.
      merged[existingIndex] = captured;
    }
  }
  return merged;
}

/**
 * Preserve the complete checkpoint-relative identity order independently from
 * bridge candidates. Confirmed candidates are pruned from the render buffer,
 * but their identities remain useful as non-rendering pagination anchors.
 */
export function mergeTransientHistoryBridgeOrder(
  currentOrder: readonly string[],
  capturedMessages: Message[],
): readonly string[] {
  const capturedOrder = dedupeMessagesByIdentity(capturedMessages)
    .map(messageIdentity)
    .filter(isNonEmptyString);
  // Clone lazily and return the input when nothing is appended: this runs per
  // render while the bridge is active, and a fresh array would invalidate the
  // coalesced render memo on every chunk (#4409 Phase 1).
  let merged: string[] | null = null;
  const seen = new Set(currentOrder);
  for (const identity of capturedOrder) {
    if (!seen.has(identity)) {
      seen.add(identity);
      (merged ??= [...currentOrder]).push(identity);
    }
  }
  return merged ?? currentOrder;
}

export function resolveThreadTransientHistoryBridge(
  visibleHistory: Message[],
  transientMessages: Message[],
  bridgeThreadId: string | null,
  currentThreadId: string | null | undefined,
  bridgeOrder?: readonly string[],
  previouslyRenderedOrder?: readonly string[],
): Message[] {
  if (!bridgeThreadId || bridgeThreadId !== currentThreadId) {
    return visibleHistory;
  }
  return resolveTransientHistoryBridge(
    visibleHistory,
    transientMessages,
    bridgeOrder,
    previouslyRenderedOrder,
  );
}

/**
 * Drop transient-buffer entries that canonical history has already
 * absorbed. This keeps the buffer a transient bridge across the async gap
 * rather than a second long-lived source of truth — otherwise a stale copy
 * could resurrect a message that history later filtered out (e.g. a superseded
 * or regenerated run).
 */
export function pruneConfirmedTransientMessages(
  transientMessages: Message[],
  visibleHistory: Message[],
): Message[] {
  if (transientMessages.length === 0) {
    return transientMessages;
  }
  const confirmedIdentities = new Set(
    visibleHistory.map(messageIdentity).filter(isNonEmptyString),
  );
  return transientMessages.filter((message) => {
    const identity = messageIdentity(message);
    return !identity || !confirmedIdentities.has(identity);
  });
}

export function getMessagesAfterBaseline(
  messages: Message[],
  baselineMessageIds: ReadonlySet<string>,
): Message[] {
  return messages.filter((message) => {
    const id = messageIdentity(message);
    return !id || !baselineMessageIds.has(id);
  });
}

/**
 * Human-message baseline for a prepared replay (regenerate / edit).
 *
 * A replay masks the turn it supersedes, so those messages leave the live
 * message list the moment the mask is applied. Baselining on the pre-mask count
 * means the replacement only ever restores the count instead of exceeding it,
 * and the optimistic copy is never recognised as confirmed. That matters for
 * the first turn of a thread, where the runtime re-keys the replacement message
 * so identity comparison cannot stand in for the count either.
 */
export function countHumanMessagesExcludingSuperseded(
  messages: Message[],
  supersededMessageIds: readonly string[],
): number {
  const superseded = new Set(supersededMessageIds);
  return messages.filter(
    (message) =>
      message.type === "human" && (!message.id || !superseded.has(message.id)),
  ).length;
}

export function getVisibleOptimisticMessages(
  optimisticMessages: Message[],
  previousHumanMessageCount: number,
  currentHumanMessageCount: number,
): Message[] {
  if (
    optimisticMessages.some((message) => message.type === "human") &&
    currentHumanMessageCount > previousHumanMessageCount
  ) {
    return [];
  }
  return optimisticMessages;
}

export function areOptimisticMessagesConfirmed(
  optimisticMessages: Message[],
  persistedMessages: Message[],
): boolean {
  const optimisticIdentities = optimisticMessages
    .map(messageIdentity)
    .filter(isNonEmptyString);
  if (optimisticIdentities.length === 0) {
    return false;
  }
  const persistedIdentities = new Set(
    persistedMessages.map(messageIdentity).filter(isNonEmptyString),
  );
  return optimisticIdentities.every((identity) =>
    persistedIdentities.has(identity),
  );
}

export function getSummarizationMiddlewareMessages(
  data: unknown,
): Message[] | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  for (const [key, update] of Object.entries(data)) {
    if (!SUMMARIZATION_MIDDLEWARE_UPDATE_KEYS.has(key)) {
      continue;
    }
    if (typeof update !== "object" || update === null) {
      continue;
    }

    const messages = Reflect.get(update, "messages");
    if (Array.isArray(messages)) {
      return [...messages] as Message[];
    }
  }

  return undefined;
}
