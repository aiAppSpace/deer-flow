# 命令目录与 Sidecar 工具栏实际布局修复（Stage 37）

## 当前边界

本报告记录实际运行中的旧编译产物 RED、同一页面的等价布局因果验证和新源码单测。
新统一编译产物仍为 **UNRUN**。React 欢迎页字体放大时另有宿主堆叠层问题，由负责
主聊天布局的 agent 修复；不能把子菜单改成 z50 当作该宿主问题已经通过。

源码冻结清单及逐文件 SHA：
[evidence/command-sidecar-placement-stage37/freeze-final.json](evidence/command-sidecar-placement-stage37/freeze-final.json)。
本域六个生产文件的最后修改时间为 2026-10-10 03:32:59.364920 +08:00，聚合 SHA 为
`04e519cf751caaafe948d0109dbb8b56a042a79e6f4cd5d6c41da005db440174`。
原目录未构建；运行中的完整 cross-app 副本、服务和运行配置均未修改。

## 命令目录实际根因

共享 `sidebar` 场景在 360×800、根字号 32px 时，两端目录初始为 y56..282，实际 main
裁切区为 y120..800。等待十二个原生动画帧，菜单与 scrollTop 均不变；首项在目录自己的
局部滚动容器外被 main 裁切，没有可恢复的原生局部滚动路径。旧公式只计算
`composer.top - 16`，漏掉裁切祖先的 top，也把 `mb-2` 的间距当成固定 8px。

两框架各自已有的 `popup-placement.ts` 现在复用实际 visual viewport 与当前裁切祖先的
交集，命令高度减去半 rem 的真实 `mb-2` 间距及原有 8px 边界。可用覆盖区太小时继续使用
原有正常流菜单，由既有原生滚动容器承载。打开时观察 composer 与全部祖先，监听原生
scroll/resize、visualViewport scroll/resize；关闭与卸载时停止这些订阅。没有增加延时、
坐标偏移、焦点补偿或滚动 owner。引用目录的既有计算保持原语义。

同一旧编译页面注入等价计算后，两端目录为 y128..282，首项可原生 trial click，
ArrowDown/Tab 仍补全 `/compact `。桌面全部目录后代的矩形保持一致（Vue/React 均零差异）。
这些是因果实验，不能替代新源码编译后的正式验收。

## 字体放大时的宿主层问题

1280×800、根字号 32px 时，目录在可见裁切区内，但 React 首项中心实际命中 HEADER。
React composer 外壳是 z30，header 是 z40；子菜单 z50 仍受父 stacking context 约束。
Vue header 是 z30，故相同目录可命中。真实 native trial 的失败已保存；本域将命令浮层
统一使用已有 reference/popover 的 z50，但没有宣称它能够跨越宿主 z30。主布局 owner
正在负责宿主 header/main 的容器响应、堆叠和原生 pan 合同，新正式断言必须保持。

## Sidecar 工具栏实际根因

两端 Sidecar 模式按钮宽 119.171875px，attachment 与间距占去槽宽后只剩约117px；
`flex-nowrap` 与 `overflow-hidden` 将其右侧裁掉约2.17px。
两端对应工具组改为自然 `flex-wrap`，保持文本、按钮与业务入口，移除该非滚动内容组的
裁切。旧页面等价布局实验后，按钮 right 从289.171875进入槽 right287内，变为225.171875；
模式菜单可实际打开并选择。桌面 footer 全部后代矩形零差异：Vue15节点、React14节点。

## 验证

| 验证                                                    | 直接结果                 | 边界                                                   |
| ------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| 新 Vue 实际挂载/裁切祖先/RO/原生scroll/关闭退休测试     | 原1FAIL、18PASS → 19PASS | 原错误156px期望实际284px，未放宽                       |
| 新 React 相同实际消费测试                               | 原1FAIL、2PASS → 3PASS   | sandbox第一次 EPERM 保留，原命令升级权限重跑           |
| Vue composer/sidecar/mentions/invariant 回归            | 28文件216PASS，exit0     | 加最终浮层类前；其后3文件47PASS、exit0                 |
| React input-box/sidecar 回归                            | 16文件150PASS，exit0     | 加最终浮层类前；其后3文件48PASS、exit0                 |
| 两端命令几何、原生首项点击与键盘因果                    | 2PASS，exit0             | 同旧页面标准几何实验、桌面零矩形差异                   |
| 两端 Sidecar 自然换行因果与真实菜单                     | 2PASS，exit0             | 同旧页面标准 CSS 实验                                  |
| Vue app/tests types、React tsc、两端 scoped lint/format | 全部 exit0               | 未改变任何类型合同；最终统一完整 verify 仍由 root 执行 |
| 新正式 command-popup-reflow.spec.ts 对旧编译源码        | 4FAIL，exit1             | 完整 trace/PNG 保留；React命令另有真实宿主拦截         |
| 新统一编译源码正式四例                                  | **UNRUN**                | 须同时包含主布局宿主修复                               |

新正式文件覆盖两 locale、字体单独放大、窄屏、低高度及返回桌面，菜单首次位置在任何
focus/自动滚动之前检查；保留原生 trial click、完整 viewport ratio1、原 survey 全项、
Tab 补全及 Escape，另外覆盖 Sidecar 两个登记终态的按钮和完整文字在自身槽内的边界。
正式用例净增加4，登记样本/目标 ledger 不增加；最终 collector 由 root 实际运行。

所有日志、几何、原始测试与正式 RED 完整失败附件见
[evidence/command-sidecar-placement-stage37/](evidence/command-sidecar-placement-stage37/)。
