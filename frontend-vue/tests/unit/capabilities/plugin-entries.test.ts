import { describe, expect, it } from "vitest";
import { pluginDirectoryEntries } from "@/components/workspace/capabilities/plugin-entries";
import type {
  CapabilityInstallation,
  PluginManifest,
} from "@/core/capabilities/types";
const plugin: PluginManifest = {
  schema_version: 1,
  version: "1",
  id: "search",
  adapter: "mcp",
  category: "research",
  name: { "en-US": "Search" },
  description: { "en-US": "Search documents" },
  aliases: ["lookup"],
  setup: {},
  kind: "mcp",
  source: "https://example.com/search",
  icon: null,
  auth_methods: [],
  contributions: ["tools"],
  config_schema: { type: "object" },
};
const installation: CapabilityInstallation = {
  id: "deployment:search",
  plugin_id: "search",
  adapter: "mcp",
  scope: "deployment",
  installed: true,
  enabled: true,
  name: "Shared search",
  description: "Operator projection",
  auth_status: "configured",
  reference: "search",
  version: null,
  health: "unknown",
  category: null,
  icon: null,
};
describe("capability directory projections", () => {
  it("deduplicates installations across adapters and uses only the server projection for ordinary users", () => {
    const states = new Map([
      ["mcp", { items: [installation], unavailable: false }],
      [
        "business",
        { items: [{ ...installation, enabled: false }], unavailable: false },
      ],
    ]);
    const result = pluginDirectoryEntries([plugin], states, true, false);
    expect(result.platform).toHaveLength(1);
    expect(result.platform[0]?.installation?.enabled).toBe(false);
    expect(result.personal[0]?.installation).toBeUndefined();
    expect(result.platform[0]?.search).toBe(
      "Shared search Operator projection",
    );
  });
  it("lets the admin config manager own deployment entries and preserves personal status", () => {
    const personal = {
      ...installation,
      id: "user:search",
      scope: "user",
      auth_status: "required",
    };
    const result = pluginDirectoryEntries(
      [plugin],
      new Map([
        ["mcp", { items: [installation, personal], unavailable: true }],
      ]),
      true,
      true,
    );
    expect(result.platform).toEqual([]);
    expect(result.personal[0]).toMatchObject({
      installed: true,
      installation: personal,
      unavailable: true,
    });
  });
});
