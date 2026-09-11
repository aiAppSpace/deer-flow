"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  PlugIcon,
  UnplugIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useAuth } from "@/core/auth/AuthProvider";
import {
  useConfigureChannelProvider,
  useChannelConnections,
  useChannelProviders,
  useConnectChannelProvider,
  useDisconnectChannelConnection,
  useDisconnectChannelProvider,
} from "@/core/channels/hooks";
import {
  closeConnectWindow,
  openConnectUrl,
  prepareConnectWindow,
} from "@/core/channels/open-connect-url";
import {
  providerCanConnect,
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
} from "@/core/channels/provider-state";
import type { ChannelConnection, ChannelProvider } from "@/core/channels/types";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

import { ChannelProviderIcon } from "../channels/channel-provider-icon";
import { ChannelRuntimeConfigDialog } from "../channels/channel-runtime-config-dialog";

import { SettingsSection } from "./settings-section";

function getProviderDescription(
  provider: ChannelProvider,
  descriptions: Record<string, string>,
): string {
  return descriptions[provider.provider] ?? provider.display_name;
}

function getConnectionLabel(connection: ChannelConnection): string | null {
  const account = connection.external_account_name;
  const workspace = connection.workspace_name;
  if (account && workspace) {
    return `${account} · ${workspace}`;
  }
  return account ?? workspace ?? connection.external_account_id ?? null;
}

function getStatusLabel(
  provider: ChannelProvider,
  connection: ChannelConnection | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (!provider.enabled) {
    return t.channels.disabled;
  }
  if (!provider.configured) {
    return t.channels.unconfigured;
  }
  if (provider.unavailable_reason) {
    return t.channels.unavailableShort;
  }
  const status = connection?.status ?? provider.connection_status;
  if (status === "connected") {
    return t.channels.connected;
  }
  if (status === "pending") {
    return t.channels.pending;
  }
  if (status === "revoked") {
    return t.channels.revoked;
  }
  return t.channels.notConnected;
}

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

function ChannelProviderItem({
  provider,
  connection,
}: {
  provider: ChannelProvider;
  connection?: ChannelConnection;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  /*
    `DELETE /channels/{provider}/runtime-config` 在 Gateway 那边第一句就是
    `await require_admin_user(...)`（channel_connections.py:571）。这颗键原来对
    **所有人**渲染，非管理员点下去拿到 403，toast 只说
    "Failed to disconnect {provider}"——用户看不出这是权限问题。
    同一目录下 skill / subagent / integrations 三个设置页早就用的是这一行判据。
  */
  const isAdmin = user?.system_role === "admin";
  const connectMutation = useConnectChannelProvider();
  const configureMutation = useConfigureChannelProvider();
  const disconnectProviderMutation = useDisconnectChannelProvider();
  const disconnectConnectionMutation = useDisconnectChannelConnection();
  const [setupOpen, setSetupOpen] = useState(false);
  const runtimeAvailable = provider.configured && !provider.unavailable_reason;
  const isConnected =
    runtimeAvailable &&
    (connection?.status === "connected" ||
      provider.connection_status === "connected");
  const canEditRuntimeConfig = providerCanEditRuntimeConfig(provider);
  const canConnect =
    (provider.connectable ?? (provider.enabled && provider.configured)) &&
    !isConnected;
  const isConnecting =
    (connectMutation.isPending &&
      connectMutation.variables === provider.provider) ||
    (configureMutation.isPending &&
      configureMutation.variables?.provider === provider.provider);
  const isDisconnecting =
    disconnectProviderMutation.isPending &&
    disconnectProviderMutation.variables === provider.provider;
  const isDisconnectingConnection =
    disconnectConnectionMutation.isPending &&
    disconnectConnectionMutation.variables === connection?.id;
  const connectionLabel = connection ? getConnectionLabel(connection) : null;
  const statusLabel = getStatusLabel(provider, connection, t);
  const unavailableReason = getProviderUnavailableReason(provider, t);

  const startConnect = (
    connectProvider: ChannelProvider,
    preparedWindow?: Window | null,
  ) => {
    const connectWindow =
      preparedWindow !== undefined
        ? preparedWindow
        : connectProvider.auth_mode === "deep_link"
          ? prepareConnectWindow()
          : null;
    void connectMutation
      .mutateAsync(connectProvider.provider)
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

  return (
    <>
      <Item variant="outline" className="w-full items-start">
        <ItemMedia variant="icon" className="bg-background">
          <ChannelProviderIcon
            provider={provider.provider}
            className="size-5"
          />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full">
            <span className="truncate">{provider.display_name}</span>
            <Badge
              variant={isConnected ? "default" : "outline"}
              className={cn(!isConnected && "text-muted-foreground")}
            >
              {isConnected ? <CheckCircle2Icon /> : <AlertCircleIcon />}
              {statusLabel}
            </Badge>
          </ItemTitle>
          <ItemDescription className="line-clamp-none">
            {getProviderDescription(provider, t.channels.descriptions)}
            {isConnected && connectionLabel
              ? ` ${t.channels.connectedAs(connectionLabel)}`
              : ""}
            {!isConnected && provider.unavailable_reason
              ? ` ${provider.unavailable_reason}`
              : ""}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="ml-auto">
          {isConnected ? (
            <>
              {canEditRuntimeConfig ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isConnecting || isDisconnecting}
                  onClick={() => setSetupOpen(true)}
                >
                  {isConnecting ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <PlugIcon />
                  )}
                  {t.channels.modify}
                </Button>
              ) : null}
              {/*
                Unbinding your own account had no control at all: the backend
                exposes DELETE /channels/connections/{id} and this app already
                shipped useDisconnectChannelConnection — with zero consumers.
                The only disconnect-ish button on this page is admin-only and
                deletes the whole deployment's provider runtime config, so a
                user who connected an IM account could not undo it.

                Same shape as the Vue side (outline / sm / Unplug icon /
                spinner while pending, accessible name naming the account).
                The multi-account list that app renders stays out of scope
                here: this row only ever shows one connection per provider.

                Success/failure goes through toasts, matching the provider
                removal button right below it. The Vue side reports both
                inline instead — that is this page's own local convention
                over there and predates this button; each app stays
                consistent with itself rather than importing the other's.
              */}
              {connection && connection.status !== "revoked" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isConnecting || isDisconnectingConnection}
                  aria-label={t.channels.disconnectAccount(
                    connectionLabel ?? connection.id,
                  )}
                  onClick={() => {
                    void disconnectConnectionMutation
                      .mutateAsync(connection.id)
                      .then(() => {
                        toast.success(t.channels.revoked);
                      })
                      .catch((error) => {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : t.channels.unavailable,
                        );
                      });
                  }}
                >
                  {isDisconnectingConnection ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <UnplugIcon />
                  )}
                  {t.channels.disconnect}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {provider.configured && canEditRuntimeConfig ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isConnecting || isDisconnecting}
                  onClick={() => setSetupOpen(true)}
                >
                  {/*
                    同一颗 Modify 在两个分支里本来一个带图标、一个不带，于是
                    provider 连上之后这颗键会自己宽出 18px。两个分支的变体和尺寸
                    完全相同，差别只有图标——是漏写不是设计。
                  */}
                  {isConnecting ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <PlugIcon />
                  )}
                  {t.channels.modify}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={isConnecting}
                title={unavailableReason}
                onClick={() => {
                  if (providerNeedsRuntimeConfig(provider)) {
                    setSetupOpen(true);
                    return;
                  }

                  if (!canConnect) {
                    toast.error(unavailableReason ?? t.channels.unavailable);
                    return;
                  }

                  startConnect(provider);
                }}
              >
                {isConnecting ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <PlugIcon />
                )}
                {connection?.status === "revoked"
                  ? t.channels.reconnect
                  : t.channels.connect}
              </Button>
            </>
          )}
          {/*
            这颗键原来叫 "Disconnect"，排在已连接分支里，对所有人渲染，点下去
            没有任何确认。它打的是 `DELETE /channels/{provider}/runtime-config`
            ——Gateway 那一条会**停掉整个部署的这条渠道运行时、把所有人的
            connection 行一并吊销、再删掉 provider 的运行时配置**
            （channel_connections.py:570 起），而且第一句就是
            `await require_admin_user(...)`。

            三件事都是错的：名字说的是「断开我的连接」而它删的是部署级配置；
            给非管理员渲染只能换来一个 403 和一句读不懂的 toast；
            这一档只有已连接的 provider 才有，于是 app secret 填错、
            永远连不上的 provider **没有任何办法清掉**。

            改成与 Vue 侧同一颗键：管理员限定、按「配过就能清」渲染、
            文案说实话。**确认对话框没有跟过来**——React 侧没有 alert-dialog
            这个 primitive，为一颗键引进一个新 primitive 超出了「只做小改」的
            边界；Vue 侧有（ChannelConnections.vue 的 AlertDialog）。
          */}
          {isAdmin && provider.configured ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDisconnecting}
              aria-label={`${t.channels.removeProviderConfig}: ${provider.display_name}`}
              onClick={() => {
                void disconnectProviderMutation
                  .mutateAsync(provider.provider)
                  .then(() => {
                    toast.success(t.channels.revoked);
                  })
                  .catch((error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t.channels.unavailable,
                    );
                  });
              }}
            >
              {isDisconnecting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {t.channels.removeProviderConfig}
            </Button>
          ) : null}
        </ItemActions>
      </Item>
      <ChannelRuntimeConfigDialog
        provider={provider}
        open={setupOpen}
        submitting={configureMutation.isPending}
        onOpenChange={setSetupOpen}
        onSubmit={(submitProvider, values) => {
          const connectWindow =
            submitProvider.auth_mode === "deep_link"
              ? prepareConnectWindow()
              : null;
          void configureMutation
            .mutateAsync({ provider: submitProvider.provider, values })
            .then((updated) => {
              setSetupOpen(false);
              if (providerCanConnect(updated)) {
                startConnect(updated, connectWindow);
                return;
              }
              closeConnectWindow(connectWindow);
              toast.success(t.channels.connected);
            })
            .catch((error) => {
              closeConnectWindow(connectWindow);
              toast.error(
                error instanceof Error ? error.message : t.channels.unavailable,
              );
            });
        }}
      />
    </>
  );
}

export function ChannelsSettingsPage() {
  const { t } = useI18n();
  const {
    enabled,
    providers,
    isLoading: providersLoading,
    error: providersError,
  } = useChannelProviders();
  const {
    connections,
    isLoading: connectionsLoading,
    error: connectionsError,
  } = useChannelConnections();
  const isLoading = providersLoading || connectionsLoading;
  const error = providersError ?? connectionsError;
  const visibleProviders = providers.filter((provider) => provider.enabled);

  const connectionByProvider = new Map<string, ChannelConnection>();
  for (const connection of connections) {
    const existing = connectionByProvider.get(connection.provider);
    if (!existing || connection.status === "connected") {
      connectionByProvider.set(connection.provider, connection);
    }
  }

  return (
    <SettingsSection
      title={t.settings.channels.title}
      description={t.settings.channels.description}
    >
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t.common.loading}</div>
      ) : error ? (
        <div className="text-destructive text-sm">{t.channels.unavailable}</div>
      ) : !enabled ? (
        <div className="text-muted-foreground text-sm">
          {t.settings.channels.disabled}
        </div>
      ) : visibleProviders.length === 0 ? (
        <div className="text-muted-foreground text-sm">
          {t.settings.channels.disabled}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          {visibleProviders.map((provider) => (
            <ChannelProviderItem
              key={provider.provider}
              provider={provider}
              connection={connectionByProvider.get(provider.provider)}
            />
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
