import { QueryClient } from "@tanstack/vue-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_QUERY_KEY,
  authSessionQueryOptions,
} from "@/core/auth/session-query";

const user = {
  id: "owner-1",
  email: "owner@example.com",
  system_role: "admin",
  needs_setup: false,
  oauth_provider: null,
};
const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
function client() {
  const result = new QueryClient();
  clients.push(result);
  return result;
}
function responses(...statuses: number[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const status of statuses) {
    fetchImpl.mockResolvedValueOnce(
      status === 200 ? Response.json(user) : new Response(null, { status }),
    );
  }
  return fetchImpl;
}

describe("shared session recovery", () => {
  it.each([403, 429, 503])(
    "retains an identified account after HTTP %i and still accepts the next authoritative 401",
    async (status) => {
      const queryClient = client();
      const known = {
        tag: "authenticated" as const,
        user: { ...user, permissions: ["threads:read"] },
      };
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, known);
      const fetchImpl = responses(status, 401);
      const options = authSessionQueryOptions(fetchImpl);
      await expect(queryClient.fetchQuery(options)).resolves.toEqual(known);
      await expect(queryClient.fetchQuery(options)).resolves.toEqual({
        tag: "unauthenticated",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["transport", "json"] as const)(
    "retains the identified session on %s failure, recovers, then accepts a real 401",
    async (failure) => {
      const queryClient = client();
      const known = { tag: "authenticated" as const, user };
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, known);
      const fetchImpl = vi.fn<typeof fetch>();
      if (failure === "transport")
        fetchImpl.mockRejectedValueOnce(new TypeError("Offline"));
      else
        fetchImpl.mockResolvedValueOnce(
          new Response("{invalid", { status: 200 }),
        );
      fetchImpl.mockResolvedValueOnce(
        Response.json({ ...user, email: "updated@example.com" }),
      );
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 401 }));
      const options = authSessionQueryOptions(fetchImpl);
      await expect(queryClient.fetchQuery(options)).resolves.toEqual(known);
      await expect(queryClient.fetchQuery(options)).resolves.toMatchObject({
        tag: "authenticated",
        user: { id: user.id, email: "updated@example.com" },
      });
      await expect(queryClient.fetchQuery(options)).resolves.toEqual({
        tag: "unauthenticated",
      });
    },
  );

  it("does not revive a previous owner after its session query was removed", async () => {
    const queryClient = client();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, {
      tag: "authenticated",
      user,
    });
    queryClient.removeQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    await expect(
      queryClient.fetchQuery(authSessionQueryOptions(responses(503))),
    ).resolves.toEqual({ tag: "unavailable" });
  });

  it("redirects an ordinary unauthenticated probe without the outage grace period", async () => {
    const queryClient = client();
    const fetchImpl = responses(401, 200, 401);
    const options = authSessionQueryOptions(fetchImpl);
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      tag: "unauthenticated",
    });
    await expect(queryClient.fetchQuery(options)).resolves.toMatchObject({
      tag: "authenticated",
      user,
    });
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      tag: "unauthenticated",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retains an unavailable session for two warm-up 401s and delegates the third probe", async () => {
    const queryClient = client();
    const fetchImpl = responses(503, 401, 401, 401, 401);
    const options = authSessionQueryOptions(fetchImpl);
    for (let probe = 0; probe < 3; probe += 1) {
      await expect(queryClient.fetchQuery(options)).resolves.toEqual({
        tag: "unavailable",
      });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      tag: "unauthenticated",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("applies the successful recovery response without a duplicate user request", async () => {
    const queryClient = client();
    const fetchImpl = responses(503, 200);
    const options = authSessionQueryOptions(fetchImpl);
    await queryClient.fetchQuery(options);
    await expect(queryClient.fetchQuery(options)).resolves.toMatchObject({
      tag: "authenticated",
      user,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("accepts a healthy delegated refresh after the third unauthorized probe", async () => {
    const queryClient = client();
    const fetchImpl = responses(503, 401, 401, 401, 200);
    const options = authSessionQueryOptions(fetchImpl);
    for (let probe = 0; probe < 3; probe += 1)
      await queryClient.fetchQuery(options);
    await expect(queryClient.fetchQuery(options)).resolves.toMatchObject({
      tag: "authenticated",
      user,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("decrements the unauthorized streak after a transient outage", async () => {
    const queryClient = client();
    const fetchImpl = responses(503, 401, 401, 503, 401, 401, 401);
    const options = authSessionQueryOptions(fetchImpl);
    for (let probe = 0; probe < 5; probe += 1) {
      await expect(queryClient.fetchQuery(options)).resolves.toEqual({
        tag: "unavailable",
      });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      tag: "unauthenticated",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it("shares one in-flight recovery between consumers", async () => {
    const queryClient = client();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, { tag: "unavailable" });
    let release!: (response: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const options = authSessionQueryOptions(fetchImpl);
    const first = queryClient.fetchQuery(options);
    const second = queryClient.fetchQuery(options);
    release(Response.json(user));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { tag: "authenticated", user },
      { tag: "authenticated", user },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not leak recovery attempts across clients or a removed session query", async () => {
    const first = client();
    const second = client();
    const firstFetch = responses(503, 401, 401);
    const options = authSessionQueryOptions(firstFetch);
    await first.fetchQuery(options);
    await first.fetchQuery(options);
    await first.fetchQuery(options);

    const secondFetch = responses(503, 401);
    await second.fetchQuery(authSessionQueryOptions(secondFetch));
    await expect(
      second.fetchQuery(authSessionQueryOptions(secondFetch)),
    ).resolves.toEqual({ tag: "unavailable" });
    expect(secondFetch).toHaveBeenCalledTimes(2);

    first.removeQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    const newSession = responses(503, 401);
    await first.fetchQuery(authSessionQueryOptions(newSession));
    await expect(
      first.fetchQuery(authSessionQueryOptions(newSession)),
    ).resolves.toEqual({ tag: "unavailable" });
    expect(newSession).toHaveBeenCalledTimes(2);
  });
});
