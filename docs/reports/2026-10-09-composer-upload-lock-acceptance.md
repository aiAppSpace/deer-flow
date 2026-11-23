# 上传锁与提交快照的实际验收（2026-10-09）

当前结论：Vue 上传期控件锁已按当前 React 消费契约修复；真实双 tab 验证两端首轮 wire 与下一轮 wire，均通过。最终产品全量门禁由根任务执行，此处不代替全量结论。

## 根因

React chat-page 将 isUploading 纳入 InputBox disabled，知识范围选择器同时禁用。Vue AgentChat 原先只把 localUploading 作为上传显示状态传入，未纳入 ChatComposer disabled，因此上传时仍可编辑正文、切换模式/模型/知识范围。提交 owner 已拥有上传前快照，但实际 UI 锁契约缺失。

修复在 `app/components/chat/AgentChat.vue` 的 composer disabled 条件加入 localUploading。模型/模式和正文沿既有 disabled 消费；知识范围沿已有 slot disabled 消费。正常用户、Agent、项目会话共用此入口；bootstrap 没有文件上传入口，demo 本身已有只读规则。没有增加新的状态 owner 或取消事务规则。

## RED → GREEN 与真实 wire

正式 `tests/e2e/composer-submission-snapshot.spec.ts` 保留上传请求暂停与完整字段断言，并增强为真实第二个 browser tab 操作模型菜单，通过浏览器原生 storage 事件影响第一个 tab 的后续选择。

- 旧 Vue 真实产品首先在上传中正文 aria-disabled 缺失处 RED。
- 上传中第一个 tab 的正文、模型、模式、知识范围均锁定；第二个 tab 改变偏好后，第一个 tab 显示新偏好但仍锁定，运行请求仍为 0。
- 释放实际上传后，首轮 wire 仍使用上传前 Reasoner/Pro 上下文及 exact file snapshot，knowledge_scope 仅在消息 additionalkwargs 中。
- 下一次实际提交采用第二个 tab 更新后的 Plain/Flash 上下文；实际把知识范围改成 Off 后，第二轮消息使用 disabled scope。两轮 thinking/plan/subagent/model/effort/scope 原断言完整保留。
- 同一完整夹具以共享 role 定位运行在真实 React 产品上也 PASS。没有 force click、fixed sleep、重试或跳过断言。

Vue 相关 command/upload/draft/thread owner/stream/sidecar 回归 8 文件、112 PASS。用户可复核 [公开夹具证据](evidence/2026-10-09-upload-lock/vue-green.log) 及正式测试源码。密钥、私有会话内容和原仓库运行配置没有复制进证据。
