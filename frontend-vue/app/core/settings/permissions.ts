/*
  【文件职责】     从单一 session/auth-disabled 事实派生 Settings 权限视图。
  【架构位置】     L3 permission view model
  【主要导出】     deriveSettingsPermissions · SettingsPermissionError
  【依赖关系】     auth session types
  【边界与注意】   Skills GET 对普通用户开放；Skills mutation 与 MCP GET/mutation 都是 admin-only。
*/

import type { SessionProbe } from "@/core/auth/session";

export class SettingsPermissionError extends Error {
  constructor() {
    super("Admin privileges required.");
    this.name = "SettingsPermissionError";
  }
}

export function deriveSettingsPermissions(
  session: SessionProbe | undefined,
  options: { authDisabled: boolean },
) {
  if (options.authDisabled && session?.tag !== "authenticated") {
    return {
      state: "authenticated" as const,
      role: "admin" as const,
      canReadSkills: true,
      canManageSkills: true,
      canReadMcp: true,
      canManageMcp: true,
      adminRequired: false,
    };
  }
  if (!session) {
    return {
      state: "loading" as const,
      role: null,
      canReadSkills: false,
      canManageSkills: false,
      canReadMcp: false,
      canManageMcp: false,
      adminRequired: false,
    };
  }
  if (session.tag !== "authenticated") {
    return {
      state: session.tag,
      role: null,
      canReadSkills: false,
      canManageSkills: false,
      canReadMcp: false,
      canManageMcp: false,
      adminRequired: false,
    };
  }
  const isAdmin = session.user.system_role === "admin";
  return {
    state: "authenticated" as const,
    role: session.user.system_role,
    canReadSkills: true,
    canManageSkills: isAdmin,
    canReadMcp: isAdmin,
    canManageMcp: isAdmin,
    adminRequired: !isAdmin,
  };
}
