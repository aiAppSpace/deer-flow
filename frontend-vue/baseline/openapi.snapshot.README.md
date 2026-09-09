# openapi.snapshot.json

Gateway 的 `/openapi.json`，**签入**而不是运行时抓取。
`app/core/api/types.gen.ts` 由 `make gen-api-types` 从这一份生成。

## 为什么签入

06 §M2 的原话是「`openapi-typescript` 从签入的 `openapi.snapshot.json` 生成」
＋「`make gen-api-types-check` 在 CI 临时生成并 diff」。CI 去 curl 一个跑着的
Gateway，门禁就会随后端部署状态变色——那是环境问题不是代码问题。签入之后
`gen-api-types-check` 检的是**幂等性**：同一份快照生成两次结果必须一致。
「和线上后端对不对得上」是另一个问题，由 real-backend job 与 raw trace 契约管。

## 刷新（一次显式动作，diff 要交 review）

```bash
cd backend && DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1 .venv/bin/python -c "
import json
from app.gateway.app import create_app
spec = create_app().openapi()
with open('../frontend-vue/baseline/openapi.snapshot.json','w') as f:
    json.dump(spec, f, indent=2, sort_keys=True, ensure_ascii=False)
    f.write('\n')
"
cd ../frontend-vue && make gen-api-types
```

`sort_keys=True` 不是洁癖：FastAPI 的输出顺序随路由注册顺序变，不排序的话
后端加一个不相干的 router 就能让整份快照 diff 成一片红。

## ⚠️ 环境变量会改变路由集

`DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1` 是**必需的**：不设它
`/api/webhooks/github` 不挂载，快照会少一条路径而且**没有任何报错**——
`create_app()` 只打一行 warning。当前快照就是带着这个变量抓的：
103 条路径 / 128 个 schema，不设变量是 102 条。

`app.py` 里唯一按条件 `include_router` 的就是这一个（其余 26 个 router 无条件挂载），
所以路由集只受这一个变量影响。**没有验证过**的是 `config.yaml` 的
memory / scheduler / tracing 开关会不会改变 schema 细节——它们看上去只影响启动期
行为，但没实测。刷新快照时如果 diff 出意料之外的东西，先怀疑这里。

## 不承担的东西

**SSE schema 不在这里（06 原话）。** 流式事件的形状由
`tests/fixtures/streams/` 的 raw trace 契约管。指望这份类型描述
`values` / `messages` 帧，拿到的会是一个空对象。
