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
