/*
  【文件职责】     集中管理 composer 草稿 key、延迟恢复、保存与 accepted 清理。
  【架构位置】     L3 Vue 状态适配
  【主要导出】     useComposerDraft
  【依赖关系】     core/threads/composer-draft
  【边界与注意】   skill catalog ready 前不恢复；用户先输入时不得被迟到恢复覆盖。
*/

import {
  computed,
  nextTick,
  ref,
  onScopeDispose,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { ConversationReference } from "@/core/conversation-references";
import {
  inlineReferences,
  referenceToken,
} from "@/core/mentions/inline-references";

import {
  buildComposerDraftKey,
  clearComposerDraft,
  getSessionComposerDraftStorage,
  readComposerDraft,
  resolveComposerDraft,
  writeComposerDraft,
} from "@/core/threads/composer-draft";

export type ComposerDraftSnapshot = {
  key: string;
  text: string;
  skillName: string | null;
  conversationReferences?: ConversationReference[];
};

export function useComposerDraft(options: {
  userId: MaybeRefOrGetter<string | null | undefined>;
  agentName: MaybeRefOrGetter<string | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
  ready: MaybeRefOrGetter<boolean>;
  enabledSkillNames: MaybeRefOrGetter<ReadonlySet<string>>;
  text: Ref<string>;
  skillName?: Ref<string | null>;
  conversationReferences?: Ref<ConversationReference[]>;
}) {
  const skillName = options.skillName ?? ref<string | null>(null);
  const storage = getSessionComposerDraftStorage();
  const key = computed(() =>
    buildComposerDraftKey({
      userId: toValue(options.userId) || "anonymous",
      agentName: toValue(options.agentName),
      threadId: toValue(options.threadId),
    }),
  );
  let activeKey = key.value;
  let restored = false;
  let applying = false;
  let dirtyBeforeRestore = false;
  let restoreGeneration = 0;
  let pendingSubmission: ComposerDraftSnapshot | null = null;

  function matchesCurrent(snapshot: NonNullable<typeof pendingSubmission>) {
    return (
      snapshot.key === key.value &&
      snapshot.text === options.text.value &&
      snapshot.skillName === skillName.value &&
      JSON.stringify(snapshot.conversationReferences ?? []) ===
        JSON.stringify(options.conversationReferences?.value ?? [])
    );
  }

  function flush(optionsForFlush: { restorePending?: boolean } = {}) {
    if (!restored || applying) return;
    if (pendingSubmission?.key === activeKey) {
      if (matchesCurrent(pendingSubmission)) {
        if (optionsForFlush.restorePending) {
          writeComposerDraft(storage, pendingSubmission.key, {
            text: pendingSubmission.text,
            skillName: pendingSubmission.skillName,
            conversationReferences: pendingSubmission.conversationReferences,
          });
          pendingSubmission = null;
        }
        return;
      }
      pendingSubmission = null;
    }
    writeComposerDraft(storage, activeKey, {
      text: options.text.value,
      skillName: skillName.value,
      conversationReferences: options.conversationReferences?.value,
    });
  }

  async function restore() {
    const generation = ++restoreGeneration;
    if (!toValue(options.ready)) return;
    if (dirtyBeforeRestore) {
      activeKey = key.value;
      restored = true;
      flush();
      return;
    }
    applying = true;
    activeKey = key.value;
    const raw = readComposerDraft(storage, activeKey);
    const draft = raw
      ? resolveComposerDraft(raw, toValue(options.enabledSkillNames))
      : null;
    const text = draft?.text ?? "";
    // Legacy saved skills join the current inline-reference owner on restore.
    // Preserve an existing token, and let resolveComposerDraft keep disabled
    // names as editable slash text instead of activating an unavailable skill.
    options.text.value =
      draft?.skillName &&
      !inlineReferences(text).some(
        (reference) =>
          reference.kind === "skill" && reference.id === draft.skillName,
      )
        ? referenceToken("skill", draft.skillName, draft.skillName) +
          (text ? ` ${text}` : "")
        : text;
    skillName.value = null;
    if (options.conversationReferences)
      options.conversationReferences.value =
        draft?.conversationReferences ?? [];
    await nextTick();
    if (generation !== restoreGeneration) return;
    applying = false;
    restored = true;
    flush();
  }

  watch(
    key,
    () => {
      flush({ restorePending: true });
      restored = false;
      dirtyBeforeRestore = false;
      void restore();
    },
    { flush: "sync" },
  );
  watch(
    () => toValue(options.ready),
    (ready) => {
      if (ready && !restored) void restore();
    },
    { immediate: true },
  );
  watch(
    [options.text, skillName, () => options.conversationReferences?.value],
    () => {
      if (!restored && !applying) {
        dirtyBeforeRestore = true;
        return;
      }
      flush();
    },
  );

  function clearIfUnchanged(snapshot: ComposerDraftSnapshot) {
    if (snapshot.key !== key.value) {
      const stored = readComposerDraft(storage, snapshot.key);
      if (
        stored?.text === snapshot.text &&
        stored.skillName === snapshot.skillName &&
        JSON.stringify(stored.conversationReferences ?? []) ===
          JSON.stringify(snapshot.conversationReferences ?? [])
      )
        clearComposerDraft(storage, snapshot.key);
      if (pendingSubmission?.key === snapshot.key) pendingSubmission = null;
      return false;
    }
    if (!matchesCurrent(snapshot)) {
      return false;
    }
    if (pendingSubmission?.key === snapshot.key) pendingSubmission = null;
    clearComposerDraft(storage, snapshot.key);
    applying = true;
    options.text.value = "";
    skillName.value = null;
    if (options.conversationReferences)
      options.conversationReferences.value = [];
    applying = false;
    return true;
  }

  function beginSubmission(snapshot: ComposerDraftSnapshot) {
    if (!matchesCurrent(snapshot)) return false;
    pendingSubmission = JSON.parse(JSON.stringify(snapshot));
    clearComposerDraft(storage, snapshot.key);
    return true;
  }

  function cancelSubmission(snapshot: ComposerDraftSnapshot) {
    if (pendingSubmission?.key !== snapshot.key) return;
    pendingSubmission = null;
    if (snapshot.key === key.value) {
      writeComposerDraft(storage, snapshot.key, {
        text: options.text.value,
        skillName: skillName.value,
        conversationReferences: options.conversationReferences?.value,
      });
      return;
    }
    writeComposerDraft(storage, snapshot.key, {
      text: snapshot.text,
      skillName: snapshot.skillName,
      conversationReferences: snapshot.conversationReferences,
    });
  }

  const restorePendingSubmission = () => {
    if (pendingSubmission) flush({ restorePending: true });
  };
  function adoptThread(threadId: string) {
    const nextKey = buildComposerDraftKey({
      userId: toValue(options.userId) || "anonymous",
      agentName: toValue(options.agentName),
      threadId,
    });
    if (nextKey === key.value) return;
    writeComposerDraft(storage, nextKey, {
      text: options.text.value,
      skillName: skillName.value,
      conversationReferences: options.conversationReferences?.value,
    });
    clearComposerDraft(storage, key.value);
    restored = false;
  }
  // Ordinary edits are persisted synchronously by the value watcher. Only an
  // accepted-pending submission needs an unload fallback because beginSubmission
  // intentionally removed its stored copy. This also respects an explicit
  // sessionStorage.clear() instead of recreating a normal draft during reload.
  const pageHide = () => restorePendingSubmission();
  globalThis.addEventListener?.("pagehide", pageHide);
  onScopeDispose(() => {
    restoreGeneration += 1;
    restorePendingSubmission();
    globalThis.removeEventListener?.("pagehide", pageHide);
  });

  return {
    key,
    flush,
    restore,
    beginSubmission,
    cancelSubmission,
    clearIfUnchanged,
    adoptThread,
  };
}
