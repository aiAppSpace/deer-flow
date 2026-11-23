# 鉴权页面对齐与恢复验收

当前 React 与 Vue 的初始化、改密、回调状态文案和表单结构已对齐。原鉴权对照的六个样本实测删除了全部 24 条 UI 差异；清单只保留原有四条服务端与客户端组织 `/auth/me` 请求的差异，没有新增接受项。生产代码于 2026-10-09 22:48:27 冻结；本次浏览器副本同时包含 22:54 的 MarkdownPre 局部组件别名修复。

## 根因与改动

- React 初始化和改密页面、OAuth 回调页面原有硬编码英文，中文 cookie 无法改变这部分内容。将页面文本接入当前框架已有的类型化字典；回调独立 layout 仅提供语言上下文，继续与带鉴权重定向的 route group 分离。
- React 原来把回调 401、503 和网络失败均归为 SSO 失败。按 Gateway 契约区分未认证与服务不可用；503/网络失败保留安全的 next，并返回明确可恢复的登录错误。成功仍使用经过校验的内部 next，外部目标回退到默认工作区。
- Vue 改密页面原来预填账号邮箱、展示额外字段标签，间距和提交中文案也与 React 不同。统一为 React 当前的空邮箱输入、placeholder 字段、卡片结构和 pending 文案。两个框架都保留或补齐 role=alert、email/current-password/new-password autocomplete；无可见标签的改密字段提供同名 aria-label。
- 两端回调增加卸载后的异步结果与定时导航退休检查，避免旧页面探测结束后继续导航。
- Vue 登录页按类型化错误键显示恢复原因，保持 SSO 失败与 Gateway 不可用文案的区别。

Vue 字典新增七个实际消费键：setup.completeAdminSubtitle、setup.emailPlaceholder、setup.newPassword、setup.confirmNewPassword、setup.creatingAdmin、setup.settingUp、login.errors.gateway_unavailable。字典库存与审计由既有 i18n 门禁维护。

## 实际验证

| 验证 | 结果 | 证据范围 |
| --- | --- | --- |
| 双端鉴权对照与状态合同 | 21 PASS | 六个原样本与两端两种 cookie 语言的初始化、回调 200/401/503/network；真实控件、pending/错误、精确请求体及完整解码的 next/query/hash |
| 真实 HttpOnly/SQL/RBAC 回调 | 4 PASS | 两端两种语言；真实初始化/登录会话、实际 Gateway `/me`；保留内部深链 query/hash，拒绝外部目标，页面异常为零 |
| Vue 完整鉴权套件 | 25 PASS | 包含迁入的发送/停止权限两例与账号通知持久化；保留原请求、CSRF、存储、权限和账户隔离合同 |
| React 受影响单元回归 | 6 files / 32 PASS | 实际页面、双语上下文、回调 route group 边界、安全 next、卸载后不导航 |
| Vue 实际页面 DOM | 4 PASS | 两语言初始化与改密表单消费、空邮箱、标准属性、CSRF、精确请求与 pending 状态 |
| Vue Nuxt callback DOM | 3 PASS | 实际 Nuxt 页面成功/503恢复与 pending 探测卸载后不导航 |
| 类型、局部 lint、格式 | PASS | React、Vue app 与 Vue tests 类型；受影响代码及测试 |

两套浏览器测试保持各自鉴权拓扑：鉴权对照使用真实 Gateway；Vue 浏览器合同使用原有 page.route 边界。最初将二者共用 Gateway 的实验曾产生夹具状态干扰，已拆开，未作为通过证据。生产应用、依赖、Nuxt buildDir、Next .next、Gateway home 与 SQL 均位于独立源码副本，未读取或修改原仓库受跟踪运行配置。测试端口 3254/3255/8154 与根任务门禁端口分离。

## 测试夹具修正

完整鉴权复验发现旧合同还在访问已移除的 settings=skills/tools，并定位已退役 testId。改为当前两端共有的能力中心入口和真实 role/文案；普通用户个人 MCP 合法、部署 MCP 仍管理员独有，技能只读/no-write、部署 MCP 零请求、真实 403 与 401 回跳断言保留。

工作区恢复断言曾要求已经退役的手动 Try again 与恢复 toast。当前 React/Vue 均使用十秒后台探测；用真实后续 `/me` 请求确认自动恢复，再断言不可用 banner 消失、Submit 可用、路由保持原地，没有添加产品控制或禁用真实探测。

登录夹具曾在提交前恒定返回已登录账号，与“提交登录”前置状态矛盾，偶发自动跳转导致没有登录 POST。夹具现仅在真实 login POST 后开放 `/me`，原表单请求、存储不含密码和安全回跳断言完整保留。

## 证据与边界

逐文件生产 hash、完整测试标题/状态/时长和基线缩减事实见 [summary.json](evidence/2026-10-09-auth-acceptance/summary.json)。旁边保存通过日志；真实会话的 token/cookie 未写入报告或证据清单。

本报告证明本地生产构建、真实 Gateway 会话及上述浏览器消费。外部身份提供方往返、生产 DNS/TLS 和部署切换不属于本次鉴权页面验收。后续全量门禁新发现的能力表面窄屏布局问题另行修复，本报告不代替全量对齐结论。
