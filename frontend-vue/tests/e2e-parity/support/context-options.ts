/*
  【文件职责】     对照取样的浏览器上下文选项，config 与 spec 共用一份。
  【架构位置】     对照测试基础设施
  【主要导出】     PARITY_CONTEXT_OPTIONS · PARITY_USE_OPTIONS
  【边界与注意】   两处消费者：playwright.parity.config.ts 的 use，以及 diff.spec.ts 里
                   为每个场景新开的 context。写成两份迟早会分叉，而分叉的后果是
                   「同一个场景在两条路径上取到的样本不一样」——比对结果会因此取决于
                   它是被哪个入口跑到的。

                   对照必须在同一组环境条件下取样，否则第一层比对就会被时区、动画
                   中间帧和配色方案淹没。主题维度不走 colorScheme，走两个应用共用的
                   localStorage 键，所以这里把 colorScheme 钉死。

                   **两个消费口的形状不一样，这就是要导出两份的原因**：
                   `browser.newContext()` 收的是 BrowserContextOptions，`reducedMotion`
                   在里面是合法键；而 config 的 `use` 是 PlaywrightTestOptions，
                   1.59 的它**没有** `reducedMotion` 这个键——写在顶层不会报错，
                   只会被安静地忽略（实测：探针里 `matchMedia("(prefers-reduced-motion:
                   reduce)").matches === false`；改走 contextOptions 之后为 true）。
                   同一个仓库里 tests/e2e/reduced-motion.spec.ts 早就撞见过这件事，
                   当时的结论是「describe 级选项没传到页面上」——真正的原因是这个。
*/

import type {
  BrowserContextOptions,
  PlaywrightTestConfig,
} from "@playwright/test";

/** `browser.newContext()` 用这一份。 */
export const PARITY_CONTEXT_OPTIONS = {
  locale: "en-US",
  timezoneId: "UTC",
  colorScheme: "light",
  reducedMotion: "reduce",
} as const satisfies BrowserContextOptions;

/*
  config 的 `use` 用这一份：三个键在 use 顶层是合法选项，照旧写在顶层
  （顶层优先于 contextOptions，语义更明确）；`reducedMotion` 只能从
  contextOptions 进去。
*/
export const PARITY_USE_OPTIONS = {
  locale: PARITY_CONTEXT_OPTIONS.locale,
  timezoneId: PARITY_CONTEXT_OPTIONS.timezoneId,
  colorScheme: PARITY_CONTEXT_OPTIONS.colorScheme,
  contextOptions: { reducedMotion: PARITY_CONTEXT_OPTIONS.reducedMotion },
} as const satisfies PlaywrightTestConfig["use"];
