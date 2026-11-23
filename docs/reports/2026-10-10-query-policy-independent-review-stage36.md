# Stage36 查询策略独立只读复核

本文件是源代码与实际安装 TanStack Query 实现的交叉复核，不是浏览器或单元 PASS 证明。审查过程中未修改生产代码、测试或全局策略，未启动编译。全局策略的实现与正式回归由 capabilities_acceptance 负责；后续源码变化须以其最终冻结记录为准。

## 已报给实现负责人及 root 的实际缺口

| 消费者 | React 当前事实 | Vue 复核时事实 | 根因方案与边界 |
| --- | --- | --- | --- |
| 无限会话列表 | `frontend/src/core/threads/hooks.ts` 的 `useInfiniteThreads` 明确 `refetchOnWindowFocus: false` | `frontend-vue/app/composables/useThreads.ts` 的实际 `useInfiniteQuery` 未显式设置 | 全局恢复默认 focus 策略前给此实际 owner 保留局部 false，并用实际生产 QueryClient 的 visibility 往返负控证明列表不意外请求。不能关闭整个全局策略。 |
| 会话 token 用量 | React `useThreadTokenUsage` 明确 retry false / focus false | Vue `useThreadTokenUsage.ts` 复核时均无局部设置 | root 已独立发现；实现负责人处理。保留这两个局部例外，避免焦点恢复触发 token 请求或传输重试。 |
| Workspace Changes | React `core/workspace-changes/hooks.ts` 明确 retry false、stale 5min、focus false | Vue `useWorkspaceChanges.ts` 已有 retry false / focus false，但缺 5min stale | focus 安全，但已有数据在重新挂载时的新鲜度不同。精确补齐实际 owner 的 stale 窗口，保留显式失效刷新，并以生产 owner 的未过期/过期挂载正负控验证。 |
| 聊天产物主面板 | React `core/artifacts/hooks.ts` 的 `useArtifactContent` 使用 Query + stale 0 / focus true | Vue `useArtifactFileContent.ts` 是独立请求生命周期 owner，仅注册 `window.focus` | 全局 Query 默认值不会触达这条非 Query 路径。实际安装 Query5 `focusManager.ts` 默认监听 window `visibilitychange`，读取 document visibilityState。需真实消费回归核实隐藏→可见是否漏刷新，并按 React 实际事件契约修 owner，保留选中项代次/abort/草稿防覆盖。不是凭“focus”同名就认等价。 |

## 已逐项确认不应盲目新增局部 false 的 owner

| Vue / React 对应入口 | 当前局部策略 | 全局 default focus 的正确边界 |
| --- | --- | --- |
| `ArtifactFileCards.vue` / `artifact-file-list.tsx` 的 archiveManifest | 两端同 retry false、stale Infinity | 正常 fresh 不自动重取；显式失效后的 stale query 可在回到页面刷新。额外 focus false 会改变 React 行为。 |
| `ModelSettings.vue` / `model-settings-page.tsx` 的 managed-models catalog | 两端没有局部 focus/stale/retry 覆盖；key 含 user id、enabled 管理员 | 两端应继承同一默认值。不能与全局 `useModels` 的 Infinity/focus false 混为一个 owner。 |
| `useSubagents.ts` / `core/subagents/hooks.ts` | 两端默认 query 策略 | 应允许 stale 条目在 visibility 恢复后更新。 |
| `useSubagentBatches.ts` / `core/subagent-batches/hooks.ts` | 列表 2s/15s、条目第一页 3s；后台不轮询；loaded pages >1 仅停止 interval | 原 React 注释明确 focus/manual invalidation 仍刷新已加载的所有页。不能把多页 interval=false 误改为 focus=false。 |
| `useBackgroundTasks.ts` / `core/background-tasks/hooks.ts` | 列表 3s/15s；详情依状态轮询；后台不轮询 | focus 是独立恢复路径，结束状态不轮询并不表示永不重新读取。 |
| `useScheduledTasks.ts` / `core/scheduled-tasks/hooks.ts` | 列表 active/idle 轮询；详情 stale0 / mount true / retry非404最多2；live 恢复显式 refetch | default focus 应一致，404 终态不重试、停止 interval 的原逻辑保留。 |
| `useThreadScheduledTasks.ts` / `core/scheduled-tasks/events.ts` | 两端 events stale Infinity / retry false；任务 fingerprint 变化重取 | 不必补 focus false；fresh Infinity 本身已约束自动 focus 请求，失效后仍可刷新。 |
| `useStandaloneArtifactContent.ts` / React 同名 hook | 两端显式 stale0 / focus true | 已有独立 Query owner，不能因主聊天面板的手工 owner 差异误改它。 |

## 必须保留的显式例外

- 历史：Vue `core/threads/history.ts` 与 React `THREAD_HISTORY_QUERY_POLICY` 都明确 focus false / stale5min。
- Active runs 与 metadata：`useActiveThreadRun.ts` / `useThreadMetadata.ts` 已明确 focus false / retry false，对应 React 实际 owner。
- Scheduled run history：当前 page0 的 mount/focus/reconnect true，旧页均 false；共享 latest/page0 观察器独立保留 mount/focus/reconnect false。不能用全局值覆盖这些响应式选项。
- Frontend extensions：两端 Infinity stale/gc、mount/focus/reconnect false、retry false，保留。
- Models：两端 Infinity/focus false，React另有授权错误不重试、其余最多一次的局部 retry；具体差异已交实现负责人。

## 不把未消费声明误认成需要新增 Vue owner

React `useRunDetail`（`core/threads/hooks.ts`）虽声明 focus false，当前 `frontend/src` 检索只有定义，没有实际调用。未发现需要为它凭空新增 Vue 查询。React 非无限 `useThreads` 仍被 conversation-reference-picker 实际调用；Vue 已用其自身列表 owner 提供引用选择数据，不能依赖旧注释“React useThreads 零调用”推导其不存在。此次无限列表局部 false 的结论来自两端真实无限 owner，而不是该旧注释。

## 验证边界

上述结论来自复核时文件内容与调用点；附件保存每个被读生产文件的 SHA。这里只报告 source-confirmed 差异/一致性，不声称所有 focus、mount、retry 行为已实际通过。实现负责人的生产消费 TDD、types/lint 与最终统一构建/全矩阵验收仍是独立 mandatory gates。


## 后续执行更新（2026-10-10 02:55 CST）

上述表格记录审查时的真实差异，不代表此刻仍未修复。cap 已完成全局 Query 与明确局部例外根因收口；artifact 主面板由 root 随后授权本审计者实施。唯一生产读取 owner `useArtifactFileContent.ts` 已冻结为 SHA `8cf9b2924445ea4e0edaa7c54bb74a340cf68d38229478c51e03ee67b0a0b5a0`：canonical五段key/plain loader结果、text且非writeDraft enabled、stale0/focus true、默认mount/reconnect、继承生产 transport-only retry。old selected/account 请求消费 AbortSignal+account fence；dirty草稿仍由现有draft owner对账；save先cancel exact当前key再写同key；run settle仅单次refetch；loadFull复用key切换已启动的read，避免warm full cache重复GET。

真实 RED→GREEN 与完整日志保存在 `docs/reports/evidence/query-policy-independent-stage36/`：原 visibility/retry 2FAIL、warm full cache 1FAIL；最终8owner/19files200tests PASS，app/tests types与lint直接0。曾出现一处新测试Message union未narrow的types exit2，已用实际AI discriminator修复并完整复验，不隐藏为全程绿。详见同目录 `artifact-freeze.json`。已有真实Gateway浏览器case增强、净PW+0，但新源完整浏览器验收尚待统一窗口；不能由DOM/源审查外推其PASS。


### 最后一次 full 选择纠正（02:59 CST）

02:55的8cf9/8-owner/200为历史checkpoint。root实际复审新增A→B→A差异，经同实例URL/Range RED→GREEN，最终使用React/现standalone相同的最近`{filepath,threadId}`对象而非每次切换清ref。最终SHA `e3015c0f99faa3b84307b1d2960eb19d0b3e63fec49c7b44f8c8395f90033386`；9owner/19files201tests/app+tests types/lint直接0，最终receipt `artifact-freeze-final.json`。mock源仍进Query key，但同React不清全文选择。browser仍待统一真实新build。
