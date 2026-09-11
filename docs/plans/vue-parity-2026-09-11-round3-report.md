# Vue 对齐 React：2026-09-11 第三轮

分支 `main-wc`，9 个提交（`6ab3cfb3` … 本文件所在的那一个），全部已提交、**未推送**。

## 一句话

对照台账 **330 → 106 行**，而且**剩下的每一行都判过了**（87 行是三条早就判过的账，
真正还开着的 19 行逐条写了判词与翻案判据）。
这一轮挖出的缺陷**大半在上游**——包括一颗叫「Disconnect」、实际删掉整个部署渠道配置、
而且对所有人可见的按钮。

## 账

| 场景族 | 起点 | 现在 |
| --- | --- | --- |
| `channels#settings-panel` | 53 / 54 | **2 / 2**（只剩 scroll-area） |
| `agents-feature-disabled` 三态 | 32 | **0** |
| `integrations` 七态 | 46 | **34**（全是判过的两条账） |
| `scheduled-tasks#default` | 14 | **0** |
| `thread-history-mermaid` | 29 | **16**（streamdown 写死的 4 个标签） |
| `browser-feature` zh-CN | 12 | **0** |
| 全量多重集 | 330 | **118** |
| 全量唯一行 | 263 | **106** |
| 单测 | 2615 | **2636 全绿**（320 文件） |

## 上游的缺陷（两边同改，共 7 处）

1. **一颗叫 "Disconnect" 的部署级删除键**。打的是
   `DELETE /channels/{provider}/runtime-config`——停掉整个部署的渠道运行时、
   吊销所有人的 connection 行、删掉 provider 配置，而且 Gateway 那条第一句就是
   `require_admin_user`。上游对**所有人**渲染、**没有任何确认**、只在已连接态才有
   （app secret 填错、永远连不上的 provider 因此清不掉）。
2. **markdown 面整片停在英文**。`streamdown` 自带 `translations` prop，上游从来没传过，
   于是代码块复制、表格导出、mermaid 工具条、外链确认在中文界面下全是英文。
3. **浏览器面板整条工具条写死英文**（`title="Back"` / `"Connecting to live browser…"` …）。
4. **产物面板写死英文**（`{ext} file`、「无法预览」、iframe title、装技能失败的 toast）。
5. **「点了就跳走」的控件写成了按钮**（新建智能体 ×2、卡片上的聊天）——不能中键打开、
   不能新标签页打开、不能复制地址，读屏器念成按钮。agent 名还是裸拼进路径的。
6. **加载占位没有 role、文案不说在加载什么**；**技能取数失败那一行没有 role、
   硬编码 `Error: ` 前缀**；**MCP 行那颗 Switch 没有可访问名**。
7. **设置对话框深链之后焦点永远落在 "Account"**；**模型不在清单里时选择器整个空白**
   （保存会把它悄悄改掉）。

## 本仓的缺陷

- `channels` 设置页：卡片没走 `ui/item`（每行深一层）、账号列表无条件渲染
  （7 个 provider 每个挂一句「尚无渠道账号」，已连接的也挂）、动作条顺序反了、
  `descriptions.buzz` 的中文是孤例漂移。
- **三份文件把 primitive 的基类抄成了本地常量**，抄的那几份都漏了
  `aria-invalid:` 与 `disabled:`——无效态与禁用态在那些字段上一直不生效。
  盘出 19 份手写 `<input>`/`<textarea>`，改掉 7 份，剩下 12 份上了双向守卫。
- 定时任务详情里缺了「复用会话」的提醒；模型清单还在取时把选择器禁掉，
  于是对话框的初始焦点被推到温度那个 spinbutton 上。
- `markdown` 命名空间里 7 条中文没翻。

## 新门禁

| 门禁 | 它守的失效方式 |
| --- | --- |
| `handwritten-input` | 手写 `<input>`/`<textarea>` 绕过 `ui/input`——上一处盒模型缺陷改回去不会让任何门禁变红 |

## 方法上的三条

**「只在一个语言维度报差异」本身就是判据。** 三个场景只在 zh-CN 上有行、en-US 一行没有
——两边渲染的是同一棵树，只是一侧没翻译。这一条这一轮用了三次，三次都命中。

**「文件里有没有这个字符串」不能当幂等判据。** 给 `MemorySettings.vue` 补导入的脚本写的是
「没有 `ui/textarea` 才加 import」，而脚本自己刚插进去的注释里就写着 `ui/textarea`。
`vue-tsc` 放行，是一条 DOM 单测抓住的。与守卫注释被自己扫到是同一个形状。

**跑门禁时不要改源码。** 这一轮有一次 e2e-mock 跑到一半时改了 `frontend-vue/app/`，
那一轮的结果直接作废（构建早就做完了，测的是旧代码），只能杀掉重跑。

## 下一轮的起点

台账上没有「还没判」的行了，所以下一轮**不能再拿台账行数当坐标系**。三条现成的：

1. **`ui/input-group` 没有移植**：三个 composer（ChatComposer / AgentBootstrapComposer /
   SidecarPanel）的输入框上游走 `PromptInputTextarea → InputGroupTextarea → <Textarea>`，
   本仓整块外壳是手写的。工单在 `vue-full-parity-backlog.md`。
2. ~~`text-red-600` 与 `text-destructive` 两边都在混用~~ **当轮做掉了**：
   错误文案两边一律 `text-destructive`（23 处），浅红底提示盒换成
   `bg-destructive/10`（6 处），diff 增删与状态色照抄上游不动；
   顺带补上本仓 diff 三档缺的 `dark:` 变体。**这套差异只在深色主题下现形，
   而对照工厂只跑浅色维度——台账永远报不出它**，所以它也是「台账之外还有活」的样本。
3. **取样面**：维度机制支持 `dark`，但**只有 `chat` 一个场景跑满矩阵**，
   其余只跑 `desktop/light/{en-US,zh-CN}`——而这一轮的「红色两套」全长在设置页与
   错误态上，那些场景一个都没开 dark，台账因此照不到。
   把带错误态的几个场景各加一个 dark 维度是现成的下一步（代价是每加一维就多一遍
   两侧取样）。`vue-full-parity-backlog.md` 的「天生看不见的八类」里还有别的。
