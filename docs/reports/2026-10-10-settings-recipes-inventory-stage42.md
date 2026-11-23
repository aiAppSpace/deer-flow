# Stage42 定时任务配方库存夹具修复

本轮只修改 `frontend-vue/tests/e2e-parity/settings-reflow.spec.ts`；不修改产品、共享场景、活动副本、Gateway、预算或任何回流阈值。正式 case 数不变。

## 根因

完整旧 cross-app 的第871/874例都在库存断言处失败：`schedule-recipes` 的按钮预期3、实际4。React `core/scheduled-tasks/recipes.ts` 与 Vue 同职责模块都定义四个业务配方，创建表单分别用 `RECIPES.map` / `v-for` 渲染，没有其它操作按钮混入容器。

固定业务库存是 `trending` / `news` / `issues` / `weekly`，英文可访问名称依次为 GitHub Trending daily、Daily tech news digest、GitHub Issue triage、Weekly report。前三项每日09:00，weekly每周一09:00；时区由应用浏览器检测。测试没有从实际 DOM 或生产数组动态生成 expected。

## 最小修复与不变合同

精确库存3改成4，并逐个要求四个固定名称各有一个按钮、桌面高度仍精确32px。库存块之前与之后的源码分别逐字相同，原360px/root32、页面零横溢出、非刻意横滚为空、lost controls为空、不可达裁切为空及API全被本场景mock接住的断言全部保留；其它两个 settings 场景不变。

生产源码没有改动，因此下面实际旧编译预览验证的是测试修复，不能冒称最终当前产品全量验收。

## 实际结果

既有Vue3270/React3271服务，每个case全新独立mock context；不启动服务或构建，不写Gateway。保持正式180s case/10s expect预算及原trace/screenshot/video策略。

| 执行                          | 原生浏览器结果                                       | 直接退出 |
| ----------------------------- | ---------------------------------------------------- | -------: |
| 原库存3断言                   | 两端2FAIL：expected3 / actual4                       |        1 |
| 修复后的原正式scheduled两例   | 两端2PASS，0skip/flake，原回流及API=[]全部通过       |        0 |
| 删除Weekly按钮负控            | 两端2FAIL：expected4 / actual3；API=[]               |        1 |
| 增加重复按钮负控              | 两端2FAIL：expected4 / actual5；API=[]               |        1 |
| 四按钮保留但Weekly改名负控    | 两端2FAIL：Weekly report expected1 / actual0；API=[] |        1 |
| 相关格式、lint、tests vue-tsc | 全部PASS                                             |        0 |

六个负控以临时context内DOM变异执行同一正式断言，未加入正式case清单，未改应用源码。JSON中的失败原文及每个负控 `unmatched-api` 附件可复核，不能把预期负控FAIL写成产品FAIL或删掉原完整FAIL。

初次沙箱启动受macOS MachPort权限拒绝，保全 `sandbox-launch-*`；scratch CJS/ESM配置错误也保全 `unresolved-scratch-*` / `cjs-scratch-*` 日志。这些不是库存因果证据；之后用真实同项目ESM模式及正常浏览器权限完成上述实际RED/GREEN，没有放宽断言。

## 冻结与证据

2026-10-10 08:49:37 CST，单spec SHA256 `34e42f32de828a31e1da476d59e380d68dc5b62bdf71071c944cbe953966e34b`。

证据目录：[settings-recipes-inventory-stage42](evidence/settings-recipes-inventory-stage42/)。精确冻结及断言保留：[source-freeze.json](evidence/settings-recipes-inventory-stage42/source-freeze.json)。实际原生原/新结果：[formal-before.json](evidence/settings-recipes-inventory-stage42/formal-before.json)、[formal-after.json](evidence/settings-recipes-inventory-stage42/formal-after.json)。三个负控各自有JSON、完整log和失败trace；原完整运行两项失败上下文/截图/trace在 `original-full-failures/` 原样保留。
