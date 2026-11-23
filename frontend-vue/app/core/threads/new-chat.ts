/** Optional completion of the existing new-chat command, after its modal closes.
 * The conversation owner supplies a one-shot, owner-checked focus operation.
 */
export type NewChatFocusHandoff = {
  agentName: string | null;
  claim: (focus: () => void) => void;
};
