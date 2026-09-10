/*
  【文件职责】     `as-child` 只能传给真的认得它的组件。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app 目录下的全部 SFC
  【边界与注意】   **这个洞 typecheck 和 eslint 都不管。** `as-child` 传给一个接不住它的
                   组件时，它只是掉进 fallthrough attrs 的一个普通属性：原样渲染到根
                   元素上，什么都不做，**一声不吭**。

                   2026-09-10 实测：`app/components/ui/button/Button.vue` 压根没有
                   这个 prop，于是 `<Button as-child><a>…</a></Button>` 渲染成
                   `<button><a>…</a></button>`——按钮里套链接（HTML 不允许 button 里
                   放交互内容）、两个可聚焦控件、样式全落在外层，里面的 `<a>` 一身不挂。
                   `vue-tsc --noEmit` 和 `eslint .` 双双放行；页面上看着"还行"，
                   是对照台账在 `artifact-viewer-window` / `project-detail` 两个场景上
                   量出来的：多出 `button "Download":` 一类节点、链接深度多一层、
                   `role:link` 的高/宽/背景全不对。

                   **判据是「模板根是不是原生元素」，不是「有没有声明 asChild」。**
                   这一条是实测出来的，不是推出来的：本仓 `ui/collapsible/CollapsibleTrigger.vue`
                   只声明了 `class`，模板根是 reka 的 `CollapsibleTriggerPrimitive`。
                   挂载它并传 `as-child` 实测输出——

                     <a data-slot="collapsible-trigger" class="cursor-pointer" href="/x">hi</a>

                   ——单个 `<a>`，没有套壳：透传属性落到**组件**根上会被 Vue 按
                   kebab→camel 匹配成那个组件的 prop，继续往下走。落到**原生元素**
                   根上才是死路一条，原样渲染成一个没人看的 HTML 属性。
                   Button 当初正是后者（根是 `<button>`）。

                   所以本仓 SFC 只要满足其一就放行：自己声明了 `asChild`，
                   或者模板根是另一个组件。不是本仓的 SFC（reka-ui 等）不归这条管。
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

const files = sfcsUnder(appDir);

function scriptOf(source: string) {
  return [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .join("\n");
}

function templateOf(source: string) {
  const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1];
  // 注释里常常拿 `as-child` 举例，先剥掉，否则门禁在讲解自己的注释上翻车。
  return template?.replaceAll(/<!--[\s\S]*?-->/g, "");
}

/** 组件名 → 它自己的源码。同名 SFC 在本仓里唯一（Nuxt 自动导入就是按这个名字）。 */
const sourceByComponent = new Map<string, string>();
for (const file of files) {
  const name = file.slice(file.lastIndexOf("/") + 1, -".vue".length);
  sourceByComponent.set(name, readFileSync(file, "utf8"));
}

/** 声明了 `asChild` prop。 */
function declaresAsChild(source: string) {
  return /\basChild\b/.test(scriptOf(source));
}

/** 模板根是不是一个组件（大写标签）。原生元素根接不住透传的 as-child。 */
function rootIsComponent(source: string) {
  const markup = templateOf(source)?.trimStart();
  return markup !== undefined && /^<[A-Z]/.test(markup);
}

/** 这个组件能不能接住 as-child。 */
function acceptsAsChild(source: string) {
  return declaresAsChild(source) || rootIsComponent(source);
}

describe("as-child 只传给认得它的组件", () => {
  it("扫描面里确实有 SFC、有 as-child 的用法、也有声明它的组件", () => {
    // 三条形状断言。少了它们，正则一改就会在空集上恒绿——而恒绿的门禁
    // 比没有门禁更坏，因为它看起来在守。
    expect(files.length).toBeGreaterThanOrEqual(100);
    const usages = files.filter((file) =>
      /\bas-child\b/.test(templateOf(readFileSync(file, "utf8")) ?? ""),
    );
    expect(usages.length).toBeGreaterThanOrEqual(5);
    const declaring = [...sourceByComponent.values()].filter(acceptsAsChild);
    expect(declaring.length).toBeGreaterThanOrEqual(2);
    // 两条判据各自都得真的判到过东西，否则其中一条写坏了也照样全绿。
    expect(
      [...sourceByComponent.values()].filter((source) =>
        /\basChild\b/.test(scriptOf(source)),
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      [...sourceByComponent.values()].filter(rootIsComponent).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("没有哪个本仓组件被传了它不认的 as-child", () => {
    const ignored: string[] = [];
    for (const file of files) {
      const markup = templateOf(readFileSync(file, "utf8"));
      if (!markup) continue;
      // `<Foo ... as-child` / `<Foo ... :as-child="x"`：从标签名一直吃到 `>`
      // 之前，中间出现 as-child 就算命中。
      for (const match of markup.matchAll(/<([A-Z][A-Za-z0-9]*)\b([^>]*)>/g)) {
        const [, name, attrs] = match;
        if (!/(^|\s):?as-child\b/.test(attrs!)) continue;
        const owner = sourceByComponent.get(name!);
        // 不是本仓 SFC（reka-ui 等）——那些天生支持，不归这条门禁管。
        if (!owner) continue;
        if (acceptsAsChild(owner)) continue;
        ignored.push(`${file.slice(appDir.length + 1)}: <${name} as-child>`);
      }
    }
    expect(
      [...new Set(ignored)].sort(),
      "这个组件的模板根是原生元素，接不住透传的 as-child——它会被当成一个普通 HTML " +
        "属性原样渲染、什么都不做——" +
        "typecheck 和 eslint 都不管这一条。要么给它加上 asChild（照 " +
        "ui/button/Button.vue 用 reka 的 Primitive），要么把调用点改成不套壳。",
    ).toEqual([]);
  });
});
