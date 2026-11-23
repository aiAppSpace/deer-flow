import type {
  CapabilityInstallation,
  PluginManifest,
} from "@/core/capabilities/types";
import type { DirectoryEntry } from "./PluginDirectory.vue";
export interface PluginGalleryEntry extends DirectoryEntry {
  plugin?: PluginManifest;
  installation?: CapabilityInstallation;
  unavailable?: boolean;
}
export function pluginDirectoryEntries(
  definitions: PluginManifest[],
  states: ReadonlyMap<
    string,
    { items: CapabilityInstallation[]; unavailable: boolean }
  >,
  canManage: boolean,
  canManagePlatform: boolean,
) {
  const installations = [
    ...new Map(
      [...states.values()]
        .flatMap((state) => state.items)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const platform: PluginGalleryEntry[] = [];
  const personal: PluginGalleryEntry[] = [];
  for (const plugin of definitions.filter(
    (plugin) =>
      canManage ||
      !installations.some(
        (item) => item.adapter === "mcp" && item.plugin_id === plugin.id,
      ),
  )) {
    const isPlatform = plugin.adapter === "guide";
    const installation = installations.find(
      (item) =>
        item.plugin_id === plugin.id &&
        item.installed &&
        (isPlatform ? item.scope !== "user" : item.scope === "user"),
    );
    (isPlatform ? platform : personal).push({
      id: plugin.id,
      category: plugin.category,
      installed: !!installation,
      search: `${Object.values(plugin.name).join(" ")} ${Object.values(plugin.description).join(" ")} ${plugin.aliases.join(" ")}`,
      plugin,
      installation,
      unavailable: states.get(plugin.adapter)?.unavailable,
    });
  }
  // This is a sanitized server projection. Non-admins never read deployment
  // connection config just to render its status.
  for (const item of installations.filter(
    (item) =>
      !canManagePlatform && item.adapter === "mcp" && item.scope !== "user",
  )) {
    const manifest = definitions.find((plugin) => plugin.id === item.plugin_id);
    platform.push({
      id: item.id,
      category: manifest?.category ?? "custom",
      search: `${item.name} ${item.description}`,
      installed: true,
      installation: item,
      plugin: manifest,
    });
  }
  return { platform, personal };
}
