import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import {
  listRetrievalCatalogDatasets,
  listRetrievalCatalogDocuments,
} from "@/core/knowledge";

type CatalogOptions = {
  agentName: MaybeRefOrGetter<string>;
  page: MaybeRefOrGetter<number>;
  search: MaybeRefOrGetter<string>;
  enabled: MaybeRefOrGetter<boolean>;
};
export const KNOWLEDGE_CATALOG_PAGE_SIZE = 100;

export function useKnowledgeDatasetCatalog(options: CatalogOptions) {
  return useQuery({
    queryKey: computed(() => [
      "knowledge",
      "retrieval-catalog",
      toValue(options.agentName),
      toValue(options.page),
      toValue(options.search),
    ]),
    queryFn: ({ signal }) =>
      listRetrievalCatalogDatasets({
        agentName: toValue(options.agentName),
        page: toValue(options.page),
        pageSize: KNOWLEDGE_CATALOG_PAGE_SIZE,
        search: toValue(options.search),
        signal,
      }),
    enabled: computed(() => toValue(options.enabled)),
    retry: false,
  });
}

export function useKnowledgeDocumentCatalog(
  options: CatalogOptions & { datasetId: MaybeRefOrGetter<string> },
) {
  return useQuery({
    queryKey: computed(() => [
      "knowledge",
      "retrieval-catalog",
      toValue(options.agentName),
      toValue(options.datasetId),
      toValue(options.page),
      toValue(options.search),
    ]),
    queryFn: ({ signal }) =>
      listRetrievalCatalogDocuments({
        agentName: toValue(options.agentName),
        datasetId: toValue(options.datasetId),
        page: toValue(options.page),
        pageSize: KNOWLEDGE_CATALOG_PAGE_SIZE,
        search: toValue(options.search),
        signal,
      }),
    enabled: computed(() => toValue(options.enabled)),
    retry: false,
  });
}
