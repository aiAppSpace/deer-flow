/*
  【文件职责】     封装 Gateway Lark 集成的安装、配置、授权与凭证切换 HTTP 契约。
  【架构位置】     L3
  【主要导出】     LarkIntegrationRequestError · 七个端点的请求函数
  【依赖关系】     core/api/fetcher · core/config · ./types
  【边界与注意】   逐行对照 React frontend/src/core/integrations/lark/api.ts。
                   这里是这个域**唯一**的传输层。此前还并存过一个 flow.ts：同样六个
                   端点各写了一遍，而两份的契约还不一样——api.ts 停在没有 `generation`
                   的旧版，flow.ts 才是产品真正在用的那份。留着两份的代价不是重复，
                   是下一个人有一半概率改到不生效的那一份。
                   React 把 react-query 的接线放在 hooks.ts；Vue 由组件自己持有
                   请求状态（六个 pending ref），所以没有对应文件。
*/
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  LarkAuthCompleteRequest,
  LarkAuthCompleteResponse,
  LarkAuthStartRequest,
  LarkAuthStartResponse,
  LarkConfigCompleteRequest,
  LarkConfigCompleteResponse,
  LarkConfigCredentialsRequest,
  LarkConfigStartRequest,
  LarkConfigStartResponse,
  LarkInstallResponse,
  LarkIntegrationStatus,
} from "./types";

export class LarkIntegrationRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LarkIntegrationRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return data.detail ?? `HTTP ${response.status}: ${response.statusText}`;
}

function normalizeLarkIntegrationStatus(
  status: LarkIntegrationStatus,
): LarkIntegrationStatus {
  // Backends predating the flag omit it entirely; an absent flag means the
  // runtime readiness was not reported as evaluated, so default to false and
  // let the mutation cache preserve the last authoritative runtime fields.
  return {
    ...status,
    sandbox_runtime_probed: status.sandbox_runtime_probed ?? false,
  };
}

export async function loadLarkIntegrationStatus(
  signal?: AbortSignal,
): Promise<LarkIntegrationStatus> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/status`,
    { signal },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  return normalizeLarkIntegrationStatus(await response.json());
}

export async function installLarkIntegration(
  signal?: AbortSignal,
): Promise<LarkInstallResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/install`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  const data = (await response.json()) as LarkInstallResponse;
  return { ...data, status: normalizeLarkIntegrationStatus(data.status) };
}

export async function startLarkAuthorization(
  request: LarkAuthStartRequest = {},
  signal?: AbortSignal,
): Promise<LarkAuthStartResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/auth/start`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  return response.json();
}

export async function startLarkConfiguration(
  request: LarkConfigStartRequest = {},
  signal?: AbortSignal,
): Promise<LarkConfigStartResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/config/start`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  return response.json();
}

export async function completeLarkConfiguration(
  request: LarkConfigCompleteRequest,
  signal?: AbortSignal,
): Promise<LarkConfigCompleteResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/config/complete`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  const data = (await response.json()) as LarkConfigCompleteResponse;
  return { ...data, status: normalizeLarkIntegrationStatus(data.status) };
}

export async function setLarkAppCredentials(
  request: LarkConfigCredentialsRequest,
  signal?: AbortSignal,
): Promise<LarkConfigCompleteResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/config/credentials`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  const data = (await response.json()) as LarkConfigCompleteResponse;
  return { ...data, status: normalizeLarkIntegrationStatus(data.status) };
}

export async function completeLarkAuthorization(
  request: LarkAuthCompleteRequest,
  signal?: AbortSignal,
): Promise<LarkAuthCompleteResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/lark/auth/complete`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readErrorDetail(response),
    );
  }
  const data = (await response.json()) as LarkAuthCompleteResponse;
  return { ...data, status: normalizeLarkIntegrationStatus(data.status) };
}
