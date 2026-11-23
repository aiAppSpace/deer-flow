# Stage42 空消息时间线与三轴键盘焦点修复

截至 2026-10-10 09:18:21 CST，两个生产消费者及三个新回归文件冻结。**真实 mounted RED→GREEN 与 CSS 因果验证已完成；最终统一生产构建后的两个新正式用例与完整三轴宏仍待执行。** 此报告不把诊断运行成功或注入 CSS 的成功记为 compiled 产品验收通过。

## 原始失败与保全

原旧冻结完整跨端 Vue triple-keyboard 的结果是 FAIL：422 方向样本，dead 0 / trapped 2 / invisible 97 / unreachable 0，原 30+10 原生按键预算保持。原运行副本为 `/private/tmp/deerflow-final-parity-stage38-dhwub23s`，根日志为 `docs/reports/evidence/root-stage39-checkpoints/cross-app.log`。没有修改原运行副本、Gateway8160、任何 baseline、阈值或测试预算。

现场保存在 `docs/reports/evidence/triple-keyboard-independent-stage42/`：

- `original-vue-result.log` 保留原 Vue 宏结果；`original-result-inventory.json` 按实际列出 424 个结果文件、846,222,388 字节及 SHA。trace 与 error-context 已复制；大量原 PNG 的原路径与 SHA 保留在清单，不冒称全部已再次复制。
- `native-result.json`、20 份具名 JSON/HTML/PNG 与 `native-results/` 保存全新独立上下文的原生对照；runner 与 config 以 `.snapshot` 形式归档。
- `candidate-result.json` 与 12 份 `candidate-*.json` 保存 CSS 因果、矩形与每次原生焦点。
- `formal-empty-red.json` / `formal-empty-red-results/` 保存新正式断言在旧生产产物上的两个真实失败。
- `empty-timeline-source-freeze.json` 保存最终五个文件 SHA；`empty-timeline-checks.json` 保存命令、直接退出码和证据哈希。

## 三类现象的独立诊断

独立使用既有 Vue3270 / React3271，只新建浏览器 context，默认阻断所有未匹配 API，复用原 `runScenario`、默认维度，再调整到 360×360/root32。场景是 chat、sidebar#default、artifact-preview、artifact-panel-resize、skill-usage#menu；每个应用每个方向均全新 context，完整执行 30+10 次原生 Tab/Shift+Tab。20 个诊断执行完成、API 漏捕均为空；诊断用例的 PASS 只说明证据采集完整，JSON 中的错误焦点没有过滤。

### 空时间线：两端真实消费者缺陷，已修复

两端 chat/sidebar 的空时间线实际容量为零，却仍有固定顶部留白和底部 spacer。Vue 空 scroller 的 clientHeight=0、scrollHeight=136，React 新正式旧源断言为 0/184。Chromium 将实际可滚动的原生 DIV 加入键盘顺序，即使没有 tabindex。两端 chat forward 的第 16、33 次 Tab 都落到 360×0 的真实消息 scroller；原 IntersectionObserver 量具也确认不可见，不是焦点读取层级不足。

空欢迎状态本来可以没有消息区高度。根因是装饰性留白制造了假的可滚动内容，因此没有给它人为补高度，没有删除原生 overflow、改 tabindex、primitive 或焦点名单，也没有改消息滚动 owner。

最终修复：

- Vue `app/components/chat/MessageList.vue` 根据真实 group、loading/streaming、历史加载入口和实际 tail schedule events 决定是否保留 `pt-8 pb-[72px]`。空状态保留同一个 log/scroller/content 节点，只有垂直装饰间距退休。
- React `src/components/workspace/messages/message-list.tsx` 按相同内容边界保留原 `pt-8` 与底部 spacer；空状态采用 `py-0`，保留 primitive 原有水平 padding。真实 Conversation/useStickToBottom/virtual/static owner 不变。
- 任何真实消息、加载/活动、历史入口或有效事件出现时，原间距恢复；再次变为空时退休。没有新建替代消息区或第二个滚动 owner。

CSS 因果实验两端各 chat/sidebar × desktop1280×720/root16、普通 mobile360×800/root16、triple360×360/root32，共 **12/12 PASS、直接退出0**。只注入等价的空态垂直留白退休，所有实际控件、log、viewport 前后矩形逐项完全相同；空 scroller 变为 0/0，每方向原生40次最终焦点无 invisible。该因果 runner 第二方向复用同 context，明确与主20探针及新正式用例的每方向 fresh context 边界区分；没有将此实验称为最终 compiled GREEN。

### iframe / Sheet：已移交根代理独立处理

两个 artifact 场景的 HTML iframe 实际只有 BODY，没有隐藏交互子节点，子 frame focusin=0。Vue forward 在 iframe 与顶层 BODY 之间切换但顶层 focusin 计数不增长；fresh reverse 会反复回到同一个 Sheet content，顶层计数却增长。React 也存在 reverse 相同物理节点重复的现象。因此只看顶层事件计数既会误判中间变化，也可能漏掉真实 stationary focus；不能据此豁免 iframe 或称 React 环正确。

旧 Vue mobile Sheet 没有 body focus guards，installed Reka 的相关 FocusScope/Sheet 行为已交给 root 作为独立 owner 诊断。本次两端 MessageList 修复不修改该 owner、iframe、原量具或其余40次按键合同。

### skill menu guard：旧产物缺陷与当前源区分

旧 Vue nonmodal menu 的 Tab 会退出到 0×0 Reka body guards，原生按键完成后仍在 guard，并非瞬时中转；旧 React menu 阻止 Tab 并保留 menu 内焦点。当前源码的独立 `retainMenuTab` 修复由 artifacts owner 负责，旧副本不含该修复；本次没有再改 DropdownMenuContent，也没有过滤 guard。需要最终 compiled 复验。

## 回归、结果与剩余门禁

新 Vue DOM 回归真实挂载 MessageList + VirtualMessageList，保持 QueryClient/toast owner，只对 NuxtLink 做框架路由边界适配。它检查 empty→真实 human→streaming→history入口→history加载→loading→有效 schedule event→empty 的原间距恢复及同一物理 owner。React 回归真实挂载 MessageList，其他领域叶组件在明确边界 stub，检查同样的内容、活动、历史和有效事件转换；物理原生滚动由正式浏览器用例覆盖。

两端新 mounted 断言先在旧源真实 FAIL，修复后：

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| Vue focused 4 files | 26 PASS / direct0 | vue-mounted-green-final-four.log |
| React focused 4 files | 19 PASS / direct0 | react-mounted-green-vertical-final.log |
| Vue app 与 tests vue-tsc | direct0 / direct0 | vue-app-types-freeze.log、vue-tests-types-freeze.log |
| React tsc | direct0 | react-types-vertical-final.log |
| 两端 owned scoped ESLint | direct0 / direct0 | *scoped-lint*final.log 与 Vue freeze log |
| 两端 owned Prettier | direct0 / direct0 | Vue freeze / React vertical-final-green log |
| 新正式用例在未修改旧 compiled 上 | 2 FAIL / direct1，原 RED 保留 | formal-empty-red.json |
| 新正式用例在最终 compiled 上 | UNRUN | 待统一构建 |
| 原完整三轴宏在最终 compiled 上 | UNRUN | root 统一完整门禁负责 |

新 `tests/e2e-parity/empty-timeline-keyboard.spec.ts` 净增两个正式 Playwright 用例/一个文件，不修改 registry 状态或 baseline：每端 chat/sidebar × 三个尺寸 × 两方向，每方向新 context，保持原30+10按键；随后在同一个 owner 上真实发送 Hello，确认原回复、Took、实际 message rows、正容量与顶部间距恢复，并维持未匹配 API 清单为空。所有样本在失败聚合中仍完整执行。旧源两失败仅来自 empty 三轴容量/不可见 DIV；真实发消息后的内容、间距与 API 断言没有失败。

早期 fixture 类型 `.get().exists()`、非字符串叶内容转换、无效事件值等问题均修正，原失败日志保留；错误的 `tsconfig.app.json` 命令记录为 setup 错误，随后按真实 Makefile 的 `vue-tsc --noEmit` 直接0。没有把这些 setup 失败当作产品原因。没有提高任何5000ms、宏1h或其他预算，没有运行新 build/fullunit，也没有停止 root-owned 服务或无关3000服务。

本次生产变更使此前对应两端当前源最终声明失效。旧 Linux/Docker/完整跨端/本地入口结果只保留各自原快照意义；最终通过需以统一最终构建、完整宏和正式新增用例实际结果收口。backend 第二轮完整4分片仍遵循 root 的统一冻结窗口，尚未启动。
