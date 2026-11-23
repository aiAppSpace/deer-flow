import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ComputedRef,
} from "vue";
import type { Message } from "@/core/types/message";
import {
  collectKnowledgeSources,
  type KnowledgeSource,
} from "@/core/knowledge/sources";

const knowledgeSourcesKey: InjectionKey<
  ComputedRef<ReadonlyMap<string, KnowledgeSource>>
> = Symbol("knowledge-sources");
export function provideKnowledgeSources(
  messages: MaybeRefOrGetter<readonly Message[]>,
) {
  const sources = computed(() => collectKnowledgeSources(toValue(messages)));
  provide(knowledgeSourcesKey, sources);
  return sources;
}
export function useKnowledgeSources() {
  return inject(
    knowledgeSourcesKey,
    computed(() => new Map<string, KnowledgeSource>()),
  );
}
