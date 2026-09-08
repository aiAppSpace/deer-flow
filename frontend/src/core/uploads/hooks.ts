/**
 * React hooks for file uploads
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  deleteUploadedFile,
  getUploadLimits,
  listUploadedFiles,
  uploadFiles,
  type UploadedFileInfo,
  type UploadResponse,
} from "./api";

/**
 * Hook to load the gateway-enforced upload limits.
 * Callers intentionally degrade to server-side validation if this request fails.
 */
/*
 * `enabled` so a public showcase page can opt out. `/showcase/<id>` renders the
 * same ChatPage, and `useThreadChat` already resolves `isMock` from that route
 * prefix -- but these queries were never gated on it, so an anonymous visitor
 * to a shared read-only conversation still triggered the workspace API calls.
 * Measured by the parity harness on 2026-09-09: four requests React made on
 * that screen that the Vue app made none of.
 */
export function useUploadLimits(
  threadId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["uploads", "limits", threadId],
    queryFn: () => getUploadLimits(threadId),
    enabled: !!threadId && (options?.enabled ?? true),
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * Hook to upload files
 */
export function useUploadFiles(threadId: string) {
  const queryClient = useQueryClient();

  return useMutation<UploadResponse, Error, File[]>({
    mutationFn: (files: File[]) => uploadFiles(threadId, files),
    onSuccess: () => {
      // Invalidate the uploaded files list
      void queryClient.invalidateQueries({
        queryKey: ["uploads", "list", threadId],
      });
    },
  });
}

/**
 * Hook to list uploaded files
 */
export function useUploadedFiles(threadId: string) {
  return useQuery({
    queryKey: ["uploads", "list", threadId],
    queryFn: () => listUploadedFiles(threadId),
    enabled: !!threadId,
  });
}

/**
 * Hook to delete an uploaded file
 */
export function useDeleteUploadedFile(threadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => deleteUploadedFile(threadId, filename),
    onSuccess: () => {
      // Invalidate the uploaded files list
      void queryClient.invalidateQueries({
        queryKey: ["uploads", "list", threadId],
      });
    },
  });
}

/**
 * Hook to handle file uploads in submit flow
 * Returns a function that uploads files and returns their info
 */
export function useUploadFilesOnSubmit(threadId: string) {
  const uploadMutation = useUploadFiles(threadId);

  return useCallback(
    async (files: File[]): Promise<UploadedFileInfo[]> => {
      if (files.length === 0) {
        return [];
      }

      const result = await uploadMutation.mutateAsync(files);
      return result.files;
    },
    [uploadMutation],
  );
}
