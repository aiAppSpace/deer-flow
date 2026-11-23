/*
  【文件职责】     artifact 显式文件分类与能力策略。
  【架构位置】     L3
  【主要导出】     classifyArtifact / canLoadArtifactText / canSaveArtifactText / canInstallSkillArtifact
  【依赖关系】     无
  【边界与注意】   正式文件按显式扩展名白名单分类；未知类型只下载。write-file 草稿按文本呈现，.skill 读取 SKILL.md；不以 MIME 推断能力。
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
  txt: "text",
  csv: "csv",
  tsv: "tsv",
  log: "text",
  conf: "text",
  config: "text",
  properties: "text",
  props: "text",
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  py: "python",
  pyi: "python",
  pyw: "python",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "groovy",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  hh: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  rake: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "zsh",
  fish: "fish",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  ini: "ini",
  env: "dotenv",
  md: "markdown",
  mdx: "mdx",
  rst: "rst",
  sql: "sql",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  r: "r",
  matlab: "matlab",
  julia: "julia",
  jl: "julia",
  elm: "elm",
  haskell: "haskell",
  hs: "haskell",
  elixir: "elixir",
  ex: "elixir",
  clj: "clojure",
  cljs: "clojure",
  dockerfile: "dockerfile",
  docker: "docker",
  tf: "terraform",
  tfvars: "terraform",
  hcl: "hcl",
  makefile: "makefile",
  cmake: "cmake",
  gradle: "groovy",
  gitignore: "git-commit",
  gitattributes: "git-commit",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
  prisma: "prisma",
  wasm: "wasm",
  zig: "zig",
  v: "v",
};

const MEDIA_EXTENSIONS: Readonly<Record<string, ArtifactPreviewKind>> = {
  apng: "image",
  avif: "image",
  bmp: "image",
  ico: "image",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  png: "image",
  webp: "image",
  aac: "audio",
  flac: "audio",
  m4a: "audio",
  mp3: "audio",
  ogg: "audio",
  wav: "audio",
  m4v: "video",
  mov: "video",
  mp4: "video",
  webm: "video",
};

function sourceOf(filepath: string): ArtifactSource {
  if (filepath.startsWith("write-file:")) return "write-file-draft";
  return filepath.split(/[?#]/, 1)[0]?.endsWith(".skill")
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
  return (name.split(".").at(-1) ?? "").toLowerCase();
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

  if (source === "write-file-draft") {
    return { ...common, kind: "text", language: "text", previewKind: null };
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
