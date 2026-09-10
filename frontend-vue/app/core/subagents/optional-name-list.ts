/*
  【文件职责】     「全部 / 一个都不给 / 指定几个」这个三态，在表单与 API 之间的往返。
  【架构位置】     L3 纯函数
  【主要导出】     OptionalNameListMode · optionalNameListToDraft ·
                   optionalNameListFromDraft · allowedSubagentsToMode ·
                   modeToAllowedSubagents · positiveInteger ·
                   isValidManagedSubagentName
  【依赖关系】     无
  【边界与注意】   API 用 `null` / `[]` / `[...]` 表达三态，而表单里 `null` 和 `[]` 都
                   长成「输入框是空的」。**只靠输入框内容读不出用户的意思**，所以
                   模式是一个显式的下拉，两者一起才还原得出那三个值。

                   `selected` 模式下要去重：同一个工具名写两遍，后端不会报错，
                   但配置里会多一条，下次打开表单看到的和存进去的不一样。

                   名字只收 `[A-Za-z0-9-]`：它要进 URL 路径段。放宽这条并不会
                   在前端出错，而是让 DELETE/PUT 打到一个转义过的怪路径上。
*/

export type OptionalNameListMode = "all" | "none" | "selected";

export function optionalNameListToDraft(value: string[] | null): {
  mode: OptionalNameListMode;
  text: string;
} {
  if (value == null) return { mode: "all", text: "" };
  if (value.length === 0) return { mode: "none", text: "" };
  return { mode: "selected", text: value.join(", ") };
}

export function optionalNameListFromDraft(
  mode: OptionalNameListMode,
  text: string,
): string[] | null {
  if (mode === "all") return null;
  if (mode === "none") return [];
  const values = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

/** 表单里的数字框给的是字符串；只有正整数才是合法的轮数/超时。 */
export function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isValidManagedSubagentName(value: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(value.trim());
}

/*
  自定义 agent 的 `allowed_subagents` 用的是**同一个三态**（null / [] / [...]），
  只是载荷是一组勾选出来的名字而不是一行逗号串。所以这两个函数与上面那对同源，
  单独写出来是因为形状不同——共用一个函数会逼调用方在数组和字符串之间来回转，
  而那正是三态最容易被拍平成两态的地方。
*/

export function allowedSubagentsToMode(
  value: string[] | null | undefined,
): OptionalNameListMode {
  if (value == null) return "all";
  return value.length === 0 ? "none" : "selected";
}

export function modeToAllowedSubagents(
  mode: OptionalNameListMode,
  selectedNames: string[],
): string[] | null {
  if (mode === "all") return null;
  if (mode === "none") return [];
  return selectedNames;
}
