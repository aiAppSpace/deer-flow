/*
  【文件职责】     核对源码、测试和文档中的文件行号引用与显式整文件行数声明。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     本模块与相邻 React 源码；checkout 文件清单
  【边界与注意】   默认引用上游；frontend-vue/ 字面前缀和 .vue 引用属于本模块。
                   只核对目标存在、行号范围与整文件行数，不冒充引用语义审查。
                   上游缺席时仅跳过上游检查，本地引用和解析负控仍须执行。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkoutFiles } from "../../scripts/lib/checkout-files.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const moduleRoot = join(here, "../..");

/** 产物与录制内容，不是本仓写下的记录。 */
const SKIPPED_DIRS = new Set([
  "node_modules",
  ".cache",
  ".nuxt",
  ".output",
  ".data",
  "test-results",
  "playwright-report",
  "dist",
  "public",
]);
const upstreamRoots = [
  join(here, "../../../frontend/src"),
  join(here, "../../../frontend/tests"),
];
const upstreamModule = join(here, "../../../frontend");
const upstreamPresent = upstreamRoots.some((root) => existsSync(root));

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** 上游没有 Vue 源文件时，未带前缀的 .vue 引用也属于本模块。 */
const CITATION = /([A-Za-z0-9_\-./]+\.(?:tsx|ts|vue))[:：](\d+)/g;

/** 必须是字面前缀，不能以本地同名文件代替丢失的上游文件。 */
const LOCAL_PREFIX = "frontend-vue/";

/**
 * 「上游 `X`（N 行）」这一类**行数**断言。三种写法都收：
 * 文件名后跟括号里的行数、`上游 \`X\` N 行`、`上游 N 行的 \`X\``。
 * **必须有紧挨着的反引号文件名**——`上游那 16 行` 说的是组件里的一段，不是整份文件。
 */
const UPSTREAM_FILE = String.raw`[A-Za-z0-9_][A-Za-z0-9_.\-]*\.(?:tsx|ts|mts|mjs|js|vue|css|json)`;
const LINE_COUNT_PATTERNS = [
  new RegExp(
    String.raw`\`(${UPSTREAM_FILE})\`\s*[（(](?:上游\s*)?([0-9][0-9,]*)\s*行`,
    "g",
  ),
  new RegExp(
    String.raw`上游\s*\`(${UPSTREAM_FILE})\`\s*([0-9][0-9,]*)\s*行`,
    "g",
  ),
  new RegExp(
    String.raw`上游\s*([0-9][0-9,]*)\s*行的\s*\`(${UPSTREAM_FILE})\``,
    "g",
  ),
];

type LineCountClaim = {
  from: string;
  line: number;
  ref: string;
  claimed: number;
};

const sourceFiles = walk(moduleRoot, [".vue", ".ts", ".mts", ".mjs", ".md"]);

function lineCountClaimsIn(source: string, from: string): LineCountClaim[] {
  const found: LineCountClaim[] = [];
  LINE_COUNT_PATTERNS.forEach((pattern, index) => {
    for (const match of source.matchAll(pattern)) {
      const ref = index === 2 ? match[2]! : match[1]!;
      const digits = index === 2 ? match[1]! : match[2]!;
      found.push({
        from,
        line: source.slice(0, match.index).split("\n").length,
        ref,
        claimed: Number(digits.replaceAll(",", "")),
      });
    }
  });
  return found;
}

type Citation = { from: string; line: number; ref: string; target: number };

function citationsIn(source: string, from: string): Citation[] {
  return source.split("\n").flatMap((text, index) =>
    [...text.matchAll(CITATION)].map((match) => ({
      from,
      line: index + 1,
      ref: match[1]!,
      target: Number(match[2]),
    })),
  );
}

function referenceOwner(ref: string): "local" | "localVue" | "upstream" {
  if (ref.startsWith(LOCAL_PREFIX)) return "local";
  return ref.endsWith(".vue") ? "localVue" : "upstream";
}

const citations = sourceFiles.flatMap((file) =>
  citationsIn(readFileSync(file, "utf8"), relative(moduleRoot, file)),
);
const local = citations.filter((one) => referenceOwner(one.ref) !== "upstream");
const upstream = citations.filter(
  (one) => referenceOwner(one.ref) === "upstream",
);
const index = basenameIndex(upstreamRoots, [".ts", ".tsx"]);
const vueIndex = basenameIndex([moduleRoot], [".vue"]);

function basenameIndex(roots: string[], exts: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root, exts)) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      index.set(name, [...(index.get(name) ?? []), file]);
    }
  }
  return index;
}

/**
 * 按 basename 找，再用**路径后缀**精确化——与上游那一档同一套解析。
 * 找不到候选返回 `null`，与「找到了但行号越界」区分开。
 */
function resolve(index: Map<string, string[]>, ref: string): string[] | null {
  const base = ref.slice(ref.lastIndexOf("/") + 1);
  const candidates = index.get(base) ?? [];
  const exact = candidates.filter((path) =>
    path.endsWith(ref.replace(/^\.\//, "")),
  );
  const pool = exact.length ? exact : candidates;
  return pool.length ? pool : null;
}

type ReadSource = (path: string) => string | undefined;
const readSource: ReadSource = (path) =>
  existsSync(path) ? readFileSync(path, "utf8") : undefined;

function citationProblems(
  items: Citation[],
  upstreamIndex: Map<string, string[]>,
  localIndex: Map<string, string[]>,
  read: ReadSource,
): string[] {
  const broken: string[] = [];
  for (const citation of items) {
    const owner = referenceOwner(citation.ref);
    const pool =
      owner === "local"
        ? [join(moduleRoot, citation.ref.slice(LOCAL_PREFIX.length))]
        : resolve(
            owner === "localVue" ? localIndex : upstreamIndex,
            citation.ref,
          );
    const sources = (pool ?? [])
      .map(read)
      .filter((source): source is string => source !== undefined);
    if (!sources.length)
      broken.push(`${citation.from}:${citation.line} → ${citation.ref} 不存在`);
    else if (
      citation.target < 1 ||
      !sources.some((source) => source.split("\n").length >= citation.target)
    )
      broken.push(
        `${citation.from}:${citation.line} → ${citation.ref}:${citation.target} 行号越界`,
      );
  }
  return broken;
}

function lineCountProblems(
  claims: LineCountClaim[],
  upstreamIndex: Map<string, string[]>,
  read: ReadSource,
): string[] {
  return claims.flatMap((claim) => {
    const actual = (upstreamIndex.get(claim.ref) ?? [])
      .map(read)
      .filter((source): source is string => source !== undefined)
      .map(
        (source) => source.split("\n").length - Number(source.endsWith("\n")),
      );
    if (!actual.length)
      return [`${claim.from}:${claim.line} → 上游没有 ${claim.ref}`];
    return actual.includes(claim.claimed)
      ? []
      : [
          `${claim.from}:${claim.line} → ${claim.ref} 写着 ${claim.claimed} 行，实际 ${actual.join("/")} 行`,
        ];
  });
}

describe("引用扫描与本模块引用", () => {
  it("扫描包含 checkout 中所有非产物源码与文档，不能空扫描", () => {
    const expected = checkoutFiles(["."], { cwd: moduleRoot }).filter(
      (file) =>
        !file.split("/").some((part) => SKIPPED_DIRS.has(part)) &&
        /\.(vue|ts|mts|mjs|md)$/.test(file),
    );
    const actual = sourceFiles.map((file) => relative(moduleRoot, file));
    expect(expected.length).toBeGreaterThan(0);
    expect(actual).toEqual(expect.arrayContaining(expected));
    expect(citations.length).toBeGreaterThan(0);
    expect(vueIndex.size).toBeGreaterThan(0);
    const expectedVue = expected
      .filter((file) => file.endsWith(".vue"))
      .map((file) => join(moduleRoot, file));
    expect([...vueIndex.values()].flat()).toEqual(
      expect.arrayContaining(expectedVue),
    );
  });

  it("本模块引用独立于相邻 React checkout 校验", () => {
    expect(citationProblems(local, index, vueIndex, readSource)).toEqual([]);
  });
});

describe.skipIf(!upstreamPresent)("本仓写下的上游引用", () => {
  it("上游索引包含每个源码根的真实文件，分流前提仍成立", () => {
    const actual = [...index.values()].flat().sort();
    for (const root of upstreamRoots.filter(existsSync)) {
      const expected = checkoutFiles([relative(upstreamModule, root)], {
        cwd: upstreamModule,
      })
        .filter((file) => /\.(ts|tsx)$/.test(file))
        .map((file) => join(upstreamModule, file));
      expect(expected.length).toBeGreaterThan(0);
      expect(actual).toEqual(expect.arrayContaining(expected));
    }
    expect(upstream.length).toBeGreaterThan(0);
    expect(
      basenameIndex(upstreamRoots, [".vue"]).size,
      "上游出现 .vue 文件，必须改为显式区分本地和上游引用",
    ).toBe(0);
  });

  it("引用上游文件行数的地方，数字就是那份文件的实际行数", () => {
    const claims = sourceFiles.flatMap((file) =>
      lineCountClaimsIn(readFileSync(file, "utf8"), relative(moduleRoot, file)),
    );
    expect(lineCountProblems(claims, index, readSource)).toEqual([]);
  });

  it("每条引用的上游文件都存在，行号都在文件长度之内", () => {
    expect(citationProblems(upstream, index, vueIndex, readSource)).toEqual([]);
  });
});

describe("引用解析负控", () => {
  // 分开拼接伪引用，避免这些故意错误的样本成为真实 checkout 引用。
  const cite = (ref: string, line: number) => [ref, line].join(":");
  const ref = "fixture.ts";
  const path = "/fixture/fixture.ts";
  const fakeIndex = new Map([[ref, [path]]]);
  const fakeRead: ReadSource = (file) =>
    file === path ? "first\nsecond\n" : undefined;

  it("支持中英文冒号、Vue 与本地前缀，分流不放宽为 frontend", () => {
    const refs = [
      ["frontend", "src", "value.ts"].join("/"),
      ["frontend-vue", "app", "value.ts"].join("/"),
      "Panel.vue",
    ];
    const result = citationsIn(
      refs.map((name) => cite(name, 2)).join("\n"),
      "fixture",
    );
    expect(result.map((one) => [one.ref, one.target, one.line])).toEqual(
      refs.map((name, i) => [name, 2, i + 1]),
    );
    expect(
      citationsIn(cite("Panel.tsx", 3).replace(":", "："), "fixture")[0]
        ?.target,
    ).toBe(3);
    expect(refs.map(referenceOwner)).toEqual(["upstream", "local", "localVue"]);
  });

  it("缺文件、越界与零行号失败，正确引用通过；同名文件优先匹配路径后缀", () => {
    const check = (name: string, line: number) =>
      citationProblems(
        citationsIn(cite(name, line), "fixture"),
        fakeIndex,
        new Map(),
        fakeRead,
      );
    expect(check(ref, 2)).toEqual([]);
    expect(check("absent.ts", 1)[0]).toContain("不存在");
    expect(check(ref, 4)[0]).toContain("行号越界");
    expect(check(ref, 0)[0]).toContain("行号越界");
    const ambiguous = new Map([[ref, ["/one/fixture.ts", "/two/fixture.ts"]]]);
    expect(resolve(ambiguous, "two/fixture.ts")).toEqual(["/two/fixture.ts"]);
    expect(
      check(["frontend-vue", "app", "absent.ts"].join("/"), 1)[0],
    ).toContain("不存在");
    expect(check("Absent.vue", 1)[0]).toContain("不存在");
  });

  it("三种整文件行数写法均解析，错误行数与缺失目标失败", () => {
    const quoted = "`" + ref + "`";
    const source = [
      quoted + "（2 行）",
      "上游 " + quoted + " 2 行",
      "上游 2 行的 " + quoted,
    ].join("\n");
    const claims = lineCountClaimsIn(source, "fixture");
    expect(
      claims.map(({ ref: name, claimed, line }) => [name, claimed, line]),
    ).toEqual([
      [ref, 2, 1],
      [ref, 2, 2],
      [ref, 2, 3],
    ]);
    expect(lineCountProblems(claims, fakeIndex, fakeRead)).toEqual([]);
    expect(
      lineCountProblems(
        [{ ...claims[0]!, claimed: 3 }],
        fakeIndex,
        fakeRead,
      )[0],
    ).toContain("实际 2 行");
    expect(lineCountProblems(claims, new Map(), fakeRead)[0]).toContain(
      "上游没有",
    );
    expect(lineCountClaimsIn("上游那 16 行", "fixture")).toEqual([]);
  });
});
