/*
  【文件职责】     模板里用到的每一个大写标签，都要有人给它做 owner。
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
