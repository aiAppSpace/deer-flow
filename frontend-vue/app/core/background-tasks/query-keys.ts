/*
  【文件职责】     后台任务 server-state 的 Vue Query key 唯一注册表。
  【架构位置】     L3 server-state contract
  【主要导出】     backgroundTaskKeys
  【依赖关系】     无
  【边界与注意】   详情 key 是列表 key 的**子路径**，所以失效列表会连带详情——
                   取消之后两处显示的是同一件事，只刷一半会自相矛盾。
*/

export const backgroundTaskKeys = {
  list: (threadId: string) => ["background-tasks", threadId] as const,
  detail: (threadId: string, taskId: string) =>
    ["background-tasks", threadId, taskId] as const,
};
