/** One cache tree for lists, cards, paginated history and immutable chat event history. */
export const scheduledTaskKeys = {
  root: () => ["scheduled-tasks"] as const,
  list: () => ["scheduled-tasks", "list"] as const,
  thread: (threadId: string) =>
    ["scheduled-tasks", "thread", threadId] as const,
  task: (taskId: string) => ["scheduled-tasks", "task", taskId] as const,
  runs: (taskId: string) => ["scheduled-tasks", "runs", taskId] as const,
  runPage: (taskId: string, page: number) =>
    ["scheduled-tasks", "runs", taskId, page] as const,
  events: (threadId: string) =>
    ["scheduled-tasks", "thread-events", threadId] as const,
};
