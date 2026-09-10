/*
  【文件职责】     artifact 在列表里怎么被称呼：文件名与人读的类型名。
  【架构位置】     L3
  【主要导出】     artifactFileName / artifactTypeDisplayName / artifactFileIcon
  【依赖关系】     lucide-vue-next（图标映射）
  【边界与注意】   与 React 的 `getFileName` / `getFileExtensionDisplayName`
                   （frontend/src/core/utils/files.tsx）同形：几种常见办公与文档格式
                   有自己的名字，其余一律大写扩展名。类型名**不翻译**——React 那边
                   返回的就是 "Markdown" / "Word" 这样的固定串，两个应用必须叫同一个名字。
*/

import {
  BookOpenText,
  Compass,
  FileCode,
  FileCog,
  FilePlay,
  FileText,
  Image as ImageIcon,
} from "lucide-vue-next";
const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "css",
  "scss",
  "less",
  "vue",
  "svelte",
  "py",
  "java",
  "kt",
  "go",
  "rs",
  "rb",
  "php",
  "sh",
  "bash",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "sql",
  "c",
  "h",
  "cpp",
  "cs",
]);
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "tiff",
  "ico",
  "webp",
  "svg",
  "heic",
]);
const MEDIA_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "aac",
  "m4a",
  "flac",
  "wma",
  "aiff",
  "ape",
  "mp4",
  "mov",
  "m4v",
]);

/** 与 React 的 getFileIcon 同一张映射表（frontend/src/core/utils/files.tsx）。 */
export function artifactFileIcon(filepath: string) {
  const extension = (filepath.split(".").pop() ?? "").toLowerCase();
  if (extension === "skill") return FileCog;
  if (extension === "html") return Compass;
  if (extension === "txt" || extension === "md") return BookOpenText;
  if (IMAGE_EXTENSIONS.has(extension)) return ImageIcon;
  if (MEDIA_EXTENSIONS.has(extension)) return FilePlay;
  return CODE_EXTENSIONS.has(extension) ? FileCode : FileText;
}

export function artifactFileName(filepath: string) {
  return filepath.split("/").pop() ?? filepath;
}

export function artifactTypeDisplayName(filepath: string) {
  const extension = artifactFileName(filepath).split(".").pop() ?? "";
  switch (extension.toLowerCase()) {
    case "doc":
    case "docx":
      return "Word";
    case "md":
      return "Markdown";
    case "txt":
      return "Text";
    case "ppt":
    case "pptx":
      return "PowerPoint";
    case "xls":
    case "xlsx":
      return "Excel";
    default:
      return extension.toUpperCase();
  }
}

/**
 * 把字节数说成人话：B / KiB / MiB，一位小数。
 *
 * 与 React 的同名函数同形（artifact-file-preview.tsx）。两个应用对同一份文件
 * 必须说出同一句话，所以它有且只有这一份——面板和独立视窗都从这里取。
 */
export function formatArtifactBytes(
  bytes: number | undefined,
): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
