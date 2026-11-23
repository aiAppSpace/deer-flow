/*
  【文件职责】     把 provider capability 与用户 connection instances 合成为展示模型。
  【架构位置】     L3 pure channel state
  【主要导出】     ChannelProviderView · buildChannelProviderViews · getChannelProviderStatusKey · getChannelConnectionLabel
  【依赖关系】     ./types
  【边界与注意】   有 connection row 时 row 是真相；一行都没有时才回落到 provider.connection_status。

                   providers 与 connections 是两个独立 HTTP 查询，不保证同一时刻的快照。
                   这里声明展示优先级，不推断哪份数据更新：已有账号行优先；没有账号行
                   才使用 provider 汇总，包括 auth-disabled 部署无需绑定的 connected 状态。
*/
import type { ChannelConnection, ChannelProvider } from "./types";

export interface ChannelProviderView {
  provider: ChannelProvider;
  connections: ChannelConnection[];
  /** 连接实例推导出的原始状态；渲染成文案前先过 getChannelProviderStatusKey。 */
  status: string;
}

const STATUS_PRIORITY = ["connected", "pending", "revoked"] as const;

/**
 * provider 一行要显示哪个状态词。
 *
 * 顺序照抄 React 设置页的 getStatusLabel
 * （frontend/src/components/workspace/settings/channels-settings-page.tsx）：
 * 停用、未配置、运行时不可用**排在连接状态之前**。少了这层，一个后端明说
 * unavailable_reason 的 provider 会因为还挂着一行 connected 而被写成「已连接」，
 * 而用户点下去只会拿到一句不可用。
 */
export function getChannelProviderStatusKey(view: ChannelProviderView): string {
  const { provider } = view;
  if (!provider.enabled) return "disabled";
  if (!provider.configured) return "unconfigured";
  if (provider.unavailable_reason) return "unavailable";
  return view.status;
}

export function getChannelConnectionLabel(
  connection: ChannelConnection,
): string {
  const identity = connection.external_account_name;
  const workspace = connection.workspace_name;
  if (identity && workspace) return `${identity} · ${workspace}`;
  return (
    identity ?? workspace ?? connection.external_account_id ?? connection.id
  );
}

export function buildChannelProviderViews(
  providers: ChannelProvider[],
  connections: ChannelConnection[],
): ChannelProviderView[] {
  return providers
    .filter((provider) => provider.enabled)
    .map((provider) => {
      const instances = connections.filter(
        (connection) => connection.provider === provider.provider,
      );
      const status =
        STATUS_PRIORITY.find((candidate) =>
          instances.some((connection) => connection.status === candidate),
        ) ??
        instances[0]?.status ??
        provider.connection_status ??
        "not_connected";
      return { provider, connections: instances, status };
    });
}
