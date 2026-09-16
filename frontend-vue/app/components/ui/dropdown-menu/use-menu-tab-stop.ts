/*
  【文件职责】     给菜单项补上 roving tabindex：有焦点的那一项是菜单里唯一的 tab 停靠点。
  【架构位置】     L2 primitive 内部
  【主要导出】     vMenuTabStop（自定义指令）
  【依赖关系】     DropdownMenuItem / DropdownMenuRadioItem / DropdownMenuSubTrigger
  【边界与注意】   ① **reka 把菜单项的 `tabindex` 写死成 `-1`**
                   （`reka-ui/dist/Menu/MenuItemImpl.js:64`），于是菜单打开时整个菜单
                   **一个 tab 停靠点都没有**。上游 Radix 的菜单项走
                   `RovingFocusGroup.Item`，当前项是 `tabIndex: 0`
                   （`@radix-ui/react-roving-focus` 的 `isCurrentTabStop ? 0 : -1`），
                   这也是 ARIA APG 的 menu 模式明写的技术：菜单里恰好有一项在 tab 序里。
                   对照台账 `thread-history` 两个维度上那条
                   `tabbablesOnlyReact: div(menuitem)` 就是它——两边 26 项 tabbable
                   逐项相同，只差菜单里的这一个。

                   ② **为什么是指令而不是 `:tabindex` + `@focus`。**
                   先写的是响应式那一版，实测**子菜单打不开**：
                   `tests/unit/workspace-shell/thread-actions-menu.dom.test.ts` 那条
                   导出用例当场红（`thread-export-markdown` 渲染不出来）。
                   二分到是 `@focus` 那一半——reka 的 `MenuSubTrigger.onClick` 里有一句
                   `event.currentTarget?.focus()`，随后才 `onOpenChange(true)`；
                   我们的处理器在那一句里同步改了一个 prop，触发的重渲染把后半段打断了。
                   **改属性不需要经过渲染**：指令直接 `addEventListener` + `setAttribute`，
                   与 Radix 自己的做法同形，也不再干扰库的事件时序。

                   ③ **不会被 reka 的下一次渲染覆盖回 `-1`。** Vue patch 比的是新旧
                   vnode 的 props，reka 那一侧恒为 `"-1"`、前后相同，于是根本不写 DOM；
                   我们直接改在 DOM 上的值因此留得住。

                   ④ **按焦点切，不按「记住最后一项」。** Radix 的 `currentTabStopId`
                   在焦点离开菜单之后仍然记着那一项；这里做不到，那需要 content 一级的
                   共享状态，而 reka 的高亮态在它自己的 context 里。够得着的到此为止。
*/

import type { Directive } from "vue";

const CLEANUP = Symbol("menu-tab-stop-cleanup");

type Anchored = HTMLElement & { [CLEANUP]?: () => void };

export const vMenuTabStop: Directive<Anchored> = {
  mounted(el) {
    const focus = () => el.setAttribute("tabindex", "0");
    const blur = () => el.setAttribute("tabindex", "-1");
    el.addEventListener("focus", focus);
    el.addEventListener("blur", blur);
    if (document.activeElement === el) focus();
    el[CLEANUP] = () => {
      el.removeEventListener("focus", focus);
      el.removeEventListener("blur", blur);
    };
  },
  unmounted(el) {
    el[CLEANUP]?.();
    el[CLEANUP] = undefined;
  },
};
