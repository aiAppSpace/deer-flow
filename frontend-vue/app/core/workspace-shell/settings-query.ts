import type { LocationQueryRaw, RouteLocationRaw } from "vue-router";

export const SETTINGS_SECTIONS = [
  "models",
  "account",
  "appearance",
  "notification",
  "channels",
  "memory",
  "subagents",
  "about",
] as const;

/**
 * 分区名的**唯一真相**，从上面那张表推出来。
 *
 * 以前它是 `useSettingsDialog.ts` 里另写的一个联合类型，而这张表标注成
 * `readonly SettingsSection[]`——两处各写一份，**「联合里多一个成员、表里漏
 * 登记」没有任何机器会发现**：`SECTION_ICONS[id]` 那种索引会被 TS 挡住，
 * 而这张表少一项只表现为「导航里不显示、深链打不开」，编译照样过。
 * 实测那时两处的成员相同、**顺序已经不同**（wave 106 按「一张表把全集切成
 * 两半，而另一半没人查」这条判据筛出来的）。倒过来推之后这个分叉不再存在。
 */
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function readSettingsSection(value: unknown): SettingsSection | null {
  const requested = Array.isArray(value) ? value[0] : value;
  return typeof requested === "string" &&
    SETTINGS_SECTIONS.includes(requested as SettingsSection)
    ? (requested as SettingsSection)
    : null;
}

type RouteLocation = {
  path: string;
  query: LocationQueryRaw;
  hash?: string;
};

export function buildSettingsCloseLocation(
  route: RouteLocation,
): RouteLocationRaw {
  const { settings: _settings, ...query } = route.query;
  return { path: route.path, query, hash: route.hash ?? "" };
}
