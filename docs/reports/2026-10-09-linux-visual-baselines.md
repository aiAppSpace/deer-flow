# Linux ARM 产品视觉基准验证

日期：2026-10-09。执行范围为 `frontend-vue/playwright.visual.config.ts` 的完整产品视觉包（8 个测试，9 张图）；没有把此包等同于 React/Vue 跨端截图对照、真实 Gateway 验收或生产部署。

## 环境与隔离

| 项目 | 实测值 |
| --- | --- |
| 容器 | `deerflow-vue-linux-gates` |
| 镜像 | `mcr.microsoft.com/playwright:v1.59.1-noble` |
| Image ID / RepoDigest | `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53` |
| 系统 / 架构 | Ubuntu 24.04.4 LTS / `aarch64`，镜像 `arm64/linux` |
| Node | `v24.14.1` |
| Playwright | `1.59.1` |
| Chromium | `147.0.7727.0` |
| IPC | `host` |
| Nuxt / Vite / Vue | `4.5.1` / `8.2.0` / `3.5.42` |

上述镜像摘要、ARM 架构、Node 与 Playwright 对应本期固定的 `ubuntu-24.04-arm` CI 视觉环境。执行是原生 Linux ARM，没有使用 amd64/QEMU 模拟。

使用主任务准备的隔离副本：宿主 `/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-yp3BMR` 挂载容器 `/work`。同步当前 Vue 源码、测试和配置时保留容器已严格锁定安装的 Linux `node_modules`，排除 `.nuxt`、`.output`、测试产物、`.env*`、`config.yaml`、`extensions_config.json` 和原 `.git`。后续构建产物全部由该 Linux 环境自身生成。已单独验证根目录与 Vue 目录的私有配置和原 Git 元数据均缺席，没有读取这些文件内容。

## 发现与根因修复

1. 首轮完整包在生产构建阶段退出码 1，没有执行测试或生成基准。展开构建日志定位到 `app/core/threads/activity.ts` 的 `import type { InfiniteData, type QueryClient }` 重复 `type`，Vite 8 transform 拒绝解析。该共享文件由主任务修成 `import type { InfiniteData, QueryClient }`，这里只同步修复后重跑，没有修改编译器或跳过文件。
2. 修复后完整生成 8/8 通过，并生成 9 张 Linux 图；第一次无更新复跑也 8/8 通过。但人工逐图发现 `dark-mode` 是整张纯深色空白背景，因此这两轮不作为合格基准交付。旧用例只等待 `html.dark`，主题初始化早于工作区 hydration，空白页面也能通过。
3. 在 `tests/e2e-visual/workspace-states.spec.ts` 深色用例补充输入框和 `welcome-suggestions` 可见断言，等待实际产品内容就绪。没有使用固定 sleep，没有改动像素阈值、截图尺寸、动画策略或全页比对。
4. 固定 Playwright 镜像没有 `make`，直接 `make e2e-visual` 退出码 127。实际复验使用 Makefile 同一条 `E2E_RUN` 包装链；主任务负责两个固定镜像视觉 CI job 的 make 安装。该环境错误不算产品用例通过或失败。

## 实际命令

全部 Playwright 运行经过现有失败现场保留和 loopback 代理包装。生成命令在容器 `/work/frontend-vue` 执行：

```sh
node scripts/keep-e2e-failure-artifacts.mjs -- \
  node scripts/with-loopback-no-proxy.mjs -- \
  python3 ../scripts/pnpm.py --dir frontend-vue exec \
  playwright test -c playwright.visual.config.ts --update-snapshots=all
```

正常门禁使用同一命令去掉 `--update-snapshots=all`，完整运行 8 个用例。配置自身在每轮启动 Nuxt production build，再启动 preview；`reuseExistingServer: false`，没有复用开发服务器或共享本机 `.output`。

## 验证记录

| 运行 | 退出码 / 结果 | 日志 |
| --- | --- | --- |
| 初始生成 | 1，生产构建语法错误，0 用例 | `/private/tmp/deerflow-linux-visual-generate.log` |
| 展开构建诊断 | 1，定位重复 type | `/private/tmp/deerflow-linux-build-diagnostic.log` |
| 修复 import 后生成 | 0，8 passed，56.5s；人工拒绝空白深色图 | `/private/tmp/deerflow-linux-visual-generate2.log` |
| 初次无更新比对 | 0，8 passed，约 1 分钟；同样未接受空白图 | `/private/tmp/deerflow-linux-visual-verify2.log` |
| `make e2e-visual` | 127，镜像未安装 make | `/private/tmp/deerflow-linux-visual-verify.log` |

5. 仅补内容就绪后，无更新完整运行仍为 8 passed，不能宣称旧空白图已被负向用例拒绝。继续核验 Playwright 1.59.1 实际源码：裸 `--update-snapshots` 默认 `changed`，在现有容差内相似的旧图不会重写。最终显式使用 `--update-snapshots=all`，强制所有九张基准来自本次实际截图，不修改既有 1% 像素容差。隔离诊断截图证明页面 DOM 和正常/禁用动画截图均有正文；诊断运行不计入正式验收。
6. 完整生成另一轮真实捕获 empty chat 建议按钮尚在有限入场动画中，同行 top 差值 8.6286px，原断言要求小于 2px。改为 `expect.poll` 等待相同的小于 2px 条件成立，保持布局断言、截图动画策略和像素阈值原值。

| 最终运行 | 退出码 / 结果 | 日志 |
| --- | --- | --- |
| 内容就绪后首次无更新 | 0，8 passed；不能作为旧空白负向通过证据 | `/private/tmp/deerflow-linux-readiness-red-full.log` |
| 入场动画几何回归 | 1，1 failed / 7 passed，建议按钮 top 差值超 2px | `/private/tmp/deerflow-linux-visual-generate-final.log` |
| 显式全部重录 | 0，8 passed，56.3s；九张逐图审阅 | `/private/tmp/deerflow-linux-visual-generate-all.log` |
| 最终完整无更新复验 | 0，8 passed，1.1 分钟 | `/private/tmp/deerflow-linux-visual-verify-final.log` |

## 本期源码刷新与逐图复验

Stage22 源码指纹为 `a1ae3b5cee55960906649f09c2cff338c39ee08558940774cd866765c1f1a1b9`（886 个产品文件）；已包含 composer 提交快照及首次 new→同一 URL adoption 的生命周期修复。Linux 独立 node_modules 与 Nuxt cache 路径再次核实在副本内，未共享原 checkout 缓存。

| Stage22 运行 | 结果 | 日志 |
| --- | --- | --- |
| 8 例全部重录 | 8 PASS，60.6 秒，9 PNG 均逐张打开审核 | `/private/tmp/deerflow-linux-visual-generate-stage22.log` |
| 8 例无更新复验 | 8 PASS，57.7 秒 | `/private/tmp/deerflow-linux-visual-verify-stage22.log` |

Stage23 又只刷新两端项目页 Tabs 的窄宽/字体放大 reflow 修复（Vue 产品文件一个）。当前 Linux 产品 SHA 为 `108258bc65aeafb505f438ef2a38545f1744e1edec9333feb5c1c4d787fbf0a6`，精确文件清单见 `2026-10-09-linux-final-source-fingerprint.json`。Stage23 完整 8 例无更新复验已 PASS（60.58 秒，0 skipped / 0 flaky），日志 `/private/tmp/deerflow-linux-visual-verify-stage23.log`，统计见 `2026-10-09-linux-visual-verify-stage23-stats.json`；12 例 payload 全 PASS（84.30 秒，0 skipped / 0 flaky），日志 `/private/tmp/deerflow-linux-payload-final-stage23.log`；asset budget exit 0，日志 `/private/tmp/deerflow-linux-asset-final-stage23.log`。六组实际请求与四组 hover/focus 记录见 `2026-10-09-linux-route-payload-final.json`。正式预算修改仅依据 Stage22 六路实际读数与约 3% 余量；禁止重渲染器、hover/focus 与零 prefetch 断言保持原样。

## 最终逐图审阅与交付

已逐张打开九张本次 Linux PNG：empty-chat 完整导航/欢迎内容/模型名/同行建议按钮；empty-chat-attachment 文件标签和输入焦点；streaming-message 真实进行中的 reasoning/subtask；reasoning-tool 折叠步骤和工具结果；artifact HTML 实际预览；settings 浅色设置；mobile 390×844 页面无裁切；dark-mode 完整深色正文、导航、输入框和建议按钮；settings-zh-cn-dark 中文字形、深色配色和设置可见。没有空白页面、乱码、测试错误覆盖层或尺寸异常。

九张合格 `*-chromium-linux.png` 已复制到 `frontend-vue/tests/e2e-visual/workspace-states.spec.ts-snapshots/`，原 Darwin 文件未覆盖。逐图路径、宽高、RGB 颜色数量及 SHA-256 见同目录报告 `2026-10-09-linux-visual-baselines-evidence.json`。这些是 Vue 固定 Linux 环境产品回归基准；跨 React/Vue 的 DOM/布局/视觉对照和真实 Gateway 验收由主任务继续独立执行。隔离副本与容器保留供复核。

## 后续源码边界

Stage23 门禁证明只对已记录 SHA 成立。主任务随后继续修复两端小屏/字体缩放与 React ChatBox owner；这些后续产品变更尚未进入上述 Linux/Docker 源码副本。必须在下一次源码稳定通知后增量刷新，再跑完整8visual无更新、12payload及asset，不能把本次通过外推为后续源码已通过。
