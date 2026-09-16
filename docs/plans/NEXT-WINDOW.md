# 新窗口开工：整段贴给下一个窗口

> 这份文件只有一个用途：**新窗口第一句话贴什么**。
> 真正的交接内容在 `vue-parity-cold-start.md` 里，那份是维护到当前事实的。
> 这份不重复它——重复就会有两份会各自过期的散文。

---

读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行。

先按文档开头那段命令**现场量一遍状态**（git、台账、CI），量完把读数说给我看；
**不要引用文档里的散文当读数**。

然后从「下一轮最该先拿的」第 1 条开始做，**做完自动开下一轮**，一直推到我喊停。
中途不要问「要不要继续 / 提交 / 推送」——提交与推送是 2026-09-06 就给的长期授权
（Claude 记忆 `deerflow-no-midway-questions`），取舍自己定并写进提交说明。

---

## ⚠ 最终判据（2026-09-16 用户重申，比旧文档强，读之前先看这一段）

用户原话：**「最终目的是 vue 版本和 react 版本在功能，体验，交互逻辑，界面上保持
完全一致」**，并追一句「这个才是最终目标」。**所以对照台账的目标就是 0。**
「新出现、还没定过的行只能减不能增」只是**过程规则**，不是终点——
历轮判成「保留本仓这一侧」的行，按这条判据**是欠账不是结清**。

同日还给了四句，它们是同一条判据的四个面：

- **不能缩水和打补丁**——对齐要还**根因**，不是让台账那一行消失
  （反例：两边可 tab 性不同就给本仓那个元素硬加 `tabindex`）；
- **该重构重构**——上游那一层结构本仓缺了，就按本仓的分层**补一层真组件**；
- **按业界最佳方案**——两边都不对时取业界做法**两边同改**，不要把本仓改成和上游一样错；
- **不要机械式对齐**——**判据是渲染与行为一致，不是源码字面一致**，两者会给出相反答案。

**底层不同构时可以退让**（用户原话：「如果是因为底层架构有差异，实在不能实现完全
对齐，能最大程度对齐就行」）。**这条要读窄**：允许不一致的只是**实现字面**，
渲染/行为/可访问性树仍按完全一致要求；而且必须拿得出**实测读数**
（「按字面对齐之后尺子上反而多出几行」）并写**翻案判据**。

逐族清单与还账路径：`vue-parity-open-accounts.md` 开头那节「按最终目标重排」。
判据全文：Claude 记忆 `deerflow-vue-replacement-goal` 与 `deerflow-long-term-top-tier-goal`。

---

## 接手时的状态（2026-09-16，**现场量，不要当断言**）

- HEAD `ca05875f`，工作区干净、**已推送**到 `origin/main-wc`。
- 台账：**147 场景-维度 / 23 唯一行 / 16 条不同的差异 / 23 个投影**（起点是 170）。
- **CI：`03cfb6ae`（最后一个动过 `frontend-vue` 的提交）那次 run 在交接时还
  `in_progress`——第一件事就是把它的结论查出来**，命令见下面两个坑。
- 本会话跑完第 27~33 轮，第 34 轮**只做了一半**（见下）。

## 下一件事：第三十四轮已量到一半，别重猜

侧栏在窄屏上的挂载时机，8 个投影。**已经排除掉两种猜法**：

- **不是「谁挂了侧栏」**：两边 workspace layout 都挂，且两边窄屏分支**都是 Sheet**
  （本仓 `ThreadSidebarShell.vue` 的 `v-if="narrow"` 对上游 `ui/sidebar.tsx:183`）。
- **不是请求集合差异**：desktop 维度上两边发的是**同一个五条集合**，只是顺序不同。

**已量到**：三行全在 mobile 维度、方向相反；本仓 `ThreadSidebar.vue` 在自己的 setup
里起了 `useThreads()` 与 `useAgentsApiEnabled()`，不在 Sheet 插槽里、关着也跑
——解释了 `threads/search` 与 `features`，**解释不了 `channels/providers`**。

**下一步**：窄屏由 JS 判定，首帧很可能先挂桌面分支、子树跟着挂载并发请求，随后才切
Sheet。**先证这一条再决定修法**——若属实，正解是让 `narrow` 首帧就正确，
而不是给查询加 `enabled`（后者挡不住「整棵子树白挂载一次」）。

---

## 量 CI 的两个坑（两个都是前几轮现场踩出来的，别再踩）

1. **`head_sha` 必须传全 sha**：传短 sha **永远返回 `total_count: 0`**，
   于是那条命令在任何情况下都会「证明」这个 sha 没被测过。
2. **纯 docs 提交不会有任何 CI run**（workflow 有 `paths:` 过滤），
   所以「HEAD 绿不绿」这个问题本身可能问错了——要问的是
   「**覆盖当前 `frontend-vue` 树的那次 run** 绿不绿」。
   **当前 HEAD `ca05875f` 就是纯 docs 提交，它 `total_count` 是 0；
   要查的是 `03cfb6ae`。**

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '.total_count'
```

`0` 的意思是「这个 sha 没被测过」，**不是「没问题」**。往前找第一个动过
`frontend-vue/`、`contracts/`、`backend/app/gateway/` 的提交，那次 run 才是当前树的结论：

```bash
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git log -1 --format=%H -- frontend-vue contracts backend/app/gateway)" \
  --jq '.workflow_runs[0] | "\(.status)/\(.conclusion // \"进行中\")"'
```

**一条红会让后面的步骤全部 `skipped`**，所以 job 级结论不够，要看**逐步结论**：

```bash
RID=$(gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git log -1 --format=%H -- frontend-vue contracts backend/app/gateway)" --jq '.workflow_runs[0].id') \
  && gh api "repos/aiAppSpace/deer-flow/actions/runs/$RID/jobs" \
    --jq '.jobs[] | "【\(.name)】\(.conclusion)", (.steps[] | select(.conclusion=="failure" or .conclusion=="skipped") | "    \(.conclusion)  \(.name)")'
```
