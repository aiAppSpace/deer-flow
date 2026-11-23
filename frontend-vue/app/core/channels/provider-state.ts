/*
  【文件职责】     计算 channel provider 的连接与运行时配置 capability。
  【架构位置】     L1 framework-neutral channel policy
  【主要导出】     providerSupportsConnect · providerCanConnect · providerNeedsRuntimeConfig · providerCanEditRuntimeConfig
  【依赖关系】     core/channels/types
  【边界与注意】   两条 connect 判据服务两个不同的界面，不要合并：
                   providerSupportsConnect 只问「这个 provider 现在能不能发起绑定」，
                   给设置页用——那里一个 provider 可以挂多个账号，已连接不挡再连一个；
                   providerCanConnect 额外要求「当前还没连上」，给侧栏用——侧栏一个
                   provider 只有一行、一个按钮，连上之后那个按钮就不是 Connect 了。
                   React 的 providerCanConnect 就是后者，设置页则把 !isConnected 写在自己那边
                   （frontend/src/core/channels/provider-state.ts 与 channels-settings-page.tsx）。
*/

import type { ChannelProvider } from "./types";
import type { Translations } from "@/core/i18n/locales/types";

export function channelProviderName(
  provider: Pick<ChannelProvider, "provider" | "display_name">,
  t: Pick<Translations, "threads">,
): string {
  const localized: Record<string, string> = t.threads.origin.providers;
  return Object.hasOwn(localized, provider.provider)
    ? localized[provider.provider]!
    : provider.display_name;
}

export function providerSupportsConnect(provider: ChannelProvider): boolean {
  return provider.connectable ?? (provider.enabled && provider.configured);
}

export function providerCanConnect(provider: ChannelProvider): boolean {
  return (
    providerSupportsConnect(provider) &&
    provider.connection_status !== "connected"
  );
}

export function providerNeedsRuntimeConfig(provider: ChannelProvider): boolean {
  return (
    provider.enabled &&
    !provider.configured &&
    (provider.credential_fields?.length ?? 0) > 0
  );
}

export function providerCanEditRuntimeConfig(
  provider: ChannelProvider,
): boolean {
  return provider.enabled && (provider.credential_fields?.length ?? 0) > 0;
}
