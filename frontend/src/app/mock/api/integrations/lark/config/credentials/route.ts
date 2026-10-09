/*
  Mock-mode fixtures for the Lark integration endpoints.

  Typed against the real contract on purpose: an untyped object literal lets a
  fixture silently fall behind the API it stands in for. That already happened —
  every flow response here was missing the required `generation`, which the
  Gateway uses to reject a superseded flow.
*/
import type { LarkConfigCompleteResponse } from "@/core/integrations/lark/types";

export function POST() {
  const body: LarkConfigCompleteResponse = {
    success: true,
    message: "Lark/Feishu app switched. Reconnect to authorize the new app.",
    generation: "mock-switched-generation",
    status: {
      installed: true,
      version: "v1.0.65",
      manifest_version: "v1.0.65",
      latest_available_version: "v1.0.65",
      runtime_version_mismatch: false,
      app_configured: true,
      app_id: "cli_switched_mock",
      app_brand: "feishu",
      skills_expected: 27,
      skills_installed: 4,
      installed_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
      enabled_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
      install_path: "/mock/integrations/skills/lark-cli",
      cli: {
        available: true,
        path: "/usr/bin/lark-cli",
        version: "lark-cli version v1.0.65",
        error: null,
      },
      auth: {
        status: "not_authorized",
        message: "Lark user authorization is not configured",
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
