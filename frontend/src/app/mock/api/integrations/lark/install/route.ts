/*
  Mock-mode fixtures for the Lark integration endpoints.

  Typed against the real contract on purpose: an untyped object literal lets a
  fixture silently fall behind the API it stands in for. That already happened —
  every flow response here was missing the required `generation`, which the
  Gateway uses to reject a superseded flow.
*/
import type { LarkInstallResponse } from "@/core/integrations/lark/types";

const installedSkills = ["lark-doc", "lark-im", "lark-shared", "lark-sheets"];

export function POST() {
  const body: LarkInstallResponse = {
    success: true,
    installed_skills: installedSkills,
    message: `Installed ${installedSkills.length} Lark/Feishu skills.`,
    status: {
      installed: true,
      version: "v1.0.65",
      manifest_version: "v1.0.65",
      latest_available_version: "v1.0.65",
      runtime_version_mismatch: false,
      app_configured: false,
      app_id: null,
      app_brand: null,
      skills_expected: 27,
      skills_installed: installedSkills.length,
      installed_skills: installedSkills,
      enabled_skills: installedSkills,
      install_path: "/mock/integrations/skills/lark-cli",
      cli: {
        available: true,
        path: "/usr/bin/lark-cli",
        version: "lark-cli version v1.0.65",
        error: null,
      },
      auth: {
        status: "not_configured",
        message: "lark-cli auth is not configured",
        user: null,
        verified: false,
      },
      sandbox_runtime_mode: "none",
      sandbox_runtime_probed: true,
      sandbox_runtime_ready: false,
      sandbox_runtime_detail: null,
    },
  };
  return Response.json(body);
}
