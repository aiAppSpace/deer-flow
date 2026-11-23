/*
  【文件职责】     固定session role 到 Skill/MCP 权限视图的单一映射。
  【架构位置】     pure permission test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/settings/permissions
  【边界与注意】   auth-disabled 是 Gateway synthetic admin；普通用户 skill 可读但不可改，MCP 不可读写。
*/

import { describe, expect, it } from "vitest";

import { deriveSettingsPermissions } from "@/core/settings/permissions";

describe("deriveSettingsPermissions", () => {
  it("allows the real auth-disabled synthetic admin", () => {
    expect(
      deriveSettingsPermissions(undefined, { authDisabled: true }),
    ).toMatchObject({
      role: "admin",
      canReadSkills: true,
      canManageSkills: true,
      canReadMcp: true,
      canManageMcp: true,
    });
  });

  it("keeps an ordinary user's skill catalog readable and every global mutation disabled", () => {
    expect(
      deriveSettingsPermissions(
        {
          tag: "authenticated",
          user: {
            id: "user-a",
            email: "user@example.test",
            system_role: "user",
            needs_setup: false,
          },
        },
        { authDisabled: false },
      ),
    ).toMatchObject({
      role: "user",
      canReadSkills: true,
      canManageSkills: false,
      canReadMcp: false,
      canManageMcp: false,
      adminRequired: true,
    });
  });

  it("uses a refreshed real user's role even when routing initially bypassed auth", () => {
    expect(
      deriveSettingsPermissions(
        {
          tag: "authenticated",
          user: {
            id: "member",
            email: "member@test.local",
            system_role: "user",
            needs_setup: false,
          },
        },
        { authDisabled: true },
      ),
    ).toMatchObject({
      role: "user",
      canManageMcp: false,
      canManageSkills: false,
    });
  });

  it("allows an authenticated admin and keeps unavailable distinct", () => {
    expect(
      deriveSettingsPermissions(
        {
          tag: "authenticated",
          user: {
            id: "admin-a",
            email: "admin@example.test",
            system_role: "admin",
            needs_setup: false,
          },
        },
        { authDisabled: false },
      ).canManageMcp,
    ).toBe(true);
    expect(
      deriveSettingsPermissions(
        { tag: "unavailable" },
        { authDisabled: false },
      ),
    ).toMatchObject({ state: "unavailable", adminRequired: false });
  });
});
