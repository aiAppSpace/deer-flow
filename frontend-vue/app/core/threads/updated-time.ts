/*
  【文件职责】     将 Gateway updated_at 转成 locale-aware 相对时间。
  【架构位置】     L3 thread presentation
  【主要导出】     formatThreadUpdatedTime
  【依赖关系】     core/utils/datetime
  【边界与注意】   措辞由 core/utils/datetime 的 formatTimeAgo 负责，与 React 的同名函数
                   逐字一致（为什么必须用 date-fns 而不是 Intl.RelativeTimeFormat，
                   理由写在那个文件头里）。这一层只多加一条**会话列表专有**的语义：
                   缺失时间返回 null，调用方据此决定渲染不渲染这一行——React 那边是
                   `thread.updated_at && (...)`，没有时间就整块不出现。
                   非法时间仍然返回 "-"，与 React 一致。
*/
import { formatTimeAgo } from "@/core/utils/datetime";

export function formatThreadUpdatedTime(
  value: string | number | Date | null | undefined,
  locale: string | undefined,
) {
  if (value === null || value === undefined || value === "") return null;
  return formatTimeAgo(value, locale);
}
