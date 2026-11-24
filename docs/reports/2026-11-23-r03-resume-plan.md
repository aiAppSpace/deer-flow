# R03 恢复方案（2026-11-23 起草，2026-11-24 开始执行）

**状态：2026-11-24 用户同意按推荐执行，计划恢复。** 执行记录写在 N03 证据目录；本文是执行依据。

## 0. 2026-11-24 调整后的总顺序（先收口、再合上游、后对齐）

2026-11-24 只读比较了上游：相对最后同步点 `5ecc1c2ac`，上游 `main`（`fc0d4bd7`）多出 1048 个提交。React 产品源码改了 331 个文件，新增 `/share/[share_token]` 和 `/workspace/usage` 两个页面，词典约增加 1700 行；后端改了 689 个文件。上游改过的文件中，85 个与 ROOT 未提交改动重叠，35 个与候选重叠。用户同意以下顺序：

1. **本地收口**：恢复候选，修 v4 三处类型错误，跑相关单测和静态检查（v4 浏览器测试推迟到合并之后）；把候选有界合入 ROOT；**在 `main-wc` 上提交前停下，等用户授权**。
2. **合并上游 `main` → `main-wc`**：按语义逐个解决冲突；合并后跑 React 和 backend 的单测与静态检查。
3. **在新基线上重做待对齐清单**：路由、文案、接口三项静态比对，加全量跨端对比，替换 10 月的 556 条旧数据。
4. **按新清单继续**：R03 剩余工作，然后 R04–R12。

下文第 4 节的 S9–S12（原件回放、浏览器实测、独立复核）推迟到第 2 步合并之后，在新基线上执行。

### 0.1 第 3 步执行约定（2026-11-24 用户确认）

第 2 步已提交为合并 `ceed64e7b`（父提交 `fa322b3b5` + `fc0d4bd7b`）。React `pnpm test` 与 backend `make test` 全量通过。同日又合入上游当天新增的 6 个提交（只涉及 backend 和文档），**第 3 步的上游基线固定为 `fa20a53fa`**；本地 `main` 已快进到同一提交。之后的上游新提交留到第 3 步完成后再合。合并取舍记录在外接盘 `/Volumes/edisk/deer-flow/docs/reports/evidence/resume-2026-11-24/MERGE-DECISIONS.md`，其中“留给第 3 步”一节是本节的输入。

1. **先让 Vue 门禁全绿，再做新清单。** `make -C frontend-vue verify` 合并后还剩 19 个单测失败：
   - 身份观测 12 个（`tests/unit/threads/thread-stream.dom.test.ts` 10 个、`tests/unit/composer/composer-workflow.dom.test.ts` 2 个）：事件数量和顺序与预期不符。Vue 源码在这次合并中没有冲突，**先查清原因再改**，这一类最可能藏着真问题。
   - 文档数字守卫 5 个（`doc-facts` 3 个、`doc-references`、`upstream-citations`）：机械更新。
   - 扩展目录 1 个（`tests/unit/extensions/catalog.test.ts`）：上游打包的扩展从 6 个增加到 19 个。
   - 选中态守卫 1 个（`toggle-variant-pressed`）：见第 3 条。
2. **全绿之前不推送。** `ceed64e7b` 等 Vue 门禁全绿后再推到 `origin/main-wc`，推送前仍要问用户。
3. **渠道绑定对话框的按钮不是 React 缺陷，已改守卫。**（11-24 更正：原先判断它“只靠颜色表示选中态”，用户据此选了在 React 侧修。）`frontend/src/components/workspace/channels/channel-binding-code-dialog.tsx` 底部按钮是动作键，连接前文字为“关闭”、连接后为“完成”，可访问名随状态变化，守卫文件头本就写明这种情况不需要 `aria-pressed`。守卫只认 `aria-label` 分支，认不出写在按钮文字里的分支，所以误报。已扩展 `frontend-vue/tests/guards/toggle-variant-pressed.test.ts` 识别按钮文字里的同条件分支，并加正反夹具；React 代码未改。
4. **同名文案保留上游说法，不回退。** 合并后为满足“同名词条两边同字”（零豁免门禁），Vue 有 19 条文案改成了上游说法。其中几条描述的是 Vue 还没有的行为，例如语音输入改为录音后转写、模型设置先选厂商、智能体保存确认、定时任务通知设置入口、回复语言偏好。这些登记为**行为待办**，在新清单里补 Vue 行为，不能为了让字对得上去改回旧文案。
5. **合并带进来的新功能是待办，不是豁免。** 豁免只限 `frontend-vue/baseline/react-parity-scope.json` 里的内容和部署项（`/` 落地页内容、docs/blog 四条路由、整站静态模式），定义见 `frontend-vue/ARCHITECTURE.md` 的“与 React 的对齐范围”。分享页 `/share/[share_token]`、用量统计 `/workspace/usage`、工具审批、工作区搜索、语音录音转写等都是核心功能，必须进待办。“非核心”“没人用”都不构成豁免理由。
6. **合并后的挂账是机械结果，不是结论。** 2 条路由进了 `pendingRoutes`，40 份新 React e2e 用例进了 `parity-scenario-coverage.json` 的 pending（`docs-search-mobile` 进 docs 豁免），459 个新词条进了 `upstream-i18n-map.json` 的 pending，3 份新契约进了 `gen-contract-constants.mjs` 的 `NOT_CONSUMED`。新清单要逐条判断并给出优先级。
7. **11-23 待对齐清单里“待做路由为空”已过期。** 新清单以合并后的 ROOT 为准，替换 [2026-11-23 待对齐清单](2026-11-23-vue-react-parity-gaps.md) 的第 2 节结论和 S15 的 556 条旧数据。

本文只覆盖“从当前现场回到可继续 R03 的状态，并关闭 run-consumer-v4 这一段”。R03 其余工作和 R04–R12 仍以 [11-03 全计划交接](2026-11-03-vue-whole-plan-handoff.md) 第 6、7、10 节为准，本文不缩小范围。

## 1. 2026-11-23 现场核验结果（只读）

| 项 | 实际情况 | 与 11-03 交接的差异 |
| --- | --- | --- |
| ROOT | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，`main-wc`，HEAD `a78045395`；`origin/main`(5ecc1c2ac) 是祖先；本地 ahead 826；WIP 1420 条（695 M / 36 D / 689 ??） | 未 fetch，上游 11-03 之后的新提交未核 |
| COPY9 | `/private/tmp/deerflow-restored-s7-public-source-l27y902m` **不存在** | 交接假定它可直接续作；现在必须走“候选丢失”恢复路径 |
| 证据根 | ROOT 下 `docs/reports/evidence/` **不存在**（从未被 Git 跟踪）；完整内容约 75G，在 **`/Volumes/edisk/deer-flow/docs/reports/evidence/`**（11-23 约 19:55–20:03 迁入） | 交接和 docs/ai 中所有 `evidence/...` 相对链接在 ROOT 失效；按外接盘同名路径读取 |
| 外接盘 | `/dev/disk6s1`，**exFAT**，`noowners`；有 `._*` AppleDouble 文件 | 不保留 Unix 权限/属主/符号链接；不能在上面放候选源码或依赖 |
| H03 候选归档 | `/Volumes/edisk/.../handoff-2026-11-03/candidate-public-source.tar.gz`，SHA256 `6d1e02d21dce8df254b81a1635f73c7c267a78f76977affdb31169ac9c5747cd` | 与交接记录一致 |
| v4 三处类型错误 | 从归档读源码确认仍在：`frontend-vue/tests/e2e-parity/support/identity-run-adoption.ts:139-140`、`frontend-vue/tests/unit/parity/identity-run-adoption.test.ts:54`；`request.startedAt` 类型为 `number \| null`（`capture-network.ts:29`） | 无变化 |
| 内置盘余量 | `/` 可用 310G | 足够放新候选和两端依赖 |

## 2. 目录规划

| 用途 | 位置 | 理由 |
| --- | --- | --- |
| 新候选（COPY10） | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow-candidates/r03-v5`（执行时若已存在则换新名，不覆盖） | 不再用 `/private/tmp`（COPY9 就是被清掉的）；必须在 APFS 上（node_modules 符号链接、可执行位、`.venv` 链接）；不放进 ROOT，避免被 ROOT 的 Git/pnpm/索引看到 |
| 新证据目录 N03 | `/Volumes/edisk/deer-flow/docs/reports/evidence/resume-<恢复当天日期>/` | 与 N01/N02 同级，旧 runner 里 `HERE.parent / "resume-2026-11-01/..."` 这类相对引用仍能解析；用户选择证据留外接盘 |
| 新交接/当前指针 | ROOT `docs/ai/CURRENT_TASK.md` 及新的有日期交接 | 入口文档留在 ROOT |

执行期间外接盘必须一直挂载；每一步开头检查 `/Volumes/edisk` 存在，不存在就停。

## 3. 旧工具的绑定问题（来自脚本源码）

旧脚本和回执不改写，按 RECOVERY 第 5 节复制到 N03 后再修改绑定，并记录 before/after SHA。

| 旧工具 | 硬绑定 | N03 新版本要改的地方 |
| --- | --- | --- |
| H03 `restore-public-source.py` | 解包目标固定 `tempfile.mkdtemp(dir="/private/tmp")` | 目标目录改为显式参数；要求目录不存在、在 APFS 上、不在 ROOT 内；其余逐成员 SHA 校验原样保留 |
| N01 `prepare-frozen-dependencies-online.py` | `COPY.parent == /private/tmp`、名字前缀 `deerflow-restored-s7-public-source-`；读 COPY 内的 `final-source-frozen.json`（归档里**没有**这个文件，它属于 explicitNonSourceEntries） | 路径断言换成 COPY10；源码清单改读第 4 步生成的“重定位 v4 清单”；禁止出现的旧路径列表加入 COPY9 和 ROOT |
| N01 prepare 安装命令 | 只有 `frontend-vue` 带 `--strict-peer-dependencies`，`frontend` 没带 | 已裁决两端都 strict（见第 6 节） |
| N02 `run-check.py` / `freeze.py` / `run-identity-products-native.py` | 都读同目录 `copy-path.txt`（现值为 COPY9）；输出写在脚本旁边 | 复制到 N03，新 `copy-path.txt` 写 COPY10；输出自然落到 N03 |
| N02 `freeze.py` | 断言 `baseline["copy"] == COPY`；在 COPY 内执行 `git ls-files -co --exclude-standard` | 需要第 4 步的重定位基线；COPY10 里需要一个公共 Git fixture |
| v4 `source-frozen.json` / `runtime-frozen.json` | `copy` 字段为 COPY9；`priorManifest` 指向 ROOT 下已不存在的 evidence 路径 | 不改原件；生成新的重定位清单，逐行 SHA 不变，只改 `copy` 并记录原件路径与 SHA |

## 4. 恢复步骤（收到“恢复”指令后才执行）

每条命令都经 N03 的 `run-check.py`（或等价的、能记录 cwd、完整命令、直接退出码和日志 SHA 的 runner）执行；退出码以直接返回值为准，不用管道截断判断。

### S0 只读复核

1. ROOT 的 Git/WIP 与本文第 1 节对比，有新变化就列出，不清理。
2. `/Volumes/edisk` 已挂载；H03 归档、inputs、receipt 的 SHA 与 receipt 一致。
3. 3440 / 3441 / 8340 无人监听，确认没有本任务残留进程；3000（AiPPT）不动。
4. 记录 Node、pnpm（以两端 `packageManager` 为准，当前 10.26.2）、Python（≥3.12）、uv、操作系统和 CPU 架构。

### S1 恢复候选源码

运行 N03 的 `restore-public-source-v2.py candidate-public-source <COPY10>`。预期输出 5966 个成员（5964 公共文件 + 2 fixture）全部 SHA 校验通过；`dependenciesInstalled=false`。

### S2 公共 Git fixture

在 COPY10 执行 `git init`：不加 remote，不装 hooks，不提交。`freeze.py` 只需要 `ls-files -co --exclude-standard` 能结合 `.gitignore` 列出文件。把 fixture 的创建方式写进 N03 回执，并注明它不是 ROOT 的 Git 历史。

### S3 生成重定位清单（v4 → COPY10）

由 v4 `source-frozen.json` / `runtime-frozen.json` 生成 N03 下的 `rebased-v4/source-frozen.json` 和 `runtime-frozen.json`：

- `copyRows` / `fixtureRows` 的 SHA 逐行不变，只把 `copy` 改为 COPY10；
- 记录原件路径（外接盘）和原件 SHA（source `2a4e4c40…0e5e`，runtime `af13ebbb…565`）。

然后校验 COPY10 的 5964+2 个文件与重定位清单逐个一致。有任何不一致就停下记录，不能改清单迁就。

### S4 正常安装依赖

运行 N03 的 `prepare-dependencies-v2.py`：

1. `python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies`
2. `python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile --strict-peer-dependencies`
3. `cd backend && uv sync --frozen --extra browser`
4. Playwright Chromium 按 `frontend-vue` 锁定的 Playwright 版本安装；记录实际浏览器路径和版本。

之后保留旧脚本的全部检查：

- `.bin` shim 里不能出现 ROOT 或任何旧 COPY 路径；
- 依赖符号链接不能指出 COPY10；
- 用 `copy-tooling-review-stage42/shim-global-paths-probe.cjs` 探测 next、rstest、eslint、prettier、tsc、playwright、nuxt、vitest 的真实入口；
- backend 能导入 `app`、`deerflow`、`deerflow_extension_api`，且都来自 COPY10。

回执写成 COPY10 的 `dependencies-ready.json`，并在 N03 留一份副本。

### S5 运行时一致性

按重定位 runtime 清单逐项核对：

- 31 个运行时入口（27 个 reka-ui 已批准入口和 4 个附加入口）；
- 14 个依赖输入（两端 package.json、锁文件和 10 个 patch）。

全部一致，才能说 COPY10 等于 v4 候选。若锁文件相同但解析出的入口 SHA 不同，就停下记录差异，交给用户裁决，不能当作通过。

### S6 修 v4 三处类型错误（测试先行）

先查清 `startedAt === null` 的真实含义：在 `capture-network.ts` 里，它表示请求被登记时还没观察到开始时间。对 run adoption 来说，缺少开始时间就是缺证，必须让整批失败，不能放行。

1. **RED**：在 `tests/unit/parity/identity-run-adoption.test.ts` 补负控用例，`run.candidate.request.startedAt` 分别为 `null`、`NaN`、`Infinity`、`0`、负数时，root 都必须 `fail` 并整批回退为 literal。先跑一次，记录失败（或类型失败）。
2. **修 `identity-run-adoption.ts:139-140`**：照同目录 `identity-replay.ts:147-150` 和 `identity-memory.ts:283-285` 的写法，在比较之前把它校验成一个有限正数的局部 `const`，不合格就 `fail("run handle chronology contradicts its exact request")`（或更准确的新文案）。如果三个模块确实重复同一逻辑，可以抽一个小的共用校验函数，但要证明三处语义一致。
3. **修测试 `:54`**：测试里的 `request` 来自 fixture，应先断言它的 `startedAt` 是有限数，再参与 `Math.max`。
4. 禁止使用 `!`、`as number`、`?? 0`、`Date.now()` 这类写法绕过类型检查。

### S7 冻结 v5

用 N03 的 `freeze.py package-run-consumer-v5 <重定位v4 source-frozen> <paths.json>` 冻结，`paths.json` 只列出 S6 改过的文件及其 before SHA。冻结后到浏览器门禁结束之前不改源码。

### S8 静态检查与单元测试

| 门禁 | 命令（cwd = COPY10） | 通过标准 |
| --- | --- | --- |
| Vue 静态 | `make -C frontend-vue lint typecheck-tests format-check standalone-check`（与 v4 失败时的命令相同） | directExit 0，四段都要执行到 |
| Vue 相关单测 | `python3 scripts/pnpm.py --dir frontend-vue exec vitest run tests/unit/parity tests/unit/agent-deerflow tests/unit/chat` | directExit 0；文件数和用例数 ≥ v4 的 102 个文件、1632 个用例，再加上新增的负控 |
| React | `python3 scripts/pnpm.py --dir frontend check` 及 v3 用过的相关单测 | 建议直接重跑，不再用“v3→v4 输入未变”的桥接说法 |

### S9 原件回放（不是浏览器测试）

1. 在 N03 新写一个回放脚本，以旧 run-projection 的回放脚本为参考，复制后改写，不覆盖旧脚本。
2. 输入用 N02 `run-consumer-actual-v3/report-artifacts` 里 4 个首发原件和 8 个 replay 原件，通过 report-preserved 记录找到准确路径并核对 SHA。
3. human / replay / known run 的期望由独立来源给出，不采用 `derived.expectedViews`。
4. 预期：v3 时因 root 没接 run phase 而失败的 12 项，在 v5 reader 下能被正确采纳；任何新拒绝都如实记录。

### S10 独立代码审查

审查范围是 v5 reader/root 的改动和新增负控，以及“inventory 只读一次、不重复 build”这条边界（交接 5.2 节）。审查结论单独成文，放进 N03。

### S11 原生浏览器实测

1. 运行 N03 的 `run-identity-products-native.py <新label> <v5 source-frozen> <v5 runtime-frozen> identity-producers identity-replay-producers`。端口 3440/3441/8340；需要在沙箱外执行，loopback 监听在沙箱内会报 EPERM。
2. 用例数以实际 collection 为准，v3 时是 28 项。
3. 结束后用 `readback-browser.py`，按它当前的实际参数回读报告、附件和端口状态。
4. 失败时先保全和回读，再改源码。

### S12 实测独立复核与收尾

1. 对 S11 的原件做独立复核。
2. 写 N03 `ACCEPTANCE.md`：只说 run-consumer 这一段限定接受与否，不说 R03 通过。
3. 更新 `current-state.json`，照 H03 的做法先留一份旧版快照。
4. 写新交接，并把 ROOT 的 `docs/ai/CURRENT_TASK.md` 指向它。

## 5. 这一段完成之后（不在本方案执行范围内）

按 11-03 交接第 6 节第 2–7 项继续：

- 真实 SDK/adapter 活动 SSE：先做 4 条，再做完整 24 组合；
- run 的 join / cancel / cursor 消费者；
- Sidecar 的独立 owner；
- human / Memory / replay 的复杂来源；
- T01–T18 与 aggregate 正式接入；
- 287 条以上候选路径有界集成回 ROOT，之后才进入 R04–R12。

## 6. 裁决记录（2026-11-23，用户授权“按推荐来”）

1. **React 依赖也加 `--strict-peer-dependencies`，两端都用 strict。** 依据：N01 final-cleanup 实际执行过 `python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies`，在 COPY9 上（`react-strict-install-v1-command.json`）和全新目录中（`react-strict-fresh-v1/execution.json`）都 directExit 0。N01 prepare 脚本只给 Vue 加，是更早的版本，v2 脚本以后来实际执行的 strict 命令为准。若 COPY10 上 React strict 安装失败，就停下记录，不退回非 strict。
2. **独立审查另开一个新的 Cursor 对话来做。** 该对话只读，不改源码、不跑冻结期间的构建，只读取 N03 冻结清单、源码差异和测试原件，结论写进 N03 的独立审查文件。理由：Cursor 用户规则禁止子 agent，新对话是不违反规则、又能隔开实现者上下文的做法。实现者自查不计为独立通过。如果之后想换成 Codex 新会话，也可以，要求相同。
3. **AppleDouble（`._*`）文件：只在 N03 新脚本里过滤，旧证据和旧脚本一律不动。** N03 新写或复制的所有枚举、审计、回读脚本，按文件名显式排除 `._` 开头的文件，并在回执里记录这条规则和被排除的数量。不删除旧证据目录里的 `._*` 文件，不修改旧脚本。旧审计结论不重新计算，若需要复核，就用 N03 新脚本出新回执。
4. **上游同步不做。** 不在 R03 范围内，不 fetch、不 merge，除非用户另行指示。
