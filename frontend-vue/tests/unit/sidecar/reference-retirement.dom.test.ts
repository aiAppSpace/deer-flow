import { effectScope, nextTick, ref } from "vue";
import { expect, it } from "vitest";
import { useSidecar } from "@/composables/useSidecar";
import type { SidecarContext } from "@/core/sidecar";
const quote = (content: string): SidecarContext => ({
  type: "referenced_message",
  label: content,
  role: "assistant",
  content,
});
it("retires only accepted conversation quotes and isolates a new parent", async () => {
  const scope = effectScope();
  const parent = ref<string | null>("A");
  const owner = scope.run(() =>
    useSidecar({ parentThreadId: parent, context: {} }),
  )!;
  owner.addContextToConversation(quote("submitted"));
  const accepted = [...owner.conversationQuotes.value];
  owner.addContextToConversation(quote("added while pending"));
  owner.clearConversationQuotes(accepted);
  expect(
    owner.conversationQuotes.value.map((item) => item.context.content),
  ).toEqual(["added while pending"]);
  parent.value = "B";
  await nextTick();
  owner.addContextToConversation(quote("B"));
  owner.clearConversationQuotes(accepted);
  expect(
    owner.conversationQuotes.value.map((item) => item.context.content),
  ).toEqual(["B"]);
  scope.stop();
});
