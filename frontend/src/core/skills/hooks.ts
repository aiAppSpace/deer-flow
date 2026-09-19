import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { enableSkill, SkillRequestError, uploadSkillArchive } from "./api";

import { loadSkills } from ".";

/*
 * `enabled` so a public showcase page can opt out. `/showcase/<id>` renders the
 * same ChatPage, and `useThreadChat` already resolves `isMock` from that route
 * prefix -- but these queries were never gated on it, so an anonymous visitor
 * to a shared read-only conversation still triggered the workspace API calls.
 * Measured by the parity harness on 2026-09-09: four requests React made on
 * that screen that the Vue app made none of.
 */
export function useSkills(options?: { enabled?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["skills"],
    queryFn: () => loadSkills(),
    enabled: options?.enabled ?? true,
    /*
     * The catalog only changes through the mutations below, and both of them
     * invalidate this key -- so a stale window costs nothing and stops the
     * *second* observer from re-fetching what the first one just loaded.
     *
     * Measured 2026-09-19 on the `user-message-plain-text` parity screen (a
     * transcript containing a `/data-analysis ...` activation, so both the
     * composer and `HumanSlashSkillText` observe this query): without a stale
     * window React issued `GET /api/skills` **twice in 2 of 5 runs** (t=274ms
     * then t=323ms) because the transcript observer mounted after the first
     * fetch had already resolved. The Vue app issued exactly one in 5/5. The
     * duplicate is invisible to every gate except the parity requests lane,
     * where it shows up as an intermittent `requestsOnlyReact`.
     */
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => !(err instanceof SkillRequestError) && count < 3,
  });
  return { skills: data ?? [], isLoading, error };
}

export function useEnableSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      skillName,
      enabled,
    }: {
      skillName: string;
      enabled: boolean;
    }) => {
      await enableSkill(skillName, enabled);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

export function useUploadSkillArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadSkillArchive,
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: ["skills"] });
      }
    },
  });
}
