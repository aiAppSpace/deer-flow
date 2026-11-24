# 当前任务入口（跨平台）

最后更新：2026-11-24。**状态：第 1 步已提交（`fa322b3b5`）；第 2 步“合并上游 main（`fc0d4bd7b`）”已提交，React 与 backend 全量测试通过；上游基线冻结为 `624a64a15`（冻结期间不再抓取或合并上游）。Vue `make verify` 已全绿（11-24）。第 3 步的新对齐计划已完成：[2026-11-24 Vue 对齐 React 计划](../reports/2026-11-24-vue-react-alignment-plan.md)（以代码为准的审查结论：23 项功能缺口、31 项行为缺陷、3 项请求一致性缺口（11-24 复核后），执行顺序 P0–P6）。执行前必须先读 [R03 恢复方案第 0.1 节“第 3 步执行约定”](../reports/2026-11-23-r03-resume-plan.md#01-第-3-步执行约定2026-11-24-用户确认)：先让 Vue 门禁全绿、全绿前不推送、豁免范围、同名文案不回退等用户已确认的约定都在那里；同一方案第 0.2 节是 11-24 确认的对齐判据（以正常用户的正常使用为准，读屏/纯键盘不再作为对齐要求；请求逐项一致仍要求），审查和清单都按它来。** 合并交接与取舍记录：`/Volumes/edisk/deer-flow/docs/reports/evidence/resume-2026-11-24/MERGE-HANDOFF.md`、同目录 `MERGE-DECISIONS.md`。总顺序见同一方案第 0 节（先收口，再合上游，后对齐）。

## 2026-11-24 进展

- 候选已恢复到持久目录 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow-candidates/r03-v5`（COPY10），源码和运行时与 v4 冻结逐项一致。v4 三处类型错误已修，冻结为 v5（`package-run-consumer-v5`）。
- 候选已有界合入 ROOT：取候选版本 286 个文件，1 份文档三方合并，私有配置未动。ROOT 依赖已重装，Vue 静态与相关单测、React 相关单测与 check 都通过。**ROOT 现在包含最新候选，不再落后于候选。**
- 完整执行记录：`/Volumes/edisk/deer-flow/docs/reports/evidence/resume-2026-11-24/README.md`。
- 浏览器测试、独立审查和全量门禁推迟到合并上游之后。

## 2026-11-23 现场变化（先读这里）

- **证据根已迁到外接盘**：`/Volumes/edisk/deer-flow/docs/reports/evidence/`（约 75G，用户决定保留在外接盘）。ROOT 下 `docs/reports/evidence/` 已不存在；本文及历史交接中的 `evidence/...` 链接，一律按外接盘同名路径读取。外接盘是 exFAT，不能放候选源码或依赖。
- **COPY9 已不存在**（`/private/tmp` 被清理）。最新候选只能从外接盘上的 H03 归档恢复；归档 SHA 已于 11-23 核对一致。
- 恢复方案（未执行）：[2026-11-23 R03 恢复方案](../reports/2026-11-23-r03-resume-plan.md)。其中列出了旧脚本的路径绑定和新目录规划；恢复前的 4 个决策点已于 11-23 按推荐裁决（方案第 6 节）。待对齐清单里的 4 项裁决见该清单第 3 节。
- Vue/React 待对齐清单（以 ROOT 当前代码为准，只读核对）：[2026-11-23 待对齐清单](../reports/2026-11-23-vue-react-parity-gaps.md)，[附录一：S15 实测差异全量明细](../reports/2026-11-23-vue-react-parity-gaps-s15-appendix.md)（751 个键中 556 个非零），以及[附录二：全计划待关闭细项](../reports/2026-11-23-vue-react-parity-gaps-plan-items.md)。
- 下面的旧条目保留 11-03 的原文；里面的 ROOT evidence 路径和 COPY9 路径现在都不可用。

## 唯一详细任务入口

- [2026-11-03全计划交接](../reports/2026-11-03-vue-whole-plan-handoff.md)：已完成、进行中、剩余W/R/C/T、已知问题、归档和恢复顺序。
- [执行状态](../reports/evidence/resume-2026-11-02/current-state.json)：最后限定接受/当前未接受候选，不是新运行许可。
- [H03持久保全](../reports/evidence/handoff-2026-11-03/README.md)：完整公共候选归档、before/proposed差异、全源/runtime与文档审查。
- [首次入口文档增量](../reports/evidence/portable-onboarding-2026-11-03/README.md)：**在H03之后发生的4条原公开文档变化**及首版docs/ai。
- [本次全面复核增量](../reports/evidence/portable-onboarding-review-2026-11-03/README.md)：后续三份docs/ai修订及新增RECOVERY；恢复需按两层文档增量逐条核验，不能直接拿首版哈希要求当前文件相同。
- [恢复目录与迁移检查表](RECOVERY.md)：同机、丢失候选、换机的不同前提与操作边界。

本机ROOT：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。
本机COPY9：`/private/tmp/deerflow-restored-s7-public-source-l27y902m`。
最新交接绝对路径：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-11-03-vue-whole-plan-handoff.md`。

路径是定位线索，是否存在/当前内容必须重新核验。换机不能把不存在的旧路径当可用环境。

## 防止接错工作现场

原仓已有大量WIP，但最新联合候选尚未集成。当前计划仍R03；最后限定接受run-projection-v4；当前未接受run-consumer-v4。v4相关1632单测PASS但静态三处类型错误，最近实际仍v3的16PASS/12FAIL，v4新浏览器未跑。**这些是11月2日冻结回执的状态，不是新会话重新跑过。** 后续实现从交接第5/10节继续，不从旧NEXT-WINDOW的历史“封账”恢复。

首次文档整理改ROOT的AGENTS.md、Copilot入口、两份旧开工文档，新增docs/ai四文件；本次复核仅修订README/CURRENT_TASK/NEW_SESSION_PROMPT并新增RECOVERY及审计证据；**COPY9及其冻结源/runtime未改**。H03旧归档/manifest/验证脚本/接受结论不重写。其ROOT5837文件“完全不变”是当时事实，现在四条已授权文档差异另有before/proposed哈希。

恢复时按[RECOVERY第4节](RECOVERY.md#4-验证文档与源码的层次)核两层文档增量：首次四旧文件before匹配N01公共基线，四旧文件after仍保持；首版docs/ai中三文件由本次before→after链承接，PROJECT_RELATIONSHIPS保持不变。旧证据与旧manifest不改写，也不能笼统忽略docs/AGENTS差异。

同机原现场的index/private/hooks应与原保护快照核对；换机或重新clone时，旧index原始字节、绝对路径和缺失node_modules不能直接作为源码漂移判据，应保留本地提交与staged/unstaged/untracked语义、按新ROOT/COPY建立新的恢复回执。迁移凭据和hooks需遵守新环境的安全边界，不能为凑旧哈希复制执行。任何其他源差异必须列为待审，不能借换机抹掉。

候选最终有界集成时，保留ROOT新增的跨平台入口，与候选AGENTS中既有开发增量逐段合并；不要从候选旧文档覆盖这次入口。287待审路径属于H03当时清单，加入本次ROOT文档变化后必须重新生成冲突与差异清单，不能盲用旧before条件。

## 后续维护方法

每次正式恢复/暂停/完成后，只把本文件指向新的完整交接和证据；不要改写历史回执。新模型读取当前指针后再去相关原件，不需要把所有历史README里的“下一步”重新做一遍。读取文档本身不授权提交、推送、清理、发布或自动后台继续。
