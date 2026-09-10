/*
  【文件职责】     模板里的大写标签、以及 script 里的 Vue 响应式 API，都要显式导入。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app 目录下的全部 SFC
  【边界与注意】   **这个洞 typecheck 和 eslint 都不管。** Vue 模板里遇到不认识的
                   大写标签不会报错，它会被当成一个自定义元素原样渲染出去——
                   页面上什么都没有，控制台一声不吭。2026-09-10 实测：
                   `BackgroundTaskCard.vue` 里 `<TriangleAlert>` 漏了 import，
                   `vue-tsc --noEmit` 和 `eslint .` 双双放行。

                   owner 有三种，都算数：script 里 import 了、
                   `app/components` 下有同名 SFC（Nuxt 自动导入）、
                   或者是 Vue/Nuxt 的内置组件。

                   判据是「这个名字在 script 段里出现过」而不是「解析出 import 语句」：
                   局部 `const Foo = defineComponent(...)`、`components: { Foo }`、
                   以及泛型里带出来的名字都是合法 owner，硬解析 import 只会造出
                   一堆假阳性，而假阳性会让人把整条门禁关掉。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

function sfcsUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sfcsUnder(full));
    else if (entry.endsWith(".vue")) found.push(full);
  }
  return found;
}

/** Vue/Nuxt 自带的，不需要任何人导入。 */
const BUILTIN = new Set([
  "NuxtLink",
  "NuxtPage",
  "NuxtLayout",
  "NuxtImg",
  "NuxtPicture",
  "NuxtLoadingIndicator",
  "NuxtRouteAnnouncer",
  "NuxtErrorBoundary",
  "ClientOnly",
  "DevOnly",
  "ServerPlaceholder",
  "Teleport",
  "Transition",
  "TransitionGroup",
  "KeepAlive",
  "Suspense",
]);

const files = sfcsUnder(appDir);
/** Nuxt 按文件名自动导入 components 目录下的 SFC。 */
const autoImported = new Set(
  files
    .filter((file) => file.includes("/components/"))
    .map((file) => file.slice(file.lastIndexOf("/") + 1, -".vue".length)),
);

describe("模板里的组件都有 owner", () => {
  it("扫描面里确实有 SFC 和大写标签", () => {
    // 少了这条，正则一改就会在空集上恒绿。
    expect(files.length).toBeGreaterThanOrEqual(100);
    expect(autoImported.size).toBeGreaterThanOrEqual(50);
  });

  it("没有哪个大写标签是没人导入的", () => {
    const orphans: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const script = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1])
        .join("\n");
      const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1];
      if (!template) continue;
      // 注释里常常提到别的组件名，先剥掉。
      const markup = template.replaceAll(/<!--[\s\S]*?-->/g, "");
      for (const [, name] of markup.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
        if (BUILTIN.has(name!) || autoImported.has(name!)) continue;
        if (new RegExp(`\\b${name}\\b`).test(script)) continue;
        orphans.push(`${file.slice(appDir.length + 1)}: <${name}>`);
      }
    }
    expect(
      [...new Set(orphans)].sort(),
      "模板里用到但没人导入的组件会被当成未知 HTML 元素静默渲染成空——" +
        "typecheck 和 eslint 都不管这一条。",
    ).toEqual([]);
  });
});

/**
 * Vue 的响应式 API 在 Nuxt 里是自动导入的，所以漏写 import **在生产里不报错**。
 *
 * 代价落在别处：不经过 Nuxt 的 dom 测试一挂载就 `ReferenceError`。
 * 2026-09-10 实测——`ScheduledTaskRunList.vue` 用了 `computed` 没导入，
 * 从来没人挂载过它，直到这一批第一次写它的用例才炸出来；同一次扫出 3 处。
 *
 * 所以本仓的规矩是**显式写**：既让组件在任何环境下都能挂载，也让读代码的人
 * 一眼看得出这个文件用了哪些响应式能力。
 */
const VUE_APIS = [
  "computed",
  "ref",
  "shallowRef",
  "reactive",
  "watch",
  "watchEffect",
  "onMounted",
  "onUnmounted",
  "onBeforeUnmount",
  "onScopeDispose",
  "nextTick",
  "provide",
  "inject",
  "toValue",
  "toRef",
  "toRefs",
  "markRaw",
  "effectScope",
  "defineAsyncComponent",
] as const;

describe("script 里的 Vue API 都显式导入", () => {
  it("没有哪个 SFC 靠 Nuxt 的自动导入过日子", () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const script = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1])
        .join("\n");
      if (!script) continue;
      // 注释里常常提到这些名字，先剥掉。
      const bare = script
        .replaceAll(/\/\*[\s\S]*?\*\//g, "")
        .replaceAll(/^[ \t]*\/\/.*$/gm, "");
      const imported = new Set<string>();
      for (const match of bare.matchAll(
        /import\s+\{([^}]*)\}\s+from\s+"vue"/g,
      )) {
        for (const name of match[1]!.split(",")) {
          imported.add(name.trim().replace(/^type\s+/, ""));
        }
      }
      for (const api of VUE_APIS) {
        if (imported.has(api)) continue;
        // `foo.computed(` 和 `myRef(` 不算——只看独立的调用。
        if (new RegExp(`(?<![\\w.])${api}\\s*\\(`).test(bare)) {
          missing.push(`${file.slice(appDir.length + 1)}: ${api}`);
        }
      }
    }
    expect(
      [...new Set(missing)].sort(),
      "Nuxt 的自动导入让漏写 import 在生产里不报错，代价是 dom 测试一挂载就 " +
        "ReferenceError——而那意味着这个组件从来没被挂载测试过。",
    ).toEqual([]);
  });
});
