/*
  【文件职责】     文本 artifact 的 baseline、remote、draft 与冲突状态机。
  【架构位置】     L3
  【主要导出】     ArtifactDraftRecord 及纯状态转换
  【依赖关系】     无
  【边界与注意】   远端刷新和 412 永不覆盖 dirty draft；discard 以最新已知 remote 为准。
*/

export interface ArtifactDraftRecord {
  filepath: string;
  baselineContent: string;
  baselineSha256: string | null;
  remoteContent: string;
  remoteSha256: string | null;
  draftContent: string;
  conflict: boolean;
}

export function createArtifactDraftRecord(
  filepath: string,
): ArtifactDraftRecord {
  return {
    filepath,
    baselineContent: "",
    baselineSha256: null,
    remoteContent: "",
    remoteSha256: null,
    draftContent: "",
    conflict: false,
  };
}

export function isArtifactDraftDirty(record: ArtifactDraftRecord) {
  return record.draftContent !== record.baselineContent;
}

export function reconcileArtifactRemote(
  current: ArtifactDraftRecord,
  remote: { content: string; sha256: string },
): ArtifactDraftRecord {
  if (
    remote.sha256 === current.remoteSha256 &&
    remote.content === current.remoteContent
  ) {
    return current;
  }

  if (isArtifactDraftDirty(current)) {
    return {
      ...current,
      remoteContent: remote.content,
      remoteSha256: remote.sha256,
      conflict:
        remote.sha256 !== current.baselineSha256 ||
        remote.content !== current.baselineContent,
    };
  }

  return {
    ...current,
    baselineContent: remote.content,
    baselineSha256: remote.sha256,
    remoteContent: remote.content,
    remoteSha256: remote.sha256,
    draftContent: remote.content,
    conflict: false,
  };
}

export function editArtifactDraft(
  current: ArtifactDraftRecord,
  content: string,
): ArtifactDraftRecord {
  return { ...current, draftContent: content };
}

export function completeArtifactSave(
  current: ArtifactDraftRecord,
  saved: { content: string; sha256: string },
): ArtifactDraftRecord {
  return {
    ...current,
    baselineContent: saved.content,
    baselineSha256: saved.sha256,
    remoteContent: saved.content,
    remoteSha256: saved.sha256,
    conflict: false,
  };
}

export function failArtifactSave(
  current: ArtifactDraftRecord,
  status: number,
): ArtifactDraftRecord {
  return status === 412 ? { ...current, conflict: true } : current;
}

export function discardArtifactDraft(
  current: ArtifactDraftRecord,
): ArtifactDraftRecord {
  return {
    ...current,
    baselineContent: current.remoteContent,
    baselineSha256: current.remoteSha256,
    draftContent: current.remoteContent,
    conflict: false,
  };
}
