# 文档引用守卫：重复枚举与文本扫描的性能根因修复

当前结论：授权的三个文件已冻结，局部 25 条测试、测试类型、lint、格式均直接退出 0。原 18 条守卫、23 个 `expect` 表达式、5 秒超时和独立运行时的 3 条显式跳过均保留；完整 canonical 复验由根任务接续，本文不把局部通过写成全量通过。

## 实际失败与成本

原完整运行实际为 3808 PASS / 1 FAIL，裸文件名检查在 5532 ms 超过原有 5000 ms。失败不是引用规则变化：首次 `checkoutBasenames()` 需要枚举整个仓库，Git 已经扫描出的未跟踪文件又被逐一 `existsSync`，各文档检查还反复读取与分行同一批模块文本。

现场完整清单为 77,706 条、13,411,121 字节，其中未跟踪文件 72,617 条、索引条目 5,089 条；模块清单 1,680 条，实际存在 1,659 条。并未删减证据文件、增加忽略项或限制 Git 输出大小。

在原 18 条守卫的私有剖析副本中，原首次裸文件名检查为 2605 ms，其中根目录清单 2325 ms；之后三个检查各重新读取 1547 个文本文件、约 11.17 MB。单独遍历清单的重复 stat 在另一次观测中耗时 2163 ms，而 Git 本身 463 ms，说明逐路径重复 I/O 会扩大负载下的成本。

这些记录受同机并行工作和同期源码注释改写影响，字节数略有变化，不能当作不可变输入的严格倍数基准。具体每条 case 的耗时、读文件次数、字节数和 stat 次数保存在 [profiles.json](evidence/doc-reference-performance-stage38/profiles.json)。

## 最小修复

- 使用标准 `git ls-files --cached --others --exclude-standard -t -z`，识别 `? ` 未跟踪条目。它们来自 Git 当前文件系统遍历，无需再次逐个 stat；索引条目仍检查实际存在性，避免已删除的 tracked 文件进入有效文件名集合。
- 保留流式 NUL 解析、UTF-8 解码、非零 Git 退出和残缺记录错误边界，没有引入全局旧清单缓存。每次调用 helper 仍重新枚举。
- 文档守卫基于已有单次模块清单，懒加载缓存同一文件原文、去除显式历史区后的文本及行。首次根目录枚举仍发生在裸文件名 case 内；没有移到 `beforeAll`、预热或更改计时范围。每条断言依旧检查相同文本和原规则。

仅 helper 优化时，原 18 条已通过，裸文件名 case 887 ms、根枚举 436 ms。最终剖析仍读取同样 1547 个模块文本；后面三个检查不再重新读文件，首次裸文件名检查 845 ms（其中根枚举 657 ms），路径检查 397 ms、豁免有效性检查 7 ms。操作次数的消除比单次耗时比例更能证明修复原因。

## RED / GREEN 与扫描边界

| 检查                            | 实际结果                                                                |
| ------------------------------- | ----------------------------------------------------------------------- |
| 原完整 canonical                | RED：3808 PASS / 1 FAIL，5532 ms 超时                                   |
| 新增真实 Git 回归运行旧 helper  | RED：1 FAIL / 6 PASS，未跟踪文件仍被重复 stat                           |
| 原守卫 18 条 + Git 回归 7 条    | GREEN：25 PASS，直接退出 0                                              |
| 原 18 条剖析                    | GREEN：18 PASS，1547 个文本文件                                         |
| 独立 Vue 源副本原守卫           | GREEN：15 PASS / 原定 3 SKIP，直接退出 0                                |
| 在该副本加入真实未跟踪坏引用    | RED：2 FAIL / 13 PASS / 3 SKIP，分别报出不存在的 make target 和相对文件 |
| 只移除该负控文件后重跑          | GREEN：15 PASS / 3 SKIP，直接退出 0                                     |
| 测试类型 / scoped lint / format | GREEN：各直接退出 0                                                     |

原五条真实 Git 边界测试全部保留：tracked/untracked/ignored、Unicode/空格/换行文件名、tracked deletion、实际超过 1 MiB 的 Git 输出（同步命令确实 ENOBUFS）、Git 错误不能伪装空清单。另外新增“未跟踪条目无需重复 stat”和“下一次调用能看见新增/删除文件”两条，防止用跨调用旧缓存加速。

通过 TypeScript AST 比较，当前守卫与 HEAD 的全部 23 个 `expect` 调用表达式一致；18 条 case 和原扫描排除清单没有变化。实际独立副本最初两次因缺少生成的 tsconfig 在加载测试前失败，失败日志保留；随后只读复制既有被忽略的生成 tsconfig 支持 Node 转换，未运行 Nuxt prepare/build。这是独立守卫证据，不替代完整 standalone 产品验收。

## 影响与待办

仅修改 `frontend-vue/scripts/lib/git-file-inventory.mjs`、`frontend-vue/tests/guards/doc-references.test.ts`、`frontend-vue/tests/unit/tooling/git-file-inventory.test.ts`。最后修改为 2026-10-10 03:49:54 CST，业务生产源码未变。完整 SHA、直接退出码和证据路径见 [receipt.json](evidence/doc-reference-performance-stage38/receipt.json)。

根任务下一步运行整组 guards/tooling 与完整 canonical。尚未执行的全量结果保持 UNRUN；本次没有启动任何服务或构建，也没有读取或更改仓库根的运行配置。
