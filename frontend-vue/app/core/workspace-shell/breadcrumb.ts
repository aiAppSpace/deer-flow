/*
  【文件职责】     面包屑第二段该不该做成链接。
  【架构位置】     L3 workspace shell（纯数据 + 纯函数）
  【主要导出】     LINKABLE_SECTIONS · isLinkableSection
  【依赖关系】     无
  【边界与注意】   与上游 `workspace-container.tsx` 的 `LINKABLE_SECTIONS` 同一张表。

                   **判据是「这个段有没有 index 路由」**，不是「它是不是一个功能区」。
                   `projects` 是功能区，但 `app/pages/workspace/projects/` 下只有
                   `[id].vue`——没有 `/workspace/projects` 这条路由。此前面包屑把它
                   无条件做成链接，点下去 404；对照台账在 `project-detail` 上量到
                   （上游 `link "Projects" [disabled]` / 本仓 `link "Projects":` 带 url）。

                   放在这里而不是留在 SFC 里，是为了让门禁能把它和真实路由表对上：
                   tests/guards/breadcrumb-linkable-sections.test.ts。
*/

/** 有 index 路由、因此面包屑点得动的 workspace 段。 */
export const LINKABLE_SECTIONS: Record<string, true> = {
  agents: true,
  chats: true,
  "scheduled-tasks": true,
};

export function isLinkableSection(segment: string | undefined): boolean {
  return Boolean(segment && LINKABLE_SECTIONS[segment]);
}
