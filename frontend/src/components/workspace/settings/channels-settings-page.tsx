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
  connections,
}: {
  provider: ChannelProvider;
  /*
    Every connection the gateway reports for this provider, newest-first as it
    sent them.

    This used to be a single optional `connection`, collapsed from the list by
    the page above with "keep the connected one if there is one". That threw
    information away: `GET /channels/connections` returns a list because a
    provider really can carry several bound accounts, and the backend already
    exposes `DELETE /channels/connections/{id}` per account — this app even
    shipped `useDisconnectChannelConnection` for it. A user with two accounts
    on one provider saw only one of them and could not unbind the other.
  */
  connections: ChannelConnection[];
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
    (connections.some((candidate) => candidate.status === "connected") ||
      provider.connection_status === "connected");
  const canEditRuntimeConfig = providerCanEditRuntimeConfig(provider);
  /*
    Connected used to mean "no connect control at all", which made adding a
    second account impossible even though the gateway supports it and this page
    now lists the accounts. Keep the control whenever there is a bound account
    to add to — the label above says "Add account" in that state.

    The `!isConnected` half still applies when the provider reports itself
    connected with no bound accounts (`DEER_FLOW_AUTH_DISABLED=1` routes every
    channel message to the default user, so no binding row exists or is needed):
    there the button would start a pointless binding flow next to a green
    "connected" badge.
  */
  const canConnect =
    (provider.connectable ?? (provider.enabled && provider.configured)) &&
    (connections.length > 0 || !isConnected);
  const isConnecting =
    (connectMutation.isPending &&
      connectMutation.variables === provider.provider) ||
    (configureMutation.isPending &&
      configureMutation.variables?.provider === provider.provider);
  const isDisconnecting =
    disconnectProviderMutation.isPending &&
    disconnectProviderMutation.variables === provider.provider;
  /*
    The row's own summary still describes one connection — the live one when
    there is one — because the badge and the `connected as …` sentence are
    about the provider, not about a particular account. The per-account
    controls live in the list below.
  */
  const primaryConnection =
    connections.find((candidate) => candidate.status === "connected") ??
    connections[0];
  const isDisconnectingConnection = (candidate: ChannelConnection) =>
    disconnectConnectionMutation.isPending &&
    disconnectConnectionMutation.variables === candidate.id;
  const connectionLabel = primaryConnection
    ? getConnectionLabel(primaryConnection)
    : null;
  const statusLabel = getStatusLabel(provider, primaryConnection, t);
  /*
    Three states, all about the bound accounts rather than the provider:
    a live account already exists → adding another, only revoked ones are left
    → reconnecting, none at all → connecting for the first time.

    This used to read `connection?.status === "revoked"`, i.e. it asked the one
    collapsed connection; with several accounts that answered about whichever
    one happened to win the collapse.
  */
  const connectLabel = connections.some(
    (candidate) =>
      candidate.status === "connected" || candidate.status === "pending",
  )
    ? t.channels.addAccount
    : connections.some((candidate) => candidate.status === "revoked")
      ? t.channels.reconnect
      : t.channels.connect;
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

  /*
    One connect control, rendered from both branches.

    It used to live only in the not-connected branch, so once a provider was
    connected there was no way to bind a second account — even though the
    gateway returns a list of connections and this page now lists them. The
    label reads "Add account" in that state (see `connectLabel`).

    Still hidden when the provider reports itself connected with no binding
    row at all (`DEER_FLOW_AUTH_DISABLED=1` routes every channel message to
    the default user): there the button would open a pointless binding flow
    right next to a green "connected" badge.
  */
  const showConnectAction = connections.length > 0 || !isConnected;
  const connectAction = (
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
      {connectLabel}
    </Button>
  );

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
          {/*
            One row per bound account, with the unbind control that belongs to
            that account. The gateway returns a list and exposes
            `DELETE /channels/connections/{id}`; collapsing the list to a
            single row here meant a second account was invisible and could not
            be unbound.

            Same shape as the Vue app renders, down to the heading and the
            per-row status line, so the two read identically to a screen
            reader. The provider-level badge above still summarises the
            provider itself.
          */}
          {connections.length > 0 ? (
            <div className="mt-3 w-full space-y-2">
              <h4 className="text-xs font-medium">{t.channels.accounts}</h4>
              {connections.map((candidate) => {
                const label = getConnectionLabel(candidate) ?? candidate.id;
                return (
                  <div
                    key={candidate.id}
                    data-testid={`channel-connection-${candidate.id}`}
                    className="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">
                        {label}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {getStatusLabel(provider, candidate, t)}
                      </div>
                    </div>
                    {candidate.status !== "revoked" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDisconnectingConnection(candidate)}
                        aria-label={t.channels.disconnectAccount(label)}
                        onClick={() => {
                          void disconnectConnectionMutation
                            .mutateAsync(candidate.id)
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
                        {isDisconnectingConnection(candidate) ? (
                          <LoaderCircleIcon className="animate-spin" />
                        ) : (
                          <UnplugIcon />
                        )}
                        {t.channels.disconnect}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
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
              {showConnectAction ? connectAction : null}
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
              {showConnectAction ? connectAction : null}
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

  /*
    Group, do not collapse. The previous shape kept one connection per provider
    ("the connected one if there is one"), which silently hid every additional
    bound account — and the gateway returns a list precisely because a provider
    can carry several.
  */
  const connectionsByProvider = new Map<string, ChannelConnection[]>();
  for (const connection of connections) {
    const bucket = connectionsByProvider.get(connection.provider);
    if (bucket) bucket.push(connection);
    else connectionsByProvider.set(connection.provider, [connection]);
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
              connections={connectionsByProvider.get(provider.provider) ?? []}
            />
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
