/*
  【文件职责】     将本地 File 上传到最终 thread 并映射为消息附件描述符。
  【架构位置】     L3 纯提交协作层
  【主要导出】     createSubmissionFileCache · prepareSubmissionFiles
  【依赖关系】     uploads/api · messages/utils
  【边界与注意】   仅缓存完整成功响应；同一 File/thread 的 run 重试复用上传。
*/
import type { FileInMessage } from "../messages/utils";
import { uploadFiles, type UploadResponse } from "./api";

export type SubmissionFileCache = Map<string, WeakMap<File, FileInMessage>>;

export function createSubmissionFileCache(): SubmissionFileCache {
  return new Map();
}

export async function prepareSubmissionFiles(options: {
  threadId: string;
  files: File[];
  cache: SubmissionFileCache;
  signal?: AbortSignal;
  upload?: (
    threadId: string,
    files: File[],
    options?: { signal?: AbortSignal },
  ) => Promise<UploadResponse>;
}): Promise<FileInMessage[]> {
  options.signal?.throwIfAborted();
  let threadCache = options.cache.get(options.threadId);
  if (!threadCache) {
    threadCache = new WeakMap<File, FileInMessage>();
    options.cache.set(options.threadId, threadCache);
  }

  const missing = options.files.filter((file) => !threadCache.has(file));
  if (missing.length > 0) {
    const upload = options.upload ?? uploadFiles;
    const response = options.signal
      ? await upload(options.threadId, missing, { signal: options.signal })
      : await upload(options.threadId, missing);
    options.signal?.throwIfAborted();
    if (response.files.length !== missing.length) {
      throw new Error(
        response.message ||
          response.skipped_files.join(", ") ||
          "Upload failed",
      );
    }
    response.files.forEach((uploaded, index) => {
      const localFile = missing[index];
      if (!localFile) return;
      threadCache!.set(localFile, {
        filename: uploaded.filename,
        size: uploaded.size,
        path: uploaded.virtual_path,
        status: "uploaded",
      });
    });
  }

  return options.files.flatMap((file) => {
    const descriptor = threadCache!.get(file);
    return descriptor ? [descriptor] : [];
  });
}
