"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConfigureChannelProvider,
  useChannelProviders,
  useConnectChannelProvider,
} from "@/core/channels/hooks";
import {
  closeConnectWindow,
  openConnectUrl,
  prepareConnectWindow,
} from "@/core/channels/open-connect-url";
import {
  channelProviderName,
  providerCanConnect,
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
} from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

import { useWorkspaceSidebarExpanded } from "../workspace-sidebar-frame";

import { ChannelBindingCodeDialog } from "./channel-binding-code-dialog";
import { ChannelProviderIcon } from "./channel-provider-icon";
import { ChannelRuntimeConfigDialog } from "./channel-runtime-config-dialog";
import { ChannelScheduledUpdates } from "./channel-scheduled-updates";

function getProviderUnavailableReason(
  provider: ChannelProvider,
  t: ReturnType<typeof useI18n>["t"],
): string | undefined {
  if (provider.unavailable_reason) {
    return provider.unavailable_reason;
  }
  if (!provider.enabled) {
    return t.channels.disabled;
  }
  if (!provider.configured) {
    return t.channels.unconfigured;
  }
  return provider.unavailable_reason ?? undefined;
}

let runtimeConfigProvider: ChannelProvider | null = null;
let runtimeConfigGeneration = 0;
let runtimeConfigInitialStep: "setup" | "binding" = "setup";
const runtimeConfigListeners = new Set<() => void>();

function subscribeRuntimeConfig(listener: () => void) {
  runtimeConfigListeners.add(listener);
  return () => runtimeConfigListeners.delete(listener);
}

function setRuntimeConfigProvider(
  provider: ChannelProvider | null,
  initialStep: "setup" | "binding" = "setup",
) {
  runtimeConfigGeneration++;
  runtimeConfigInitialStep = initialStep;
  runtimeConfigProvider = provider;
  runtimeConfigListeners.forEach((listener) => listener());
}

let bindingCodeProvider: ChannelProvider | null = null;

function setBindingCodeProvider(provider: ChannelProvider | null) {
  bindingCodeProvider = provider;
  runtimeConfigListeners.forEach((listener) => listener());
}

function useBindingCodeProvider() {
  return useSyncExternalStore(
    subscribeRuntimeConfig,
    () => bindingCodeProvider,
    () => null,
  );
}

function useRuntimeConfigProvider() {
  return useSyncExternalStore(
    subscribeRuntimeConfig,
    () => runtimeConfigProvider,
    () => null,
  );
}

export function WorkspaceChannelRuntimeConfigHost() {
  const provider = useRuntimeConfigProvider();
  const bindingProvider = useBindingCodeProvider();
  const { t } = useI18n();
  const connectMutation = useConnectChannelProvider();
  const configureMutation = useConfigureChannelProvider();

  useEffect(
    () => () => {
      setRuntimeConfigProvider(null);
      setBindingCodeProvider(null);
    },
    [],
  );

  const startConnect = (
    nextProvider: ChannelProvider,
    preparedWindow?: Window | null,
  ) => {
    if (nextProvider.auth_mode === "binding_code") {
      closeConnectWindow(preparedWindow ?? null);
      setBindingCodeProvider(nextProvider);
      return;
    }
    const generation = runtimeConfigGeneration;
    const connectWindow =
      preparedWindow !== undefined
        ? preparedWindow
        : nextProvider.auth_mode === "deep_link"
          ? prepareConnectWindow()
          : null;
    void connectMutation
      .mutateAsync(nextProvider.provider)
      .then((result) => {
        if (generation !== runtimeConfigGeneration) {
          closeConnectWindow(connectWindow);
          return;
        }
        if (result.url) {
          openConnectUrl(result.url, connectWindow);
          return;
        }
        closeConnectWindow(connectWindow);
        toast.success(result.instruction);
      })
      .catch((error) => {
        closeConnectWindow(connectWindow);
        if (generation !== runtimeConfigGeneration) return;
        toast.error(
          error instanceof Error ? error.message : t.channels.unavailable,
        );
      });
  };

  return (
    <>
      <ChannelRuntimeConfigDialog
        onConfigured={() => {
          setRuntimeConfigProvider(null);
        }}
        provider={provider}
        initialStep={runtimeConfigInitialStep}
        open={provider !== null}
        submitting={configureMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRuntimeConfigProvider(null);
          }
        }}
        onSubmit={(provider, values) => {
          const generation = runtimeConfigGeneration;
          const connectWindow =
            provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
          return configureMutation
            .mutateAsync({ provider: provider.provider, values })
            .then((updated) => {
              if (generation !== runtimeConfigGeneration) {
                closeConnectWindow(connectWindow);
                return;
              }
              if (updated.provider === "wechat") return updated;
              setRuntimeConfigProvider(null);
              if (providerCanConnect(updated)) {
                startConnect(updated, connectWindow);
                return;
              }
              closeConnectWindow(connectWindow);
              toast.success(t.channels.connected);
            })
            .catch((error) => {
              closeConnectWindow(connectWindow);
              if (generation !== runtimeConfigGeneration) return;
              toast.error(
                error instanceof Error ? error.message : t.channels.unavailable,
              );
            });
        }}
      />
      <ChannelBindingCodeDialog
        provider={bindingProvider}
        open={bindingProvider !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBindingCodeProvider(null);
          }
        }}
      />
    </>
  );
}

export function WorkspaceChannelsList() {
  const isSidebarOpen = useWorkspaceSidebarExpanded();
  const { t } = useI18n();
  const { enabled, providers, isLoading, error } = useChannelProviders();
  const connectMutation = useConnectChannelProvider();
  const visibleProviders = providers.filter((provider) => provider.enabled);

  const startConnect = (
    provider: ChannelProvider,
    preparedWindow?: Window | null,
  ) => {
    if (provider.provider === "wechat") {
      closeConnectWindow(preparedWindow ?? null);
      setRuntimeConfigProvider(
        provider,
        provider.configured ? "binding" : "setup",
      );
      return;
    }
    // The command stays in a dialog with copy and expiry, not a passing toast.
    if (provider.auth_mode === "binding_code") {
      closeConnectWindow(preparedWindow ?? null);
      setBindingCodeProvider(provider);
      return;
    }
    const connectWindow =
      preparedWindow !== undefined
        ? preparedWindow
        : provider.auth_mode === "deep_link"
          ? prepareConnectWindow()
          : null;
    void connectMutation
      .mutateAsync(provider.provider)
      .then((result) => {
        if (result.url) {
          openConnectUrl(result.url, connectWindow);
          return;
        }
        closeConnectWindow(connectWindow);
        toast.success(result.instruction);
      })
      .catch((error) => {
        closeConnectWindow(connectWindow);
        toast.error(
          error instanceof Error ? error.message : t.channels.unavailable,
        );
      });
  };

  if (!isSidebarOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <SidebarGroup className="pt-0">
        <SidebarGroupLabel>{t.sidebar.channels}</SidebarGroupLabel>
        <div className="space-y-2 px-2 py-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </SidebarGroup>
    );
  }

  if (error || !enabled || visibleProviders.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="pt-0">
      <SidebarGroupLabel>{t.sidebar.channels}</SidebarGroupLabel>
      <SidebarMenu>
        {visibleProviders.map((provider) => {
          const canEditRuntimeConfig = providerCanEditRuntimeConfig(provider);
          const isConnected =
            !provider.unavailable_reason &&
            provider.connection_status === "connected";
          const isPending =
            connectMutation.isPending &&
            connectMutation.variables === provider.provider;
          const canConnect = providerCanConnect(provider);
          const unavailableReason = getProviderUnavailableReason(provider, t);

          return (
            <SidebarMenuItem key={provider.provider}>
              <div className="hover:bg-sidebar-accent flex flex-col rounded-md px-2 py-1 transition-colors">
                <div className="flex h-8 items-center gap-2">
                  <ChannelProviderIcon
                    provider={provider.provider}
                    className="size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {channelProviderName(provider, t)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isConnected ? "outline" : "secondary"}
                    className={cn(
                      "h-8 w-24 px-2 text-xs",
                      isConnected && "gap-1",
                    )}
                    disabled={isPending}
                    title={unavailableReason}
                    onClick={() => {
                      if (
                        providerNeedsRuntimeConfig(provider) ||
                        (isConnected && canEditRuntimeConfig)
                      ) {
                        setRuntimeConfigProvider(provider);
                        return;
                      }

                      if (!canConnect) {
                        toast.error(
                          unavailableReason ?? t.channels.unavailable,
                        );
                        return;
                      }

                      startConnect(provider);
                    }}
                  >
                    {isPending ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : isConnected ? (
                      <CheckIcon className="size-3.5" />
                    ) : null}
                    <span>
                      {isConnected ? t.channels.connected : t.channels.connect}
                    </span>
                  </Button>
                </div>
                {/* Only for a connected app, where the answer applies. Under the
                    name, full width: the row is too narrow beside the button. */}
                {isConnected ? (
                  <ChannelScheduledUpdates
                    provider={provider}
                    className="pb-0.5 pl-7 text-[11px] leading-snug [&_svg]:hidden"
                  />
                ) : null}
              </div>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
