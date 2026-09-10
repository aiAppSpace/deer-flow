/*
  【文件职责】     把时间戳转成与 React 逐字相同的 locale-aware 相对时间。
  【架构位置】     L3
  【主要导出】     formatTimeAgo
  【依赖关系】     date-fns
  【边界与注意】   与 React 的 `formatTimeAgo`（frontend/src/core/utils/datetime.ts）
                   同措辞，所以用的是**同一个库** date-fns 而不是
                   Intl.RelativeTimeFormat——后者输出「last year」，前者输出
                   「about 1 year ago」，两者都合法但不是同一句话，而这份对照的判据
                   就是可访问名逐字相同。想靠词典把 16 个 date-fns 分桶在两种语言上
                   重写一遍，等于把一份会随上游演进的语料抄进本仓。

                   **非法与空时间都返回 `"-"`**，与 React 一致（React 的注释写着
                   后端可能给出空的 lastUpdated，`new Date("")` 会让 date-fns 抛
                   Invalid time value）。「缺时间就整块不渲染」是**调用方**的判断，
                   不是这里的——会话列表要那个语义，用 threads/updated-time 的
                   `formatThreadUpdatedTime`。

                   **locale 必填，而上游是可选的。** 上游漏传不出错，因为它自己会
                   `getLocaleFromCookie() ?? detectLocale()` 兜底；本仓不能照抄那条兜底
                   ——`detectLocale()` 读 `navigator.language`，Nuxt 在服务端渲染时
                   读不到，同一次调用会在服务端和客户端给出两句不同的话，直接是
                   hydration 不一致。既然不能兜底，就不能让人漏传：把参数改成必填，
                   由类型系统守。想显式表示「就是没有 locale」，传 `undefined`。

                   实测：`ProjectThreadsSection.vue` 就漏传过，于是项目详情页的
                   相对时间在中文界面里显示成 "3 months ago"。对照台账在
                   `project-detail/desktop/light/zh-CN` 上抓到了它
                   （React "3 个月前" / Vue "3 months ago"）。
*/

import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

export function dateFnsLocale(locale: string | undefined) {
  return locale === "zh-CN" ? zhCN : enUS;
}

export function formatTimeAgo(
  value: string | number | Date | null | undefined,
  locale: string | undefined,
): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "-";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}
