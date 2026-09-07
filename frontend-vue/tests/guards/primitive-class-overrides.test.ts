/*
  【文件职责】     守住「调用点传给 primitive 的 class，不许重复基类里已经有的那一个」。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/**（基类）· app/**（调用点）· tailwind-merge
  【边界与注意】   **这条规则来自 wave 139 踩到的一个坑**：`AgentSettingsDialog.vue` 在
                   调用点写了 `<DialogTitle class="text-lg">`，而 `DialogTitle` 这颗
                   primitive 的基类本来就是 `text-lg leading-none font-semibold`。
                   那行 class **值和基类一模一样、看上去什么都没改**，但
                   `cn`/tailwind-merge 认的是**组**——Tailwind v4 的 `text-lg` 同时带
                   font-size 与 line-height，于是基类里的 `leading-none` 被一起顶掉，
                   标题从 18px 变成 28px，对话框整体高出 10px。

                   **判据是「重复**了**、并且顶掉了基类里别的东西」，两个条件都要。**
                   一开始只用了前半条（「重复即报」），实测立刻撞上一个反例：
                   `MemorySettings.vue:393` 的 `<Input class="min-w-0 flex-1 sm:max-w-md">`
                   重复了基类里的 `min-w-0`——**而上游那一处一字不差地也是这么写的**
                   （`memory-settings-page.tsx:557`，上游 `input.tsx:11` 的基类里同样有
                   `min-w-0`）。按「重复即报」就得让本仓与上游的源码分家，
                   而渲染结果一模一样。**照抄上游是这个仓库更高的一条规矩。**

                   加上后半条之后判据仍然零豁免：
                   - **有意的覆盖**（`sm:max-w-md` 盖掉基类的 `sm:max-w-lg`）传的是
                     **不同的值**，前半条就不成立，压根走不到这里；
                   - **无害的重复**（上面那条 `min-w-0`）顶不掉任何东西，放行；
                   - **wave 139 那种**（`text-lg` 重复、连带顶掉 `leading-none`）两条都中。
                   也就是说它精确地只报「看上去什么都没改、实际改了别的」这一种。

                   **扫描面自己是双向的**：`ui/` 下每一个把 `props.class` 交给 `cn()` 的
                   组件，要么被解析出字面量基类、要么落在 `VARIANT_BASED`（基类来自
                   `xxxVariants()`，静态解析不出来）。两张表恰好划分全集，
                   新写法混进来会让这条用例先红（wave 84 的「扫描面盖全了没有」）。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { twMerge } from "tailwind-merge";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../app", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".vue")) out.push(full);
  }
  return out;
}

const files = walk(appRoot);
const uiFiles = files.filter((file) => file.includes("/components/ui/"));

/*
  `cn(…, props.class)` 里 `props.class` **之前**那一段。基类可能被 prettier 拆成
  好几个字符串字面量（`Input.vue` 就是三段），也可能混着运行时表达式
  （`ChainOfThoughtStep.vue` 的 `statusStyles[props.status]`、`Button.vue` 的
  `buttonVariants(...)`）——**只有全是字面量的那一种读得出基类**。

  **这两条正则第一版都写错过，而且都是被下面那条双向用例顶出来的**：
  ① 漏了 prettier 给最后一个参数补的尾逗号（`props.class,\n)`），21 个组件全落到
     「第三种写法」里；② 只认单个字面量，`Input.vue` 那种多段的又落出去 4 个。
  **那条用例存在的全部理由就是这个**（wave 84 的「扫描面盖全了没有」）。
*/
const CN_BEFORE_CLASS = /cn\(([\s\S]*?),\s*props\.class\s*,?\s*\)/;
/** 一段里所有的字符串字面量。 */
const STRING_LITERAL = /(['"`])([^'"`]*)\1/g;
/** 任何把 props.class 交给 cn() 的写法，用来确认表盖全了。 */
const TAKES_CLASS = /cn\([\s\S]*?props\.class/;

const componentName = (file: string) =>
  file.slice(file.lastIndexOf("/") + 1).replace(/\.vue$/, "");

const base = new Map<string, string[]>();
const dynamicBased: string[] = [];
const takesClass: string[] = [];
for (const file of uiFiles) {
  const source = readFileSync(file, "utf8");
  if (!TAKES_CLASS.test(source)) continue;
  const name = componentName(file);
  takesClass.push(name);
  const args = source.match(CN_BEFORE_CLASS)?.[1];
  if (args === undefined) continue;
  const literals = [...args.matchAll(STRING_LITERAL)].map((one) => one[2]!);
  // 把字面量抠掉之后还剩标识符 → 基类里有运行时算出来的部分，静态读不出。
  const rest = args.replace(STRING_LITERAL, "").replace(/[\s,]/g, "");
  if (rest.length > 0 || literals.length === 0) {
    dynamicBased.push(name);
    continue;
  }
  base.set(name, literals.join(" ").split(/\s+/).filter(Boolean));
}

type Hit = {
  file: string;
  line: number;
  component: string;
  duplicated: string[];
  dropped: string[];
};

function collectHits(): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    if (file.includes("/components/ui/")) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b([^>]*?)>/gs)) {
      const [, name, attributes] = match;
      const declared = base.get(name!);
      if (!declared) continue;
      // 只看静态 `class="..."`；`:class` 是表达式，静态读不出来。
      const passed = attributes!.match(/\sclass="([^"]+)"/);
      if (!passed) continue;
      const tokens = passed[1]!.split(/\s+/).filter(Boolean);
      const duplicated = tokens.filter((token) => declared.includes(token));
      if (!duplicated.length) continue;
      const merged = twMerge(declared.join(" "), tokens.join(" ")).split(/\s+/);
      const dropped = declared.filter((token) => !merged.includes(token));
      // 见文件头：重复**且**顶掉了别的才算，两个条件都要。
      if (!dropped.length) continue;
      hits.push({
        file: file.slice(appRoot.length - 3),
        line: source.slice(0, match.index).split("\n").length,
        component: name!,
        duplicated,
        dropped,
      });
    }
  }
  return hits;
}

describe("primitive 基类与调用点", () => {
  it("扫到了基类，也扫到了调用面（两边空掉时不能假绿）", () => {
    // 少了这条，把正则写坏会让下面那条静默全绿（同线索 131）。
    expect(base.size).toBeGreaterThan(20);
    expect(files.length).toBeGreaterThan(150);
  });

  it("每个把 props.class 交给 cn() 的 primitive，要么读得出基类、要么基类里有运行时部分", () => {
    const classified = new Set([...base.keys(), ...dynamicBased]);
    expect([...takesClass].filter((name) => !classified.has(name))).toEqual([]);
  });

  it("调用点重复传的类，不许顶掉基类里的别的类", () => {
    expect(
      collectHits().map(
        (hit) =>
          `${hit.file}:${hit.line} <${hit.component}> 重复传 [${hit.duplicated.join(" ")}]` +
          ` → 基类被顶掉 [${hit.dropped.join(" ")}]`,
      ),
      "primitive 的基类是合同；一个和基类一模一样的 class 看上去什么都没改，" +
        "却会顶掉同组的其它类（wave 139：`text-lg` 顶掉了 `leading-none`）",
    ).toEqual([]);
  });

  it("这条判据真的会响（拿 wave 139 那处当样本，就地构造一次）", () => {
    /*
      **不能只有一条永远绿的用例**：上面那条今天是 0 命中，而一个「算出来的 0」
      和一个「没算的 0」长得一模一样（这个仓库反复踩过）。这里就地重放 wave 139
      那处真实写法，证明判据会响。
    */
    const declared = "text-lg leading-none font-semibold".split(" ");
    const passed = ["text-lg"];
    const duplicated = passed.filter((token) => declared.includes(token));
    const merged = twMerge(declared.join(" "), passed.join(" ")).split(/\s+/);
    expect(duplicated).toEqual(["text-lg"]);
    expect(declared.filter((token) => !merged.includes(token))).toEqual([
      "leading-none",
    ]);
  });
});
