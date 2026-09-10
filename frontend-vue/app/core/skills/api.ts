/*
  【文件职责】     读取 skill catalog，并调用全局启停与安装 HTTP 合同。
  【架构位置】     L3 Gateway adapter
  【主要导出】     SkillRequestError · SkillSecurityFinding · MAX_SKILL_ARCHIVE_UPLOAD_BYTES ·
                   loadSkills · enableSkill · installSkill · uploadSkillArchive ·
                   formatSkillSecurityFindings
  【依赖关系】     authenticated fetch · shared Gateway error parser
  【边界与注意】   GET 对普通用户开放；PUT/安装的真实 403 必须可被 UI 分类。

                   **安全扫描结论（findings）要能被 UI 拿到。** 上传一个 .skill 被拒
                   时，后端给的是「哪一条规则、哪个文件的哪一行、怎么改」；只留一句
                   "Install failed" 的话，用户完全不知道自己的包哪里有问题。
                   解析是**逐字段防御**的：这份 JSON 来自网络，缺字段或类型不对的
                   条目直接丢掉，而不是让整个错误处理崩在一个 undefined 上。
*/

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";

import type { Skill } from "./type";

/*
  与后端 `_MAX_SKILL_ARCHIVE_UPLOAD_BYTES`（backend/app/gateway/routers/skills.py）
  保持一致；nginx 与 Ingress 放行 101 MiB，多出来的那 1 MiB 是 multipart 的框架开销。
  前端先拦一道，是为了不让用户传完 100 MiB 才被拒。
*/
export const MAX_SKILL_ARCHIVE_UPLOAD_BYTES = 100 * 1024 * 1024;

export interface SkillSecurityFinding {
  rule_id: string;
  severity: string;
  file: string | null;
  line: number | null;
  message: string;
  remediation: string | null;
}

export class SkillRequestError extends Error {
  readonly status: number;
  /** 安全扫描的结论；没有就是空数组，调用方不必判 undefined。 */
  readonly findings: SkillSecurityFinding[];

  constructor(
    status: number,
    message: string,
    readonly body: unknown = null,
    readonly responseText = "",
    findings: SkillSecurityFinding[] = [],
  ) {
    super(message);
    this.name = "SkillRequestError";
    this.status = status;
    this.findings = findings;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

async function readErrorDetail(response: Response): Promise<SkillRequestError> {
  const error = await readGatewayResponseError(
    response,
    `HTTP ${response.status}: ${response.statusText}`,
  );
  return new SkillRequestError(
    response.status,
    error.message,
    error.body,
    error.responseText,
    parseSecurityFindings(error.body),
  );
}

/**
 * 从错误体里挑出安全扫描结论。
 *
 * 逐字段判类型：这份 JSON 来自网络，一条缺 `rule_id` 的记录不该让整个错误处理
 * 崩掉——丢掉那一条，剩下的照样显示。
 */
function parseSecurityFindings(body: unknown): SkillSecurityFinding[] {
  const detail = (body as { detail?: unknown })?.detail;
  const raw = (detail as { findings?: unknown })?.findings;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const finding = candidate as Record<string, unknown>;
    if (
      typeof finding.rule_id !== "string" ||
      typeof finding.severity !== "string" ||
      typeof finding.message !== "string"
    ) {
      return [];
    }
    return [
      {
        rule_id: finding.rule_id,
        severity: finding.severity,
        file: typeof finding.file === "string" ? finding.file : null,
        line: typeof finding.line === "number" ? finding.line : null,
        message: finding.message,
        remediation:
          typeof finding.remediation === "string" ? finding.remediation : null,
      },
    ];
  });
}

/**
 * 把扫描结论摊成给人看的几行。
 *
 * **最多三条**，其余折成「还有 N 条」：一个 toast 里塞二十行没人会读完，
 * 而前三条足够判断「这是不是我自己写的问题」。
 */
export function formatSkillSecurityFindings(
  findings: SkillSecurityFinding[],
): string {
  const lines = findings.slice(0, 3).map((finding) => {
    const location = finding.file
      ? `${finding.file}${finding.line === null ? "" : `:${finding.line}`}`
      : finding.line === null
        ? "archive"
        : `archive:${finding.line}`;
    return `${finding.severity} ${finding.rule_id} · ${location}: ${finding.message}${finding.remediation ? ` ${finding.remediation}` : ""}`;
  });
  const omittedCount = findings.length - lines.length;
  if (omittedCount > 0) {
    lines.push(`... and ${omittedCount} more`);
  }
  return lines.join("\n");
}

export async function loadSkills(options: { signal?: AbortSignal } = {}) {
  const skills = await fetch(`${getBackendBaseURL()}/api/skills`, {
    signal: options.signal,
  });
  if (!skills.ok) {
    throw await readErrorDetail(skills);
  }
  const json = await skills.json();
  return json.skills as Skill[];
}

export async function enableSkill(
  skillName: string,
  enabled: boolean,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${encodeURIComponent(skillName)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
      }),
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw await readErrorDetail(response);
  }
  return response.json() as Promise<Skill>;
}

export interface InstallSkillRequest {
  thread_id: string;
  path: string;
}

export interface InstallSkillResponse {
  success: boolean;
  skill_name: string;
  message: string;
}

export async function installSkill(
  request: InstallSkillRequest,
): Promise<InstallSkillResponse> {
  const response = await fetch(`${getBackendBaseURL()}/api/skills/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await readErrorDetail(response);
    // Surface authorization failures so callers can show an admin-only hint
    // instead of a generic failure.
    if (response.status === 403) {
      throw error;
    }
    // Other HTTP errors keep the existing soft-failure contract.
    return {
      success: false,
      skill_name: "",
      message: error.message,
    };
  }

  return response.json();
}

/**
 * 上传一个 `.skill` 压缩包安装。
 *
 * 三类失败要**分得开**：403（要管理员）、413（包太大）、以及安全扫描给了结论的。
 * 这三种都抛 `SkillRequestError` 让调用方分类；其余的（比如包里少了 SKILL.md）
 * 是「这次装不上」而不是「请求出错」，按正常结果返回，调用方照常显示后端那句话。
 */
export async function uploadSkillArchive(
  archive: File,
): Promise<InstallSkillResponse> {
  const formData = new FormData();
  formData.append("archive", archive);

  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/install/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const error = await readErrorDetail(response);
    if (
      response.status === 403 ||
      response.status === 413 ||
      error.findings.length > 0
    ) {
      throw error;
    }
    return { success: false, skill_name: "", message: error.message };
  }

  return (await response.json()) as InstallSkillResponse;
}
