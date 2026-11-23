/*
  【文件职责】     核对文件头点名的导出、显式导出总数与「无依赖」声明。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     checkout 文件清单、源码注释剥离器
  【边界与注意】   「主要导出」是索引，只核对点名的存在；写了总数才核对全集。
                   依赖栏允许描述上下游关系，仅「无 / 零依赖」有统一可判的含义。
                   注释中的符号不能救活不存在的导出，字符串中的注释标记不能吞掉源码。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkoutFiles } from "../../scripts/lib/checkout-files.mjs";
import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

const MARKER = "【主要导出】";
const HEADER_MARKERS = [
  "【文件职责】",
  "【架构位置】",
  "【主要导出】",
  "【依赖关系】",
  "【边界与注意】",
];

/** 生产、配置、工具与测试源码都要扫描；根配置文件按散文头处理。 */
const SCAN_ROOTS = [
  "app",
  "config",
  "packages",
  "scripts",
  "server",
  "shared",
  "tests",
];

/** 扫描与排除目录必须恰好覆盖 checkout 的顶层目录；每项排除须解释原因。 */
const EXCLUDED_ROOTS: Record<string, string> = {
  baseline: "签入的数据文件，不是源码",
  public: "静态资源与录制下来的 demo，不是本仓源码",
  examples: "独立的消费方样例，由 make consumer-check 单独装起来跑",
  patches:
    "pnpm 注册的依赖源码差异文件，非独立 TS 模块；下方核对精确清单，公开 API 回归验证实际安装入口",
};

const sourceFiles = checkoutFiles(SCAN_ROOTS, { cwd: root }).filter((file) =>
  /\.(ts|mts|mjs)$/.test(file),
);

/** `【主要导出】` 那一行加上它后面所有缩进续行，拼成一句。 */
function exportBlockOf(source: string): string | null {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(MARKER));
  if (start < 0) return null;
  const head = lines[start] as string;
  const parts = [head.slice(head.indexOf(MARKER) + MARKER.length)];
  for (const line of lines.slice(start + 1)) {
    if (HEADER_MARKERS.some((marker) => line.includes(marker))) break;
    if (/^\s*(\*\/|-->)/.test(line)) break;
    if (!line.trim()) break;
    if (!/^\s{4,}/.test(line)) break;
    parts.push(line);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** 使用识别字符串的剥离器，避免路径中的通配符被误认成注释。 */
const stripJs = (source: string): string =>
  stripComments(source, ["line", "block"]);

function exportedNamesOf(source: string): Set<string> {
  const code = stripJs(source);
  const names = new Set<string>();
  const collect = (pattern: RegExp) => {
    for (const match of code.matchAll(pattern)) names.add(match[1] as string);
  };
  collect(
    /^\s*export\s+(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(/^\s*export\s+(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/gm);
  collect(
    /^\s*export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+default\s+(?:async\s+)?(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
  );
  for (const match of code.matchAll(/^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const piece of (match[1] as string).split(",")) {
      const token = piece.trim();
      if (!token) continue;
      const renamed = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(token);
      names.add(
        renamed ? (renamed[1] as string) : token.replace(/^type\s+/, "").trim(),
      );
    }
  }
  if (/^\s*export\s+default\b/m.test(code)) names.add("default");
  return names;
}

/** 三种命名法才算「点了一个名字」，其余按散文放过。 */
function looksLikeSymbol(token: string): boolean {
  return (
    /^[a-z][a-z0-9]*[A-Z]/.test(token) ||
    /^[A-Z][a-z0-9]+[A-Z]/.test(token) ||
    /^[A-Z][A-Z0-9]*_[A-Z0-9_]*$/.test(token)
  );
}

interface Declaration {
  file: string;
  block: string;
  tokens: string[];
  exported: Set<string>;
  reExports: boolean;
  /** 头里自己写下的导出总数（`… 等 9 个`），没写就是 null。 */
  claimedCount: number | null;
}

function declarationOf(file: string, source: string): Declaration | null {
  const block = exportBlockOf(source);
  if (block === null) return null;
  const tokens = [
    ...new Set([...block.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0])),
  ].filter(looksLikeSymbol);
  const counted = /等\s*(\d+)\s*个/.exec(block);
  return {
    file,
    block,
    tokens,
    exported: exportedNamesOf(source),
    reExports: /^\s*export\s+\*/m.test(stripJs(source)),
    claimedCount: counted ? Number(counted[1]) : null,
  };
}
const declarations = sourceFiles
  .map((file) => declarationOf(file, readFileSync(`${root}${file}`, "utf8")))
  .filter((entry): entry is Declaration => entry !== null);

function missingExports(entry: Declaration): string[] {
  return entry.tokens.filter((token) => !entry.exported.has(token));
}

function dependencyImports(source: string): string[] {
  return claimsNoDependency(source) ? importSpecifiersOf(source) : [];
}

/** `【依赖关系】` 里唯一可证伪的一档：整栏就一个「无 / 零依赖」。 */
function claimsNoDependency(source: string): boolean {
  const value = /【依赖关系】\s*(.+)/.exec(source)?.[1]?.trim();
  return value !== undefined && /^(无|零依赖)[。；;]?$/.test(value);
}

/** 静态与动态 import 的 specifier；注释先剥掉。 */
function importSpecifiersOf(source: string): string[] {
  return [
    ...new Set(
      [
        ...stripJs(source).matchAll(
          /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
        ),
      ].map((match) => match[1] as string),
    ),
  ];
}

describe("扫描面", () => {
  it("补丁目录恰好包含 pnpm 注册的差异文件，不能隐藏其它源码", () => {
    const manifest = JSON.parse(
      readFileSync(`${root}package.json`, "utf8"),
    ) as {
      pnpm: { patchedDependencies: Record<string, string> };
    };
    const registered = Object.values(manifest.pnpm.patchedDependencies).sort();
    const present = checkoutFiles(["patches"], { cwd: root });
    expect(present.length).toBeGreaterThan(0);
    expect(
      registered.every((file) => /^patches\/[^/]+\.patch$/.test(file)),
    ).toBe(true);
    expect(present).toEqual(registered);
  });

  it("按目录读取的源码集合与完整 checkout 清单相等", () => {
    const expected = checkoutFiles(["."], { cwd: root }).filter(
      (file) =>
        SCAN_ROOTS.includes(file.split("/")[0]!) &&
        /\.(ts|mts|mjs)$/.test(file),
    );
    expect(sourceFiles).toEqual(expected);
  });

  it("SCAN_ROOTS 与 EXCLUDED_ROOTS 恰好划分 checkout 里的顶层目录", () => {
    const tops = new Set(
      checkoutFiles(["."], { cwd: root })
        .map((file) => file.split("/"))
        .filter((parts) => parts.length > 1)
        .map((parts) => parts[0] as string),
    );
    const declared = [...SCAN_ROOTS, ...Object.keys(EXCLUDED_ROOTS)].sort();
    expect(
      declared,
      "checkout 里多了或少了一个顶层目录：要扫的进 SCAN_ROOTS，" +
        "有意不扫的进 EXCLUDED_ROOTS 并写出理由——" +
        "不表态的话那个目录下的文件头就静默不受检查",
    ).toEqual([...tops].sort());
  });

  it("EXCLUDED_ROOTS 的每项排除都显式给出理由", () => {
    const thin = Object.entries(EXCLUDED_ROOTS).filter(
      ([dir, why]) => !why.trim() || why.trim() === dir,
    );
    expect(thin, "有意不扫要写得出为什么").toEqual([]);
  });
});

describe("文件头的【依赖关系】", () => {
  const sourceEntries = sourceFiles
    .concat(
      checkoutFiles(["app"], { cwd: root }).filter((file) =>
        file.endsWith(".vue"),
      ),
    )
    .map((file) => ({ file, source: readFileSync(`${root}${file}`, "utf8") }));
  const claiming = sourceEntries.filter((entry) =>
    claimsNoDependency(entry.source),
  );

  it("确实有文件这么写（形状先断言再计算）", () => {
    const expected = sourceEntries
      .filter(({ source }) =>
        /^\s*(?:\*\s*)?【依赖关系】\s*(?:无|零依赖)[。；;]?\s*$/m.test(source),
      )
      .map(({ file }) => file)
      .sort();
    expect(claiming.map(({ file }) => file).sort()).toEqual(expected);
  });

  it("写「无」的文件真的一个 import 都没有", () => {
    const broken = claiming
      .filter((entry) => dependencyImports(entry.source).length > 0)
      .map(
        (entry) =>
          `${entry.file}：头里写「无」，实际 import ${importSpecifiersOf(entry.source).join(" ")}`,
      );
    expect(broken).toEqual([]);
  });
});

describe("文件头的【主要导出】", () => {
  it("扫到的文件与可判 token 都不是零（形状先断言再计算）", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const dir of SCAN_ROOTS) {
      expect(
        sourceFiles.some((file) => file.startsWith(`${dir}/`)),
        dir,
      ).toBe(true);
    }
    const expected = sourceFiles.filter((file) =>
      readFileSync(`${root}${file}`, "utf8").includes(MARKER),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(declarations.map(({ file }) => file)).toEqual(expected);
    expect(declarations.some(({ tokens }) => tokens.length > 0)).toBe(true);
  });

  it("点了名的文件必须真的解析出导出", () => {
    const silent = declarations
      .filter((entry) => entry.tokens.length > 0 && entry.exported.size === 0)
      .map((entry) => entry.file);
    expect(
      silent,
      "这些文件的头点了符号，却一个 export 都解析不出来——先修解析再谈比对",
    ).toEqual([]);
  });

  it("每个点名的符号都真的被这个文件导出", () => {
    const broken: string[] = [];
    for (const entry of declarations) {
      /*
        `export *` 的转出名要跨文件解析，当前模块里一个都没有（上面那条
        形状断言之外再兜一层）；真出现时先把这里补成解析，不要静默放过。
      */
      if (entry.reExports) continue;
      for (const token of missingExports(entry)) {
        broken.push(
          `${entry.file}：【主要导出】点名了 ${token}，文件没有导出它`,
        );
      }
    }
    expect(broken).toEqual([]);
  });

  /*
    写了「等 N 个」就不再是索引，而是一句**关于全集**的断言，而且能算。
    这一档与上面「只钉点名的存在」不冲突：不写数字的文件一行都不受影响。
    `export *` 的转出名解析不了，所以那种文件写数字也不判——真出现时
    上面那条 `starred` 用例会先红。
  */
  const counting = declarations.filter(
    (entry) => entry.claimedCount !== null && !entry.reExports,
  );

  it("确实有文件在头里写导出总数（形状先断言再计算）", () => {
    const expected = declarations.filter(
      ({ block, reExports }) => !reExports && /等\s*\d+\s*个/.test(block),
    );
    expect(counting.map(({ file }) => file)).toEqual(
      expected.map(({ file }) => file),
    );
  });

  it("写了「等 N 个」的，N 必须等于实际导出数", () => {
    const wrong = counting
      .filter((entry) => entry.claimedCount !== entry.exported.size)
      .map(
        (entry) =>
          `${entry.file}：头里写「等 ${entry.claimedCount} 个」，实际导出 ${entry.exported.size} 个`,
      );
    expect(
      wrong,
      "写数字就得对；不想维护这个数就把「等 N 个」去掉，判据自选口径",
    ).toEqual([]);
  });

  it("当前没有任何文件靠 export * 绕过比对", () => {
    const starred = declarations
      .filter((entry) => entry.reExports && entry.tokens.length > 0)
      .map((entry) => entry.file);
    expect(
      starred,
      "有文件同时用 export * 且在头里点名——把上面那条 continue 改成真解析",
    ).toEqual([]);
  });
});

describe("文件头解析负控", () => {
  const fixture = (header: string, code: string) =>
    `/*\n  【主要导出】 ${header}\n  【依赖关系】 无\n*/\n${code}`;

  it("三种符号命名都被核对，散文与纯首字母缩写不被误报", () => {
    const entry = declarationOf(
      "fixture.ts",
      fixture(
        "camelValue / PascalValue / ALL_CAPS / helpers / MCP / GET",
        "export const camelValue = 1;\nexport class PascalValue {}\nexport const ALL_CAPS = 2;",
      ),
    )!;
    expect(entry.tokens).toEqual(["camelValue", "PascalValue", "ALL_CAPS"]);
    expect(missingExports(entry)).toEqual([]);
  });

  it("注释里的导出不能救活缺失符号，字符串里的通配符不能吞掉真导出", () => {
    const entry = declarationOf(
      "fixture.ts",
      fixture(
        "presentValue / absentValue",
        [
          'const path = "/workspace/**";',
          "export const presentValue = path;",
          "// export const absentValue = 1;",
        ].join("\n"),
      ),
    )!;
    expect(entry.tokens).toEqual(["presentValue", "absentValue"]);
    expect([...entry.exported]).toEqual(["presentValue"]);
    expect(missingExports(entry)).toEqual(["absentValue"]);
    expect(
      declarationOf("fixture.ts", "export const presentValue = 1;"),
    ).toBeNull();
  });

  it("续行、别名、type、default 与显式总数都进入同一解析路径", () => {
    const entry = declarationOf(
      "fixture.ts",
      fixture(
        "firstValue / RenamedValue\n                   ExtraType / default 等 4 个",
        "const sourceValue = 1;\nexport const firstValue = 1;\nexport { sourceValue as RenamedValue };\nexport type ExtraType = string;\nexport default firstValue;",
      ),
    )!;
    expect(entry.tokens).toEqual(["firstValue", "RenamedValue", "ExtraType"]);
    expect(missingExports(entry)).toEqual([]);
    expect(entry.claimedCount).toBe(entry.exported.size);
    const wrong = declarationOf(
      "fixture.ts",
      fixture("firstValue 等 2 个", "export const firstValue = 1;"),
    )!;
    expect(wrong.claimedCount).not.toBe(wrong.exported.size);
    expect(
      declarationOf(
        "fixture.ts",
        fixture("firstValue", 'export * from "./values";'),
      )!.reExports,
    ).toBe(true);
  });

  it("无依赖声明检出静态、动态和 type-only import，忽略注释", () => {
    const source = fixture(
      "无",
      [
        'import type { ValueType } from "types";',
        'import "side-effect";',
        'const value = import("dynamic");',
        '// import "comment-only";',
      ].join("\n"),
    );
    expect(dependencyImports(source)).toEqual([
      "types",
      "side-effect",
      "dynamic",
    ]);
    expect(
      dependencyImports(
        source.replace("【依赖关系】 无", "【依赖关系】 零依赖；"),
      ),
    ).toEqual(["types", "side-effect", "dynamic"]);
    expect(
      dependencyImports(
        source.replace("【依赖关系】 无", "【依赖关系】 见 import"),
      ),
    ).toEqual([]);
    expect(
      dependencyImports(fixture("无", '// import "comment-only";')),
    ).toEqual([]);
  });
});
