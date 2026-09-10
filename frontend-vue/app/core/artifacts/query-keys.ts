/*
  【文件职责】     产物内容 server-state 的 Vue Query key 唯一注册表。
  【架构位置】     L3 server-state contract
  【主要导出】     artifactKeys
  【依赖关系】     无
  【边界与注意】   `full` 进 key 是**有意的**：预览窗口和完整文件是同一份文件的两个
                   不同结果，共用一个 key 的话「加载完整文件」会把预览那份直接覆盖掉，
                   而用户点「取消」时再也拿不回来。与 React 的
                   `["artifact", filepath, threadId, isMock, fullContentRequested]`
                   同形（core/artifacts/hooks.ts）。
*/

export const artifactKeys = {
  /** 前缀 key：要把某次会话的产物整棵标脏时用它。 */
  root: () => ["artifact"] as const,
  content: (input: {
    filepath: string;
    threadId: string;
    isMock: boolean;
    full: boolean;
  }) =>
    [
      "artifact",
      input.filepath,
      input.threadId,
      input.isMock,
      input.full,
    ] as const,
};
