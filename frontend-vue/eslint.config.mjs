/*
  【文件职责】     定义 Vue/Nuxt 源码静态检查规则。
  【架构位置】     工程底座
  【主要导出】     ESLint flat config
  【依赖关系】     由 make lint 消费
  【边界与注意】   不关闭 TypeScript 或 Vue 的核心规则，也不按文件豁免。
                   本仓的每个源文件都是自己维护的，没有「必须与别处逐字节等同」
                   因而不能修的文件——那条约束连同它的 manifest 一起删掉了。
                   ignores 必须**单独成一个 config 对象**才是全局忽略；
                   和 rules 写在同一个对象里只会把该对象自己的规则排除掉。
*/

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    ignores: [
      ".cache/**",
      ".nuxt/**",
      ".output/**",
      "playwright-report/**",
      "test-results/**",
      // 生成物（scripts/gen-api-types.mjs）。9000 行 openapi-typescript 输出，
      // 它的写法由生成器决定，改不动也不该改。
      "app/core/api/types.gen.ts",
    ],
  },
  {
    rules: {
      "vue/multi-word-component-names": "off",
      // Vue SFC templates use Prettier's self-closing void-element syntax.
      "vue/html-self-closing": [
        "warn",
        {
          html: { void: "always", normal: "always", component: "always" },
          svg: "always",
          math: "always",
        },
      ],
    },
  },
  {
    // `interface HumanMessageGroup extends GenericMessageGroup<"human"> {}`
    // ——给泛型实例化取名字，是 TS 里表达「具名别名 + 可被 declaration merging
    // 扩展」的标准写法，空 body 是它的形式而不是遗漏。
    files: ["app/core/**/*.ts", "packages/agent-core/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
    },
  },
  {
    // vitest 会提升 `vi.mock(...)`，所以它必须写在被 mock 的模块 import 之前才符合
    // 运行语义。`import/first` 在测试文件里因此是误报。
    files: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    rules: {
      "import/first": "off",
    },
  },
);
