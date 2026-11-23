/*
  【文件职责】     固定Vue Query owner 的 scope、poll、mutation、刷新与 cleanup。
  【架构位置】     Vue DOM/composable test
  【主要导出】     无；Vitest cases
  【依赖关系】     @tanstack/vue-query · composables/useChannelConnections
  【边界与注意】   旧 scope 请求只能写旧 key；dispose 必须 abort query 与 poll observer。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { useChannelConnections } from "@/composables/useChannelConnections";
import { channelKeys } from "@/core/channels/query-keys";
import type {
  ChannelConnectResponse,
  ChannelConnection,
  ChannelProvider,
} from "@/core/channels/types";

const api = vi.hoisted(() => ({
  configureChannelProvider: vi.fn(),
  connectChannelProvider: vi.fn(),
  disconnectChannelConnection: vi.fn(),
  disconnectChannelProvider: vi.fn(),
  listChannelConnections: vi.fn(),
  listChannelProviders: vi.fn(),
}));

vi.mock("@/core/channels/api", () => api);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function provider(): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [],
  };
}

function connection(status = "connected"): ChannelConnection {
  return {
    id: "connection-a",
    provider: "slack",
    status,
    scopes: [],
    metadata: {},
  };
}

function connectResult(): ChannelConnectResponse {
  return {
    provider: "slack",
    mode: "binding_code",
    url: null,
    code: "code",
    instruction: "Send /connect code",
    expires_in: 30,
  };
}

function mountOwner(scope = ref("user-a"), pollIntervalMs = 1000) {
  let owner!: ReturnType<typeof useChannelConnections>;
  const Host = defineComponent({
    setup() {
      owner = useChannelConnections({
        scopeKey: scope,
        enabled: true,
        pollIntervalMs,
      });
      return () =>
        h(
          "div",
          owner.providerViews.value
            .map((view) => `${view.provider.provider}:${view.status}`)
            .join(","),
        );
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return { owner, queryClient, scope, wrapper };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useChannelConnections", () => {
  it("binds AbortSignal and late query results to their original user scope", async () => {
    const providersA = deferred<{
      enabled: boolean;
      providers: ChannelProvider[];
    }>();
    const providersB = deferred<{
      enabled: boolean;
      providers: ChannelProvider[];
    }>();
    const connectionsB = deferred<ChannelConnection[]>();
    const providerSignals: AbortSignal[] = [];
    const connectionSignals: AbortSignal[] = [];
    api.listChannelProviders.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        providerSignals.push(signal);
        return providerSignals.length === 1
          ? providersA.promise
          : providersB.promise;
      },
    );
    api.listChannelConnections.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        connectionSignals.push(signal);
        return connectionsB.promise;
      },
    );
    const scope = ref("user-a");
    const { queryClient, wrapper } = mountOwner(scope);

    await vi.waitFor(() => expect(providerSignals).toHaveLength(1));
    // providers 还没落地，就还没有任何 provider 需要解释状态——此时不问 connections。
    expect(connectionSignals).toHaveLength(0);
    scope.value = "user-b";
    await nextTick();
    await vi.waitFor(() => expect(providerSignals).toHaveLength(2));
    expect(providerSignals[0]?.aborted).toBe(true);

    providersB.resolve({ enabled: true, providers: [provider()] });
    await vi.waitFor(() => expect(connectionSignals).toHaveLength(1));
    connectionsB.resolve([connection()]);
    await vi.waitFor(() => expect(wrapper.text()).toBe("slack:connected"));
    providersA.resolve({ enabled: true, providers: [] });
    await Promise.resolve();
    await nextTick();

    expect(wrapper.text()).toBe("slack:connected");
    expect(queryClient.getQueryData(channelKeys.connections("user-b"))).toEqual(
      [connection()],
    );
    wrapper.unmount();
    queryClient.clear();
  });

  /*
    connections 请求自己也要跟着 scope 走。上一条用例里它压根没发出来（providers
    还在途），所以中止路径要单独测：providers 先落地、connections 在途，这时切用户。
  */
  it("aborts an in-flight connections request when the user scope changes", async () => {
    const connectionsA = deferred<ChannelConnection[]>();
    const connectionSignals: AbortSignal[] = [];
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        connectionSignals.push(signal);
        return connectionSignals.length === 1
          ? connectionsA.promise
          : Promise.resolve([connection()]);
      },
    );
    const scope = ref("user-a");
    const { queryClient, wrapper } = mountOwner(scope);

    await vi.waitFor(() => expect(connectionSignals).toHaveLength(1));
    scope.value = "user-b";
    await nextTick();
    await vi.waitFor(() => expect(connectionSignals[0]?.aborted).toBe(true));

    connectionsA.resolve([]);
    await vi.waitFor(() => expect(wrapper.text()).toBe("slack:connected"));
    expect(queryClient.getQueryData(channelKeys.connections("user-a"))).toBe(
      undefined,
    );
    wrapper.unmount();
    queryClient.clear();
  });

  it("deduplicates connect, polls authoritative connections and stops on dispose", async () => {
    vi.useFakeTimers();
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockResolvedValue([connection("pending")]);
    const pendingConnect = deferred<ChannelConnectResponse>();
    api.connectChannelProvider.mockReturnValue(pendingConnect.promise);
    const { owner, queryClient, wrapper } = mountOwner();
    await vi.waitFor(() => expect(wrapper.text()).toBe("slack:pending"));

    const first = owner.connect("slack");
    const duplicate = owner.connect("slack");
    await Promise.resolve();
    expect(api.connectChannelProvider).toHaveBeenCalledTimes(1);
    expect(owner.isProviderPending("slack")).toBe(true);
    pendingConnect.resolve(connectResult());
    await first;
    await duplicate;
    expect(owner.isProviderPending("slack")).toBe(false);
    await owner.connect("slack");
    expect(api.connectChannelProvider).toHaveBeenCalledTimes(2);

    const inFlightPoll = deferred<ChannelConnection[]>();
    api.listChannelConnections.mockReturnValueOnce(inFlightPoll.promise);
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.listChannelConnections.mock.calls.length).toBeGreaterThan(1);
    const pollSignal = api.listChannelConnections.mock.calls.at(-1)?.[0]
      ?.signal as AbortSignal;
    wrapper.unmount();
    expect(pollSignal.aborted).toBe(true);
    inFlightPoll.resolve([connection("connected")]);
    await Promise.resolve();
    const callsAtDispose = api.listChannelConnections.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.listChannelConnections).toHaveBeenCalledTimes(callsAtDispose);
    queryClient.clear();
  });

  it("disconnects an exact instance and provider runtime before authoritative refetch", async () => {
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockResolvedValue([connection()]);
    api.disconnectChannelConnection.mockResolvedValue(undefined);
    api.disconnectChannelProvider.mockResolvedValue({
      ...provider(),
      configured: false,
      connectable: false,
    });
    const { owner, queryClient, wrapper } = mountOwner();
    await vi.waitFor(() => expect(wrapper.text()).toBe("slack:connected"));
    const providerReadsBefore = api.listChannelProviders.mock.calls.length;
    const connectionReadsBefore = api.listChannelConnections.mock.calls.length;

    await owner.disconnectConnection("connection-a");
    expect(api.disconnectChannelConnection).toHaveBeenCalledWith(
      "connection-a",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(api.listChannelProviders.mock.calls.length).toBeGreaterThan(
      providerReadsBefore,
    );
    expect(api.listChannelConnections.mock.calls.length).toBeGreaterThan(
      connectionReadsBefore,
    );

    await owner.disconnectProvider("slack");
    expect(api.disconnectChannelProvider).toHaveBeenCalledWith(
      "slack",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    wrapper.unmount();
    queryClient.clear();
  });
});

describe("channel mutation account fencing", () => {
  it("does not refresh or repopulate any cache after global account retirement", async () => {
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockResolvedValue([]);
    const pending = deferred<ChannelProvider>();
    api.configureChannelProvider.mockReturnValue(pending.promise);
    const { owner, wrapper, queryClient } = mountOwner();
    await vi.waitFor(() => expect(owner.loaded.value).toBe(true));
    const operation = owner.configure("slack", {
      bot_token: "old-account-token",
    });
    await Promise.resolve();
    const reads = api.listChannelProviders.mock.calls.length;
    invalidateWorkspaceQueryOwner(queryClient);
    queryClient.clear();
    pending.resolve(provider());
    await operation;
    expect(api.listChannelProviders).toHaveBeenCalledTimes(reads);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    wrapper.unmount();
  });
  it("does not let an old mutation finalizer clear a new user's busy state", async () => {
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockResolvedValue([]);
    const a = deferred<ChannelProvider>();
    const b = deferred<ChannelProvider>();
    api.configureChannelProvider
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    const { owner, wrapper, queryClient, scope } = mountOwner();
    await vi.waitFor(() => expect(owner.loaded.value).toBe(true));
    const first = owner.configure("slack", { bot_token: "alice" });
    await Promise.resolve();
    scope.value = "user-b";
    await nextTick();
    const second = owner.configure("slack", { bot_token: "bob" });
    await Promise.resolve();
    a.resolve(provider());
    await first;
    expect(owner.isProviderPending("slack")).toBe(true);
    b.resolve(provider());
    await second;
    expect(owner.isProviderPending("slack")).toBe(false);
    wrapper.unmount();
    queryClient.clear();
  });
  it("retains a successful mutation result if its background catalog refresh fails", async () => {
    api.listChannelProviders.mockResolvedValue({
      enabled: true,
      providers: [provider()],
    });
    api.listChannelConnections.mockResolvedValue([]);
    api.configureChannelProvider.mockResolvedValue(provider());
    const { owner, wrapper, queryClient } = mountOwner();
    await vi.waitFor(() => expect(owner.loaded.value).toBe(true));
    api.listChannelProviders.mockRejectedValueOnce(
      new Error("Catalog unavailable"),
    );
    await expect(
      owner.configure("slack", { bot_token: "saved" }),
    ).resolves.toEqual(provider());
    expect(owner.isProviderPending("slack")).toBe(false);
    wrapper.unmount();
    queryClient.clear();
  });
});
