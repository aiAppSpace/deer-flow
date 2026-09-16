# 上游合并审核清单（`main` → `main-wc`，2026-09-09）

> ⚠️ **这是 2026-09-09 的历史快照，已被超越——不要引用它里面的任何数字或状态。**
> 里面的台账读数、门禁读数、「还剩多少」「未推送」「等你拍板」这类说法都是当时的，
> **现在全都不成立**。留着只是为了能看出判据是怎么演进的。
>
> **现状一律以这三份为准**（按这个顺序读）：
> `docs/plans/vue-parity-cold-start.md`（新窗口的入口，唯一维护到当前事实的那份）→
> `docs/plans/vue-parity-open-accounts.md` 的「零、全面审查」节（逐条量出来的挂账现状）→
> Claude 记忆 `deerflow-parity-harness-plan`。

**分支**：`merge/upstream-202609`（从 `main-wc` 开出，`main-wc` 全程未动）
**规模**：上游 234 个提交 / 2319 个差异文件 / **27 个冲突**（1065 个文件已自动合并）
**合并基点**：`e4a7a047`（2026-08-13）

> **判据**（你定的）：每处先问「这两边是不是在修同一个 bug？」——
> 是的话优先用上游的（减少 fork 漂移），除非我们那份实测更好，那才保留并写明理由。
>
> **状态**：`✅已解` = 我已经落了（下面写明怎么落的）；其余**当时等用户拍板；那次合并早已落地，这里没有任何未决事项**。

---

## 一、已经解掉的（1 个，附带捞到一处上游回归）

### ✅ `frontend/src/components/landing/header.tsx`

- **我们**：wave 174 给 `fetch("https://api.github.com/...")` 加 `AbortSignal.timeout(3000)`
  ——那时它在 async Server Component 里，没有超时会卡住整个 `/` 的响应。
- **上游 #5302**：把这次取数**整个挪走了**——客户端组件 `star-counter.tsx` + 路由处理器
  `app/github-stars/route.ts`。
- **判断**：**上游修得更彻底**（根因是「外部服务能卡住页面渲染」，挪走比加超时更根本），
  而我们那行补丁补的代码已经不存在。**取上游。**

**但是**——我们那条守卫 `frontend/tests/unit/styles/external-fetch-timeout.test.ts`
**当场抓住了上游的回归**：

```
expected [ 'app/github-stars/route.ts' ] to deeply equal []
```

上游新的 `route.ts` 里那个 `fetch("https://api.github.com/...")` **没有超时**。
影响面比原来小（卡的是一个 API 请求、不再是首页），但**是同一类缺陷**。

**我做了两件事**（等你确认）：
1. 给 `frontend/src/app/github-stars/route.ts` 补 `signal: AbortSignal.timeout(3000)`，
   注释写明它与 wave 174 是同一处缺陷、#5302 搬家时把「有界」这一半落下了。
2. 把守卫里那个自证锚点从已消失的 `header.tsx` 改成 `route.ts`。

> **这属于「两边同改」的老规矩**：上游自己是坏的 → 我们修 → 应该回推给上游。

---

## 二、纯文档，合并方式是**并集**（7 个）

这几处都是「上游写了新东西 + 我们加了 Vue 段落」，没有一处是互相否定的。
**建议一律并集**，我按上游的组织方式把我们的段落插回去。

| 文件 | 上游加了什么 | 我们加了什么 |
| --- | --- | --- |
| `AGENTS.md` | skill-review waiver 机制、scheduled-task 说明、`SKIP_FRONTEND_BUILD`、`/health` 就绪探针 | Vue 的 `make dev-vue/dev-dual/dual-frontend-production-check`、双前端拓扑 |
| `README.md` | Docker Compose v2.24+ 要求、`/agent` 斜杠命令、本地端口说明 | 整个 Vue 章节、`make dev-vue/dev-dual` |
| `README_zh.md` | 同上的中文版 | 同上 |
| `CONTRIBUTING.md` | Compose v2.24 前置条件、pnpm | **我们这侧是空的** → 直接取上游 |
| `backend/AGENTS.md` | MCP 任务运行时、调度器多实例、`extensions_config.json` 可写、InfoQuest 超时 | replay gateway 的两个测试 seed 说明 |
| `frontend/AGENTS.md` | auth 权限清单要两处同步 | e2e 用 3002 端口、不复用任意监听器 |
| `frontend/src/AGENTS.md` | stream-mode 大幅扩写（强制 `messages-tuple`、gap 恢复细节） | 无实质改动（1 行） |

> **`frontend/src/AGENTS.md` 建议直接取上游**：它描述的是上游代码的实际行为，
> 而且比我们那份新、全。**其余六个并集。**

---

## 三、构建/容器脚本（8 个）——有一处是**我们的真修复，要保留**

### 3.1 ⚠️ `docker/nginx/nginx.local.conf` —— **保留我们的**

```
我们   proxy_set_header X-Forwarded-Proto $forwarded_proto;
上游   proxy_set_header X-Forwarded-Proto $scheme;
```

我们那处是 wave 修过的真缺陷：**`make dev` 跑在另一层 TLS 反代后面时登录 403**
（`$scheme` 只反映到 nginx 这一跳的协议）。上游没修这个。**保留我们的。**

### 3.2 需要真正手工合并的两个

| 文件 | 冲突点 |
| --- | --- |
| `scripts/serve.sh`（4 处）| 我们把 `FRONTEND_CMD` 拆成了 `REACT_FRONTEND_CMD` / `VUE_FRONTEND_CMD` 并加了 `--vue/--dual`；上游在**单前端**的 `FRONTEND_CMD` 上加了 `--skip-frontend-build`、`PORT=3000`、启动超时 120→300。**要把上游这三样搬进我们的双前端结构。** |
| `backend/tests/test_pnpm_script.py` | 它断言的就是 `serve.sh` 里那两行的形状——**跟着上面的解法走**。 |

### 3.3 并集即可的五个

| 文件 | 说明 |
| --- | --- |
| `Makefile` | 我们的 `dev-vue`/`dev-dual`/`docker-logs-react`/`docker-logs-vue` + 上游的 `extension-*`/`setup-sandbox`/`SKIP_FRONTEND_BUILD`。上游的 `docker-logs-frontend` 是单前端时代的名字，**我们那两个是它的替代**，`.PHONY` 要一起对齐。 |
| `scripts/docker.sh` | 上游加了 Compose 版本探测与 `docker-compose` 回退、相对路径修 Windows；我们加了 `--profile provisioner` 与 `frontend-vue` 服务。**两边都要。** |
| `docker/dev-entrypoint.sh` | 我们插了「平台自愈」作为第 4 步，上游原第 4 步顺延成第 5 步。**并集，改编号即可。** |
| `docker/docker-compose-dev.yaml` | **`env_file` 一定要用上游的 `path/required` 长语法**（那是修 Windows 缺 `.env` 就崩的 bug）；我们的 CORS 注释与 Vue 服务保留。 |
| `docker/docker-compose.yaml` | 上游把 `depends_on` 改成 `condition: service_healthy`；我们多一个 `frontend-vue`。**三个服务都用上游的 condition 写法。** |
| `.env.example` | 上游加 `SOFYA_API_KEY`；我们改写了 CORS 说明。**并集。** |
| `backend/tests/test_dev_entrypoint.py` | 我们加平台自愈测试、上游加 extensions 测试。**并集。** |

---

## 四、`frontend/src` 产品代码（8 个）——**逐个要看**

### 4.1 小的，机械并集

- **`frontend/src/app/workspace/scheduled-tasks/page.tsx`**：只有 import 行冲突
  （我们 `useMemo`、上游 `useRef`）→ **`useEffect, useMemo, useRef, useState` 全要**。

### 4.2 两边改同一处、但**不是同一个 bug** —— 要把两者都保住

| 文件 | 我们修的 | 上游修的 | 建议 |
| --- | --- | --- | --- |
| `use-browser-stream.ts` | 放弃重连之后按钮永远显示「…」（说反话）→ 加 `onReconnectExhaustedRef.current?.()` | #4951：重连后不要重建流 → 改用 `reconnectAttemptRef` | **合并**：用上游的 ref 读法，**保留我们那次回调** |
| `thread-title.tsx` | `Loading...` 盖掉已知标题、被 Next 的 assertive 播报器读出且不再更正（WCAG 4.1.3）| #5045 + archive：换了标题来源 | **合并**：保留我们的优先级逻辑，接上游的新数据源 |
| `skill-settings-page.tsx` | 给 tablist 加 `aria-label`（无名 tablist 读屏器只念「tab list」）| #5039：`defaultValue` 改成受控 `value={filter}` | **合并**：上游的受控写法 + 我们的 `aria-label` |
| `artifact-file-list.tsx` + 它的 `.dom.test.tsx` | isMock 时「渲染出来再禁用」而不是整块删掉 | #5117：加 zip 下载 | **并集**（测试也要两边都留）|

### 4.3 ⚠️ 两个大的，需要把我们的改动**搬到上游的新结构上**

- **`artifact-file-detail.tsx`（5 处冲突，上游 57+/275-）**
  上游 #5284/#5056/#4865 重构了：CSV/TSV 表格预览、markdown 独立视图、
  `resolveStoredArtifactLanguage` / `canBrowserPreviewFile` 新抽象。
  我们的改动是：**长文件名把动作键推出可视区**（wave 82 两边同改）、
  **HTML 预览的滚动恢复与资源 URL 重写**。
  → 这几样要重新落到上游的新函数结构上。**改动面最大的一个。**

- **`recent-chat-list.tsx`（2 处，上游 445+/306-）**
  上游 #5265/#5236/#4983 加了 projects、归档/恢复、分支会话标识，几乎重写。
  我们的改动是：**删除会话失败时不再静默**（原来行还在、什么都不说）。
  → 把这段错误处理搬到上游的新结构上。

- **`frontend/tests/e2e/utils/mock-api.ts`**
  我们加了 `token-usage` 与 `workspace-changes` 路由；上游也加了 `token-usage`
  （写法不同）以及大量新路由。→ **并集**，`token-usage` 保留一份即可。

---

## 五、我需要你拍板的三件事

1. **`frontend/src/AGENTS.md` 直接取上游** —— 同意吗？（我们那侧只有 1 行改动）
2. **`docker/nginx/nginx.local.conf` 保留我们的 `$forwarded_proto`** —— 同意吗？
   （这是我们量过的真缺陷修复，上游没修）
3. **`artifact-file-detail.tsx` 与 `recent-chat-list.tsx`**：上游几乎重写，
   我们的改动要重新落上去。**要我逐个搬，还是先取上游、把我们那两处改动挂账、
   下一轮当作「两边同改」重新做一遍？**（后者更干净，但会短暂丢掉那两处修复）

---

## 六、审完之后的验收（脚本这一关）

按你说的「人工审核完毕，再用脚本审」，合并落完后跑：

```
cd frontend && pnpm check && pnpm test && pnpm test:e2e     # React 三门
make -C frontend-vue verify                                 # 2285 条
make -C frontend-vue e2e-mock e2e-parity e2e-parity-auth
make -C frontend-vue audit icon-parity asset-budget standalone-sim e2e-visual e2e-backend
cd backend && make test                                     # 上游动了很多后端
```

**预期会红的地方**（合并带进来的上游改动 + 我们的守卫）：
- `frontend-vue` 的对照台账——上游改了 React 的多处产品行为（artifact 预览、
  会话列表、标题），**台账几乎肯定会分叉**，要逐条重判。
- `backend-enum-mirror` / `nginx` 那几条跨仓守卫——上游动过对应文件。

**回退**：`git merge --abort`，或 `git checkout main-wc && git branch -D merge/upstream-202609`。
`main-wc` 停在 `cc0387db`，远端也有一份。

---

# 附：实际落地记录（边审边记）

## 严格审出来的问题——**冲突清单之外的，比冲突本身更危险**

`git` 自动合并了 1065 个文件、不报冲突，但其中**三处把上游的东西静默吃掉了**。
它们不在任何冲突清单里，是靠 `tsc` 与 `pnpm test` 抓出来的：

| 文件 | 丢了什么 | 怎么发现的 |
| --- | --- | --- |
| `core/artifacts/preview.ts` | 上游新增的 `appendHtmlPreviewBaseHref`（+ 它的 `escapeHtmlAttribute`）| `tsc`：新组件 `artifact-file-preview.tsx` 引不到它 |
| `core/api/stream-mode.ts` | 上游的「剥掉 `streamResumable` 再发请求」整段 | `pnpm test`：上游那条用例期望 `{signal}`，实际拿到 `{streamResumable:true}` |
| `components/workspace/copy-button.tsx` | 反过来——**多**出一个重复的 `aria-label` 属性 | `tsc`：JSX 重复属性 |

**`stream-mode.ts` 那条要单独说**：我们不是「没跟上」，是 **wave 之前某次合并把上游的功能误删了**
（`121f831f`「harden local dual-frontend deployment flows」里删掉 18 行剥离逻辑，
提交说明只字未提，与标题也无关）。当时上游那两条用例还没进我们的树，所以没人发现。
**这次合并是它第一次现形。**

> **教训**：`git merge` 不报冲突 ≠ 合对了。**必须跑类型检查和测试**——
> 27 个冲突里没有一个是这三处。

## 逐个的落法

| 文件 | 落法 | 依据 |
| --- | --- | --- |
| `landing/header.tsx` | 取上游 | 我们补丁的对象已不存在；**顺带给上游新的 `route.ts` 补了超时**（我们的守卫抓出来的） |
| `frontend/src/AGENTS.md` | 取上游 | 我们相对基点**改动为空**，实测确认 |
| `CONTRIBUTING.md` | **并集**（先取上游后补回我们 3 行）| 一开始整取上游丢了 Compose Watch / 双前端两句，核对时抓回 |
| `artifact-file-detail.tsx` | 取上游 | 上游 57+/275- 几乎重写；`tsc` 确认与我们其余代码自洽 |
| `recent-chat-list.tsx` | **重新落我们的修复** | 上游没有任何删除失败处理（`deleteError` 等 0 处），而两侧 e2e 都在断言 `data-testid="delete-chat-error"`。上游 #5265 把它拆成了按行的 `ThreadSidebarItem`，所以 `handleDelete` 不再收参数、`failedDeleteThread` 状态也不需要了 |
| `use-browser-stream.ts` | **合并两者** | 上游 #4951 改用 `reconnectAttemptRef`（修「重连后重建流」），我们加的是「放弃时通知调用方」——不是同一个 bug |
| `thread-title.tsx` | **合并两者** | 上游 #5045 引入 `canonicalTitle`，我们改的是优先级（`Loading...` 不许盖过已知名字）。用上游的数据源 + 我们的顺序 |
| `skill-settings-page.tsx` | **合并两者** | 上游改成受控 `value={filter}`，我们的 `aria-label` 保留 |
| `artifact-file-list.tsx` | 取上游结构 + **补回 `isMock`** | 上游把 `useThread`/`isMock` 从这个文件删了，但它自己的 `artifact-file-detail.tsx` 仍用了 **10 次**——**上游内部不一致**，我们当初修的就是这处 |
| `artifact-file-list.dom.test.tsx` | 取上游 9 条 + 接回我们 2 条 | 两组测的是不同东西；上游的 `renderList` 要包上 `ThreadContext`（否则 `useThread` 抛错） |
| `scheduled-tasks/page.tsx` | 并集 import | `useMemo` 与 `useRef` 都真的在用（后者是泛型写法 `useRef<T>(null)`）|
| `mock-api.ts` | **保留我们的响应体** + 上游更宽的 glob + 上游新增的 `mcp-tasks` 路由 | 上游那份 mock 返回 `{run_id,thread_id,status,changes}`，而真实后端（`workspace_changes/api.py`）返回 `{available,summary,files,…}`——**上游的 mock 与它自己的 API 对不上** |
| `stream-mode.ts` + 它的测试 | 取上游 | 见上面「静默吃掉」那一节 |
| `skill-settings-page.dom.test.tsx` | 补 mock | 上游 #5039 给组件加了 `useUploadSkillArchive`，我们的 `rs.mock` 少一个成员就把整个模块换成了不完整对象 |

## React 三门（合并后）

- `pnpm check` ✅
- `pnpm test` ✅ **1351 全过**
- `pnpm test:e2e` —— 待跑

---

## 三维审计：把「冲突之外的丢失」量出来

冲突清单只覆盖 git 报冲突的文件。真正危险的是**没报冲突却合错**，以及
**我手工解冲突时判断错了**。所以在冲突全部解完之后，又按三个维度做了一次
全量比对（合并基点 `e4a7a047`，fork 侧 1335 个改动文件，上游侧 1065 个）。

### 维度一：上游从没碰过、却被我改了 —— 4 个

`.github/workflows/frontend-vue-verify.yml`、`test_dual_frontend_production_ingress.py`、
`skill-settings-page.dom.test.tsx`、`external-fetch-timeout.test.ts`。
逐个看过 diff：都是为适配上游新形状而**主动**加的守卫补丁，带注释，没有顺手删东西。

### 维度二：上游改过、却整块等于 fork —— **0 个**

没有任何一处上游改动被整块丢掉。

### 维度三：合并树整块等于上游、fork 改动被吃掉 —— 5 个

这一维暴露了本次合并**最严重的三处回归**：

| 文件 | 判定 | 处理 |
| --- | --- | --- |
| `setup_agent_tool.py` | ❌ **我判错了** | 见下节 |
| `artifact-file-detail.tsx` | ❌ 两个 fork 修复被吃 | 搬到上游新结构 |
| `frontend/src/AGENTS.md` | ❌ 线程删除约定被顶掉 | 补回 bullet |
| `header.tsx` | ✅ 上游搬家，修复已在 `route.ts` | 无需处理 |
| `stream-mode.ts` + 测试 | ✅ 有意取上游 | 无需处理 |

### 维度四：两边都改过的 78 个文件里，fork 新增行是否被部分丢掉

写脚本逐行核对（只取长度 ≥25、非纯标点非注释的有辨识度行），先在原文件里找，
找不到的再**全仓找一遍**（上游经常把代码搬家，只在原文件找会误报）。
初测 141 行彻底消失，逐个判完后剩 100 行，全部核实为「同义改写 / 等价写法 /
上游搬家后重写」，无内容损失。

## 三处必须记下来的判断错误

### 1. `setup_agent_tool.py`：我把 fork 的修复退回成了上游

当时的理由是「上游的 tool-receipt 机制已经取代了我们的 `status="error"`」。
这个判断错了，而且我**第一次纠正它时给的理由也不对**，两次都记下来：

- 错的地方：`git log $BASE..main -- <该文件>` 是**空的**——上游从头到尾没碰过这个文件。
  这里根本不该出现冲突，是我手动改错了。
- 我第一次给的纠正理由（**不成立**）：「`make_tool_receipt()` 第 114 行
  `status = meta.get("status") or message.status`，所以回执的成败取自 `message.status`」。
  实际是 `meta` **优先**，而 `meta` 由 `ToolErrorHandlingMiddleware` 按内容前缀打上；
  该中间件在 `agents/factory.py:259` 是 **always** 挂在链上的，生产里也没有绕过它
  直调 `.func` 的路径。我当初的探针直接调了 `.func`，绕过中间件才看到空的
  `additional_kwargs`——**探针的边界选错了，读数就没有意义**。
- 真正成立的理由：上游**自己**在 `update_agent_tool.py`（同族工具，且是上游一个月内
  还改过的当前代码）、`batch_task_tool.py`、`review_skill_package_tool.py` 三处都写了
  `status="error"`。上游只是没给 `setup_agent` 写而已，是它自己不一致。
  而 `tests/test_command_tool_result_semantics.py:358` 那句
  `assert message.status == "success"` 是**顺带描述生产者**，不是设计主张——同文件
  第 293 行的同型断言上游自己注了 `# producer did not set status="error"`，
  而真实工具那条 `test_view_image_disallowed_path_receipt_is_error` 压根不断言
  `message.status`。已把 358 行改成 `== "error"` 并写清理由；负向验证确认它是唯一
  抓住这处变异的断言，`_meta` 与回执两条保持独立有效。

教训两条：**「上游有个更好的机制」必须先证明上游真的动过这个文件**；
**探针要在真实调用边界上打，绕过中间件量出来的读数会把人带反。**

### 2. `artifact-file-detail.tsx`：整块取上游，吃掉了两个 fork 修复

- **HTML 预览资源内联。** 预览 iframe 的 `sandbox` 里**故意没有**
  `allow-same-origin`（上游自己的注释这么写的），文档因此是不透明源、
  子资源请求不带 cookie。上游用 `<base href>` 只能把 URL 解析对，请求照样 401。
  fork 的做法是在**带凭据的父页面**里把资源取回来内联成 data URL。
  上游 #5265 把预览抽到了新组件 `artifact-file-preview.tsx`，所以这套机制被留在
  `core/artifacts/preview.ts` 里成了**引用数为 0 的死代码**。已搬到新组件，
  并与上游的 `<base href>` 组合（前者管认得的资源，后者兜住锚点/表单/脚本构造的 URL）。
- **媒体不走 sandbox iframe。** 同一个根因：`<iframe sandbox="">` 请求媒体
  `Origin: null`。fork 按类型渲染 `<img>/<audio>/<video>`。
  fork 自己的 `artifact-preview.spec.ts:520` 就断言
  `videoRequest.headers().origin).not.toBe("null")`——这条规格**还在**合并树里，
  跑 React e2e 必红。已把 `ArtifactBrowserPreview` 接回。
- **长文件名溢出。** fork 在标题列加 `min-w-0`、文件名加 `truncate`、
  动作列加 `shrink-0`（原提交实测：59 字符文件名在 1280px 下把按钮推出裁剪框 199px）。
  三处都被上游版顶掉了，已连注释一起回填。

新增 `artifact-file-preview.dom.test.tsx`（3 例）把内联行为钉在**组件层**——
纯函数测试当初全绿，却挡不住「调用它的组件被换掉」。

搬家时核对过取数频率：上游传给预览组件的是**节流后**的 `visibleContent`
（`editorContent = isDirty ? activeDraft.draftContent : visibleContent`），
而 fork 那份 effect 用的是**未节流**的原始 `content`——所以移植后每次内容变化触发的
资源请求只会更少，不是回归；React e2e 里带流式写入的预览用例也确实是绿的。

**反向印证：** `frontend-vue/app/components/workspace/artifacts/ArtifactPreview.vue`
里同样实现了这两条（同源产物内联成 data URL 再喂 blob URL；`<img>/<audio>/<video>`
分开渲染），注释写的是同一个根因（「sandbox 没有 allow-same-origin，iframe 是不透明源」）。
也就是说，如果这里保留上游版，React 与 Vue 会在一条**已经对齐过**的行为上重新分叉。

### 3. `AGENTS.md` 重建：丢了事实，还写进了与本仓相反的事实

按字节预算重建根 `AGENTS.md` 时，除了漏掉几段，还**采纳了上游一句与本仓事实相反的话**：

- 上游写 `.env` / `config.yaml` / `extensions_config.json` 是 gitignored；
  实测三个文件**都被 git 跟踪、`.gitignore` 里都没有**。fork 的政策是
  「intentionally tracked，preserve that policy」。两处（正文段 + `make config` 注释）都已订正。
- 上游写 `scripts/pnpm.py` 「invoked from `frontend/`」；实测该脚本有
  `ALLOWED_PROJECTS = ("frontend", "frontend-vue")` 和 `--dir` 选项。已订正。
- CONTRIBUTING 里上游写 `make docker-init` 会「构建镜像 + 装 pnpm/uv 依赖 + 共享缓存」；
  实测 `docker.sh` 的 `init()` **只拉沙箱镜像**。已订正，并补回 `vue.localhost:2026`。

另外补回：provisioner Compose profile 段、Vue 三条 per-module 命令、
「Vue 拥有自己的测试面」边界句、`under deploy/` 指路。
为腾出字节预算，把上游塞进根文件的 skill-review waiver 细则与 extensions 细则压成了指针
（这个文件的定位是编排层，深度归模块指南），并去掉了与正文重复的五行 `make extension-*`。

分段 artifact 写入协议（`begin/append/finalize_artifact_write`）的描述放进了
`deerflow/tools/AGENTS.md`——`sandbox/AGENTS.md` 合并后只剩 52 字节余量，那里只留一句指针。

## 一条方法论

**`git merge` 不报冲突 ≠ 合对了；我手工解了冲突 ≠ 解对了。**
两个方向都要用脚本量：上游改动有没有被吃、fork 改动有没有被吃。
判断「取上游」之前，先跑 `git log $(git merge-base A B)..upstream -- <file>`
确认上游**真的动过**这个文件。

---

## Vue 侧：合并把 8 条跨仓守卫打红了，逐条处置

合并**一个 `frontend-vue/` 文件都没动**（实测 `git diff --name-only main-wc -- frontend-vue/` 为空），
但 Vue 有一批守卫的**坐标系是上游 React**——上游一动它们就该红。这正是它们存在的意义。

| 守卫 | 红的原因 | 处置 |
| --- | --- | --- |
| `doc-references` 里每条 make 命令都存在 | 我为省字节把五行 `make extension-*` 压成 `make extension-install/list/...`，守卫按目标名解析得到不存在的 `make extension-`；另有上游新写的 `` `make extension-*` `` 通配 | 改文本（写成真能跑的一条 + 兄弟目标放注释），不放宽守卫 |
| `upstream-citations` 行数对得上 | 上游 5 份文件行数变了 | 逐条改真；`plugins.ts` 98→269 那条**连结论一起改**（见下） |
| `upstream-citations` 行号不越界 | 上游把 `artifact-file-detail.tsx:1014` 的 `ArtifactLink` 搬到了 `artifact-file-preview.tsx:311` | 指到新位置 |
| `scenario-coverage` 上游每份 spec 都表过态 | 上游新增 8 份 e2e spec | 8 条全进 `pending`，逐条写理由与「什么时候重新问」 |
| `product-surface` 缺失路由都分了类 | 上游新增 `/artifacts/view`、`/workspace/projects/[id]` | 两条进 `pendingRoutes` + `$reasons` |
| `doc-facts` openapi README 数字 | 上游 `app.py` 多了 4 个无条件 router（22→26） | 改真 |
| `slash-contract` 保留名一致 | 上游给共享契约加了 `agent` | `make gen-contract-constants` 重生成（本仓这份是生成物） |
| `upstream-key-coverage` 上游每条 key 都答得上 | **343 条**（见下） | 给守卫加第三个桶 |

### `plugins.ts`：数字过期，结论也不成立了

Vue 那句写的是「上游 `plugins.ts` 98 行里**只有 `rehypeStreamingListItems` 能搬**」。
上游涨到 269 行，新增的 `rehypeScopedSlug` / `rehypeClobberFragments` 是**框架无关**的 hast 插件
——所以「只有一个能搬」这句已经不对了。实测后写清了为什么仍然不搬：
上游在 sanitize **之前**就给标题打 `user-content-` 前缀，sanitize 会再加一次，
`rehypeClobberFragments` 是用来擦掉那个双前缀的；本仓的 `rehypeHeadingSlugs` 只写裸 slug、
前缀交给 sanitize 统一加，压根不产生双前缀。**一个有等价物，一个无对象。**

### 343 条 i18n：先量形状，再决定怎么处置

直接补 343 条、或者全塞进那张手工别名表，两条路都是错的。做了一次**对照实验**
（把上游词典临时换回合并基点那份再跑守卫）确认这 343 条**全部**来自本次合并，
再按「渲染出来的字」把它们分开：

- **164 条是纯路径搬家** —— 上游把 `settings.account.*` / `settings.skills.*` /
  `settings.integrations.*` 拍平到了顶层，本仓渲染的是同一句话。
- **179 条是本仓确实没有的新话** —— subagents 38、backgroundTasks 32、projects 27、
  subagentBatches 25、artifactTable 18…… 都是上游新功能。

判据收紧过一次：一开始按「同字」匹配，抓出 12 条**跨功能的巧合同字**
（`subagentBatches.pause` 对上 `scheduledTasks.actions.pause`，只是都叫 "Pause"）。
最终判据是**路径同尾 + 同字**（函数型词条要求两边都取不到字面量），巧合的那 12 条归入「新话」。

守卫从两桶扩成三桶（`baseline/upstream-i18n-map.json`），并加了两条自证：
`movedByUpstream` 的每一条必须指向真存在且**同字**的本仓 key；
**`pending` 里不许藏搬家**——本仓若已存在「以 `.<该 key>` 结尾且同字」的条目就翻红。
三条变异逐一验过，各自精确翻红一条断言。

### Vue 门禁读数（合并后）

| 门禁 | 读数 |
| --- | --- |
| `make verify` | 退出码 0；278 test files / **2288 passed**；build 完成 |
| `make audit` | 退出码 0；`pnpm audit` 报 20 条 / 7 个包，**每个包都在分诊表里表过态** |
| `make icon-parity` | 退出码 0（顾问性质）。「只有 React 用」的字形从合并前长出 `Archive`/`ArchiveRestore`/`Folder*`/`Layers`/`List`/`ListChecks`/`Table2`/`UsersRound` —— 都是上游新功能带进来的，对应的场景已进 pending |
| `make asset-budget` | 退出码 0；all-client-js 494 chunks / raw 14153.8 KiB / gzip 3278.9 KiB |
| `make standalone-sim` | 退出码 0；跑过 15 条、未跑 5 条、红 0 条；兄弟应用已还原 |

### `e2e-parity`：8 条红，一个根因，且**不是 Vue 的产品缺陷**

首跑 **8 failed / 95 passed**：`thread-history` ×2、`thread-list-pin` ×3、
`thread-list-infinite-scroll` ×2，外加台账比对那一条。全部卡在
`getByText('Newest chat')` 等满 30 秒。

从失败产物往回读（不是猜）：

1. 快照里 `Newest chat` **存在于可访问性树、但判定不可见**；
2. 两张失败截图一对比就清楚了——一侧是 `Recent chats` + 两条会话，
   另一侧只有 `Projects` 一栏且列表为空；
3. 代码坐实：上游 #5265 之后 `RecentChatList` 调
   `useInfiniteThreads({ archived: false })` → `searchThreadsByArchive` →
   **`POST /api/threads/search`**（Gateway 原生路由），而本仓仍走
   `POST /api/langgraph/threads/search`；
4. 后端确有该端点（`ThreadSearchRequest`，`archived` 语义是「省略含全部、
   `false` 含未归档」）；
5. Vue 的 `tests/e2e/utils/mock-api.ts` 里 grep 不到这条路由。

对照工厂把**同一份 mock 套在两个应用上**，所以这条缺失只打到 React 那侧。
修法是补上路由，并与 langgraph 那条**共用同一段处理逻辑、喂同一份 fixture**
——差异要落在 UI 上，不能落在数据上；`archived` 按后端语义过滤。

只跑那三个场景复验：**11 passed**，原来 31 秒超时的现在不到 1 秒
（前一次全量跑就是天然的「修复前」对照）。

**这 8 条不是 Vue 的产品缺陷**，是对照工厂的 mock 没跟上上游的接口变化。
上游 projects 功能本身已经进了 `pendingRoutes` 与 pending 场景表。

### 台账逐类判定（`parity-accept` 之前）

修好 mock 之后 **102 个场景全过**，只剩台账比对一条红：−415 / +1713 行，涉及 89 个场景。
把新增条目**去重后按维度归类**（不是肉眼扫），每一类给出根因与处置：

| 台账变化 | 根因 | 处置 |
| --- | --- | --- |
| `ariaOnlyReact`「Projects / New project / Group chats by project」×22、`tabbablesOnlyReact` 171×button、`tabOrder` 位移、`geometry` Δ-56、`depth` React 4/Vue 3、`order` 第 22 节点 | 上游 #5265 侧栏新增 Projects 段 | 已入 `pendingRoutes` 与 pending 场景表，**接受** |
| `requestsOnlyReact: POST /api/threads/search` ×97 ↔ `requestsOnlyVue: POST /api/langgraph/threads/search` ×91 | 两边走不同路由做同一件事，Gateway 两条都支持 | 设计如此，**接受** |
| `GET /api/features` ×68、`GET /api/subagents` ×2 | 上游给 features 加了 `fetchMcpTasksEnabled` / `fetchSubagentBatchesCapability` 两个新调用方 | 对应功能已入 pending，**接受** |
| 产物视图切换 radio ↔ tablist/tabpanel | 上游把该控件从单选组换成 tabs | **接受**并记录 |
| `paragraph: Deerflow is AI…` ↔ `DeerFlow is AI…` | 上游这次订正了拼写 | **改 Vue 跟上** |
| `geometry` 标题宽度 React=706 / Vue=232.6 / Δ-473.4 | 上游 #5136「过长子任务标题截断成一行」 | **改 Vue 跟上**（`min-w-24 flex-1` + `block truncate`，右侧元数据配 `min-w-0`） |
| `order` 第 38 节点复制按钮 | 上游 #5095 性能改动后的节点序位移 | **接受** |
| `scheduled-tasks` Vue 把几个字段并成一个文本节点 | 上游改了该卡片布局 | **接受**并记录 |

两处「改 Vue 跟上」都是上游的 **bug 修复**且代价是一行级的，属于该跟的；
功能级缺口（projects、MCP durable tasks、subagent batches）不在这次动。

`PARITY_ACCEPT_GROW=1 make parity-accept` 退出码 0。核对新台账：
`Deerflow is AI` **0 处**、`Research stopped reload regression width` **0 处**
（两处修复确实消失了），`New project` 22 处、`POST /api/threads/search` 97 处按判定保留。
台账从 **103 行变成 580 行**，95 个场景不变——这是合并后的如实状态。

### `e2e-mock` / `e2e-backend`：两条红，都是**该跟进的上游变化**

**`e2e-mock`（首跑 268 passed / 1 failed）** —— 失败的是
`agent chat page loads with input box and AI disclaimer`，即我上一步跟进的那句拼写。
本仓有三处钉着旧写法（一条 e2e 断言、一条 unit 断言、一条注释举例），一并同步。
这本身也说明那次跟进不是白改：两边这句话此前确实不一致，只是没有守卫在比。
重跑 **退出码 0**，五套合计 314 passed。

**`e2e-backend`（八套里 1 条红）** —— `auth-disabled contract (real backend)`。
上游 #5265 给后端 `/auth/me` 加了 `permissions`（含新的 `projects:*`），
而**两个前端的合成用户和 `User` 类型都没有这个字段**——React 那边同样不同步，
只是它没有这条契约测试守着；两边至今也没有任何代码读它。

不把不用的字段硬塞进 `User` 类型充数，把契约改成**两个方向都钉住**：

- 去掉「有意不建模」的字段之后，剩下的必须与 `AUTH_DISABLED_USER` **完全相等**
  （某个已建模字段变了照样红）；
- 后端多出来的字段必须**恰好**是那一组——再冒出一个新的没人看过的字段依然红，
  而不是被 `toMatchObject` 那类子集断言悄悄放过。

并写明什么时候把它收进来：前端真的开始按 `permissions` 做门禁的那一刻
（那时它就该进 `User` 类型、进合成用户，并从这张表里删掉）。
两条断言各自做了变异验证，都能独立翻红。


---

## 补做的第五个方向：上游新增行有没有在解冲突时被丢掉

前面四个方向里，逐行核对只做了 fork 一侧（「fork 新增的行还在不在」），
**上游一侧的同类核对当时没做**——用户追问「冲突全部解决完毕了吗」时才补上。
判据同前：两边都改过的 78 个文件，取上游新增的有辨识度行（≥25 字符、非纯标点/注释），
先在原文件找，找不到的再全仓找一遍。结果 **43 行 / 8 个文件**，逐个人工审：

| 文件 | 行数 | 判定 |
| --- | --- | --- |
| `scripts/deploy.sh` | 1 | ✅ 上游的新内容（`--wait --wait-timeout 180`）在，只是我们另外保留了 `--build`（守卫钉着） |
| `scripts/docker.sh` | 1 | ✅ 上游的实质改动（写死的 `docker compose` → 版本探测的 `${COMPOSE_BIN[*]}`）在，只是另外保留了 `--profile provisioner` |
| `backend/tests/test_pnpm_script.py` | 1 | ✅ 上游断言的实质（`env PORT=3000`）在，变量名按双前端拆成 React/Vue 两条 |
| `scripts/serve.sh` | 2 | ✅ usage 行含上游新增的 `--skip-frontend-build`；那条 Note 改写成覆盖两个前端 |
| `Makefile` | 2 | ✅ 只差 `docker-logs-frontend`——**保留它反而是坏的**：`docker.sh logs` 实际只认 `--react/--vue/--gateway/--nginx/--redis/--provisioner`，守卫明令这个名字不许出现 |
| `frontend/src/AGENTS.md` | 1 | ✅ 唯一不同的那句是上游的**事实错误**（说 Gateway 不接受 `stream_resumable`，而 `run_models.py:32` 是 `Literal[False] \| None` 的兼容占位），已按代码订正 |
| `frontend/tests/e2e/utils/mock-api.ts` | 3 | ✅ 2 行是 threadId 提取写法（fork 用 `URL()`+`decodeURIComponent`，合并前就如此）；1 行出自上游那份与真后端对不上的 workspace-changes 响应体，有意拒绝 |
| `AGENTS.md` | 32 | 见下 |

`AGENTS.md` 那 32 行分七组：A 树条目移入散文（未跟踪的运行时目录本就该在例外清单）、
B 扩展段 8 项事实全在、D 定时任务在 `backend/AGENTS.md:18,22` 讲得更细、
E 五行 `make extension-*` 与正文重复故去重、F 生产启动段 5 项事实全在、
G 两处 `gitignored` 是**有意订正**（三个文件实测都被跟踪）。

**只有 C 组是真缺陷**：技能评审 waiver 的 12 行细节，我当时写「压缩成指向
`backend/AGENTS.md` 的指针」——**而那份文件里根本没有 waiver 规则**。
内容本身没丢（在 `scripts/AGENTS.md` 的 "Public Skill Review Waivers" 一节，
逐条覆盖且更细），但**指针指错了地方**。已改指向 `scripts/AGENTS.md`。

教训：**「压缩成指针」必须去被指向的那份文件里确认内容真的在**——
否则它和直接删掉没有区别，而且更难发现。
