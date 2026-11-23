/*
  【文件职责】     调用 Gateway Memory document、CRUD、import/export HTTP 合同。
  【架构位置】     L3 Gateway adapter
  【主要导出】     load/clear/create/update/delete/import/export Memory
  【依赖关系】     authenticated fetch · shared Gateway error parser
  【边界与注意】   所有方法可取消；非 2xx 保留 status/detail，响应不压扁 metadata。
*/

import { readGatewayResponseError } from "../api/errors";
import { fetch } from "../api/fetcher";
import { getBackendBaseURL } from "../config";

import { normalizeMemoryPayload } from "./schema";

import type {
  MemoryFactInput,
  MemoryFactPatchInput,
  UserMemory,
} from "./types";

async function readMemoryResponse(
  response: Response,
  fallbackMessage: string,
): Promise<UserMemory> {
  function formatErrorDetail(detail: unknown): string | null {
    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            if (typeof record.msg === "string") {
              return record.msg;
            }

            try {
              return JSON.stringify(record);
            } catch {
              return null;
            }
          }

          return String(item);
        })
        .filter(Boolean);

      return parts.length > 0 ? parts.join("; ") : null;
    }

    if (detail && typeof detail === "object") {
      try {
        return JSON.stringify(detail);
      } catch {
        return null;
      }
    }

    if (
      typeof detail === "string" ||
      typeof detail === "number" ||
      typeof detail === "boolean" ||
      typeof detail === "bigint"
    ) {
      return String(detail);
    }

    if (typeof detail === "symbol") {
      return detail.description ?? null;
    }

    return null;
  }

  if (!response.ok) {
    const error = await readGatewayResponseError(response, fallbackMessage);
    const detail =
      error.body && typeof error.body === "object"
        ? Reflect.get(error.body, "detail")
        : undefined;
    const detailMessage = formatErrorDetail(detail);
    error.message =
      detailMessage ?? `${fallbackMessage}: ${response.statusText}`;
    throw error;
  }

  const normalized = normalizeMemoryPayload(await response.json(), {
    invalidFactStrategy: "drop",
  });
  if (!normalized) throw new Error("Invalid memory payload");
  return normalized;
}

export async function loadMemory(
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(`${getBackendBaseURL()}/api/memory`, options);
  return readMemoryResponse(response, "Failed to fetch memory");
}

export async function clearMemory(
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(`${getBackendBaseURL()}/api/memory`, {
    method: "DELETE",
    signal: options.signal,
  });
  return readMemoryResponse(response, "Failed to clear memory");
}

export async function deleteMemoryFact(
  factId: string,
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/memory/facts/${encodeURIComponent(factId)}`,
    {
      method: "DELETE",
      signal: options.signal,
    },
  );
  return readMemoryResponse(response, "Failed to delete memory fact");
}

export async function exportMemory(
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(`${getBackendBaseURL()}/api/memory/export`, {
    signal: options.signal,
  });
  return readMemoryResponse(response, "Failed to export memory");
}

/** Only observes the original memory object at the native fetch-call boundary. */
export type MemoryImportDispatchObserver = (
  memory: UserMemory,
  preAborted: boolean,
) => void;

export async function importMemory(
  memory: UserMemory,
  options: { signal?: AbortSignal } = {},
  observeDispatch?: MemoryImportDispatchObserver,
): Promise<UserMemory> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/memory/import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(memory),
      signal: options.signal,
    },
    observeDispatch
      ? (preAborted) => observeDispatch(memory, preAborted)
      : undefined,
  );
  return readMemoryResponse(response, "Failed to import memory");
}

export async function createMemoryFact(
  input: MemoryFactInput,
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(`${getBackendBaseURL()}/api/memory/facts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });
  return readMemoryResponse(response, "Failed to create memory fact");
}

export async function updateMemoryFact(
  factId: string,
  input: MemoryFactPatchInput,
  options: { signal?: AbortSignal } = {},
): Promise<UserMemory> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/memory/facts/${encodeURIComponent(factId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: options.signal,
    },
  );
  return readMemoryResponse(response, "Failed to update memory fact");
}
