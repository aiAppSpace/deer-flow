import { afterEach, beforeEach, expect, test, rs } from "@rstest/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  WorkspaceChannelRuntimeConfigHost,
  WorkspaceChannelsList,
} from "@/components/workspace/channels/workspace-channels-list";
import {
  useChannelProviders,
  useConfigureChannelProvider,
  useConnectChannelProvider,
} from "@/core/channels/hooks";
import { openConnectUrl } from "@/core/channels/open-connect-url";
import type { ChannelProvider } from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";
rs.mock("@/core/channels/hooks", () => ({
  useChannelProviders: rs.fn(),
  useConfigureChannelProvider: rs.fn(),
  useConnectChannelProvider: rs.fn(),
}));
rs.mock("@/core/i18n/hooks", () => ({ useI18n: () => ({ t: enUS }) }));
rs.mock("sonner", () => ({ toast: { success: rs.fn(), error: rs.fn() } }));
rs.mock("@/core/channels/open-connect-url", () => ({
  closeConnectWindow: rs.fn(),
  openConnectUrl: rs.fn(),
  prepareConnectWindow: rs.fn(() => null),
}));
rs.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ open: true }),
  SidebarGroup: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => (
    <li>{children}</li>
  ),
}));
rs.mock(
  "@/components/workspace/channels/channel-runtime-config-dialog",
  () => ({
    ChannelRuntimeConfigDialog: ({
      open,
      provider,
      onOpenChange,
      onSubmit,
    }: {
      open: boolean;
      provider: ChannelProvider | null;
      onOpenChange: (open: boolean) => void;
      onSubmit: (
        provider: ChannelProvider,
        values: Record<string, string>,
      ) => unknown;
    }) =>
      open && provider ? (
        <div role="dialog" aria-label={provider.display_name}>
          <button onClick={() => onOpenChange(false)}>
            close configuration
          </button>
          <button onClick={() => void onSubmit(provider, {})}>
            submit configuration
          </button>
        </div>
      ) : null,
  }),
);
function provider(id: string): ChannelProvider {
  return {
    provider: id,
    display_name: id,
    enabled: true,
    configured: false,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [
      { name: "token", label: "Token", type: "password", required: true },
    ],
  } as ChannelProvider;
}
function pending<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const configure = rs.fn();
const connect = rs.fn();
beforeEach(() => {
  rs.mocked(useChannelProviders).mockReturnValue({
    enabled: true,
    providers: [provider("slack"), provider("telegram")],
    isLoading: false,
    error: null,
  });
  rs.mocked(useConfigureChannelProvider).mockReturnValue({
    mutateAsync: configure,
    isPending: false,
  } as unknown as ReturnType<typeof useConfigureChannelProvider>);
  rs.mocked(useConnectChannelProvider).mockReturnValue({
    mutateAsync: connect,
    isPending: false,
  } as unknown as ReturnType<typeof useConnectChannelProvider>);
  connect.mockResolvedValue({ instruction: "bind current provider" });
});
afterEach(() => {
  cleanup();
  rs.clearAllMocks();
  configure.mockReset();
  connect.mockReset();
});
function open(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: "Connect" })[index]!);
}
for (const outcome of ["success", "failure"] as const)
  test(`a retired channel configuration ${outcome} cannot affect a reopened provider dialog`, async () => {
    const result = pending<ChannelProvider>();
    configure.mockReturnValue(result.promise);
    render(
      <>
        <WorkspaceChannelsList />
        <WorkspaceChannelRuntimeConfigHost />
      </>,
    );
    open(0);
    fireEvent.click(
      screen.getByRole("button", { name: "submit configuration" }),
    );
    await waitFor(() => expect(configure).toHaveBeenCalledTimes(1));
    fireEvent.click(
      screen.getByRole("button", { name: "close configuration" }),
    );
    open(1);
    await act(async () => {
      if (outcome === "success")
        result.resolve({ ...provider("slack"), configured: true });
      else result.reject(new Error("old configuration failed"));
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog", { name: "telegram" })).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
test("a current channel configuration still closes its dialog and starts binding", async () => {
  configure.mockResolvedValue({ ...provider("slack"), configured: true });
  render(
    <>
      <WorkspaceChannelsList />
      <WorkspaceChannelRuntimeConfigHost />
    </>,
  );
  open(0);
  fireEvent.click(screen.getByRole("button", { name: "submit configuration" }));
  await waitFor(() => expect(connect).toHaveBeenCalledWith("slack"));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("bind current provider"),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

for (const outcome of ["success", "failure"] as const)
  test(`a retired binding ${outcome} cannot affect the next configuration`, async () => {
    const result = pending<{ url: string }>();
    configure.mockResolvedValue({ ...provider("slack"), configured: true });
    connect.mockReturnValue(result.promise);
    render(
      <>
        <WorkspaceChannelsList />
        <WorkspaceChannelRuntimeConfigHost />
      </>,
    );
    open(0);
    fireEvent.click(
      screen.getByRole("button", { name: "submit configuration" }),
    );
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    open(1);
    await act(async () => {
      if (outcome === "success")
        result.resolve({ url: "https://example.test/old-binding" });
      else result.reject(new Error("old binding failed"));
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog", { name: "telegram" })).toBeTruthy();
    expect(openConnectUrl).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
