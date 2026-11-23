# Composer 与通知键盘行为：Stage 41

当前四个 Vue 生产文件已冻结；最终字节指纹和全部定向日志见 `evidence/composer-keyboard-clusters-stage41/final-freeze-receipt.json`。最终源码之后实际复验 25 files / 209 tests PASS，0 unhandled；app/tests types、scoped lint（0 warning）、format、standalone 静态扫描均 direct 0。原编译 React 的三个正式原生浏览器合同全部 PASS（9.0s）。新 Vue 源的正式编译浏览器验证仍待统一构建，不能以 DOM 单测代替。

| 真实根因 | 当前最小修复 |
| --- | --- |
| Vue 通知项没有 installed Sonner 的原生 tabindex/focus-return；Escape 还会主动 blur | 通知项 tabindex=0；原生焦点进入记录 prior target，离开/viewport 卸载时按 Sonner 合同返回；Escape 保留当前焦点 |
| Vue toast timer 在 hover、键盘交互或文档隐藏时继续过期 | 既有 toast store 唯一拥有 timer；按实际 remaining 暂停/恢复，新通知在暂停期间保留完整寿命；dismiss/clear 仍权威 |
| 按钮打开引用选择器后，Tab 返回 textarea 的通用 keyup 被当成 caret 更新而关闭选择器 | 仅四个 caret 导航键更新 inline caret；textarea selection 在 button-open/busy 时保持；通过 scoped document pointerdown 按 React 合同关闭外部点击 |
| Shelf attach 给权威附件结果额外加入 source markers，误触发 inline-reference hydration | shelf handoff 只传实际 attach result；picker 主动插入引用的 source markers 保留，独立附件 chip/empty textarea 合同恢复 |

通知的 live region 也按当前 installed Sonner 实际 DOM 收口：永久 section 保持 polite，通知 li 无额外 role/aria-live。旧 Vue 每项 status/alert/assertive 属于此前自行加入的差异。

## 证据与限制

- 原生旧源码 RED：通知/引用两条 Vue FAIL、React 两条 PASS；hover 超过原 4000ms 的 Vue FAIL、React PASS。原始 trace、PNG 与日志保留在本目录 evidence 下。
- DOM RED 分别保留：初始四项真实失败、寿命两项失败、ARIA 两项失败；最终原断言与新负控均 PASS。
- 新 `composer-keyboard-lifecycle.spec.ts` 共有双端 6 条正式场景，保留 catchall API abort、原生 Tab/ShiftTab/Escape、按钮打开 popup 保持、真实外部关闭、附件删除、欢迎区域隐藏及项目 header link。React 三条已实际通过；Vue 新编译范围待执行。
- 草拟浏览器断言曾误选 sr-only greeting、使用 Vue-only welcome testid，以及 Tab 进入浏览器 chrome；这些草稿失败独立保留，不被计作新增产品缺陷。最终使用两端共有的 Surprise 按钮、真实 sidebar 外部点击及文档内 ShiftTab。
- happy-dom 对 blur 内同步 focus 的实现会被外层 focus 覆盖；DOM 测试检查真实 prior-target focus 调用，最终原生浏览器合同直接检查 activeElement。
- 无 builder/full suite、共享 Gateway 写入或门禁名单/阈值/预算变更。本期较早 Linux 与 standalone default 的 PASS 仅证明其精确旧 snapshot；不能覆盖本轮生产变化，完整 with-e2e 仍待最终源执行。
