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
  【依赖关系】     ./message-identity · ./message-seq · ../messages/{utils,run-duration} ·
                   ../types/message
  【边界与注意】   这是 05 C1–C4 的实现主体，函数体逐字搬自上游——**有意不重新设计**。
                   05 C 组自己写着「建议原样复制…不要重新设计」，而本文件是全仓
                   唯一一处「原样」有明确含义的地方：`mergeMessages` 的锚点编织
                   （C2「不能在第一个锚点处切片」）和 `resolveTransientHistoryBridge`
                   的未加载页抑制（C4）都是被具体 issue 逼出来的形状，读代码看不出
                   哪一步在防什么，只有上游 2,381 行的 `message-merge.test.ts` 能
                   证明它们还成立。改这里之前先让那份测试红。

                   **2026-09-10：补上了 seq 骨架。** 此前本文件是从上游**加骨架之前**
                   的版本移植的（上游那一版的局部规则叫 canonicalMinSeq），于是排序
                   全靠身份锚点编织：一条 seq 已知、但在已加载窗口里找不到桥接身份的
                   消息，只能落到队尾而不是它在 feed 里的位置。位置这件事现在交给
                   `./message-seq` 的可信 seq——`mergeMessages` 用它建骨架、
                   `resolveTransientHistoryBridge` 用 `insertByTrustedSeq` 先插位再编织，
                   两处都是「骨架压过锚点猜测」。判据在 tests/unit/threads/message-seq.test.ts。

                   跟着骨架一起改掉的一处**本仓旧行为**：第一个共有锚点之前的受保护
                   前缀，此前是**压住不显示**的（宁可不显示，也不要视觉上抹平一段没加载
                   的历史空档）；上游改成无条件编织在锚点之前——位置的歧义交给骨架管，
                   而「用户真发过的消息在刷新之前一直看不见」是更坏的一头。

                   与上游唯一的实质差异：`EMPTY_MESSAGES` / `EMPTY_MESSAGE_IDENTITIES`
                   这两个稳定空数组在上游是为了不让 React 的 `useMemo` 依赖每帧失效；
                   Vue 侧 `computed` 是按需重算的，但这两个常量仍然保留——
                   它们同时是**默认参数的身份**，`resolveTransientHistoryBridge`
                   的 `previouslyRenderedOrder` 默认值靠引用相等做短路。
*/

import { getMessageRunId } from "../messages/run-duration";
import {
  MESSAGE_SEQ_KEY,
  insertByTrustedSeq,
  trustedMessageSeq,
} from "./message-seq";
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

type PositionedMessage = {
  message: Message;
  /*
    排序用的二元键。有 seq 的条目坐在 [seq, 0]；其余都锚在某个有位置的邻居上
    （见 mergeMessages）。键相等时靠**稳定排序**回落到插入顺序，于是一个无 seq 段
    不用额外的键间距就能保住段内顺序。
  */
  major: number;
  minor: number;
};

export function mergeMessages(
  historyMessages: Message[],
  threadMessages: Message[],
  optimisticMessages: Message[],
): Message[] {
  /*
    Pass 1：按身份收敛**可信位置**与值得保留的历史元数据。
    同一身份的多个可信 seq 收敛到**最早**的那个；隐藏的控制副本只在没有任何
    可见副本带位置时才贡献位置——于是一条被重新盖过键的提醒，拖不动那条可见的用户消息。
  */
  const visibleSeqByIdentity = new Map<string, number>();
  const anySeqByIdentity = new Map<string, number>();
  const savedTurnDurations = new Map<string, number>();
  const savedRunIds = new Map<string, string>();
  const collectTrustedSeq = (message: Message) => {
    const identity = messageIdentity(message);
    if (!identity) return;
    const seq = trustedMessageSeq(message);
    if (seq === undefined) return;
    const known = anySeqByIdentity.get(identity);
    if (known === undefined || seq < known) anySeqByIdentity.set(identity, seq);
    if (!isHiddenFromUIMessage(message)) {
      const knownVisible = visibleSeqByIdentity.get(identity);
      if (knownVisible === undefined || seq < knownVisible) {
        visibleSeqByIdentity.set(identity, seq);
      }
    }
  };
  const trustedSeqOf = (identity: string | undefined) =>
    identity === undefined
      ? undefined
      : (visibleSeqByIdentity.get(identity) ?? anySeqByIdentity.get(identity));
  for (const message of historyMessages) {
    collectTrustedSeq(message);
    const identity = messageIdentity(message);
    const runId = getMessageRunId(message);
    if (identity && runId) savedRunIds.set(identity, runId);
    if (identity && message.additional_kwargs?.turn_duration !== undefined) {
      savedTurnDurations.set(
        identity,
        message.additional_kwargs.turn_duration as number,
      );
    }
  }
  for (const message of threadMessages) collectTrustedSeq(message);

  const canonical = dedupeMessagesByIdentity(historyMessages);
  const live = dedupeMessagesByIdentity(threadMessages);
  const canonicalByIdentity = new Map(
    canonical.flatMap((message) => {
      const identity = messageIdentity(message);
      return identity ? [[identity, message] as const] : [];
    }),
  );

  /*
    Pass 2：走一遍实时尾巴。共有身份是排序锚点、并且可以替换权威内容；
    带可信 seq 的实时独有消息加入骨架；其余堆成「无 seq 段」，编织到它下一个
    共有锚点之前。

    一个被摘要过的 checkpoint 不一定是历史的连续后缀：中间件可能在头部留下
    受保护的 prompt/input、在尾部留下最近的一段。所以每个共有身份都算锚点，
    就地替换权威副本，新的实时消息织在下一个锚点之前（或最后一个锚点之后），
    于是一条受保护的早期输入不会被全局的「后者胜」去重挪到队尾。
  */
  const replacementByIdentity = new Map<string, Message>();
  const beforeAnchor = new Map<string, Message[]>();
  const skeletonLive: Message[] = [];
  let pending: Message[] = [];
  let trailingAnchorSeq: number | undefined;
  for (const message of live) {
    const identity = messageIdentity(message);
    const canonicalMessage = identity
      ? canonicalByIdentity.get(identity)
      : undefined;
    if (identity && canonicalMessage) {
      if (pending.length > 0) {
        beforeAnchor.set(identity, [
          ...(beforeAnchor.get(identity) ?? []),
          ...pending,
        ]);
      }
      pending = [];
      trailingAnchorSeq = undefined;
      // 隐藏的 checkpoint 控制消息不许替换一条恰好复用了同一身份的可见用户消息。
      // 其余情况下实时副本更新，就地替换而不移动位置。
      if (
        !isHiddenFromUIMessage(message) ||
        isHiddenFromUIMessage(canonicalMessage)
      ) {
        replacementByIdentity.set(identity, message);
      }
      continue;
    }
    if (identity && trustedSeqOf(identity) !== undefined) {
      // 一条有位置的实时独有结果，同时也是它前面那些步骤的锚点。
      beforeAnchor.set(identity, pending);
      pending = [];
      skeletonLive.push(message);
      trailingAnchorSeq = trustedSeqOf(identity);
      continue;
    }
    pending.push(message);
  }
  // 只有「实时独有且有位置」的锚点才能把尾随步骤拉进一个空档。
  // 共有锚点之后，保持权威源顺序直到队尾。
  const trailingPending = pending;

  /*
    Pass 3：给权威条目定位。没有可信 seq 的权威条目，保持它相对**前一条**
    有位置条目的既定位置（前面一条都没有时就排在最前）。
  */
  const entries: PositionedMessage[] = [];
  let minorCounter = 0;
  let previousCanonicalSeq = 0;
  let firstCanonicalSeq = Number.POSITIVE_INFINITY;
  for (const message of canonical) {
    const identity = messageIdentity(message);
    const seq = trustedSeqOf(identity);
    let major: number;
    let minor: number;
    if (seq !== undefined) {
      major = seq;
      minor = 0;
      previousCanonicalSeq = seq;
      firstCanonicalSeq = Math.min(firstCanonicalSeq, seq);
    } else {
      major = previousCanonicalSeq;
      minor = ++minorCounter;
    }
    if (identity) {
      // 已知排在这个锚点之前的无 seq 段，紧挨着它之前；稳定排序保住段内顺序。
      const segment = beforeAnchor.get(identity);
      if (segment) {
        for (const segmentMessage of segment) {
          entries.push({ message: segmentMessage, major, minor: minor - 0.5 });
        }
      }
    }
    const replacement = identity
      ? replacementByIdentity.get(identity)
      : undefined;
    entries.push({ message: replacement ?? message, major, minor });
  }
  for (const message of skeletonLive) {
    const identity = messageIdentity(message);
    const seq = trustedSeqOf(identity);
    if (seq === undefined) continue;
    for (const segmentMessage of beforeAnchor.get(identity!) ?? []) {
      entries.push({ message: segmentMessage, major: seq, minor: -0.5 });
    }
    entries.push({ message, major: seq, minor: 0 });
  }
  /*
    一条抢救回来的早期输入，可能排在一段**没加载的历史空档**之前，而它的后继
    属于新的这一轮 run。那些后继要留在队尾；在已加载窗口之内，尾随步骤则跟着
    它们的结果走。
  */
  const trailingMajor =
    trailingAnchorSeq !== undefined && trailingAnchorSeq >= firstCanonicalSeq
      ? trailingAnchorSeq
      : Number.POSITIVE_INFINITY;
  for (const message of trailingPending) {
    entries.push({ message, major: trailingMajor, minor: 0.5 });
  }
  for (const message of optimisticMessages) {
    entries.push({
      message,
      major: Number.POSITIVE_INFINITY,
      minor: ++minorCounter,
    });
  }

  const ordered = entries
    .slice()
    .sort((left, right) => left.major - right.major || left.minor - right.minor)
    .map((entry) => entry.message);

  const merged = dedupeMessagesByIdentity(ordered);

  /*
    Pass 4：把内容替换弄丢的排序元数据接回去。缺失或非法的 seq **永远不覆盖**
    已知位置；胜出那份内容的其余 additional_kwargs、run_id、turn_duration 原样带走。
  */
  return merged.map((message) => {
    const identity = messageIdentity(message);
    if (!identity) return message;
    const trustedSeq = trustedSeqOf(identity);
    const shouldRestoreSeq =
      trustedSeq !== undefined && trustedMessageSeq(message) !== trustedSeq;
    const shouldRestoreRunId =
      savedRunIds.has(identity) && !getMessageRunId(message);
    const shouldRestoreTurnDuration =
      savedTurnDurations.has(identity) &&
      message.additional_kwargs?.turn_duration === undefined;
    if (
      !shouldRestoreSeq &&
      !shouldRestoreRunId &&
      !shouldRestoreTurnDuration
    ) {
      return message;
    }
    return {
      ...message,
      ...(shouldRestoreRunId ? { run_id: savedRunIds.get(identity) } : {}),
      additional_kwargs: {
        ...message.additional_kwargs,
        ...(shouldRestoreSeq ? { [MESSAGE_SEQ_KEY]: trustedSeq } : {}),
        ...(shouldRestoreTurnDuration
          ? { turn_duration: savedTurnDurations.get(identity) }
          : {}),
      },
    } as Message;
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

  /*
    **可信 seq 压过身份锚点**——与 mergeMessages 用的是同一条位置优先级。
    一条抢救回来、而 seq 已知的消息，落在 feed 给它的位置上，哪怕已加载窗口里
    没有任何桥接身份与它重叠；没有可信位置的条目才退回下面的锚点编织。
  */
  const seqPositioned: Message[] = [];
  const unpositioned: Message[] = [];
  for (const message of missing) {
    if (trustedMessageSeq(message) !== undefined) seqPositioned.push(message);
    else unpositioned.push(message);
  }
  // 先把有位置的行放进去，编织才能把无位置的邻居锚在它们身上，
  // 而不会被之后的一次插入把顺序反过来。
  const positionedHistory = insertByTrustedSeq(visibleHistory, seqPositioned);
  const anchorIdentities = new Set(
    positionedHistory.map(messageIdentity).filter(isNonEmptyString),
  );
  const missingByIdentity = new Map(
    unpositioned.flatMap((message) => {
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

  for (const identity of bridgeOrder) {
    if (anchorIdentities.has(identity)) {
      if (pending.length > 0) {
        /*
          一个**靠 seq 抢救回来的锚点**保得住它捕获到的前缀，哪怕这一帧还没渲染过它。
          只有「锚在已加载历史上的**首个**前缀」才需要证明自己没有跨过一段
          没加载的游标空档——那种证明来自上一帧真渲染过的相对位置。
        */
        if (
          lastAnchorIdentity !== undefined ||
          !presentIdentities.has(identity)
        ) {
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
    return [...positionedHistory, ...unpositioned];
  }

  // A candidate added before its ordering snapshot (or carrying an identity
  // absent from that snapshot) cannot be anchored. Keep it in capture order at
  // the trailing edge of the anchored bridge rather than dropping it.
  for (const message of unpositioned) {
    const identity = messageIdentity(message);
    if (identity && !emittedMissingIdentities.has(identity)) {
      pending.push(message);
      emittedMissingIdentities.add(identity);
    }
  }

  const resolved: Message[] = [];
  for (const message of positionedHistory) {
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
