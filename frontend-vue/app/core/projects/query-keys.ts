/*
  【文件职责】     项目 server-state 的 Vue Query key 唯一注册表。
  【架构位置】     L3 server-state contract
  【主要导出】     projectKeys
  【依赖关系】     ./types
  【边界与注意】   **mutation 之后失效的一律是 `root()` 这整棵子树**，配合 `exact: false`
                   ——与 `scheduledTaskKeys` 同一条取舍：React 的每个 project mutation 都调
                   `invalidateQueries({ queryKey: ["projects"] })`，前缀失效会把 list、detail
                   与 threads 一并标脏。写成精确 key 只标脏 list 不是优化，是**与 React 不同的
                   刷新时机**，同一个 Gateway 上会产生两种可见结果。

                   list 按 status 分片，用字符串 `"all"` 表示「省略 status」，
                   而不是把 `undefined` 塞进 key——`[..., undefined]` 与 `[...]`
                   在 Vue Query 里是两个不同的 key，靠它区分「全部」太脆。
*/

import type { ProjectStatus } from "./types";

export const projectKeys = {
  /** 前缀 key：任何 mutation 之后失效的就是它。 */
  root: () => ["projects"] as const,
  list: (status?: ProjectStatus) =>
    ["projects", "list", status ?? "all"] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const,
  threads: (projectId: string) => ["projects", "threads", projectId] as const,
};
