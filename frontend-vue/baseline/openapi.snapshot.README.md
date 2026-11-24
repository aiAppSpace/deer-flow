# Gateway OpenAPI snapshot

`openapi.snapshot.json` 是当前核心 Gateway REST schema 的签入快照；`app/core/api/types.gen.ts` 由现有 openapi-typescript 生成器生成。

## 刷新与校验

在仓库根目录安装 backend 的锁定依赖后，在 `frontend-vue/` 运行：

```bash
make export-openapi
make gen-api-types
make export-openapi-check gen-api-types-check
```

`export-openapi-check` 从当前 backend 源码重新导出并比对快照；`gen-api-types-check` 验证快照生成的类型是否最新。两项合起来覆盖源码、快照和类型，单独生成类型不证明后端新鲜度。CI 的 real-backend job 必须执行两项。

## 隔离边界

`frontend-vue/scripts/export-openapi.py` 使用临时配置和 runtime home，固定 `plugins: []`，提供空的 MCP/skills 配置与空 dotenv 文件，并清除环境中继承的业务配置及凭据。它不读取或修改开发机的 `config.yaml`、`.env`、`extensions_config.json` 或持久数据。Webhook 路由通过 `DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1` 显式包含，docs 生成显式开启。

Gateway 在构造期加载 Python extensions，并在核心路由后挂载贡献路由。因此私有扩展不应进入核心快照；扩展 API 需要在受控扩展样例中另外验证。导出使用模块已有 `app`，不重复调用 `create_app()`，也不执行 lifespan 或对真实模型发请求。

输出按键排序，UTF-8 保存。临时文件路径不应进入 schema；连续隔离导出的 freshness 检查必须一致。新增条件路由时，应更新受控导出配置及对应契约验证。

## REST 之外

OpenAPI 不描述 SSE 动态 payload、run 生命周期、工具输出或实时浏览器帧；这些仍由 JSON contracts、协议单测和真实 Gateway E2E 验证。调用 `openapi()` 也不证明 Gateway lifespan、身份权限或数据库迁移已经通过。

当前受控核心快照：216 条路径 / 234 个 schema；其余 41 个 router 无条件挂载，条件/扩展 routers 按当前代码与受控 fixture 独立验证。
