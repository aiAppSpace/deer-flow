# Lark 设置跨端滚动差异根因（Stage34）

当前状态：原正式浏览器用例保持全文不变；旧真实产物稳定 **FAIL**，只加入与 React 等价的 Vue section 结构后，原正式全部断言 **1 PASS / direct exit 0**。Vue 最小生产修复已冻结，DOM 两语言 TDD、相关功能回归和两套类型检查通过。Stage35 新编译产物的原正式浏览器回归已 **1 PASS / direct exit 0**，同批 Copy 两项也 PASS；因果注入证据与真实生产验收分别保留。

## 真实失败

完整 aggregate 第 50 项失败于最终严格滚动相等：Vue scrollTop=198、React=425。overflow、scrollTop>0 两条均成功。两端对话框外框同为 672×680、clientHeight=678，内容 scrollHeight 却是 Vue1060 / React1132。动画和 DOM 稳定后读数不变。

源代码与实际 DOM 都显示：React `LarkPluginSettings` 导出组件使用 SettingsSection 包含 Integrations 标题、描述和正文 main；Vue 直接返回 Lark Card，缺少两段可见文案和 section 层级。这是产品差异，不能删除相等断言或调整窗口/容差将门禁变绿。

## 因果与负控

在独立浏览器 context 里，仅按 React 已有结构为 Vue 增加 SettingsSection 的原生 DOM 等价物，没有设置 scrollTop、坐标或样式偏移：内容高变为1132，同一 Calendar click + Exact OAuth scope fill 后，Vue425 / React425。两端 Connect Lark 按钮完整出现在对话框内。

相同 readiness 等待但不增加 section 的负控，仍是 Vue198 / React425。进一步用初始化 MutationObserver 仅在 Vue Card 出现时补 section，原 `interaction-settles-first.spec.ts` 全部原生交互、窗口、overflow/top>0 与最终精确等式均原样，**1 PASS / direct exit 0**；没有额外等待掩盖相等结果。

## 生产与回归

仅 `frontend-vue/app/components/workspace/capabilities/LarkPluginSettings.vue` 引入已有 SettingsSection，并把已有 `settings.integrations.title/description` 传给它，无新样式封装。冻结 SHA256：`0944688ba5b53011d7607f7e64487724d119040002e7a7c62f8e73a54479e228`。

现有 DOM 文件新增两种语言的实际 section 标题/描述/main/Card 验证与唯一 API 加载约束，旧源2 FAIL/8 PASS → 新源相关3文件22 PASS。app 和 tests vue-tsc、定向 lint/Prettier 均 direct exit0。实际词典仍1828键/64unused，与基线一致。

正式 spec 与 aggregate 旧副本逐字节相同，SHA256 `ce0d0553f0e693ebc435d4ceead4db1f200a4ade4a46e21b7e3a85005898087f`。Stage35 已在 Vue3250 / React3251 新产物再次运行原 formal，1 PASS（1.5s）；上述 spec SHA 仍逐字节一致。

完整原失败 trace、截图、诊断 runner、两端分阶段 geometry、相同 readiness 负控、原 formal 因果日志和 TDD/types 在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/interaction-settle-stage34/`。

Stage35 生产输入与正式运行证据在 `docs/reports/evidence/copy-control-reflow-stage34/stage35-formal-final/`，包含 acceptance.json、formal3.json/log 和未改断言的原 spec。该回归使用独立 browser contexts，没有修改 root 全量服务、源副本或输出。

实际preview构建输入采用root独立源码receipt `docs/reports/evidence/root-stage34-checkpoints/cross-source-final.json`（5538项、SHA04ce0e533629af6b2f8010d4a6f25bdcf0f358762dd4caa1b1bc07e92b3fbc89）和 `freeze-copy-proof.json`。实际build/start日志与关键产品源/副本逐字节匹配，不混用Docker选源receipt，也不声称已取得完整编译产物字节清单。
