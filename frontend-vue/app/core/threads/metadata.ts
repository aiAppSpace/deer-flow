/*
  【文件职责】     单条线程元数据缓存的 query key。
  【架构位置】     L3 core
  【主要导出】     threadMetadataQueryKey
  【依赖关系】     useThreadMetadata（拥有者）· archive · cache-invalidation · useProjects · useThreads
  【边界与注意】   **这颗 key 此前是四处字面量，而且没有任何查询拥有它**——
                   归档、移到项目、run 结束、改名都以为自己重读了这条线程，
                   其实 `invalidateQueries` 找不到观察者，全是空操作
                   （wave 216 逐处核过）。`useThreadMetadata` 补上拥有者之后，
                   key 收到这一处，免得下一次再各写各的。
                   与 `threadHistoryQueryKey` / `threadTokenUsageQueryKey` 同一形状。
*/

export const threadMetadataQueryKey = (threadId: string | null) =>
  ["thread", "metadata", threadId] as const;
