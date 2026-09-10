/*
  【文件职责】     独立产物视窗的路由地址。
  【架构位置】     L3 常量
  【主要导出】     ARTIFACT_VIEWER_ROUTE
  【依赖关系】     无
  【边界与注意】   单独一个文件，是为了让**全局路由 middleware** 能静态引用这个地址
                   而不把整个 viewer 模块（连同 policy/display/showcase）拖进每一条
                   路由的关键路径——`middleware/auth.global.ts` 顶部那段注释讲的就是
                   这件事。判定逻辑仍在 `./viewer.ts`，由 middleware 动态 import。
*/

/** 用应用自己的渲染器展示一件已存储产物的独立路由。 */
export const ARTIFACT_VIEWER_ROUTE = "/artifacts/view";
