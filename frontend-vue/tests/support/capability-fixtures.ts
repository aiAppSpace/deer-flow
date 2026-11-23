import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { MockSkill } from "../e2e/utils/mock-api";

/** HTTP fixtures use the Gateway catalog itself, without either frontend's component data. */
export function mockCapabilityCatalog(
  page: Page,
  skills: MockSkill[],
  larkStatus: () => { installed: boolean },
) {
  void page.route("**/api/capabilities/catalog", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: readFileSync(
        path.resolve(
          process.cwd(),
          "../backend/packages/harness/deerflow/capabilities/builtin.json",
        ),
        "utf8",
      ),
    }),
  );
  for (const endpoint of ["/api/mcp/config", "/api/mcp/personal/config"]) {
    void page.route(`**${endpoint}`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { mcp_servers: {} } })
        : route.fallback(),
    );
  }
  void page.route("**/api/capabilities/installations/*", (route) => {
    const adapter = new URL(route.request().url()).pathname.split("/").pop();
    const items =
      adapter === "lark"
        ? [
            {
              id: "lark",
              plugin_id: "lark",
              adapter: "lark",
              name: "Lark / Feishu",
              reference: "lark",
              installed: larkStatus().installed,
              enabled: null,
              version: null,
              auth_status: "required",
              health: "unknown",
              scope: "user",
              category: null,
              icon: null,
            },
          ]
        : adapter === "skills"
          ? skills.map((skill) => ({
              id: `skill:${skill.category ?? "public"}:${skill.name}`,
              plugin_id: null,
              adapter: "skills",
              name: skill.name,
              reference: skill.name,
              description: skill.description,
              installed: true,
              enabled: skill.enabled ?? true,
              version: null,
              auth_status: "not_required",
              health: "unknown",
              scope: "deployment",
              category: skill.category,
              icon: null,
            }))
          : [];
    return route.fulfill({ json: { items, can_manage: true } });
  });
  void page.route("**/api/plugins", (route) => route.fulfill({ json: [] }));
}
