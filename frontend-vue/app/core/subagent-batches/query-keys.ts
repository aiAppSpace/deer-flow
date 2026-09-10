/*
  【文件职责】     subagent 批次 server-state 的 Vue Query key 唯一注册表。
  【架构位置】     L3 server-state contract
  【主要导出】     subagentBatchKeys
  【依赖关系】     无
  【边界与注意】   条目 key 是批次 key 的**子路径**：重试一个条目会同时改变
                   这一条的状态和整批的计数，两处必须一起刷新，否则进度条和
                   条目列表会互相矛盾。
*/

export const subagentBatchKeys = {
  list: (threadId: string) => ["subagent-batches", threadId] as const,
  items: (threadId: string, batchId: string) =>
    ["subagent-batches", threadId, batchId, "items"] as const,
};
