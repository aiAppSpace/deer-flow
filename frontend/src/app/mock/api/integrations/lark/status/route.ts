/*
  Mock-mode fixtures for the Lark integration endpoints.

  Typed against the real contract on purpose: an untyped object literal lets a
  fixture silently fall behind the API it stands in for. That already happened —
  every flow response here was missing the required `generation`, which the
  Gateway uses to reject a superseded flow.
*/
import type { LarkIntegrationStatus } from "@/core/integrations/lark/types";

const status: LarkIntegrationStatus = {
  installed: false,
  version: "v1.0.65",
  manifest_version: null,
  latest_available_version: "v1.0.65",
  runtime_version_mismatch: false,
  app_configured: false,
  app_id: null,
  app_brand: null,
  skills_expected: 27,
  skills_installed: 0,
  installed_skills: [],
  enabled_skills: [],
  install_path: "/mock/integrations/skills/lark-cli",
  cli: {
    available: false,
    path: null,
    version: null,
    error: "lark-cli is not on PATH",
  },
  auth: {
    status: "unavailable",
    message: "lark-cli is not installed on the Gateway",
    user: null,
    verified: false,
  },
  sandbox_runtime_mode: "none",
  sandbox_runtime_probed: true,
  sandbox_runtime_ready: false,
  sandbox_runtime_detail: null,
};

export function GET() {
  return Response.json(status);
}
