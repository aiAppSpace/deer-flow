# React Dialog/Sheet iframe 边界独立复核

只读复核，无生产/测试/量具修改，无 Next/Nuxt 构建或全量 unit。实际小型 bundle 运行当前组件与已安装 Radix，自有 loopback port0 和隔离浏览器 finally 关闭，无业务 API 请求。

| 当前读取输入 | SHA256 |
|---|---|
| `frontend/src/components/ui/dialog-focus-boundary.ts` | `979f0b01f0b474a75167d9ecea8d6a3ee0ecb4b0d924ee33c3f98239cf2a0572` |
| `frontend/src/components/ui/dialog.tsx` | `7062306274a778be66b7cd989202d352f17d1c919054abf79b53bc339337d7a3` |
| `frontend/src/components/ui/sheet.tsx` | `e754eae8ad3833190c0668fdfcd49cec5c612771ba0414ecd9c473ed11282080` |

这三份输入在辅助执行前后字节不变。不要把此审阅 SHA 外推为随后修改的最终源。

## 结论

iframe helper 当前无新增阻断发现。它只在 host 含 iframe 且未 closed 时插入内部首尾边界；通过真实候选 focus 的 nested focusin 更新 Radix，阻止透明 sentinel 自身覆盖最后焦点。原 modal/trap/outside/nesting 仍由 Radix 承担。MutationObserver 可修复动态 child 插入造成的首尾顺序；无 iframe 时不插 DOM。React19 callback ref 返回清理，object ref 退役清空，ref identity 变化会先释放旧 observer/guards。当前 mounted 文件已有 object/callback cleanup、直接 primitive asChild section 等有效断言；本独立审阅没有重新执行那些 unit，不把读码写成实跑 PASS。Sheet/Dialog 封装原本的 asChild 子元素结构限制不应冒称由此 helper 扩大支持。

本独立原生实际验证：iframe 移除后 guards 2→0，重新插入且内容变化后 0→2、start/end 位于真实首尾；unmount 后 guards 清零，均正确。

发现一个真实的既有 Sheet owner 缺口：Sheet 内打开项目 Dialog，在内层 `Inner` button 聚焦后，同目标实际收到两次 `scrollIntoView({block:'nearest'})`。内层 Dialog 处理一次；外层 Sheet 的 React portal 冒泡又处理一次。Sheet 当前只检查 target connected/active，没有 `host.contains`/最近弹层 host/closed/revision fence，而 Dialog 已有相应 owner 判断。它不是 iframe guard 自身错误，也不能把这次命令 exit0 写成全部行为 PASS。

最小建议：Sheet 复用当前 Dialog 的 host-local owner 和 rAF 退役语义，保留 caller 优先、原键盘/指针行为；先证明 nested portal 仅内层 reveal、close/unmount 和迟到 rAF 退休，再落源。不要重写 iframe 栈、候选算法或 Radix modal admission。

## 证据边界

- [native-review.json](evidence/dialog-boundary-independent-review-stage42/native-review.json)：前后 SHA、动态边界正确、nested portal `OBSERVED_OWNER_GAP`、unmount 正确、请求与 pageerror 均空。
- [native-review.cjs](evidence/dialog-boundary-independent-review-stage42/native-review.cjs)：实际 source 小型组件工具。命令直接 exit0 表示诊断完成，不代表 owner gap 已修复。

未运行最新完整 Next 页面/跨端全矩阵；Linux 仍 HOLD。已向 root 和 composer 同步真实缺口，不修改其独占文件。
