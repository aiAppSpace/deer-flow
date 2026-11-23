# Stage40 真实回放截图与独立性采集工具只读复核

逐张回读 expected/actual/diff，并阅读 trace、原截图规格、当前 Vue/React 宿主及原生滚动合同。没有修改源、测试、门禁或 baseline，没有运行构建、完整单测或浏览器。

截图失败是真实布局终态变化：旧图 composer 在约 y587–705 可见，消息处于尾部；新图 composer 不在窗口内。cap 的同产物原生观测显示 textarea 仍为 activeElement，却在 y862.875；form 为 y849.875–965.875，所在 main 的 clientHeight720、scrollHeight982、scrollTop0。原 0.02 阈值及数据/DOM断言应保持。

源代码给出的因果候选是分栏触发容器响应布局：artifact 打开后 chat-pane 宽738.59px，小于 root16 下48rem=768px；当前两端都让 header 入自然流，消息 flex item 使用 automatic minimum、上限100dvh，原 main 允许 native pan。内部消息 tail owner 只跟随消息 scroller；外层 focus reveal 只监听新的 focus 事件。发送时已经聚焦的 textarea，后续消息/面板布局增长未必再产生 focusin。不能仅凭宏观“最终可原生滚入”证明这个初始截图终态等同旧图，也不能由此只读候选直接宣布产品缺陷。

旧 expected 也包含确实过时的表现：`Completed in <1s`、无 p4 卡框的平铺 artifact；当前 React `chat-box.tsx` 对 artifacts 使用 p4，当前两端耗时为 `Took`。因此不能为了旧 baseline 整体恢复旧样式。第一轮 React 诊断未取得实际 suggestions，仍不能作同状态对照结论。cap 正补真实 finished/suggestions+artifact 状态的独立原生对照；在该结果前不支持更新截图基准或放宽阈值。如真实同态证实双方共同活动焦点随布局增长脱离 viewport，再从原外层滚动 owner 的生命周期收口，而非加截图前补偿滚动。

同时只读复核 Stage40 四采集工具：完整 standalone 源树、安装后真实 workspace native dependencies、`--with-e2e` 实际 venv/解释器/stdlib 三集合的当前执行链无新增阻断发现。exec 包装保留原 argv/options/stdout/异常与退出码，原 exit7 负控有效；实际 JSON 在删除前保留，source/native/backend 验证在 workspace dispose 前执行，预算与 skip 条件未变。早期 prerequisite 失败后的后续集合应写 NOT_REACHED；最终成功证据仍须逐项确认 capture/verify 与 backend receipt 齐备，不能只看 outer wrapper 的工具 SHA/React absent 两项布尔值。

完整路径、PNG SHA/尺寸、源和四工具 SHA、原几何及上述边界已保存到 `docs/reports/evidence/real-render-independent-stage40/review.json`。原 real 5 PASS/1 screenshot FAIL，以及尚未完成的后续门禁，均不在本次只读审查中改写为 PASS。
