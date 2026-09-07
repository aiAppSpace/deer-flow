/*
  【文件职责】     登记「目的**就是**与兄弟应用对照」的文件，并给每一条标出
                   「兄弟应用缺席时靠什么保证不红」的检查方式。
  【架构位置】     构建脚本共享库
  【主要导出】     CROSS_APP_BY_DESIGN · KINDS
  【依赖关系】     无
  【边界与注意】   两个消费者：`scripts/standalone-check.mjs`（静态证明没有跨应用
                   引用）与 `scripts/standalone-sim.mjs`（真把兄弟应用移走跑一遍）。

                   **`kind` 存在的理由**：wave 83 第一次真做这个实验时发现，
                   `note` 里那句「缺席时整组 skipIf 跳过」在
                   `tests/unit/i18n/upstream-key-coverage.test.ts` 上是**假的**——
                   `describe.skipIf` 跳过的是用例、不是收集，工厂函数里那句
                   `readFileSync` 照样执行，ENOENT 让 `make verify` 当场红。
                   这张表此前**没有任何机器读过 `note`**（线索 183：一栏零消费者的
                   元数据写错了不会有任何征兆）。`kind` 把每条 note 接上一个能跑的
                   检查，`standalone-sim` 逐条跑给你看。

                   **wave 110 又补了两处「登记了就不再检查」**，两处都实测过洞：
                   - `kind: "data"` 此前是唯一**什么都不查**的一档（无条件 `ok: true`）。
                     实测把一份 `.ts` 标成 `data`，改动前的 `standalone-sim` 报
                     「跑过 13 / 未跑 6 / **红 0**」——它就此**永远不会被这个实验跑到**，
                     而这个实验正是判据本身。现在 `data` 必须不是可执行源码后缀。
                   - **这张表是单向的**：只有「有代码级引用的文件在表里就不算 BLOCKING」，
                     没有「表里的每一条还真的提到兄弟应用吗」。一条已经不再引用
                     `../frontend` 的登记会永远留着，而它不产生 hit，于是既不在 BLOCKING
                     里也不在 DECLARED 计数里——**看报表一切正常**。现在
                     `standalone-check` 会把这种「过期的登记」报出来并 exit 1。
*/

/**
 * 兄弟应用缺席时，这一条靠什么保证不红。
 *
 * - `test`   vitest 用例：缺席时必须跳过或照常绿（`standalone-sim` 真跑）
 * - `script` node 脚本：缺席时必须打印一行后 exit 0（`standalone-sim` 真跑）
 * - `data`   纯数据：命中的是文件内容里的一句出处说明，没有可执行行为
 * - `e2e`    由 `make e2e-parity` 整组跳过覆盖（`standalone-sim --with-e2e` 真跑）
 */
export const KINDS = ["test", "script", "data", "e2e"];

/**
 * 目的**就是**与兄弟应用对照的文件。它们仍然打印出来，但不计入 BLOCKING。
 *
 * 进这张表只有一个条件：`../frontend` 不存在时，本仓的 install / build / test / e2e
 * 必须照常全绿。也就是说每一条都得自己处理「对方不在」——跳过、退出 0，或者压根
 * 只是数据里的一句出处说明。任何一条做不到，它就不是对照工具，而是依赖。
 */
export const CROSS_APP_BY_DESIGN = {
  "tests/parity/product-surface.test.ts": {
    kind: "test",
    note: "产品表面对照；缺席时整组 describe.skipIf 跳过。",
  },
  "tests/guards/doc-references.test.ts": {
    kind: "test",
    note: "「裸文件名/仓库路径在 checkout 里搜得到」那一档要拿兄弟应用的文件名当坐标系；缺席时那三条用例 skipIf 跳过，其余检查照常跑。",
  },
  "tests/guards/upstream-citations.test.ts": {
    kind: "test",
    note: "钉本仓源码/测试/文档里对上游的『文件:行号』引用还指得到东西；缺席时整组 describe.skipIf 跳过。",
  },
  "tests/guards/toggle-variant-pressed.test.ts": {
    kind: "test",
    note: "「选中态只靠换色」的守卫，两个应用一起扫（对照台账看不见两边一起漏，线索 238）；缺席时**上游那一条** it.skipIf 跳过，Vue 那一条照常跑。",
  },
  "tests/guards/primitive-base-classes.test.ts": {
    kind: "test",
    note: "逐个对比两个应用同名 primitive 的基类字符串；坐标系是上游的 `components/ui/**`，缺席时整组 describe.skipIf 跳过（并且 reactBases() 在缺席时直接返回空表，因为 skipIf 跳过的是用例不是收集，见 wave 83）。",
  },
  "tests/guards/upstream-zero-claims.test.ts": {
    kind: "test",
    note: "把「上游这东西没人用」这类散文断言变成门禁；缺席时整组 describe.skipIf 跳过。",
  },
  "tests/guards/golden-fixture-provenance.test.ts": {
    kind: "test",
    note: "钉 golden 夹具的出处标签 == 上游实际装的 streamdown 版本；缺席时整组 describe.skipIf 跳过。",
  },
  "scripts/record-react-markdown.mjs": {
    kind: "script",
    note: "golden 夹具录制器；夹具已签入，缺席时退出 0 不重录。",
  },
  "tests/fixtures/react-markdown-dom.json": {
    kind: "data",
    note: "签入的 golden 夹具，命中的只是 $comment 里的出处说明。",
  },
  "tests/architecture.test.ts": {
    kind: "test",
    note: "**禁止**跨应用 import 的守卫本身，命中的是它的 forbidden 正则。",
  },
  "scripts/upstream-drift.mjs": {
    kind: "script",
    note: "上游漂移报告；缺席时打印一行后退出 0，不进任何门禁。",
  },
  "scripts/icon-parity.mjs": {
    kind: "script",
    note: "图标字形 / 尺寸 / tooltip 的对照报告；要读上游装的 lucide 别名表（本仓装的是 lucide-vue-next，别名映射不同），所以路径写死。缺席时打印一行后退出 0，不进任何门禁。",
  },
  "baseline/upstream-marker.json": {
    kind: "data",
    note: "漂移报告的已审阅位置，命中的是它声明的监视路径（纯数据）。",
  },
  "baseline/react-parity-scope.json": {
    kind: "data",
    note: "对齐范围的豁免定义（纯数据），命中的是它点名的上游路径；唯一消费者整组 skipIf 跳过。",
  },
  "tests/e2e-parity/support/react-preview.ts": {
    kind: "e2e",
    note: "对照套件启动兄弟应用的地方；缺席时不启动它，e2e-parity 整组跳过，不进任何聚合入口。",
  },
  "tests/parity/scenario-coverage.test.ts": {
    kind: "test",
    note: "场景覆盖率棘轮；坐标系是上游的 spec 清单，缺席时那条用例 skipIf 跳过。",
  },
  "baseline/parity-scenario-coverage.json": {
    kind: "data",
    note: "覆盖率棘轮的数据（纯数据），命中的是它说明坐标系来自哪里。",
  },
  "tests/unit/i18n/vue-only-keys.test.ts": {
    kind: "test",
    note: "本仓独有词典块的守卫；坐标系是上游词典的顶层块清单，缺席时那条用例 skipIf 跳过。",
  },
  "tests/unit/i18n/upstream-key-coverage.test.ts": {
    kind: "test",
    note: "「上游的每一条本仓都答得上」的守卫；坐标系是上游词典，缺席时整组 skipIf 跳过（wave 83 修好之前这句是假的，见本文件头）。",
  },
};
