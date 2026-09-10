/*
  【文件职责】     将纯 TS、需要 DOM 全局、需要 Nuxt 上下文的测试分为三个真实 project。
  【架构位置】     工程底座
  【主要导出】     Vitest workspace 配置
  【依赖关系】     被 make test/verify 消费
  【边界与注意】   三个 project 的 include 互斥，靠文件名后缀区分，不靠目录：
                   *.nuxt.test.ts → nuxt，*.dom.test.ts → dom，其余 *.test.ts → node。
                   写测试时按它需要的运行环境选后缀：要 document 的用 .dom，
                   要 Nuxt 运行时（useRuntimeConfig、路由、插件）的用 .nuxt，
                   其余一律 node——node 最快，DOM 环境约贵 3 倍。
                   加 project 时必须同步 node 的 exclude，否则一个文件会被跑两遍。
                   node/dom 两个 project 不经过 Nuxt，拿不到 Nuxt 注入的路径别名，
                   所以 `@` 和 `#shared` 要在这里显式补上。

                   dom project 额外挂 `@vitejs/plugin-vue`：M3 起有组件测试要 mount `.vue`，
                   而不经过 Nuxt 就没人编译 SFC（表现是 vite 报「invalid JS syntax」）。
                   放在 dom 而不是让组件测试改走 nuxt project，是因为 `@vue/test-utils`
                   要的只是一个 document，不是整个 Nuxt 运行时——上 nuxt 会把
                   「只渲染一段 markdown」的用例拖成整套应用启动。
*/

import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, defineProject } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

/** 与 .nuxt/tsconfig.app.json 的 `"@/*": ["../app/*"]` 保持一致。 */
const appDir = fileURLToPath(new URL("app", import.meta.url));
/** Nuxt 自带的 `#shared`；node/dom 不经过 Nuxt，同样要显式补。 */
const sharedDir = fileURLToPath(new URL("shared", import.meta.url));
const alias = { "@": appDir, "#shared": sharedDir };

export default defineConfig({
  test: {
    projects: [
      defineProject({
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/agent-core/tests/**/*.test.ts",
          ],
          exclude: ["tests/**/*.nuxt.test.ts", "tests/**/*.dom.test.ts"],
        },
      }),
      defineProject({
        plugins: [vue()],
        resolve: { alias },
        test: {
          // 迁移过来的 core 测试里有一批用 DOM 全局（Response、FormData、
          // localStorage…）但不碰 React，happy-dom 就够，不必上 Nuxt 环境。
          name: "dom",
          environment: "happy-dom",
          setupFiles: ["tests/setup/dom.ts"],
          include: ["tests/**/*.dom.test.ts"],
        },
      }),
      await defineVitestProject({
        test: {
          name: "nuxt",
          environment: "nuxt",
          include: ["tests/**/*.nuxt.test.ts"],
        },
      }),
    ],
  },
});
