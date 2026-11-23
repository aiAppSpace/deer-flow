/*
  【文件职责】     复用 skills catalog query，并拥有设置页唯一 toggle mutation。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useSkillSettings
  【依赖关系】     useSkillsCatalog · skills api · Vue Query
  【边界与注意】   non-admin 预先拒绝；不 optimistic 改 skill；成功响应同步后等待同 key authoritative re-read。
*/

import { computed, onScopeDispose, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import {
  useSkillsCatalog,
  SKILLS_QUERY_KEY,
} from "@/composables/useSkillsCatalog";
import { enableSkill } from "@/core/skills/api";
import type { Skill } from "@/core/skills/type";
import { SettingsPermissionError } from "@/core/settings/permissions";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

export function useSkillSettings(options: {
  canManage: MaybeRefOrGetter<boolean>;
  enabled?: MaybeRefOrGetter<boolean>;
}) {
  const queryClient = useQueryClient();
  const catalog = useSkillsCatalog({ enabled: options.enabled ?? true });
  const mutation = useMutation({
    onMutate: () => captureWorkspaceQueryOwner(queryClient),
    mutationFn: ({
      skillName,
      enabled,
      signal,
    }: {
      skillName: string;
      enabled: boolean;
      signal: AbortSignal;
    }) => enableSkill(skillName, enabled, { signal }),
    onSuccess: async (updated, _variables, isCurrent) => {
      if (!isCurrent?.()) return;
      queryClient.setQueryData<Skill[]>(SKILLS_QUERY_KEY, (rows) =>
        (rows ?? []).map((row) => (row.name === updated.name ? updated : row)),
      );
      await queryClient.invalidateQueries({
        queryKey: SKILLS_QUERY_KEY,
        exact: true,
      });
    },
  });
  let inFlight: Promise<Skill> | null = null;
  let controller: AbortController | null = null;
  async function toggle(skillName: string, enabled: boolean) {
    if (!toValue(options.canManage)) throw new SettingsPermissionError();
    if (inFlight) return inFlight;
    controller = new AbortController();
    inFlight = mutation
      .mutateAsync({ skillName, enabled, signal: controller.signal })
      .finally(() => {
        inFlight = null;
        controller = null;
      });
    return inFlight;
  }
  onScopeDispose(() => controller?.abort());
  return {
    ...catalog,
    canManage: computed(() => Boolean(toValue(options.canManage))),
    toggle,
    pending: mutation.isPending,
    mutationError: mutation.error,
  };
}
