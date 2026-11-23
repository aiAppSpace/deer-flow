/*
  【文件职责】     单一 artifact draft、编辑、离开确认与 beforeunload 生命周期 owner。
  【架构位置】     L3（DeerFlow artifacts）
  【主要导出】     useArtifactDraft / ArtifactDraftOwner
  【依赖关系】     core/artifacts/draft · vue-router
  【边界与注意】   只有本 owner 可决定 dirty 离开；listener 仅在 dirty 期间存在并随 scope 清理。
*/

import { computed, onScopeDispose, reactive, readonly, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";

import {
  completeArtifactSave,
  createArtifactDraftRecord,
  discardArtifactDraft,
  editArtifactDraft,
  failArtifactSave,
  isArtifactDraftDirty,
  reconcileArtifactRemote,
  type ArtifactDraftRecord,
} from "@/core/artifacts/draft";

const LEAVE_MESSAGE =
  "Discard unsaved artifact changes before leaving this view?";

export function useArtifactDraft(
  options: {
    confirm?: (message: string) => boolean;
  } = {},
) {
  const records = reactive<Record<string, ArtifactDraftRecord>>({});
  const editingPath = ref<string | null>(null);
  const confirmLeave =
    options.confirm ?? ((message: string) => globalThis.confirm(message));
  let beforeUnloadRegistered = false;

  function ensure(filepath: string) {
    return (records[filepath] ??= createArtifactDraftRecord(filepath));
  }

  function reconcile(
    filepath: string,
    remote: { content: string; sha256: string },
  ) {
    records[filepath] = reconcileArtifactRemote(ensure(filepath), remote);
    return records[filepath]!;
  }

  function update(filepath: string, content: string) {
    records[filepath] = editArtifactDraft(ensure(filepath), content);
  }

  function completeSave(
    filepath: string,
    saved: { content: string; sha256: string },
  ) {
    records[filepath] = completeArtifactSave(ensure(filepath), saved);
  }

  function failSave(filepath: string, status: number) {
    records[filepath] = failArtifactSave(ensure(filepath), status);
  }

  function discard(filepath: string) {
    records[filepath] = discardArtifactDraft(ensure(filepath));
  }

  function beginEdit(filepath: string) {
    editingPath.value = filepath;
  }

  const hasUnsavedDrafts = computed(() =>
    Object.values(records).some(isArtifactDraftDirty),
  );

  function requestLeave(filepath?: string) {
    const targets = filepath
      ? [filepath]
      : Object.keys(records).filter((path) =>
          isArtifactDraftDirty(records[path]!),
        );
    const dirtyTargets = targets.filter((path) =>
      isArtifactDraftDirty(ensure(path)),
    );
    if (dirtyTargets.length === 0) return true;
    if (!confirmLeave(LEAVE_MESSAGE)) return false;
    for (const path of dirtyTargets) discard(path);
    if (
      editingPath.value !== null &&
      dirtyTargets.includes(editingPath.value)
    ) {
      editingPath.value = null;
    }
    return true;
  }

  function requestExitEdit(filepath: string) {
    if (editingPath.value === filepath) editingPath.value = null;
    return true;
  }

  function reset() {
    for (const path of Object.keys(records))
      Reflect.deleteProperty(records, path);
    editingPath.value = null;
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault();
  }

  function removeBeforeUnload() {
    if (!beforeUnloadRegistered) return;
    globalThis.removeEventListener("beforeunload", beforeUnload);
    beforeUnloadRegistered = false;
  }

  watch(
    hasUnsavedDrafts,
    (dirty) => {
      if (typeof window === "undefined") return;
      if (dirty && !beforeUnloadRegistered) {
        globalThis.addEventListener("beforeunload", beforeUnload);
        beforeUnloadRegistered = true;
      } else if (!dirty) {
        removeBeforeUnload();
      }
    },
    { flush: "sync" },
  );

  onBeforeRouteLeave(() => (requestLeave() ? true : false));
  onBeforeRouteUpdate(() => (requestLeave() ? true : false));
  onScopeDispose(removeBeforeUnload);

  return {
    records,
    editingPath: readonly(editingPath),
    hasUnsavedDrafts,
    ensure,
    reconcile,
    update,
    completeSave,
    failSave,
    discard,
    beginEdit,
    requestLeave,
    requestExitEdit,
    reset,
  };
}

export type ArtifactDraftOwner = ReturnType<typeof useArtifactDraft>;
