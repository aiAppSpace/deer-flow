/*
  【文件职责】     算出「哪一组 present-files 该挂归档下载键」。
  【架构位置】     L3 纯函数
  【主要导出】     ArtifactArchiveCandidate · getArtifactArchiveCandidatesByGroupIndex
  【依赖关系】     ./run-duration(getMessageRunId) · ./utils(hasPresentFiles)
  【边界与注意】   **一次运行只挂一颗键，挂在它最后那一组上。**

                   同一次运行可能分几次呈递文件，每组各自画一份文件卡。压缩包是
                   按 run 打的、每次都是全量，所以每组都挂一颗的话，用户会看到
                   三颗内容一模一样的「下载当前版本（7 个文件）」，还以为是三批
                   不同的东西。挂最后一组，因为那时候文件才齐。

                   下面筛了两道——组类型、以及消息里有没有 present_files。按目前的
                   分组规则（utils.ts：present-files 组恒为单条、且那条必有
                   present_files）**这两道互为冗余**，任一单独存在都够。留着两道是
                   因为它们防的是分组规则朝两个不同方向变：一条 present_files 消息
                   被并进别的组（键会挂在不画文件列表的组上，丢掉），或者 present-files
                   组开始容纳别的消息（会取到别人的 run_id）。测试守的是行为
                   ——「别的组不挂键」——而不是哪一道检查生效。
*/

import { getMessageRunId } from "./run-duration";
import { hasPresentFiles, type MessageGroup } from "./utils";

export interface ArtifactArchiveCandidate {
  runId: string;
}

export function getArtifactArchiveCandidatesByGroupIndex(
  groups: MessageGroup[],
): Array<ArtifactArchiveCandidate | undefined> {
  const candidates = Array<ArtifactArchiveCandidate | undefined>(
    groups.length,
  ).fill(undefined);
  const lastGroupIndexByRunId = new Map<string, number>();

  groups.forEach((group, groupIndex) => {
    if (group.type !== "assistant:present-files") return;
    for (const message of group.messages) {
      if (!hasPresentFiles(message)) continue;
      const runId = getMessageRunId(message);
      if (!runId) continue;
      lastGroupIndexByRunId.set(runId, groupIndex);
    }
  });

  for (const [runId, groupIndex] of lastGroupIndexByRunId) {
    candidates[groupIndex] = { runId };
  }

  return candidates;
}
