/*
  【文件职责】     钉住「调用点写了 `v-model` 的 primitive，必须自己声明 emits」，零豁免。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/components/ui/**（primitive 的 props/emits 声明）· app/**（调用点）
  【边界与注意】   **它守的是坑 72，一个不报错的 Vue 陷阱**：`renderComponentRoot`
                   在合并 `$attrs` 之前跑 `filterModelListeners`——凡是 `onUpdate:<key>`
                   且本组件**声明了同名 prop**，就从 fallthrough 里剔掉。
                   不报警告、不报错，**只是永远收不到事件**。
                   也就是说「声明了 prop 却不 emit」比「什么都不声明」更糟：
                   前者会把调用点的 `v-model` 安静地吞掉。

                   规则本来只写在 `ui/textarea/Textarea.vue` 与
                   `ui/collapsible/Collapsible.vue` 两份注释里（「`modelValue` /
                   `update:open` **必须显式声明并显式 emit**，靠 fallthrough 是不行的」），
                   **全仓生效、零门禁**——2026-09-12 第十四轮按「grep 注释里的断言，
                   再问有没有人守」翻出来的第二条。全仓量：**59 处 `v-model` 调用点、
                   落在 9 个 primitive 上、0 违规**。这道门把这个 0 钉住。

                   **判据为什么从调用点出发，而不是从 primitive 出发**：
                   「声明了 prop P 就必须 emit `update:P`」是错的——`class` /
                   `language` / `readonly` 这些单向 prop 当然不该 emit，
                   按那条判据要一张几十条的豁免表（坑 180）。
                   **只有被 `v-model` 绑过的那个 key 才落进陷阱**，所以判据只看它。

                   **两种写法分开判，因为能看见的东西不一样**：
                   · `defineProps<{ … }>()` 内联字面量 → emits 也是字面量，
                     能逐条比 `update:<key>` 在不在；
                   · `defineProps<DialogRootProps>()` 类型引用（reka 三件套）→
                     prop 名与 emit 名都在别的包的类型里，**这里看不见**，
                     所以只要求「有 `defineEmits<`」。
                     那一层真正的保证来自 `useForwardPropsEmits`，
                     而 Trigger / Close / Group 这类**本来就没有 emits** 的 reka 包装
                     用的是不带 Emits 的 `useForwardProps`——它们也从不被 `v-model` 绑，
                     所以天然不在这条判据的取样面里（**不是豁免，是判据没覆盖到**）。

                   注释先剥掉（坑 202）。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const uiDir = join(appDir, "components/ui");

/** 开标签：属性值里的 `>` 不算结束。 */
const OPEN_TAG = /<([A-Z][A-Za-z]*)((?:[^<>]|"[^"]*"|'[^']*')*?)>/g;
/** `v-model` 或 `v-model:key`。 */
const V_MODEL = /v-model(?::(\w+))?\s*=/g;

function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".vue")) out.push(full);
  }
  return out;
}

type Primitive = {
  file: string;
  hasEmits: boolean;
  /** emits 是内联字面量时列出来的 key；类型引用时为 null（这里看不见）。 */
  inlineEmits: Set<string> | null;
};

function primitives(): Map<string, Primitive> {
  const table = new Map<string, Primitive>();
  for (const file of walk(uiDir)) {
    const source = readFileSync(file, "utf8");
    const inline = /defineEmits<\{([\s\S]*?)\}>\(/.exec(source);
    table.set(file.slice(file.lastIndexOf("/") + 1, -4), {
      file: file.slice(uiDir.length + 1),
      hasEmits: source.includes("defineEmits<"),
      inlineEmits: inline
        ? new Set([...inline[1]!.matchAll(/"([\w:]+)"\s*:/g)].map((m) => m[1]!))
        : null,
    });
  }
  return table;
}

/** 调用点上的每一处 `<Primitive v-model:key>`。 */
function bindings(): { at: string; name: string; key: string }[] {
  const found: { at: string; name: string; key: string }[] = [];
  const table = primitives();
  for (const file of walk(appDir)) {
    if (file.startsWith(`${uiDir}/`)) continue;
    const source = strip(readFileSync(file, "utf8"));
    for (const tag of source.matchAll(OPEN_TAG)) {
      if (!table.has(tag[1]!)) continue;
      for (const model of tag[2]!.matchAll(V_MODEL)) {
        found.push({
          at: `${relative(appDir, file)}:${source.slice(0, tag.index).split("\n").length}`,
          name: tag[1]!,
          key: model[1] ?? "modelValue",
        });
      }
    }
  }
  return found;
}

describe("被 v-model 绑的 primitive 自己声明 emits", () => {
  const table = primitives();
  const used = bindings();

  /* 形状断言：正则写坏会让下面两条静默全绿（坑 176/195）。 */
  it("扫到了 primitive，也扫到了调用点上的 v-model", () => {
    expect(table.size).toBeGreaterThan(100);
    expect(used.length).toBeGreaterThan(40);
    expect(new Set(used.map((one) => one.name)).size).toBeGreaterThan(5);
    // 头注释点名的那一颗必须在取样面里。
    expect(
      used.some((one) => one.name === "Textarea" && one.key === "modelValue"),
    ).toBe(true);
  });

  it("每一颗被 v-model 绑的 primitive 都有 defineEmits", () => {
    const silent = used
      .filter((one) => !table.get(one.name)!.hasEmits)
      .map((one) => `${one.at} → <${one.name} v-model:${one.key}>`)
      .sort();
    expect(
      silent,
      "坑 72：声明了同名 prop 却不 emit，Vue 会把调用点的 `onUpdate:*` " +
        "从 fallthrough 里**静默剔掉**——不报错，只是 v-model 永远不更新。",
    ).toEqual([]);
  });

  it("内联 emits 的那几颗，逐条列出了 update:<key>", () => {
    const missing = used
      .filter((one) => {
        const inline = table.get(one.name)!.inlineEmits;
        return inline !== null && !inline.has(`update:${one.key}`);
      })
      .map(
        (one) =>
          `${one.at} → ui/${table.get(one.name)!.file} 少 update:${one.key}`,
      )
      .sort();
    expect(
      missing,
      "调用点绑了这个 key，primitive 的 emits 里却没有它",
    ).toEqual([]);
  });
});
