# Stage34 引用弹层的布局根因修复

当前 Vue/React 生产修复已冻结；定向 DOM、类型和 lint 通过。root 统一新编译产物上的正式引用回归两端 2/2 PASS，53.8s，直接 exit0；包含每端三个登记终态与原有全部 survey。

## 当前源码与真实失败

- Vue `ChatComposer.vue` 的 welcome 建议仅排除了 command catalog，没有排除引用目录；React 已排除 `showMentions`。真实组件断言证明打开引用后 Vue 仍保留建议（RED），使 narrow/root32 composer 额外增高。
- React 引用定位只监听 window resize/scroll。自然 font-only 变化没有这两种事件时，输入 root 的位置和高度已经变化，但弹层仍保留旧 maxHeight，Close 实际 y=-129。
- 两端按 window 计算上下空间，忽略 narrow `main` 从 y=120 开始的 overflow 裁切。Close 虽然可能处于窗口内，其中心实际命中 header；原生 trial click 无法靠 scrollIntoView 恢复。

旧编译产物的正式 `chat-content-reflow` 引用两端用例均 RED。新增可见范围断言在任何测试滚动之前执行，防止测试动作顺带刷新旧位置掩盖缺陷；保留原三终态、横滚/lost/clipped survey。

## 最小修复

两端独立的 `mentions/popup-placement.ts` 只计算当前 visual viewport 与所有当前裁切祖先的垂直交集；间隔来自弹层实际 CSS margin，保留既有 4px 边界。打开期间原生 ResizeObserver 监听 composer 及祖先，并监听 window/visualViewport resize、scroll；关闭和卸载完整清理。不会缓存桌面时的裁切集合，因为断点本身会改变 overflow。

Vue 同时在引用目录打开时隐藏 welcome 建议。草稿、引用选择、上传/提交/Stop owner、命令目录及后端合同均由原消费者继续持有。

## 证据边界

- Vue 2 files /32 tests PASS；React InputBox 41 tests PASS。双方生产/测试类型和 scoped lint 直接 exit0。
- 旧编译正式引用 2 case FAIL；旧 Close native hit/trial 2 case FAIL。
- 同旧产物临时注入标准可见交集/ResizeObserver 方案后两端 2 case PASS，正常桌面所有 main 后代 rect 0 diff（Vue 先补正 welcome suppression 并按旧规则重算后作布局比较）。narrow popup.top=124，位于 main.top=120 之内，Close 两端 center hit/trial PASS。
- 两张 narrow 注入截图已逐张实际回读，只作因果证据。随后新编译正式两端 2/2 PASS（Vue 25.7s / React 18.9s，总 53.8s），使用 3250/3251 独立 mock context，任何原生滚动前的可见范围、Close 原生点击路径、Shift+Tab 及三终态原 survey 全部通过。

完整源 SHA、原始日志、JSON、旧失败 trace/PNG 在同目录 `summary.json` 与证据文件中。Linux Stage33 是此前精确 snapshot 的有效历史通过记录，不能外推此次生产变更。
