/** Independent keys preserve each capability's mount freshness and error state. */
export const FEATURES_QUERY_KEYS = {
  agentsApi: ["features", "agents_api"],
  browserControl: ["features", "browser_control"],
  mcpTasks: ["features", "mcp_tasks"],
  subagentBatches: ["features", "subagent_batches"],
  conversationReferences: ["features", "conversation_references"],
  knowledgeBase: ["features", "knowledge_base"],
  scheduledTasks: ["features", "scheduled_tasks"],
  threadActivity: ["features", "thread_activity"],
} as const;

export const FEATURE_QUERY_POLICY = {
  staleTime: 0,
  refetchOnMount: true,
  retry: false,
} as const;
