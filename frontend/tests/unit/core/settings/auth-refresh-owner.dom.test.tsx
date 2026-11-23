import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { AuthProvider, useAuth, type User } from "@/core/auth/AuthProvider";
import { UserPreferencesBoundary } from "@/core/settings/user-preferences-boundary";

const mocks = rs.hoisted(() => ({ push: rs.fn() }));
rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/workspace/chats/new",
}));
rs.mock("@/core/static-mode", () => ({ isStaticWebsiteOnly: () => false }));
rs.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: () => () => undefined,
}));
const alice: User = {
  id: "alice",
  email: "alice@example.com",
  system_role: "admin",
  needs_setup: false,
};
let auth!: ReturnType<typeof useAuth>;
let client!: QueryClient;
const clients = new Set<QueryClient>();
function Consumer() {
  auth = useAuth();
  client = useQueryClient();
  clients.add(client);
  return (
    <>
      <output>{auth.user?.id ?? "signed-out"}</output>
      <input aria-label="Draft" defaultValue="" />
    </>
  );
}
function workspace(initialUser: User | null = alice) {
  return (
    <AuthProvider initialUser={initialUser}>
      <UserPreferencesBoundary>
        <Consumer />
      </UserPreferencesBoundary>
    </AuthProvider>
  );
}
beforeEach(() => mocks.push.mockReset());
afterEach(() => {
  cleanup();
  for (const owned of clients) owned.clear();
  clients.clear();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});

describe("real auth refresh and workspace query owner", () => {
  it.each(["transport", "json"] as const)(
    "retains account, cache and edited DOM on %s failure and same-account recovery",
    async (failure) => {
      const reason =
        failure === "transport"
          ? new TypeError("Network unavailable")
          : new SyntaxError("Invalid JSON");
      const fetchImpl = rs.fn<typeof fetch>();
      if (failure === "transport") fetchImpl.mockRejectedValueOnce(reason);
      else
        fetchImpl.mockResolvedValueOnce(
          new Response("{invalid", { status: 200 }),
        );
      fetchImpl.mockResolvedValueOnce(
        Response.json({ ...alice, email: "refreshed@example.com" }),
      );
      rs.stubGlobal("fetch", fetchImpl);
      const error = rs
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      render(workspace());
      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: "Draft",
      });
      fireEvent.change(input, { target: { value: "unsent draft" } });
      const original = client;
      original.setQueryData(["private"], "retained cache");
      await act(() => auth.refreshUser());
      expect(auth.user?.id).toBe("alice");
      expect(client).toBe(original);
      expect(client.getQueryData(["private"])).toBe("retained cache");
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Draft" }),
      ).toBe(input);
      expect(input.value).toBe("unsent draft");
      expect(auth.isLoading).toBe(false);
      expect(error).toHaveBeenCalledWith(
        "Failed to refresh user:",
        failure === "transport" ? reason : expect.any(SyntaxError),
      );
      expect(mocks.push).not.toHaveBeenCalled();
      await act(() => auth.refreshUser());
      expect(auth.user?.email).toBe("refreshed@example.com");
      expect(client).toBe(original);
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Draft" }),
      ).toBe(input);
      expect(input.value).toBe("unsent draft");
    },
  );

  it.each(["401", "logout", "switch"] as const)(
    "retires the old account workspace on %s",
    async (action) => {
      rs.stubGlobal(
        "fetch",
        rs
          .fn<typeof fetch>()
          .mockResolvedValue(
            action === "switch"
              ? Response.json({ ...alice, id: "bob" })
              : new Response(null, { status: action === "401" ? 401 : 204 }),
          ),
      );
      render(workspace());
      const original = client;
      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: "Draft",
      });
      fireEvent.change(input, { target: { value: "private draft" } });
      original.setQueryData(["private"], "alice-only");
      await act(() =>
        action === "logout" ? auth.logout() : auth.refreshUser(),
      );
      expect(auth.user?.id ?? null).toBe(action === "switch" ? "bob" : null);
      expect(client).not.toBe(original);
      expect(client.getQueryData(["private"])).toBeUndefined();
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Draft" }),
      ).not.toBe(input);
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Draft" }).value,
      ).toBe("");
      if (action === "401")
        expect(mocks.push).toHaveBeenCalledWith(
          "/login?next=%2Fworkspace%2Fchats%2Fnew",
        );
      if (action === "logout") expect(mocks.push).toHaveBeenCalledWith("/");
    },
  );

  it("keeps a failed cold-start probe signed out and reports the error", async () => {
    const reason = new TypeError("Offline");
    rs.stubGlobal("fetch", rs.fn<typeof fetch>().mockRejectedValue(reason));
    const error = rs
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(workspace(null));
    const original = client;
    await act(() => auth.refreshUser());
    expect(auth.user).toBeNull();
    expect(client).toBe(original);
    expect(auth.isLoading).toBe(false);
    expect(error).toHaveBeenCalledWith("Failed to refresh user:", reason);
  });
});
