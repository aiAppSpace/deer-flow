/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     loadModels
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";

import { getBackendBaseURL } from "../config";

import type { ModelsResponse } from "./types";

export async function loadModels(
  options: { signal?: AbortSignal } = {},
): Promise<ModelsResponse> {
  const res = await fetch(`${getBackendBaseURL()}/api/models`, {
    signal: options.signal,
  });
  if (!res.ok) {
    await throwGatewayApiError(
      res,
      `Failed to load models: ${res.status} ${res.statusText}`.trim(),
    );
  }
  const data = (await res.json()) as Partial<ModelsResponse>;
  return {
    models: data.models ?? [],
    token_usage: data.token_usage ?? { enabled: false },
  };
}
