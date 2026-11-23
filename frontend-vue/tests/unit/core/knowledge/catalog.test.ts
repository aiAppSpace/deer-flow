import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@/core/api/fetcher";
import { GatewayResponseError } from "@/core/api/errors";
import {
  listRetrievalCatalogDatasets,
  listRetrievalCatalogDocuments,
} from "@/core/knowledge";
vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(fetch).mockReset();
});
describe("knowledge catalog contract", () => {
  it("preserves assistant, pagination and trimmed search while consuming cancellation", async () => {
    const signal = new AbortController().signal;
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ items: [], page: 2, page_size: 100, total: 0 }),
    );
    await listRetrievalCatalogDatasets({
      agentName: "analyst/一",
      page: 2,
      search: "  policy & rules  ",
      signal,
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    const parsed = new URL(String(url), "https://deerflow.test");
    expect(parsed.pathname).toBe("/api/knowledge/retrieval-catalog/datasets");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      agent_name: "analyst/一",
      page: "2",
      page_size: "100",
      search: "policy & rules",
    });
    expect(init?.signal).toBe(signal);
  });
  it("encodes dataset identifiers independently from assistant identifiers", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ items: [], page: 1, page_size: 100, total: 0 }),
    );
    await listRetrievalCatalogDocuments({
      agentName: "lead_agent",
      datasetId: "id/percent%",
      page: 1,
    });
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain(
      "/datasets/id%2Fpercent%25/documents?",
    );
  });
  it.each([409, 503])(
    "preserves %s for unavailable scope/config without automatic requests",
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(
        Response.json({ detail: "Scope unavailable" }, { status }),
      );
      const failure = await listRetrievalCatalogDatasets({
        agentName: "lead_agent",
        page: 1,
      }).catch((error) => error);
      expect(failure).toBeInstanceOf(GatewayResponseError);
      expect(failure).toMatchObject({ status, message: "Scope unavailable" });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});
