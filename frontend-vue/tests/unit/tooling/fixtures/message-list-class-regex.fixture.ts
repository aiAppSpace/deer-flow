/**
 * Historical syntax fixture for the comment scanner: a regexp containing
 * quotes, escaped character classes and a lazy quantifier, followed by a
 * reference that must disappear with its comment.
 * The original storage-key citation was frontend/src/app/workspace/agents/new/page.tsx.
 */
export const binding = /<MessageList\b[\s\S]*?:class="([^"]+)"/;
export const SAVE_HINT_STORAGE_KEY = "deerflow.agent-create.save-hint-seen";
