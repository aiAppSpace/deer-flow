import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));

import { fetch } from "@/core/api/fetcher";
import {
  DEFAULT_SCHEDULED_TASKS_FEATURE,
  fetchBrowserControlEnabled,
  fetchConversationReferencesCapability,
  fetchKnowledgeBaseFeature,
  fetchMcpTasksEnabled,
  fetchScheduledTasksFeature,
  fetchSubagentBatchesCapability,
  fetchThreadActivityFeature,
} from "@/core/features/api";

const mockedFetch = vi.mocked(fetch);
function respond(feature: Record<string, unknown> = {}) {
  mockedFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ agents_api: { enabled: true }, ...feature })),
  );
}

beforeEach(() => mockedFetch.mockReset());

describe("optional feature contracts", () => {
  it("keeps an older Gateway usable without inventing optional capabilities", async () => {
    respond();
    await expect(fetchBrowserControlEnabled()).resolves.toBe(false);
    respond();
    await expect(fetchMcpTasksEnabled()).resolves.toBe(false);
    respond();
    await expect(fetchSubagentBatchesCapability()).resolves.toEqual({
      repositoryAvailable: false,
      workerRunning: false,
      maxRunning: 0,
    });
    respond();
    await expect(fetchConversationReferencesCapability()).resolves.toEqual({
      enabled: false,
      maxReferences: 0,
    });
    respond();
    await expect(fetchKnowledgeBaseFeature()).resolves.toEqual({
      scopeSelectionEnabled: false,
    });
    respond();
    await expect(fetchThreadActivityFeature()).resolves.toEqual({
      available: false,
    });
    respond();
    await expect(fetchScheduledTasksFeature()).resolves.toEqual(
      DEFAULT_SCHEDULED_TASKS_FEATURE,
    );
  });

  it("preserves batch history independently of the worker and honors explicit new fields", async () => {
    respond({
      subagent_batches: {
        enabled: true,
        repository_available: true,
        worker_running: false,
        max_running: 3,
      },
    });
    await expect(fetchSubagentBatchesCapability()).resolves.toEqual({
      repositoryAvailable: true,
      workerRunning: false,
      maxRunning: 3,
    });
    respond({ subagent_batches: { enabled: true, max_running: 4 } });
    await expect(fetchSubagentBatchesCapability()).resolves.toEqual({
      repositoryAvailable: true,
      workerRunning: true,
      maxRunning: 4,
    });
  });

  it.each([0, -1, 1.5, "3", null])(
    "rejects malformed conversation reference limits (%s)",
    async (maxReferences) => {
      respond({
        conversation_references: {
          enabled: true,
          max_references: maxReferences,
        },
      });
      await expect(fetchConversationReferencesCapability()).resolves.toEqual({
        enabled: true,
        maxReferences: 0,
      });
    },
  );

  it("keeps knowledge, references, browser and MCP independent", async () => {
    respond({ conversation_references: { enabled: true, max_references: 3 } });
    await expect(fetchConversationReferencesCapability()).resolves.toEqual({
      enabled: true,
      maxReferences: 3,
    });
    respond({ knowledge_base: { scope_selection_enabled: true } });
    await expect(fetchKnowledgeBaseFeature()).resolves.toEqual({
      scopeSelectionEnabled: true,
    });
    respond({ thread_activity: { available: "true" } });
    await expect(fetchThreadActivityFeature()).resolves.toEqual({
      available: false,
    });
  });

  it("keeps scheduler persistence, execution and chat tools separate", async () => {
    respond({
      scheduled_tasks: {
        available: true,
        running: false,
        tool_enabled: false,
        min_interval_seconds: 30,
      },
    });
    await expect(fetchScheduledTasksFeature()).resolves.toEqual({
      available: true,
      running: false,
      toolEnabled: false,
      minIntervalSeconds: 30,
    });
  });

  it.each([0, -1, 0.5, "10", null])(
    "uses scheduler legacy defaults for malformed fields (%s)",
    async (minimum) => {
      respond({
        scheduled_tasks: {
          available: false,
          running: "false",
          tool_enabled: "true",
          min_interval_seconds: minimum,
        },
      });
      await expect(fetchScheduledTasksFeature()).resolves.toEqual({
        ...DEFAULT_SCHEDULED_TASKS_FEATURE,
        available: false,
      });
    },
  );

  it("passes cancellation to discovery and leaves transport errors observable", async () => {
    const controller = new AbortController();
    respond({ browser_control: { enabled: true } });
    await expect(
      fetchBrowserControlEnabled({ signal: controller.signal }),
    ).resolves.toBe(true);
    expect(mockedFetch).toHaveBeenCalledWith("/api/features", {
      signal: controller.signal,
    });
    mockedFetch.mockResolvedValueOnce(
      new Response("", { status: 503, statusText: "Unavailable" }),
    );
    await expect(fetchScheduledTasksFeature()).rejects.toThrow("Unavailable");
  });
});
