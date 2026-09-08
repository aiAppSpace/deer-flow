/*
  【文件职责】     守住 `baseline/*.json` 里每个**不带 `$` 前缀**的顶层键都真的有人读。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     baseline/*.json · app/** · scripts/** · tests/**
  【边界与注意】   **这条是线索 131 的一般化。** wave 29 发现
                   `parity-scenario-coverage.json` 的 `$pendingReasons` 挂了十几轮
                   没有任何消费者——删掉一条理由不会让任何门禁变红。当时是给那一个
                   键补了守卫；wave 48 发现同样的事又发生了一次：
                   `react-parity-scope.json` 的 `exemptModes` 声明了「静态整站模式
                   不欠」，**没有任何东西读它**（`product-surface.test.ts` 比的是路由，
                   而静态模式不是一条路由，是 env 开关下的分支——所以它天生没有
                   消费者，属于纯说明）。

                   于是本仓的约定被写死成一条可执行的判据：

                   - **`$` 开头 = 纯说明**，不参与任何判断，没人读是正常的；
                   - **不带 `$` = 真数据**，必须至少有一个 `.ts` / `.mjs` / `.vue`
                     读它，否则它就是一条「写了没人看」的声明——
                     **改错了不会有任何门禁变红**，而这正是它最危险的地方。

                   `exemptModes` 已按这条规矩改名成 `$exemptModes`（它确实是说明）。

                   **判据只钉顶层键**：深层字段的消费方式太多（解构、索引、
                   `Object.entries` 遍历），钉进去会变成噪声。顶层键是这些文件的
                   「目录」，写错一个整块就静默失效。

                   **wave 52 补的第二半：说明里「谁在引我」那句话本身也会烂。**
                   `react-parity-scope.json` 的 `$comment` 写着
                   「product-surface.test.ts 是它唯一的消费者」——而
                   `scenario-coverage.test.ts` 在那句话落地 **30 分钟后**就开始读它
                   （`07a1d766` → `23aa5ac2`），这句话**错了九天、约五十轮**，
                   期间没有任何东西会红。它误导的正是最该被误导不得的那个判断：
                   「我改这份数据，谁会跟着变红？」

                   修法照本仓自己的教条——**散文改不出这个性质，数据可以**：
                   手工维护的 baseline 各自声明一条 `$readers`，
                   由下面那条用例与**实测引用集**逐字比对。

                   **`$readers` 的定义是「引用」不是「读取」**：注释剥掉之后，
                   本仓 `app`/`scripts`/`tests` 里凡是提到这份文件名的源文件都算。
                   不缩窄成「真的 readFileSync 了」是因为那要靠正则猜——实测
                   prettier 会把 `read("baseline/x.json")` 折成两行，
                   按行匹配会把三个真读者判成没读（**假绿**）。而「引用」这个口径
                   本身就是对的：`standalone-check.mjs` 只是在表里点名它，
                   但那份表同样会因为改名而失效，同样需要有人跟着改。

                   **生成出来的 baseline 不声明 `$readers`**（`i18n-keys.json`、
                   `upstream-marker.json`、`parity-diff.json`、`openapi.snapshot.json`）：
                   手加的键会在下一次重新生成时被写掉。它们的写入方就在
                   `HAND_MAINTAINED` 之外，这里如实列出而不是假装能覆盖全部。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const baselineDir = join(root, "baseline");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".nuxt" || entry === ".output") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|mjs|vue)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = ["app", "scripts", "tests"].flatMap((dir) =>
  walk(join(root, dir)),
);

/*
  **先把注释剥掉再判「有没有人读」。** 不剥的话，一句提到这个键的注释就会把它算成
  被消费——本守卫自己的文件头就提到了 `exemptModes`，第一版因此对「把它改回没人读的
  名字」这条变异**假绿**（同线索 126：写进注释就会被算成有人用）。
*/
function stripComments(text: string): string {
  return text
    .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
    .replaceAll(/<!--[\s\S]*?-->/g, " ")
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const sourceText = sources.map((file) =>
  stripComments(readFileSync(file, "utf8")),
);

const baselines = readdirSync(baselineDir).filter((name) =>
  name.endsWith(".json"),
);

/**
 * 手工维护的 baseline —— 它们必须声明 `$readers`。
 * 生成出来的那几份不在这里：手加的键会在下一次重新生成时被写掉。
 * 下面第一条用例校验这张表自己（每一份都得真的在 baseline/ 里）。
 */
const HAND_MAINTAINED = [
  "looping-animations.json",
  "parity-route-sampling.json",
  "parity-scenario-coverage.json",
  "react-parity-scope.json",
  "route-payload-budget.json",
];

/**
 * 生成出来的 baseline —— 由某个脚本或用例写出，手加的键会在下一次重新生成时被写掉，
 * 所以**不要求**它们声明 `$readers`。
 *
 * **每一份都要点名谁生成它，而那句话由下面的用例去撞。** wave 83 的教训是
 * 「守卫注释里点名的上游符号在 frontend/src 里根本不存在」——散文写下的
 * 「这份是生成的」同样会烂：生成器改名、挪走、或者干脆不再写这份文件，
 * 而这里照样绿着。
 *
 * **为什么需要这张表**：wave 104 之前只有 HAND_MAINTAINED 一张，而校验是**单向**的
 * （只查「表里的都真的在 baseline/ 里」）。于是新加一份**手工维护**的 baseline、
 * 忘了登记，它就永远不必声明 `$readers`，**没有任何机器会发现**——
 * 正是线索 229 那个形状（判据由一个看不见新东西的扫描面撑着）。
 * 两张表合起来必须**恰好划分** `baseline/*.json`，与覆盖率棘轮的三个桶同构。
 */
/*
  **模式要拼出来，不能写成字面量。** 这条检查扫的是源文件的文本，而扫描面里包含
  **本文件自己**——第一版写成 `/writeFileSync|writeFile\(/`，于是当 GENERATED 指向
  本守卫时，它匹配到的是自己那段正则的源码，判定「有写调用」而**假绿**
  （wave 104 的负向验证 N5 当场抓到）。同线索 126 的形状：
  **写进源码里的模式串会把自己算进扫描结果。**
*/
const WRITE_CALL = new RegExp(
  ["write", "FileSync"].join("") + "|" + ["write", "File"].join("") + "\\(",
);

const GENERATED: Record<string, string> = {
  "i18n-keys.json": "scripts/i18n-manager.mjs",
  "openapi.snapshot.json": "scripts/gen-api-types.mjs",
  "parity-diff.json": "tests/e2e-parity/diff.spec.ts",
  "parity-auth-diff.json": "tests/e2e-parity-auth/diff.spec.ts",
  "upstream-marker.json": "scripts/upstream-drift.mjs",
};

/** 注释剥掉之后，`app`/`scripts`/`tests` 里提到这份 baseline 文件名的源文件。 */
function referencedBy(name: string): string[] {
  const found: string[] = [];
  sources.forEach((file, index) => {
    if (sourceText[index]?.includes(name)) {
      found.push(file.slice(root.length + 1));
    }
  });
  return found.sort();
}

describe("baseline 数据文件的顶层键", () => {
  it("扫到了 baseline 文件与源码（两边空掉时不能假绿）", () => {
    expect(baselines.length).toBeGreaterThan(3);
    expect(sources.length).toBeGreaterThan(100);
  });

  it("每个不带 $ 前缀的顶层键都至少有一个消费者", () => {
    const orphans: string[] = [];
    for (const name of baselines) {
      const parsed: unknown = JSON.parse(
        readFileSync(join(baselineDir, name), "utf8"),
      );
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        continue;
      }
      for (const key of Object.keys(parsed)) {
        if (key.startsWith("$")) continue;
        const used = sourceText.some((text) => text.includes(key));
        if (!used) orphans.push(`${name} → ${key}`);
      }
    }
    expect(
      orphans,
      "这些键写了但没人读：要么接上消费者，要么加 $ 前缀声明它是纯说明",
    ).toEqual([]);
  });
});

describe("baseline 说明里「谁在引我」那句话", () => {
  it("手工维护清单自己不会腐烂", () => {
    const missing = HAND_MAINTAINED.filter((name) => !baselines.includes(name));
    expect(missing, "文件没了就把它从 HAND_MAINTAINED 拿掉").toEqual([]);
  });

  it("每份手工维护的 baseline 都声明了 $readers", () => {
    const undeclared = HAND_MAINTAINED.filter((name) => {
      const parsed = JSON.parse(
        readFileSync(join(baselineDir, name), "utf8"),
      ) as Record<string, unknown>;
      return !Array.isArray(parsed.$readers);
    });
    expect(
      undeclared,
      "少了这条，下面那条用例会静默没有被测对象（同线索 131）",
    ).toEqual([]);
  });

  it("两张表恰好划分 baseline/*.json（多一份少一份都要表态）", () => {
    const declared = [...HAND_MAINTAINED, ...Object.keys(GENERATED)].sort();
    const actual = [...baselines].sort();
    expect(
      declared,
      "baseline/ 下多了或少了一份 .json：手工维护的进 HAND_MAINTAINED" +
        "（并给它加 $readers），生成出来的进 GENERATED 并点名生成器——" +
        "不表态的话它就永远不必声明 $readers，而没有任何机器会发现",
    ).toEqual(actual);
  });

  it("GENERATED 点名的生成器确实存在，而且确实写这份 baseline", () => {
    const broken: { baseline: string; generator: string; why: string }[] = [];
    for (const [name, generator] of Object.entries(GENERATED)) {
      const full = join(root, generator);
      if (!existsSync(full)) {
        broken.push({ baseline: name, generator, why: "生成器文件不存在" });
        continue;
      }
      const text = stripComments(readFileSync(full, "utf8"));
      if (!text.includes(name)) {
        broken.push({
          baseline: name,
          generator,
          why: "生成器里没提到这份 baseline",
        });
        continue;
      }
      if (!WRITE_CALL.test(text)) {
        broken.push({
          baseline: name,
          generator,
          why: "生成器里没有任何写文件调用",
        });
      }
    }
    expect(
      broken,
      "「这份是生成的」这句话烂了：生成器改名/挪走/不再写它——" +
        "而在 wave 104 补上这条之前，烂了也没有任何东西会红（同 wave 83 的形状）",
    ).toEqual([]);
  });

  it("$readers 就是实测的引用集，一个不多一个不少", () => {
    const drifted: { file: string; declared: string[]; actual: string[] }[] =
      [];
    for (const name of baselines) {
      const parsed = JSON.parse(
        readFileSync(join(baselineDir, name), "utf8"),
      ) as Record<string, unknown>;
      const declared = parsed.$readers;
      if (!Array.isArray(declared)) continue;
      const actual = referencedBy(name);
      const sorted = [...(declared as string[])].sort();
      if (JSON.stringify(sorted) !== JSON.stringify(actual)) {
        drifted.push({ file: name, declared: sorted, actual });
      }
    }
    expect(
      drifted,
      "谁在引这份 baseline 变了：把 $readers 改成实测的那一列——" +
        "它回答的是「我改这份数据，谁会跟着变红」",
    ).toEqual([]);
  });
});
