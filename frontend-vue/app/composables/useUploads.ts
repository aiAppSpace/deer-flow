/*
  【文件职责】     上传的 vue-query 绑定（05 N1）。
  【架构位置】     L3（Vue 适配）
  【主要导出】     UPLOAD_QUERY_KEYS · useUploadLimits · useUploadedFiles
                   useUploadFiles · useDeleteUploadedFile
  【依赖关系】     @tanstack/vue-query · @/core/uploads/api
  【边界与注意】   **N1 的登记在这里填完。** 05 N 组的验收动作是「移植前先去读源码
                   补齐这一格」，读完的四条结论：

                   1. **限额从 Gateway 来**，不是前端常量：`GET /uploads/limits`。
                      `retry: false` + `staleTime 60s` 与上游一致——**这两个不能改**：
                      限额拿不到时的既定降级是「交给服务端校验」，重试只会让
                      composer 在网络差时卡住而不是放行。
                   2. **超限的降级路径是服务端**。`file-validation.ts`
                      是同一套规则的前端副本，用于即时反馈；它与后端不一致时
                      **以后端为准**，前端那份只负责别让用户白等一次上传。
                   3. **pre-submit 上传状态归 `threads` 而不是这里**
                      （`frontend/AGENTS.md` 明确，05 N1 转述）。所以本文件里
                      没有「正在上传」的状态——那个 `isUploading` 在
                      `useThreadStream` 上。分家的理由是它属于**一次提交**的
                      生命周期，不属于 thread 的上传列表。
                   4. **上传中切 thread：附件不持久化**（对照 05 E3）。
                      查询按 threadId 分键，切走即失去订阅；进行中的那次 POST
                      不会被取消，但它的结果只会落到原 thread 的列表缓存里。
                      **这一条本窗口没有 E2E 覆盖**，只有键的形状是可断言的。
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  observeUploadLimits,
  type ThreadConsumptionObservation,
} from "@/core/diagnostics/parity-observation";

import {
  deleteUploadedFile,
  getUploadLimits,
  listUploadedFiles,
  uploadFiles,
  type UploadResponse,
} from "@/core/uploads/api";

export const UPLOAD_QUERY_KEYS = {
  limits: (threadId: string) => ["uploads", "limits", threadId] as const,
  list: (threadId: string) => ["uploads", "list", threadId] as const,
} as const;

export function useUploadLimits(
  threadId: MaybeRefOrGetter<string>,
  options?: {
    observation?: MaybeRefOrGetter<
      ThreadConsumptionObservation | null | undefined
    >;
  },
) {
  return useQuery({
    queryKey: computed(() => UPLOAD_QUERY_KEYS.limits(toValue(threadId))),
    queryFn: () => {
      const raw = toValue(threadId);
      observeUploadLimits(raw, () => toValue(options?.observation));
      return getUploadLimits(raw);
    },
    enabled: computed(() => Boolean(toValue(threadId))),
    retry: false,
    staleTime: 60_000,
  });
}

export function useUploadedFiles(threadId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => UPLOAD_QUERY_KEYS.list(toValue(threadId))),
    queryFn: () => listUploadedFiles(toValue(threadId)),
    enabled: computed(() => Boolean(toValue(threadId))),
  });
}

export function useUploadFiles(threadId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation<UploadResponse, Error, File[]>({
    mutationFn: (files: File[]) => uploadFiles(toValue(threadId), files),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...UPLOAD_QUERY_KEYS.list(toValue(threadId))],
      });
    },
  });
}

export function useDeleteUploadedFile(threadId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      deleteUploadedFile(toValue(threadId), filename),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...UPLOAD_QUERY_KEYS.list(toValue(threadId))],
      });
    },
  });
}
