import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";

import { QueryClientProvider } from "@/components/query-client-provider";
import { UserPreferencesBoundary } from "@/core/settings/user-preferences-boundary";

const mocks = rs.hoisted(() => ({
  user: { id: "alice" } as { id: string } | null,
  load: rs.fn<(owner: string) => Promise<string>>(),
  write: rs.fn<(owner: string) => Promise<string>>(),
  start: rs.fn(() => rs.fn()),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
rs.mock("@/core/static-mode", () => ({ isStaticWebsiteOnly: () => false }));
rs.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: mocks.start,
}));

const clients = new Set<QueryClient>();
const owners = new Map<string, QueryClient>();
const observations: { owner: string; value: string | undefined }[] = [];
function Consumer() {
  const owner = mocks.user?.id ?? "signed-out";
  const client = useQueryClient();
  clients.add(client);
  owners.set(owner, client);
  const query = useQuery({
    queryKey: ["private-probe"],
    queryFn: () => mocks.load(owner),
    staleTime: Infinity,
    retry: false,
  });
  const late = useQuery<string>({ queryKey: ["late-write"], enabled: false });
  const mutation = useMutation({
    mutationFn: () => mocks.write(owner),
    onSuccess: (value) => client.setQueryData(["late-write"], value),
  });
  observations.push({ owner, value: query.data });
  return (
    <>
      <output data-testid="value">{query.data ?? "pending"}</output>
      <output data-testid="late">{late.data ?? "none"}</output>
      <button onClick={() => mutation.mutate()}>Write</button>
    </>
  );
}
// The outer provider is the pre-repair workspace composition. The boundary must
// isolate its consumers even when an enclosing public scope already has a cache.
function Workspace() {
  return (
    <QueryClientProvider>
      <UserPreferencesBoundary>
        <Consumer />
      </UserPreferencesBoundary>
    </QueryClientProvider>
  );
}
function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mocks.user = { id: "alice" };
  mocks.load
    .mockReset()
    .mockImplementation(async (owner) => `${owner}-private`);
  mocks.write.mockReset().mockImplementation(async (owner) => `${owner}-write`);
  mocks.start.mockClear();
  observations.length = 0;
  owners.clear();
});
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.clear();
});

describe("account-owned workspace server state", () => {
  it("isolates independent server renders of the same provider", () => {
    function ServerConsumer({ value }: { value?: string }) {
      const client = useQueryClient();
      clients.add(client);
      if (value) client.setQueryData(["server-private"], value);
      return (
        <output>
          {client.getQueryData<string>(["server-private"]) ?? "empty"}
        </output>
      );
    }
    expect(
      renderToString(
        <QueryClientProvider>
          <ServerConsumer value="alice-private" />
        </QueryClientProvider>,
      ),
    ).toContain("alice-private");
    expect(
      renderToString(
        <QueryClientProvider>
          <ServerConsumer />
        </QueryClientProvider>,
      ),
    ).toContain("empty");
    expect(clients.size).toBe(2);
  });

  it.each([false, true])(
    "keeps same-account cache and retires account changes (StrictMode=%s)",
    async (strict) => {
      const tree = () =>
        strict ? (
          <StrictMode>
            <Workspace />
          </StrictMode>
        ) : (
          <Workspace />
        );
      const view = render(tree());
      await screen.findByText("alice-private");
      const alice = owners.get("alice");
      const beforeRefresh = mocks.load.mock.calls.length;
      mocks.user = { id: "alice" };
      view.rerender(tree());
      expect(owners.get("alice")).toBe(alice);
      expect(mocks.load).toHaveBeenCalledTimes(beforeRefresh);
      for (const user of [
        { id: "bob" },
        null,
        { id: "default" },
        { id: "alice" },
      ]) {
        const prior = owners.get(mocks.user?.id ?? "signed-out");
        mocks.user = user;
        view.rerender(tree());
        const owner = user?.id ?? "signed-out";
        await screen.findByText(`${owner}-private`);
        expect(owners.get(owner)).not.toBe(prior);
      }
      expect(owners.get("alice")).not.toBe(alice);
      expect(
        observations.every(
          (row) =>
            row.value === undefined || row.value === `${row.owner}-private`,
        ),
      ).toBe(true);
    },
  );

  it("contains old non-abortable query and mutation completions in the retired cache", async () => {
    const oldRead = deferred();
    const oldWrite = deferred();
    mocks.load.mockImplementation((owner) =>
      owner === "alice" ? oldRead.promise : Promise.resolve(`${owner}-private`),
    );
    mocks.write.mockImplementation(() => oldWrite.promise);
    const view = render(<Workspace />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("alice"));
    const oldClient = owners.get("alice")!;
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledWith("alice"));
    mocks.user = { id: "bob" };
    view.rerender(<Workspace />);
    await screen.findByText("bob-private");
    await act(async () => {
      oldRead.resolve("alice-private");
      oldWrite.resolve("alice-write");
      await Promise.all([oldRead.promise, oldWrite.promise]);
    });
    await waitFor(() =>
      expect(oldClient.getQueryData(["late-write"])).toBe("alice-write"),
    );
    expect(screen.getByTestId("value").textContent).toBe("bob-private");
    expect(screen.getByTestId("late").textContent).toBe("none");
    expect(owners.get("bob")!.getQueryData(["late-write"])).toBeUndefined();
    expect(
      observations
        .filter((row) => row.owner === "bob")
        .every((row) => row.value === undefined || row.value === "bob-private"),
    ).toBe(true);
  });
});
