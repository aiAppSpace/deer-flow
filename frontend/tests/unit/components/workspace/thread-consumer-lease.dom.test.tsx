import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

import { useThreadChat } from "@/components/workspace/chats/use-thread-chat";
import {
  PARITY_OBSERVATION_CAPABILITY as CAP,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
  type ThreadConsumptionObservation,
} from "@/core/diagnostics/parity-observation";
import { useUploadLimits } from "@/core/uploads/hooks";

const { route, mint } = rs.hoisted(() => ({
  route: { search: "project=alpha" },
  mint: rs.fn(),
}));
rs.mock("next/navigation", () => ({
  usePathname: () => "/workspace/chats/new",
  useParams: () => ({ thread_id: "new" }),
  useSearchParams: () => new URLSearchParams(route.search),
}));
rs.mock("@/core/utils/uuid", () => ({ uuid: mint }));
let packets: ObservationPacket[];
let calls: string[];
let client: QueryClient;
let selected: ReturnType<typeof useThreadChat>;
let fail = false;
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
function Consumer({
  thread,
  observation,
}: {
  thread: string;
  observation?: ThreadConsumptionObservation | null;
}) {
  useUploadLimits(thread, { observation });
  return null;
}
function Owner() {
  selected = useThreadChat(undefined, {
    surface: "main",
    account: "alice",
    agent: null,
  });
  return (
    <>
      <Consumer
        thread={selected.threadId}
        observation={selected.consumptionObservation}
      />
      <Consumer
        thread={selected.threadId}
        observation={selected.consumptionObservation}
      />
    </>
  );
}
function host() {
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <Owner />
      </QueryClientProvider>
    </StrictMode>,
  );
}
beforeEach(() => {
  packets = [];
  calls = [];
  fail = false;
  route.search = "project=alpha";
  let serial = 0;
  mint.mockReset().mockImplementation(() => `draft-${++serial}`);
  window.history.replaceState(null, "", "/workspace/chats/new?project=alpha");
  client = new QueryClient();
  Object.defineProperty(window, CAP, {
    configurable: true,
    value: { version: 1, token: "mounted", action: "entry" },
  });
  window.addEventListener(EVENT, receive);
  rs.stubGlobal(
    "fetch",
    rs.fn(async (input: string) => {
      calls.push(String(input));
      return Response.json(
        fail ? { detail: "original failure" } : { max_file_size_bytes: 1024 },
        { status: fail ? 503 : 200 },
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAP);
  rs.unstubAllGlobals();
});

it("real React Query executes one shared limits request with the exact committed render lease", async () => {
  const view = host();
  await waitFor(() => expect(calls).toHaveLength(1));
  const consumers = packets.filter((p) => p.event === "uploads.limits");
  expect(consumers).toHaveLength(1);
  const consumer = consumers[0]!;
  const lease = packets.find(
    (p) =>
      p.event === "lease.select" &&
      p.values.lease === consumer.values.lease &&
      p.values.epoch === consumer.values.epoch,
  );
  expect(lease?.values.raw).toBe(selected.threadId);
  expect(consumer.values.raw).toBe(selected.threadId);
  expect(calls[0]).toContain(
    `/api/threads/${selected.threadId}/uploads/limits`,
  );
  const handle = selected.consumptionObservation;
  view.rerender(
    <StrictMode>
      <QueryClientProvider client={client}>
        <Owner />
      </QueryClientProvider>
    </StrictMode>,
  );
  expect(selected.consumptionObservation).toBe(handle);
  expect(calls).toHaveLength(1);
  view.unmount();
  handle!.uploadsLimits("late-old");
  expect(packets.at(-1)?.values).toMatchObject({
    raw: "late-old",
    state: "retired",
  });
});

it("project changes use a new allocated source without changing query admission or retry", async () => {
  const view = host();
  await waitFor(() => expect(calls).toHaveLength(1));
  const prior = selected.threadId;
  act(() => {
    route.search = "project=beta";
    view.rerender(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Owner />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(selected.threadId).not.toBe(prior);
  const last = packets.filter((p) => p.event === "uploads.limits").at(-1)!;
  expect(last.values.raw).toBe(selected.threadId);
  expect(
    packets.find(
      (p) => p.event === "lease.select" && p.values.lease === last.values.lease,
    )?.values.projectIntent,
  ).toBe("beta");
  expect(
    client
      .getQueryCache()
      .getAll()
      .every((q) => q.options.retry === false),
  ).toBe(true);
});

it("a failed original request is still witnessed once and keeps the query error", async () => {
  fail = true;
  host();
  await waitFor(() =>
    expect(
      client.getQueryState(["uploads", "limits", selected.threadId])?.status,
    ).toBe("error"),
  );
  expect(calls).toHaveLength(1);
  expect(packets.filter((p) => p.event === "uploads.limits")).toHaveLength(1);
  expect(
    String(
      client.getQueryState(["uploads", "limits", selected.threadId])?.error,
    ),
  ).toContain("original failure");
});

it.each([false, true])(
  "an unowned or throwing observer keeps the actual React query: throws=%s",
  async (throws) => {
    const observation = throws
      ? {
          uploadsLimits() {
            throw new Error("observer failed");
          },
        }
      : undefined;
    render(
      <QueryClientProvider client={client}>
        <Consumer thread="literal-saved" observation={observation} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        client.getQueryState(["uploads", "limits", "literal-saved"])?.status,
      ).toBe("success"),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/threads/literal-saved/uploads/limits");
    expect(packets).toHaveLength(1);
    expect(packets[0]?.event).toBe(throws ? "invalid" : "uploads.unowned");
    expect(packets[0]?.values).toEqual(
      throws
        ? { reason: "upload consumer observation failed" }
        : { raw: "literal-saved" },
    );
  },
);

it.each(["missing", "wrong-version", "closed"])(
  "inactive observation does not read or invoke a handle: %s",
  async (mode) => {
    if (mode === "wrong-version")
      Object.defineProperty(window, CAP, {
        configurable: true,
        value: { version: 2, token: "wrong", action: "entry" },
      });
    else Reflect.deleteProperty(window, CAP);
    fail = mode === "closed";
    const read = rs.fn();
    const consume = rs.fn();
    function OffConsumer() {
      useUploadLimits("literal-saved", {
        get observation() {
          read();
          return { uploadsLimits: consume };
        },
      });
      return null;
    }
    render(
      <QueryClientProvider client={client}>
        <OffConsumer />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        client.getQueryState(["uploads", "limits", "literal-saved"])?.status,
      ).toBe(fail ? "error" : "success"),
    );
    expect(calls).toHaveLength(1);
    expect(read).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(packets).toEqual([]);
  },
);
