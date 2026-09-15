/*
  【文件职责】     从仓库根 `../docs/plans` 读一份计划文档，并把「计划目录整个不在
                   checkout 里」与「那份文档被挪走了」分成两种结果。
  【架构位置】     构建脚本共享库
  【主要导出】     planDocsRoot · readPlanDoc
  【依赖关系】     node:fs · node:url
  【边界与注意】   为什么需要它：这三份计划文档是**「当前事实」的终点**——两处历史
                   快照都自带「数字已过期」并把读者指向冷启动文档，于是全仓唯一
                   活着的台账读数只写在那里。而 `doc-facts` 的扫描面止于
                   `frontend-vue/`，**那个终点没有任何门禁**（第十九轮实测：
                   冷启动文档停在 138 场景-维度，实际 140；方向 A 那句停在
                   「129 个里 110 个 desktop」，实际 140 个里 118 个）。

                   形状照抄 `backend-source.mjs`，理由也一样（wave 107）：
                   `try { read(…) } catch { return }` 会把两件事压成一件——
                   文档改个名，`catch` 一样吃掉，用例照常绿，而它守的断言
                   从此不再被检查且没有任何征兆。这里分开：
                   计划目录不在 → 返回 null（调用方明确跳过）；
                   目录在、文档不在 → **抛错**，那是要红的。

                   **只读、只在门禁里用。** 产品代码不许 import 它——`frontend-vue/`
                   被单独移走之后仍须自足，而这些文档留在仓库根。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 仓库根下的 docs/plans/。frontend-vue/scripts/lib/ → ../../../ 就是仓库根。 */
export const planDocsRoot = fileURLToPath(
  new URL("../../../docs/plans/", import.meta.url),
);

/**
 * 读 `docs/plans/<name>`。
 *
 * @returns 文档文本；`../docs/plans` 整个不在 checkout 里时返回 `null`。
 * @throws  目录在、而这份文档不在——文档被挪了，调用方那条断言要跟进。
 */
export function readPlanDoc(name) {
  if (!existsSync(planDocsRoot)) return null;
  const path = `${planDocsRoot}${name}`;
  if (!existsSync(path)) {
    throw new Error(
      `../docs/plans 在 checkout 里，但 ${name} 不在——计划文档被挪了，` +
        `跟进引用它的那条断言（别把这里改成静默跳过）`,
    );
  }
  return readFileSync(path, "utf8");
}
