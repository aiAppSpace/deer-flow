/*
  【文件职责】     合并子任务实时/历史/终态数据并生成稳定展示模型。
  【架构位置】     L3
  【主要导出】     buildSubtaskCardViewModel
  【依赖关系】     tasks/presentation · steps · subtask-result
  【边界与注意】   只做纯计算；历史 backfill 的网络与展开状态留在组件。

                   这里**不产状态文案**。曾经有一个 `statusLabel`，三支写死英文，
                   其中 completed 那支还是 "Completed" 而上游是 "Subtask completed"
                   ——既漏翻（zh-CN 下照样念英文）又和上游文案不一致。上游读的是
                   `t.subtasks[status]`，而且折叠头在 in_progress 时优先显示的是
                   最后一次工具调用的解释，不是状态词；那是带 i18n 的展示逻辑，
                   属于组件，不属于这个纯函数。
*/
import type { Model } from "@/core/models/types";

import {
  formatSubtaskTokenUsage,
  resolveSubtaskModelLabel,
} from "./presentation";
import { mergeSteps, stepsForDisplay, type SubtaskStep } from "./steps";
import type { SubtaskResultUpdate } from "./subtask-result";
import type { Subtask } from "./types";

export interface SubtaskCardViewModel {
  id: string;
  status: Subtask["status"];
  description: string;
  prompt: string;
  modelLabel?: string;
  tokenLabel?: string;
  steps: SubtaskStep[];
  result?: string;
  error?: string;
}

export function buildSubtaskCardViewModel(options: {
  id: string;
  description: string;
  prompt: string;
  pendingStatus: Subtask["status"];
  liveTask?: Subtask;
  terminal?: SubtaskResultUpdate;
  historicalSteps?: SubtaskStep[];
  models?: Model[];
}): SubtaskCardViewModel {
  const { liveTask, terminal } = options;
  const status = terminal?.status ?? liveTask?.status ?? options.pendingStatus;
  const steps = stepsForDisplay(
    mergeSteps(liveTask?.steps ?? [], options.historicalSteps ?? []),
    status,
  );
  const modelName = terminal?.modelName ?? liveTask?.modelName;
  const usage = terminal?.usage ?? liveTask?.usage;
  return {
    id: options.id,
    status,
    description: options.description,
    prompt: options.prompt,
    modelLabel: resolveSubtaskModelLabel(modelName, options.models ?? []),
    tokenLabel: formatSubtaskTokenUsage(usage),
    steps,
    result: terminal?.result ?? liveTask?.result,
    error: terminal?.error ?? liveTask?.error,
  };
}
