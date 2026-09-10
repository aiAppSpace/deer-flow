/*
  【文件职责】     Item 一族的 class 变体。
  【架构位置】     L2
  【主要导出】     itemVariants · itemMediaVariants · 两个变体类型
  【依赖关系】     class-variance-authority
  【边界与注意】   逐字搬自上游 `components/ui/item.tsx`。**class 串不要"整理"**：
                   `group/item` 与 `group-has-[[data-slot=item-description]]/item:`
                   是一对的——媒体列靠后者在有描述时上对齐，改掉任一半都会静默失效。
*/

import { cva, type VariantProps } from "class-variance-authority";

export const itemVariants = cva(
  "group/item flex items-center border border-transparent text-sm rounded-md transition-colors [a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "p-4 gap-4 ",
        sm: "py-3 px-4 gap-2.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none group-has-[[data-slot=item-description]]/item:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type ItemVariants = VariantProps<typeof itemVariants>;
export type ItemMediaVariants = VariantProps<typeof itemMediaVariants>;
