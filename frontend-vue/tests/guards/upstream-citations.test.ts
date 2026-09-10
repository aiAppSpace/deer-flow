/*
  【文件职责】     守住本仓写下的 `文件:行号` 引用都还指得到东西：默认按**上游**解，
                   路径字面以 `frontend-vue/` 开头的按**本模块**解（wave 129，见 LOCAL_PREFIX）。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     本模块的源码/测试/文档注释 · ../frontend/{src,tests}（缺席则整组跳过）
  【边界与注意】   **这是本仓最容易被信、却从来没有被验过的一类记录。**
                   wave 45（线索 171）翻出 `ChatComposer.vue` 里一句「布局那几个类
                   （`min-h-10 flex-1`）」——那两个类在 wave 37 就被顺带去掉了，
                   注释却留在原地挂了八轮。wave 46 顺着往下查，发现 `app/**` 里
                   **有 136 处 `上游文件.tsx:行号` 形式的引用，一次都没有被验过**，
                   而抽验能看到行号漂了（`input-box.tsx:1328` 写的是 composerLocked，
                   实际在 1331）。

                   **这条守卫只钉能机械判的那一半**：被引的文件必须存在，行号必须
                   落在文件长度之内。**它不判「那一行是不是仍在说同一件事」**——
                   那要语义判断，钉进门禁只会变成一条随上游任何改动就红的噪声。
                   小幅漂移（几行）不影响读者找到目标；文件没了、行号越界才是
                   「照着找什么都找不到」。

                   同名文件（`hooks.ts` / `page.tsx` 在上游有多份）按**路径后缀**
                   先精确匹配；只写了 basename 时，只要有一个候选够长就算过——
                   再严就会把合法的简写判红。

                   `../frontend` 缺席时整组跳过：本模块的独立性不受影响
                   （与 scenario-coverage / standalone-check 的 DECLARED 同一条规矩）。

                   **wave 53 补的第二类：引用的不是位置，是上游文件的「多少行」。**
                   `文件:行号` 只判存在与不越界（小幅漂移无所谓），而
                   **`上游 N 行的 X` 是一句关于整份文件的精确断言**，上游一改就错，
                   而且**错得毫无迹象**。wave 53 实测七处：`plugins.ts` 98、
                   `safe-children.ts` 34、`api-client.ts` 471、`infinite.test.ts` 498
                   四处仍然精确，而 `message-merge.test.ts` 的「1,740 行」在
                   **`44832a5e`（2026-08-14 合上游）** 之后变成 2,095，
                   两个文件里各挂着一份，错了三周。
                   （同一轮还有 `globals.css` 的 453→454，是本仓自己那次
                   `4804faa1` 改的；那句话里数字不承重，已删掉数字而不是改数字——
                   **不承重的数字就别写**。）

                   **判据是相等，不是「在范围内」**：这类数字只有准确才有意义，
                   而它变红的那一刻，正是「上游那份测试长了 355 行，去看看」
                   最该被看见的时候。**识别的形状是「反引号里的文件名紧挨着行数」**，
                   所以 `上游那 16 行`（组件片段，不是整份文件）这类不会被误抓。

                   **wave 51 把范围从 `app/**` 推到整个模块。** wave 46 只扫了 `app/**`，
                   而同一形状的引用在 `tests/**` 里有 **90 处**、在 `BEHAVIOR_CONTRACTS.md`
                   里还有 1 处——**同一类记录，只因为换了个目录就一条都没人验**。
                   实测这 91 处当前全部指得到（越界 0、不存在 0），所以这次扩范围
                   **不改判据、只改覆盖面**：227 处一起看着。
                   扫描面直接取模块根，跳过 node_modules/.nuxt/.output/test-results/public
                   这些产物目录——按目录清单列举，下一个人加一个新顶层目录就会自动进来。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const moduleRoot = join(here, "../..");

/** 产物与录制内容，不是本仓写下的记录。 */
const SKIPPED_DIRS = new Set([
  "node_modules",
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

/*
  `.vue` 也收（wave 203）。此前只收 `.tsx|.ts`，于是仓里 12 处
  `Foo.vue:行号` 一条都没被验过——写这条守卫要挡的正是「照着找什么都找不到」，
  而 `.vue` 是本仓自己组件的**主要**文件形式。

  `.vue` 的分流不看前缀，看扩展名：**上游一个 `.vue` 文件都没有**
  （下面那条用例把这个前提也钉住了），所以 `.vue:行号` 必然指向本模块。
*/
const CITATION = /([A-Za-z0-9_\-./]+\.(?:tsx|ts|vue))[:：](\d+)/g;

/*
  **以 `frontend-vue/` 开头的那些说的是本模块自己，不是上游**（wave 129）。

  这条正则收的是**任何** `文件.ts:行号`，而下面那条用例把它们**一律**拿去上游索引里
  按 basename 找——也就是说这份文件的头写着「守住本仓写下的、对上游的引用」，
  机器执行的却是「**任何** `.ts:行号` 引用都必须指向上游」。**两句不是一回事。**
  实测（wave 129 写下第一条这样的引用时当场撞上）：注释里写
  `frontend-vue/app/core/scheduled-tasks/form.ts:64`，报的是「上游没有」——
  一句正确的本地引用，得到一条说不通的错误。

  判据取「路径**字面**以 `frontend-vue/` 开头」，不是「在本模块里找得到就算本地」：
  后者会**削弱**这条守卫——`utils.ts` 两个应用都有，一条漂了的上游引用会因为
  本模块里恰好有个同名文件而蒙混过关。字面前缀没有这个问题，上游引用永远不会
  以 `frontend-vue/` 开头。
*/
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

function collectLineCountClaims(): LineCountClaim[] {
  const found: LineCountClaim[] = [];
  for (const file of walk(moduleRoot, [".vue", ".ts", ".mts", ".mjs", ".md"])) {
    const source = readFileSync(file, "utf8");
    LINE_COUNT_PATTERNS.forEach((pattern, index) => {
      for (const match of source.matchAll(pattern)) {
        const ref = index === 2 ? match[2]! : match[1]!;
        const digits = index === 2 ? match[1]! : match[2]!;
        found.push({
          from: file.slice(moduleRoot.length + 1),
          line: source.slice(0, match.index).split("\n").length,
          ref,
          claimed: Number(digits.replaceAll(",", "")),
        });
      }
    });
  }
  return found;
}

type Citation = { from: string; line: number; ref: string; target: number };

function collectCitations(): Citation[] {
  const found: Citation[] = [];
  for (const file of walk(moduleRoot, [".vue", ".ts", ".mts", ".mjs", ".md"])) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, index) => {
      for (const match of text.matchAll(CITATION)) {
        found.push({
          from: file.slice(moduleRoot.length + 1),
          line: index + 1,
          ref: match[1]!,
          target: Number(match[2]),
        });
      }
    });
  }
  return found;
}

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

describe.skipIf(!upstreamPresent)("本仓写下的上游引用", () => {
  const citations = collectCitations();
  const local = citations.filter((one) => one.ref.startsWith(LOCAL_PREFIX));
  const localVue = citations.filter(
    (one) => !one.ref.startsWith(LOCAL_PREFIX) && one.ref.endsWith(".vue"),
  );
  const upstream = citations.filter(
    (one) => !one.ref.startsWith(LOCAL_PREFIX) && !one.ref.endsWith(".vue"),
  );
  const index = basenameIndex(upstreamRoots, [".ts", ".tsx"]);
  const vueIndex = basenameIndex([moduleRoot], [".vue"]);

  it("扫到了引用，也扫到了上游文件（两边空掉时不能假绿）", () => {
    // 少了这条，把正则写坏或把上游根写错都会让下面那条静默全绿。
    // 阈值按实测（227 处）留出余量，不是钉死的条数：这里要挡的是「扫成 0」。
    expect(citations.length).toBeGreaterThan(150);
    expect(index.size).toBeGreaterThan(50);
    /*
      **分流之后，上游那一半必须还是绝大多数。**

      这里**不写** `local.length + upstream.length === citations.length`——
      那两个是同一个谓词的正反两半，恒等式，看着像检查其实什么都没证
      （「一个算出来的 0 和一个没算的 0 长得一模一样」的同族）。
      真正的风险是**误分流**：把 `LOCAL_PREFIX` 放宽成 `"frontend"` 之类，
      所有上游引用都会被当成本地的，上游那一档就此静默失效。
      钉住上游那一半的量能挡住它；本地那一半不设下限（它为空只是没人写本地引用，
      不是缺陷）。
    */
    expect(upstream.length).toBeGreaterThan(150);
    /*
      `.vue` 走「本模块」那一档的**前提**：上游一个 Vue 文件都没有。
      这个前提哪天不成立（上游真的开始写 Vue），分流规则就得换，
      而不是让一批引用悄悄找错地方。
    */
    expect(
      basenameIndex(upstreamRoots, [".vue"]).size,
      "上游出现了 .vue 文件：`.vue:行号` 不能再无条件当作本模块引用",
    ).toBe(0);
    expect(vueIndex.size).toBeGreaterThan(50);
  });

  it("引用上游文件行数的地方，数字就是那份文件的实际行数", () => {
    const claims = collectLineCountClaims();
    // 正则写坏就会一条都扫不到，而空集合永远 toEqual([])（同线索 131）。
    expect(claims.length).toBeGreaterThan(2);
    const wrong: string[] = [];
    for (const claim of claims) {
      const candidates = index.get(claim.ref) ?? [];
      if (!candidates.length) {
        wrong.push(`${claim.from}:${claim.line} → 上游没有 ${claim.ref}`);
        continue;
      }
      const actual = candidates.map(
        (path) => readFileSync(path, "utf8").split("\n").length - 1,
      );
      if (!actual.includes(claim.claimed)) {
        wrong.push(
          `${claim.from}:${claim.line} → ${claim.ref} 写着 ${claim.claimed} 行，实际 ${actual.join("/")} 行`,
        );
      }
    }
    expect(
      wrong,
      "上游那份文件的行数变了：改这个数字，同时想一想它长出来的那些行要不要跟进",
    ).toEqual([]);
  });

  it("每条引用的文件都存在，行号都在文件长度之内", () => {
    const broken: string[] = [];
    for (const citation of local) {
      const path = join(moduleRoot, citation.ref.slice(LOCAL_PREFIX.length));
      if (!existsSync(path)) {
        broken.push(
          `${citation.from}:${citation.line} → 本模块里没有 ${citation.ref}`,
        );
        continue;
      }
      if (readFileSync(path, "utf8").split("\n").length < citation.target) {
        broken.push(
          `${citation.from}:${citation.line} → ${citation.ref}:${citation.target} 行号越界`,
        );
      }
    }
    for (const [citation, pool] of [
      ...upstream.map((one) => [one, resolve(index, one.ref)] as const),
      ...localVue.map((one) => [one, resolve(vueIndex, one.ref)] as const),
    ]) {
      if (!pool) {
        broken.push(
          `${citation.from}:${citation.line} → ${citation.ref} 不存在`,
        );
        continue;
      }
      const fits = pool.some(
        (path) =>
          readFileSync(path, "utf8").split("\n").length >= citation.target,
      );
      if (!fits) {
        broken.push(
          `${citation.from}:${citation.line} → ${citation.ref}:${citation.target} 行号越界`,
        );
      }
    }
    expect(broken).toEqual([]);
  });
});
