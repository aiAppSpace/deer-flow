# Artifact Range 响应生命周期根因修复

## 实证与根因

Standalone Stage27 的真实 Gateway 包在 `artifact-write.spec.ts` 读取第一条浏览器 206 响应 body 时失败。失败 trace 中，同一 `note.txt` 的第一条 `Range: bytes=0-1048575` 请求在返回 206 headers 后 `net::ERR_ABORTED`，59 ms 后第二条相同 GET 成功返回 `server baseline`。不是服务端 Range 失败，也不是增加第二条 HTTP 请求能够解决的测试问题。

在独立 canonical Docker Vue 镜像与真实 Gateway 上，保留原完整 spec，仅用原生 `AbortController` / `fetch` 透明日志记录调用。旧源码连续 3 次完整流程通过时，首次 reload 的 `note.txt` 与 `large.html` 仍每次都发生首次取消。真实 abort 栈明确为：`useArtifactFileContent.onScopeDispose → effectScope.stop → component unmount`，没有证据支持 focus/stream watcher 触发本次取消。

源码链与真实请求时序对应：

1. `authDisabled=true` 时 middleware 正确绕过登录查询，以默认 synthetic 身份挂载工作区。
2. `ComposerModelSelector` 独自使用 `useAuthSession({ enabled: true })`，子树 setup 意外启动 `/me`；其他同类消费者均遵守 authDisabled。
3. spec 真实注册留下的 cookie 令 `/me` 返回真实账号，`UserPreferencesBoundary` 从无真实 preference owner 切换到真实 owner。
4. 账号边界正确取消旧工作区查询并卸载子树，正在读取 Range body 的 ArtifactPanel 随 scope 终止。重挂载再发第二次 GET，掩盖了正常情况下已经发生的浪费和竞态。

React 的模型选择器只消费 AuthProvider，authDisabled 的初始 owner 为 `AUTH_DISABLED_USER`，不会额外主动探测。本次精准修复 Vue selector：按同一 authDisabled 模式门控唯一 session query；没有真实 cache 时使用标准 synthetic default ID 管理 favorites，已有真实 cache 优先。保留显式 visibility refresh 到真实账号后必要的账号隔离重置。

## 验证

- 新增真实 VueQuery + UserPreferencesBoundary + ComposerModelSelector 集成测试，修复前 2 FAIL，修复后 2 PASS。
- 连同既有 favorites、preferences mount、live session 与 workspace query isolation：5 files / 20 tests PASS。
- Scoped ESLint 与 Prettier PASS。
- 独立 canonical Docker Vue `deerflow-ingress-vue:stage28` +真实 Gateway 上原完整 artifact-write 流程重复 3 次：3 PASS / 18.5 s。原 206、Range、精确 `server baseline` body、并发 412 与草稿保留、禁止二进制预览、超限 HTML 预览全部保留；另显式断言原 response `finished() === null`。
- 仪器记录修复后初始 `/me` 查询 0、artifact abort 0；没有替代请求兜底，没有忽略 body。

日志：`/private/tmp/deerflow-composer-session-owner-red-stage28.log`、`/private/tmp/deerflow-composer-session-owner-green-stage28.log`、`/private/tmp/deerflow-artifact-owner-stage28.log`（旧源码的卸载实证）、`/private/tmp/deerflow-artifact-rootfix-stage28.log` 与同名 JSON。以下持久 JSON 保存摘要，最终整包 standalone / cross-app 结果由主任务另行记录，不能由此 focused 验收代替。
