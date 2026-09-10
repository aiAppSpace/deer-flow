/*
  【文件职责】     校验 settings 深链并构造只移除 settings 的关闭路由。
  【架构位置】     L3 workspace shell
  【主要导出】     SettingsSection · SETTINGS_SECTIONS · readSettingsSection
                   buildSettingsCloseLocation
  【依赖关系】     vue-router types
  【边界与注意】   保留其他 query/hash；组件用 push 形成可回放 history。

                   数组顺序就是导航里的显示顺序，逐项对照 React
                   frontend/src/components/workspace/settings/settings-dialog.tsx 的 sections。
                   ~~对照台账按多重集比可访问性树，顺序天然测不出来——所以这一行只能靠
                   人盯着两边看，改动前先回那个文件核一遍。~~
                   **⚠️ 这句话自 wave 95 起就不成立了，wave 106 实测推翻**：
                   `diffAriaOrder` 那一档比的就是公共节点的相对顺序。把 `channels`
                   与 `memory` 对调之后 `make e2e-parity` **当场红 8 行**
                   （`integrations` 的三个终态 + `settings-notification`，各两种语言），
                   报的是「第 14 个公共节点 React=- button "Channels" Vue=- button "Memory"」。
                   **改这张表的顺序不需要人肉对照，跑一次 e2e-parity 就行。**
*/
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router";

export const SETTINGS_SECTIONS = [
  "account",
  "appearance",
  "notification",
  "channels",
  "integrations",
  "memory",
  "tools",
  "subagents",
  "skills",
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
