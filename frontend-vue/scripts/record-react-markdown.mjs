#!/usr/bin/env node
/*
  【文件职责】     把 React 版 Streamdown 对 M3 语料的渲染结果录成夹具，供归一化 DOM 等价 gate 比对。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认重录；`--check` 只校验夹具与当前 React 版一致
  【依赖关系】     tests/fixtures/markdown-corpus.mjs；frontend/ 的 react-dom/server 与 streamdown
  【边界与注意】   录制**必须**在 `frontend/` 里跑——React、streamdown、shiki 都装在那边。
                   这里用 `node --input-type=module -e` + `cwd=frontend`：node 对 `--eval`
                   的 ESM 以 cwd 为解析基准，所以裸 specifier 能解析到 frontend 的
                   node_modules，而脚本本身仍留在 frontend-vue，不往 React 仓里塞文件。

                   `rehypeStreamingListItems` 不在这里重写一份 JS 拷贝：那会让夹具记录的是
                   「我抄的那份」而不是上游那份，gate 就变成自证。改为用 frontend 自带的
                   typescript 把 `src/core/streamdown/plugins.ts` 原地转译后导入。

                   夹具记录的是 **SSR 输出**。shiki 高亮与 mermaid 渲染都是浏览器侧异步任务，
                   SSR 拿到的是未高亮的回退结构；那层回退结构本身是有效契约，
                   高亮之后的 DOM 不在这个 gate 的回答范围内（见证据文档红项）。
*/

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = resolve(ROOT, "../frontend");

// 录制需要兄弟应用装好的 React/streamdown。本仓的 install/build/test/e2e 都不依赖
// 它（夹具是签入的），所以缺席时安静退出而不是失败——否则这个工具会把
// 「另一个应用在不在」变成本仓能不能跑的前提。
if (!existsSync(join(FRONTEND, "node_modules"))) {
  process.stdout.write(
    "兄弟应用 ../frontend 未安装依赖，跳过录制；签入的夹具保持不变。\n",
  );
  process.exit(0);
}
const CORPUS_URL = pathToFileURL(
  join(ROOT, "tests/fixtures/markdown-corpus.mjs"),
).href;
const OUTPUT = join(ROOT, "tests/fixtures/react-markdown-dom.json");

/** 在 frontend/ 里跑的录制程序。写成字符串是因为它必须以 frontend 为模块解析基准。 */
const PROGRAM = `
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";

const { CORPUS, PRESET_APP, PRESET_RAW, PRESET_DEFAULT } = await import(
  ${JSON.stringify(CORPUS_URL)}
);

// 上游 plugins.ts 原地转译后导入——不抄一份 JS 拷贝，见脚本头。
const cacheDir = "node_modules/.cache/deerflow-m3";
mkdirSync(cacheDir, { recursive: true });
const pluginSource = readFileSync("src/core/streamdown/plugins.ts", "utf8");
const transpiled = ts.transpileModule(pluginSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pluginFile = cacheDir + "/upstream-plugins.mjs";
writeFileSync(pluginFile, transpiled);
const { rehypeStreamingListItems } = await import(
  pathToFileURL(pluginFile).href
);

const katexOptions = { output: "html", throwOnError: false, strict: false };
const appRemark = [
  [remarkGfm, { singleTilde: false }],
  [remarkMath, { singleDollarTextMath: true }],
];

function propsFor(entry) {
  const streaming = entry.streaming ? [rehypeStreamingListItems] : [];
  if (entry.preset === PRESET_DEFAULT) {
    return streaming.length ? { rehypePlugins: streaming } : {};
  }
  const base = entry.preset === PRESET_RAW ? [rehypeRaw] : [];
  return {
    remarkPlugins: appRemark,
    rehypePlugins: [...base, [rehypeKatex, katexOptions], ...streaming],
  };
}

// Streamdown 自带的组件覆盖全部退回同名内建标签，于是渲染出来的就是
// 「它真实的 unified 管线 + hast-util-to-jsx-runtime(react)」的裸输出。
// 这样比对到的差异只可能来自管线装配或渲染器本身——正是 04 §1 说的那条界。
const NEUTRAL = {};
for (const tag of [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "img", "strong", "em", "del",
  "ul", "ol", "li", "blockquote", "hr", "pre", "code", "sup", "sub",
  "table", "thead", "tbody", "tr", "th", "td", "br", "span", "div", "section",
  "input",
]) {
  NEUTRAL[tag] = tag;
}

const records = {};
for (const entry of CORPUS) {
  const shared = {
    ...propsFor(entry),
    parseIncompleteMarkdown: entry.incomplete === true,
    children: entry.markdown,
  };
  records[entry.id] = {
    preset: entry.preset,
    streaming: entry.streaming === true,
    incomplete: entry.incomplete === true,
    // gate 判据：中性组件映射下的裸 DOM。
    neutralHtml: renderToStaticMarkup(
      React.createElement(Streamdown, { ...shared, components: NEUTRAL }),
    ),
    // M4b 的组件层规格：Streamdown 默认组件映射的完整产物。M3 只对代码块/mermaid 用它。
    styledHtml: renderToStaticMarkup(React.createElement(Streamdown, shared)),
  };
}

process.stdout.write(
  "@@RECORD@@" + JSON.stringify(records) + "@@END@@",
);
`;

function record() {
  const raw = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", PROGRAM],
    { cwd: FRONTEND, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const start = raw.indexOf("@@RECORD@@");
  const end = raw.indexOf("@@END@@");
  if (start === -1 || end === -1) {
    throw new Error(`录制程序没有输出结果：\n${raw}`);
  }
  return JSON.parse(raw.slice(start + "@@RECORD@@".length, end));
}

/*
  出处里的版本号**从上游实际装的那份读**，不写死。

  写死的代价不是「不好看」：上游升 streamdown 之后重录一次，出处会盖上一个
  **假的**版本号——夹具换了内容、标签还说是旧版本，而这份夹具正是 markdown
  对齐的全部依据。wave 49 发现时两者恰好都是 2.5.0，所以从没显形过。
  `tests/guards/golden-fixture-provenance.test.ts` 钉的就是「标签 == 实际装的版本」。
*/
function streamdownVersion() {
  const manifest = join(FRONTEND, "node_modules/streamdown/package.json");
  if (!existsSync(manifest)) return "unknown";
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  return typeof parsed.version === "string" ? parsed.version : "unknown";
}

function katexVersion() {
  const manifest = join(FRONTEND, "node_modules/katex/package.json");
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  if (typeof parsed.version !== "string")
    throw new Error("KaTeX version is missing");
  return parsed.version;
}

function main() {
  const check = process.argv.includes("--check");
  const records = record();
  const version = streamdownVersion();
  const mathVersion = katexVersion();
  const serialized = `${JSON.stringify(
    {
      $comment: `由 \`node scripts/record-react-markdown.mjs\` 从 frontend/ 的 React + streamdown@${version} + katex@${mathVersion} 录制。勿手改。`,
      recordedFrom: `frontend/ · streamdown ${version} · katex ${mathVersion} · react-dom/server`,
      entries: records,
    },
    null,
    2,
  )}\n`;

  if (check) {
    const current = readFileSync(OUTPUT, "utf8");
    if (current !== serialized) {
      process.stderr.write(
        "✗ React 侧夹具已过期：重跑 `node scripts/record-react-markdown.mjs` 并把 diff 交 review。\n",
      );
      process.exit(1);
    }
    process.stdout.write("React 夹具与当前 frontend/ 一致\n");
    return;
  }

  writeFileSync(OUTPUT, serialized);
  process.stdout.write(
    `录制 ${Object.keys(records).length} 条 → tests/fixtures/react-markdown-dom.json\n`,
  );
}

main();
