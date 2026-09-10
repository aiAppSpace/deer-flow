/*
  【文件职责】     artifact 显式文件分类与能力策略。
  【架构位置】     L3
  【主要导出】     classifyArtifact / canLoadArtifactText / canSaveArtifactText / canInstallSkillArtifact
  【依赖关系】     无
  【边界与注意】   未知扩展名、无扩展名、SVG、Office 与归档一律 fail closed；MIME 只能收窄能力。
*/

export type ArtifactSource = "formal" | "write-file-draft" | "skill-archive";

export type ArtifactPreviewKind = "image" | "audio" | "video" | "pdf";

export type ArtifactPolicy =
  | {
      kind: "text";
      language: string;
      previewKind: null;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    }
  | {
      kind: "browser-media" | "safe-document";
      language: null;
      previewKind: ArtifactPreviewKind;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    }
  | {
      kind: "skill-archive" | "download-only";
      language: null;
      previewKind: null;
      source: ArtifactSource;
      isMock: boolean;
      filepath: string;
    };

const TEXT_LANGUAGES: Readonly<Record<string, string>> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  css: "css",
  csv: "csv",
  go: "go",
  h: "c",
  hpp: "cpp",
  htm: "html",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsonl: "json",
  jsx: "jsx",
  log: "text",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsv: "tsv",
  tsx: "tsx",
  txt: "text",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const MEDIA_EXTENSIONS: Readonly<Record<string, ArtifactPreviewKind>> = {
  apng: "image",
  avif: "image",
  bmp: "image",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  png: "image",
  webp: "image",
  aac: "audio",
  flac: "audio",
  m4a: "audio",
  mp3: "audio",
  oga: "audio",
  ogg: "audio",
  wav: "audio",
  weba: "audio",
  m4v: "video",
  mov: "video",
  mp4: "video",
  ogv: "video",
  webm: "video",
};

function sourceOf(filepath: string): ArtifactSource {
  if (filepath.startsWith("write-file:")) return "write-file-draft";
  return filepath.split(/[?#]/, 1)[0]?.toLowerCase().endsWith(".skill")
    ? "skill-archive"
    : "formal";
}

function extensionOf(filepath: string) {
  let normalized = filepath.split(/[?#]/, 1)[0] ?? filepath;
  if (filepath.startsWith("write-file:")) {
    try {
      normalized = new URL(filepath).pathname;
    } catch {
      normalized = filepath.slice("write-file:".length);
    }
  }
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function classifyArtifact(
  filepath: string,
  metadata: { contentType?: string; isMock?: boolean } = {},
): ArtifactPolicy {
  const source = sourceOf(filepath);
  const extension = extensionOf(filepath);
  const common = { filepath, source, isMock: metadata.isMock === true };

  /*
    `.skill` 是**目录形态的包**，里面有一份 SKILL.md，所以它按 markdown 预览，
    不是按"不能预览的归档"。React 就是这么判的：`isSkillFile` 直接返回
    `{ isCodeFile: true, language: "markdown" }`，loader 再把 URL 补上 `/SKILL.md`
    （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx 与
    core/artifacts/loader.ts）。Vue 原来把它归到 skill-archive、只给一句"可下载"，
    于是用户点开一个技能包什么也看不到。

    `source` 仍然是 skill-archive——安装入口靠它，而且它也不能编辑
    （canSaveArtifactText 只认 formal）。
  */
  if (source === "skill-archive") {
    return {
      ...common,
      kind: "text",
      language: "markdown",
      previewKind: null,
    };
  }

  const language = TEXT_LANGUAGES[extension];
  if (language !== undefined) {
    return { ...common, kind: "text", language, previewKind: null };
  }

  const previewKind = MEDIA_EXTENSIONS[extension];
  if (previewKind !== undefined) {
    return {
      ...common,
      kind: "browser-media",
      language: null,
      previewKind,
    };
  }

  if (extension === "pdf") {
    return {
      ...common,
      kind: "safe-document",
      language: null,
      previewKind: "pdf",
    };
  }

  return {
    ...common,
    kind: "download-only",
    language: null,
    previewKind: null,
  };
}

/**
 * 这门「语言」用哪个字符分列；不是表格就返回 `null`。
 *
 * **只认 csv 与 tsv**：把 `.txt` 之类也猜成表格，一份普通文本会被按逗号切成
 * 一堆无意义的列，而用户看不出发生了什么。要扩展就显式加一条。
 */
export function getTabularDelimiter(
  language: string | null,
): "," | "\t" | null {
  if (language === "csv") return ",";
  if (language === "tsv") return "\t";
  return null;
}

export function canLoadArtifactText(policy: ArtifactPolicy) {
  return policy.kind === "text";
}

export function canSaveArtifactText(
  policy: ArtifactPolicy,
  options: { hasRevision: boolean; fullContentLoaded?: boolean },
) {
  return (
    policy.kind === "text" &&
    policy.source === "formal" &&
    !policy.isMock &&
    policy.filepath.replace(/^\/+/, "").startsWith("mnt/user-data/outputs/") &&
    options.hasRevision &&
    options.fullContentLoaded !== false
  );
}

export function canInstallSkillArtifact(
  policy: ArtifactPolicy,
  options: { isAdmin: boolean },
) {
  return policy.source === "skill-archive" && !policy.isMock && options.isAdmin;
}
