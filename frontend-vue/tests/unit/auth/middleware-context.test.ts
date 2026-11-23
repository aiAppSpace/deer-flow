import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  active: true,
  disabled: "",
  fetchQuery: vi.fn(),
}));
vi.mock("@tanstack/vue-query", () => ({
  useQueryClient() {
    if (!fixture.active)
      throw new Error("injection context retired after await");
    return { fetchQuery: fixture.fetchQuery };
  },
}));
vi.mock("@/core/auth/session-query", () => ({
  authSessionQueryOptions: () => ({ queryKey: ["auth", "session"] }),
}));

beforeEach(() => {
  fixture.active = true;
  fixture.disabled = "";
  fixture.fetchQuery.mockReset().mockResolvedValue({
    tag: "authenticated",
    user: { id: "alice", needs_setup: false },
  });
  vi.stubGlobal("defineNuxtRouteMiddleware", (handler: unknown) => handler);
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { authDisabled: fixture.disabled },
  }));
  vi.stubGlobal(
    "navigateTo",
    vi.fn((location: string) => location),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("captures the query owner before the artifact target import retires injection context", async () => {
  const { default: middleware } = await import("@/middleware/auth.global");
  const invoke = middleware as unknown as (route: {
    path: string;
    fullPath: string;
    query: Record<string, string>;
  }) => Promise<unknown>;
  const result = invoke({
    path: "/artifacts/view",
    fullPath:
      "/artifacts/view?thread_id=alice-thread&path=%2Fmnt%2Fuser-data%2Foutputs%2Freport.csv",
    query: {
      thread_id: "alice-thread",
      path: "/mnt/user-data/outputs/report.csv",
    },
  });
  fixture.active = false;
  await expect(result).resolves.toBeUndefined();
  expect(fixture.fetchQuery).toHaveBeenCalledExactlyOnceWith({
    queryKey: ["auth", "session"],
  });
});

it("does not inject a query owner on public or auth-disabled navigation", async () => {
  const { default: middleware } = await import("@/middleware/auth.global");
  const invoke = middleware as unknown as (route: {
    path: string;
    fullPath: string;
    query: Record<string, string>;
  }) => Promise<unknown>;
  fixture.active = false;
  await expect(
    invoke({ path: "/", fullPath: "/", query: {} }),
  ).resolves.toBeUndefined();
  fixture.disabled = "1";
  await expect(
    invoke({
      path: "/workspace/chats/new",
      fullPath: "/workspace/chats/new",
      query: {},
    }),
  ).resolves.toBeUndefined();
  expect(fixture.fetchQuery).not.toHaveBeenCalled();
});
