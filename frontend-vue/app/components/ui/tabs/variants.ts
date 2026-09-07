/*
  【文件职责】     Tabs 的 tablist 变体，逐字照上游 `ui/tabs.tsx:28` 的 `tabsListVariants`。
  【架构位置】     L2
  【主要导出】     tabsListVariants · TabsListVariants
  【依赖关系】     class-variance-authority
  【边界与注意】   **`line` 这一档不是装饰**：上游技能设置页用的就是它
                   （`skill-settings-page.tsx:87` 的 `<TabsList variant="line">`）。
                   wave 144 第一次给那一屏取样，量出本仓另写了一套带边框的胶囊
                   （tablist 少 `text-muted-foreground`、选中项多一块底色、字重 400 对 500、
                   高 34 对 29），**而此前没有任何一档看得见**。

                   变体靠 `group/tabs-list` 标记 + `TabsList` 上的 `data-variant`
                   联动，`TabsTrigger` 里那一串 `group-data-[variant=*]/tabs-list:`
                   全部依赖它——**三处缺一不可**，只搬其中一处不会有任何效果。
*/

import { cva, type VariantProps } from "class-variance-authority";

export const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type TabsListVariants = VariantProps<typeof tabsListVariants>;
