/*
  【文件职责】     扩展目录的本地化说明：按语言挑出扩展包自带说明里的一份。
  【架构位置】     L2（core，纯函数）
  【主要导出】     localizeDocumentation · bundledCopy
  【依赖关系】     ./bundled-documentation.json（scripts/gen-extension-documentation.mjs 生成）
  【边界与注意】   与 React `core/extensions/documentation.ts` 同名同行为：先精确匹配
                   语言标签，再按主语言匹配，再退回 en-US，最后取第一份。
                   运行时扩展上报的说明（contribution.documentation）尚未接入。
*/

// Playwright loads the locales through Node's native ESM, which requires the
// JSON import attribute.
import bundled from "./bundled-documentation.json" with { type: "json" };

type LocalizedDocumentation = {
  title: string;
  description: string;
  usage: { title: string; description: string }[];
  requirements?: string[];
};

export function localizeDocumentation(
  doc: { locales: Record<string, LocalizedDocumentation> },
  locale: string,
) {
  const entries = Object.entries(doc.locales);
  const target = locale.toLowerCase();
  const match = (tag: string) =>
    entries.find(([key]) => key.toLowerCase() === tag)?.[1] ??
    entries.find(
      ([key]) => key.toLowerCase().split("-")[0] === tag.split("-")[0],
    )?.[1];
  const copy = match(target) ?? match("en-us") ?? entries[0]![1];
  return {
    ...copy,
    gettingStarted: copy.usage,
    requirements: copy.requirements,
  };
}

export function bundledCopy(name: keyof typeof bundled, locale: string) {
  return localizeDocumentation(bundled[name], locale);
}
