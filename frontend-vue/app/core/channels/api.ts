/*
  【文件职责】     访问 Gateway channel provider/configuration/connection lifecycle endpoints。
  【架构位置】     L3 Gateway HTTP contract
  【主要导出】     list/connect/configure/disconnect channel APIs
  【依赖关系】     core/api/fetcher · errors · config
  【边界与注意】   mutation target 原样编码；AbortSignal 与 Gateway detail 必须保真传递。
*/

import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  ChannelConnectResponse,
  ChannelConnection,
  ChannelConnectionsResponse,
  ChannelProviderId,
  ChannelProvider,
  ChannelProvidersResponse,
  ChannelRuntimeConfigValues,
  WechatQRLoginSession,
} from "./types";

export interface ChannelRequestOptions {
  signal?: AbortSignal;
}

export async function startWechatQRLogin(): Promise<WechatQRLoginSession> {
  const response = await fetch(channelsUrl("/wechat/qr-login"), {
    method: "POST",
  });
  if (!response.ok)
    await throwGatewayApiError(response, "Unable to start WeChat QR login");
  return response.json() as Promise<WechatQRLoginSession>;
}

export async function pollWechatQRLogin(
  id: string,
  signal?: AbortSignal,
  verifyCode?: string,
): Promise<WechatQRLoginSession> {
  const response = await fetch(
    channelsUrl(`/wechat/qr-login/${encodeURIComponent(id)}/poll`),
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      ...(verifyCode
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verify_code: verifyCode }),
          }
        : {}),
    },
  );
  if (!response.ok)
    await throwGatewayApiError(response, "Unable to check WeChat QR login");
  return response.json() as Promise<WechatQRLoginSession>;
}

export async function cancelWechatQRLogin(id: string): Promise<void> {
  const response = await fetch(
    channelsUrl(`/wechat/qr-login/${encodeURIComponent(id)}`),
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404)
    await throwGatewayApiError(response, "Unable to cancel WeChat QR login");
}

function channelsUrl(path: string): string {
  return `${getBackendBaseURL()}/api/channels${path}`;
}

export async function listChannelProviders(
  options: ChannelRequestOptions = {},
): Promise<ChannelProvidersResponse> {
  const response = options.signal
    ? await fetch(channelsUrl("/providers"), { signal: options.signal })
    : await fetch(channelsUrl("/providers"));
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load channel providers: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ChannelProvidersResponse>;
}

export async function listChannelConnections(
  options: ChannelRequestOptions = {},
): Promise<ChannelConnection[]> {
  const response = options.signal
    ? await fetch(channelsUrl("/connections"), { signal: options.signal })
    : await fetch(channelsUrl("/connections"));
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load channel connections: ${response.statusText}`,
    );
  }
  const data = (await response.json()) as ChannelConnectionsResponse;
  return data.connections;
}

export async function connectChannelProvider(
  provider: ChannelProviderId,
  options: ChannelRequestOptions = {},
): Promise<ChannelConnectResponse> {
  const response = await fetch(
    channelsUrl(`/${encodeURIComponent(provider)}/connect`),
    { method: "POST", ...(options.signal ? { signal: options.signal } : {}) },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to connect ${provider}: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ChannelConnectResponse>;
}

export async function configureChannelProvider(
  provider: ChannelProviderId,
  values: ChannelRuntimeConfigValues,
  options: ChannelRequestOptions = {},
): Promise<ChannelProvider> {
  const response = await fetch(
    channelsUrl(`/${encodeURIComponent(provider)}/runtime-config`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to configure ${provider}: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ChannelProvider>;
}

export async function disconnectChannelConnection(
  connectionId: string,
  options: ChannelRequestOptions = {},
): Promise<void> {
  const response = await fetch(
    channelsUrl(`/connections/${encodeURIComponent(connectionId)}`),
    {
      method: "DELETE",
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to disconnect channel: ${response.statusText}`,
    );
  }
}

export async function disconnectChannelProvider(
  provider: ChannelProviderId,
  options: ChannelRequestOptions = {},
): Promise<ChannelProvider> {
  const response = await fetch(
    channelsUrl(`/${encodeURIComponent(provider)}/runtime-config`),
    {
      method: "DELETE",
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to disconnect ${provider}: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ChannelProvider>;
}
