# MessageList 交互归属清理与根因修复

2026-10-11，承接整个 W00–W13 计划的 W12。状态为 **代码已实现、定向回归 PASS；最终冻结整源验收 UNRUN**。本文不以组件变短或新增 composable 数量作为完成证明。

## 已确认的错误与修复

- 浏览器选区工具条只在关闭/滚动时清理，切换线程或身份而不卸载 MessageList 时仍引用旧消息。新增真实 mounted 用例分别切 threadId/editOwnerKey，修前 29 项中 2 项失败，修后两种切换均退休旧引用且允许新引用。
- HIL 请求的 pending 仅按 request id 保存，旧会话拒绝返回会移除新会话相同 request id 的 pending 并播报旧错误；身份切换本身也没有清理。新增两种 owner 的真实 mounted 回归，修前 12 项中 2 项失败；修后操作 token 仅能影响自己仍在持有的请求。
- 复制反馈的 Promise、计时器与组件生命周期绑定不完整。修后会话/身份变化及卸载退休旧反馈；同一 owner 的成功、失败及原 2 秒反馈保留。该部分有有效回归，未声称取得修前 RED。

## 最终职责

| Owner | 独占内容 | 委托边界 |
| --- | --- | --- |
| useMessageTurnActions | inline edit 草稿/提交锁、复制反馈/计时器、晚返回归属 | 编辑请求交宿主，消息与 run 不复制 |
| useMessageSelection | 同一 assistant 回合选区、工具条定位、ResizeObserver、全局监听 | 消息分组为只读输入，引用动作交宿主 |
| useMessageHumanInput | HIL pending/token、响应确认、流结束/新错误/owner 退休 | 实际发送交宿主，表单草稿仍由 HumanInputCard 持有 |
| MessageList | 分组与卡片渲染、动作可用性、历史加载/阅读意图接线 | 动态测量/锚点/追尾仍归既有 VirtualMessageList |

清理 MessageList 中 21 段旧轮次/过程叙事为持续有效的语义边界，保留必要的 React 对应来源。没有变更物理滚动容器、组顺序、消息间距、HIL wire、编辑提交参数或产品文案。

## 实际验证与保留边界

- 9 个消息/表单/滚动消费者测试文件，**108 PASS / 0 FAIL，direct 0**；包括原 inline edit、真实 id、readonly、scroll owner、virtual list 和 HIL 卡片行为。
- 8 个改动源码/测试文件 ESLint direct 0；格式检查通过；应用及 tests 两类 types direct 0。
- 首轮更宽 chat/composer/workspace-shell 执行是 **538 PASS / 4 FAIL**，真实日志保留。三个为并行 AgentChat 同步退休回归，一个是仍从 AgentChat 旧位置截取分支源码的守卫；该次执行不能称完整 PASS。其后 AgentChat 的修复及最终统一门禁另行取得结果。
- 最终完整 canonical、cross-app、mock/backend/external、Linux/standalone/Docker/本地入口仍按原计划执行，不能由本报告代替。

证据目录：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-11/message-actions/`。`summary.json` 列出结果边界；`red.json` 与 `human-input-red.json` 保留两组真实 RED；`green-owners-complete.json`/执行收据为最终定向 GREEN（请求与实际收集的 9 文件集合完全相同）；此前 106 PASS 实际为 8 文件，id 用例路径拼写纠正的原因与两次结果均保留；`implementation.patch` 及源码 SHA 保留对原 Stage43 冻结源的具体变更。

## 最终测试守卫复核

整源 Stage44 canonical 实际 481 文件 / 3975 项 PASS、direct 0，输入前后无漂移。随后发现本次迁移的编辑禁用守卫仍读取 owner 内部公式文本，按 W12 改为挂载实际 useMessageTurnActions，验证空白/未修改草稿禁用且直接调用也不能提交，以及有效草稿按原 id 与 trim 后正文提交。原 MessageList 集成测试仍保留；这一测试迁移不改变产品代码、用例数量、断言预算或基准。两份完整相关文件 25 项 PASS，lint 0；首次命令误指不存在的 vitest.dom.config.ts，未收集测试，正确命令及错误边界记录于 behavior-guard-execution.json。Stage45 将重新冻结并验收这次最终测试变更，Stage44 PASS 不冒充 Stage45。
