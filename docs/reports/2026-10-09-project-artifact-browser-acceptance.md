# W09 项目/文档/回收站及产物浏览器回归交付（2026-10-09）

本报告记录当前源码与 root stage9 生产预览的本域验证。不是全项目验收，也不是 React/Vue 像素对齐或真实 Gateway 通过声明。所有生产构建由 root 负责；本子任务复用 `http://localhost:3101`，没有重启服务。

## 交付文件与实际覆盖

- `frontend-vue/tests/support/project-gateway-mock.ts`：从共享 mock 抽出项目/文档/trash 状态机，共享入口仍为同步路由注册。原线程创建和 agent normalize 区块保持各 owner 的实现。
- `frontend-vue/tests/unit/projects/project-gateway-mock.test.ts`：7 个真实 HTTP method/body/status/状态变迁契约回归。
- `frontend-vue/tests/e2e/project-documents.spec.ts`：13 个实际页面流程。前 5 个从当前 React `frontend/tests/e2e/project-documents.spec.ts` 迁入，另 8 个补足本期验收边界。
- `frontend-vue/tests/e2e-real/project-trash.spec.ts`：当前 React `frontend/tests/e2e-real-backend/project-trash.spec.ts` 迁入，使用真实 same-origin project/upload/trash/purge API。此条本子任务 **UNRUN**，由 root 的真实 Gateway 串行门禁执行。
- `frontend-vue/tests/e2e-parity/support/project-scenarios.ts`：10 个共享场景、22 个实际状态，均标注 `upstreamSpecs: ["project-documents"]`；root 已接 shared catalog。桌面亮色、桌面暗色、移动亮色；包含实际 `/workspace/trash` 路由。跨端 parity 本子任务 **UNRUN**，不能把登记场景算通过。

项目 E2E 逐项覆盖四 tabs、UTF-8 instructions 限额与保存、刷新默认 Chats、项目重命名、文档上传/去重、转换预览、原始文件真实下载字节、会话文件提升/provenance/源文件保留、attach 到 composer、归档项目只读能力、原项目消失后恢复目标选择、同 hash 合并、缺失内容 409、120 行 shelf/trash 分页、120 个成员线程独立分页、每个会话文件上限、恢复/永久删除/清空确认、部分 purge 失败后的权威重取及权限 403。

## 三端合同与 mock 根因修复

合同来源是当前 `backend/app/gateway/routers/{projects,project_documents,trash}.py`，以及 React 实际四 tabs、DocumentPreviewDialog 与 Trash 页面。

- Instructions 用 UTF-8 bytes 校验，不以 JavaScript 字符个数替代。
- 上传解析真实 multipart bytes，按 hash 去重，区分 200/201；正文预览允许转换后的 companion，原始下载保留原 filename/content type/bytes。
- `thread-files` 使用真实 `thread_limit`（默认20，最大50）、`file_limit`（默认50，最大200）与成员线程 offset 游标，不把它误当 document `limit`。
- 归档项目禁止上传/提升/trash，但保留预览/下载/attach；attach 复制到目标线程，文件名冲突由权威响应命名。
- Restore 要求有效 active 目标；同 hash 合并返回幸存 ID；缺失内容 409 不移除行。
- Partial purge 真实模拟前部已永久删除、遇某项失败 500、后续未处理；客户端重取后保留失败及剩余项并允许重试。
- 项目成员线程读取 live `getThreads()`，不捕获首次数组引用，避免随后创建/移动的线程被旧 snapshot 吞掉。
- 原始下载使用 React 同款新窗口链接。初始 popup 下载请求不会被 Playwright `page.route()` 捕获，这是原下载 E2E 真正失败的根因。Document content 同一 handler 同时注册在 BrowserContext，保持同一状态 owner，实际下载 filename 与字节均通过验证；没有改产品下载行为规避浏览器。

TDD 证据：新模块不存在时单测失败；真实成员线程双重分页用例在旧 mock 返回全部线程时 1 FAIL/6 PASS；修复真实 backend 契约后 7 PASS。没有以固定返回值代替状态机。

## Stage1 七个失败的审核与根因

| Stage1 条目                                      | 当前 React 事实 / 处理                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 键盘保存后期待退出编辑                           | 当前 React 保存后继续编辑；E2E 改为核真实 PUT正文/sha、编辑器内容和 Save draft disabled。                                           |
| Streaming source 重复正文匹配                    | 异步 CodeMirror 加载态与真实编辑器同存一瞬；等待 loading Textarea消失后读真实 textbox，不靠全页 getByText。                         |
| PDF 期待 sandbox/title                           | 当前 React PDF 原生 viewer iframe 没有 HTML sandbox；检查真实 iframe URL 与无 sandbox。                                             |
| Browser 期待 move wire                           | 当前 React 没有 onMouseMove；检查无 move，以及 click/wheel/key 精确一次。                                                           |
| Browser REST 错误期待 inline Retry               | 当前 React 用错误 toast，并重新提交 URL；实际重试及权威URL/title通过。                                                              |
| Fast Model 无 reasoning capability却期待 minimal | 当前合同省略 reasoning_effort；测试同样省略、保留完整其他 context。                                                                 |
| Sidecar 删除 pending 可关闭                      | 生产真缺口：Vue X始终存在、外部点击未拦。DOM red/green 后修 showClose 与 interact-outside；真实浏览器 pending无X/Esc/外部关闭通过。 |

`CodeEditor.vue` 另一处真实 UI 差异已经修正：当前 React 加载态是 readonly Textarea，Vue 原为 pre。先跑 1 FAIL/8 PASS，再换同样的 readonly Textarea/value/monospace/resize-none/border-none/padding，保留真实 CodeMirror host 测量。最终 CodeEditor + ArtifactPanel 31 PASS。412冲突丢弃测试读取真实 source EditorView.doc，未降低冲突与 dirty draft 断言。

## 实际执行结果

所有命令经 `python3 scripts/pnpm.py --dir frontend-vue`；浏览器命令另由 `scripts/with-loopback-no-proxy.mjs` 包装，临时 reuse config 关闭 webServer、固定绝对 testDir/globalSetup 与 1 worker。

| 执行                                                        | 退出码 / 结果                                          | 日志                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| project mock 契约修复最终                                   | 0；7 PASS                                              | `/private/tmp/deerflow-project-pagination-green.log`                |
| projects + artifact panel + Sidecar + Browser targeted unit | 0；16 files / 113 PASS                                 | `/private/tmp/deerflow-w09-artifact-sidecar-units-final.log`        |
| CodeEditor loading red                                      | 1；1 FAIL / 8 PASS                                     | `/private/tmp/deerflow-code-editor-loading-red.log`                 |
| CodeEditor + ArtifactPanel final green                      | 0；2 files / 31 PASS                                   | `/private/tmp/deerflow-code-editor-loading-green-final.log`         |
| stage9 产物编辑/预览 + browser + 项目13项                   | 0；30 PASS，50.6s                                      | `/private/tmp/deerflow-artifacts-stage9-e2e.log`                    |
| stage9 Sidecar 全套                                         | 0；8 PASS，14.2s                                       | `/private/tmp/deerflow-sidecar-stage9-e2e.log`                      |
| scoped ESLint / prettier                                    | 0                                                      | `/private/tmp/deerflow-code-editor-i18n-lint.log`、`...-format.log` |
| tests vue-tsc（正确 tsconfig.tests.json）                   | 首轮2遇并发composer RED fixtures；props落地后完整复验0 | `/private/tmp/deerflow-code-editor-i18n-types-recheck.log`          |

真实 stage9 浏览器命令：

```sh
node frontend-vue/scripts/with-loopback-no-proxy.mjs -- python3 scripts/pnpm.py --dir frontend-vue exec playwright test -c /private/tmp/deerflow-artifacts-reuse.config.ts artifact-code-editor.spec.ts artifact-preview.spec.ts browser-control.spec.ts sidecar-panel.spec.ts project-documents.spec.ts
node frontend-vue/scripts/with-loopback-no-proxy.mjs -- python3 scripts/pnpm.py --dir frontend-vue exec playwright test -c /private/tmp/deerflow-artifacts-reuse.config.ts sidecar-chat.spec.ts
```

第一条的 `sidecar-panel.spec.ts` 名称误写，未匹配任何 case，其余30项实际通过。没有把漏跑算通过；第二条用真实 `sidecar-chat.spec.ts` 独立完整8项补跑通过。初始完整产品门禁343 PASS/101 FAIL/47未运行的全局状态不能被本报告覆盖；最终全量由 root 重建/串行执行。
