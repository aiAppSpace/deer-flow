/*
  【文件职责】     以 Vue Query 持有 composer 的 skills catalog 与 ready 状态。
  【架构位置】     L3 Vue Query adapter
  【主要导出】     useSkillsCatalog · SKILLS_QUERY_KEY
  【依赖关系】     core/skills/api
  【边界与注意】   ready 区分“空 catalog”与“尚未加载”，供安全草稿恢复使用。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { loadSkills, SkillRequestError } from "@/core/skills/api";

export const SKILLS_QUERY_KEY = ["skills"] as const;

/** Composer-facing, server-state-backed enabled skill catalog. */
export function useSkillsCatalog(
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  const query = useQuery({
    queryKey: SKILLS_QUERY_KEY,
    queryFn: ({ signal }) => loadSkills({ signal }),
    enabled: computed(() => toValue(options.enabled ?? true)),
    /*
      目录只通过 useSkillSettings / IntegrationsSettings 的 mutation 变，
      而那几处都会 `invalidateQueries(SKILLS_QUERY_KEY)`，所以留一个新鲜窗
      不会挡住真更新——它挡的是**第二个观察者**去重取第一个刚取回来的东西。

      与上游 `core/skills/hooks.ts` 的 `useSkills` **两边同改**（第四十七轮）：
      那一屏（`user-message-plain-text`，正文里有一条 `/data-analysis …`，
      于是 composer 与 `HumanSlashSkillText` 同时观察这个查询）实测
      **上游 5 跑里 2 跑发了两次**（274ms 后又 323ms），本仓 5/5 都是一次。
      这条重复除了对照台账的 requests 档，**没有任何门禁看得见**。
    */
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof SkillRequestError) && count < 3,
  });

  return {
    skills: computed(() => query.data.value ?? []),
    ready: computed(() => query.isFetched.value || query.isError.value),
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
