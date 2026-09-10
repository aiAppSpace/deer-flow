/*
  【文件职责】     侧栏菜单键的 cva 变体表。
  【架构位置】     L2 primitive 样式契约
  【主要导出】     sidebarMenuButtonVariants
  【依赖关系】     class-variance-authority
  【边界与注意】   **基类整串照抄上游 `ui/sidebar.tsx` 的 `sidebarMenuButtonVariants`**，
                   一个 token 都不要「顺手优化」：`peer/menu-button` 被 menu-action 的
                   `peer-data-[size=…]` 选中，`group-has-data-[sidebar=menu-action]/menu-item:pr-8`
                   负责给动作键让位，`data-[active=true]:*` 是高亮态——
                   本仓的 primitive 基类比对守卫（tests/guards）逐字比这一串。
*/
import { cva, type VariantProps } from "class-variance-authority";

export const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type SidebarMenuButtonVariants = VariantProps<
  typeof sidebarMenuButtonVariants
>;
