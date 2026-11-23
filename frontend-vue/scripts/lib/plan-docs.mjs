/*
  【文件职责】     读取仓库根计划文档，并区分目录缺席与文档丢失。
  【架构位置】     构建脚本共享库
  【主要导出】     planDocsRoot · readPlanDoc
  【依赖关系】     node:fs · node:url
  【边界与注意】   计划目录不存在时返回 null，由调用方明确记录跳过；目录存在而目标文档缺失时抛错。
                   此工具只用于仓库门禁；独立 Vue 产品不依赖仓库根的计划文档。
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
