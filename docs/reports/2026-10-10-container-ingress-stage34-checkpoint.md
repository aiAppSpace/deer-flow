# Stage34 容器构建检查点

2026-10-10：当前仅 Vue canonical Docker build 已直接 exit 0。React build、三条 Compose 入口探针、正式 container-smoke 与 SIGTERM 复验均 **UNRUN**。新的 Vue 中文重排诊断尚未确认是否需要追加生产修改，因此本记录不是最终入口验收。

- Vue 899 个选定生产输入 SHA256：`78064b3864362bceb411486d677c0fa918a16a5c042d8325748b68db85ab0744`。
- 镜像：`deerflow-ingress-vue:stage34-final`；实际 ID：`sha256:f8e5c275432251c909b1c57a4320e2314309ca69ece92858f668bbdf32569ab0`。tag 中的 final 是构建标识，不表示本轮验收完成；如源码再变，不覆盖该检查点镜像。
- 构建前后当前源码、隔离副本与记录指纹逐文件一致，Dockerignore 指纹一致。
- React 当前准备输入为 812 个文件，SHA256 `744c5d539c4e5c956b464108d36405074f26f7029374fada55a71c68dffa7c05`；其中既有 `pnpm-workspace.yaml` 本次纳入正式库存，当前和旧副本原本字节相同。
- Gateway 894 个生产文件及四个实际挂载执行输入与既有副本零差异；继续复用原精确镜像，未重建。
- 专属 Compose runtime/SQL 与现有运行 Stage33 服务尚未变更。

精确证据：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage34/`；完整逐文件指纹：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-container-stage34-source-fingerprint.json`。Copy 控件新编译后的正式浏览器两项仍待统一新 cross-app 服务 ready，不能将标准 CSS 因果注入实验当作生产验收通过。
