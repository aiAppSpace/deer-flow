/*
  【文件职责】     钉住 UI primitive 层的可观察语义：角色、aria 状态与键盘出口。
  【架构位置】     L2 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/**
  【边界与注意】   这里钉的是**可观察行为**，不是 DOM 结构，也不是 React 的 class。
                   真实焦点陷阱与 Escape 归 tests/e2e/ui-primitives-a11y.spec.ts：
                   happy-dom 不做布局，焦点行为在这里没有可信度。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

afterEach(() => {
  document.body.innerHTML = "";
});

function query<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function get<T extends HTMLElement>(selector: string): T {
  const element = query<T>(selector);
  expect(element, `${selector} is not in the document`).not.toBeNull();
  return element!;
}

async function mountPortal(render: () => unknown) {
  const wrapper = mount(defineComponent({ setup: () => render }), {
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe("Dialog", () => {
  it("is a labelled, described modal that reports open state", async () => {
    await mountPortal(() =>
      h(Dialog, { open: true }, () => [
        h(DialogContent, { closeLabel: "Close panel" }, () => [
          h(DialogTitle, () => "Panel title"),
          h(DialogDescription, () => "Panel description"),
        ]),
      ]),
    );

    const content = get('[role="dialog"]');
    expect(content.getAttribute("data-state")).toBe("open");
    // Reka 全库不写 aria-modal（Radix 写），所以由本层显式补上。
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(content.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Panel title");
    expect(
      document.getElementById(content.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("Panel description");
  });

  it("renders the close button by default and only drops it when asked", async () => {
    /*
      与 React 的 shadcn DialogContent 一致：showCloseButton 默认 true。
      名字仍然由调用方给（primitive 不持有产品文案），但**给不给**不再是调用方
      的自由——closeLabel 是必填 prop，忘了传是编译期错误，而不是一个静默发布的、
      关不掉的对话框。React 全仓只有 sidecar 删除中那一处显式关掉它。
    */
    const withClose = await mountPortal(() =>
      h(Dialog, { open: true }, () => [
        h(DialogContent, { closeLabel: "Close" }, () => [
          h(DialogTitle, () => "Default close"),
          h(DialogDescription, () => "Default close description"),
        ]),
      ]),
    );
    expect(get('[data-slot="dialog-close"]').getAttribute("aria-label")).toBe(
      "Close",
    );
    // 两个 dialog 都 portal 到 body，先卸载再挂下一个，否则查到的是上一个的按钮。
    withClose.unmount();
    await flushPromises();

    await mountPortal(() =>
      h(Dialog, { open: true }, () => [
        h(DialogContent, { closeLabel: "Close", showClose: false }, () => [
          h(DialogTitle, () => "No close"),
          h(DialogDescription, () => "No close description"),
        ]),
      ]),
    );
    expect(query('[data-slot="dialog-close"]')).toBeNull();
  });

  it("routes every close affordance through one update:open", async () => {
    const onOpen = vi.fn();
    await mountPortal(() =>
      h(Dialog, { open: true, "onUpdate:open": onOpen }, () => [
        h(DialogContent, { closeLabel: "Close panel" }, () => [
          h(DialogTitle, () => "Panel title"),
          h(DialogDescription, () => "Panel description"),
        ]),
      ]),
    );

    get('[data-slot="dialog-close"]').click();
    await flushPromises();
    expect(onOpen).toHaveBeenCalledWith(false);
  });
});

describe("AlertDialog", () => {
  it("uses the alertdialog role and offers a cancel plus an action", async () => {
    await mountPortal(() =>
      h(AlertDialog, { open: true }, () => [
        h(AlertDialogContent, null, () => [
          h(AlertDialogTitle, () => "Delete it?"),
          h(AlertDialogDescription, () => "This cannot be undone."),
          h(AlertDialogCancel, () => "Keep"),
          h(AlertDialogAction, { variant: "destructive" }, () => "Delete"),
        ]),
      ]),
    );

    const content = get('[role="alertdialog"]');
    expect(content.getAttribute("data-state")).toBe("open");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(query('[data-slot="alert-dialog-cancel"]')?.textContent).toBe(
      "Keep",
    );
    expect(query('[data-slot="alert-dialog-action"]')?.textContent).toBe(
      "Delete",
    );
  });
});

describe("Sheet", () => {
  it("keeps dialog semantics and records the edge it slides from", async () => {
    await mountPortal(() =>
      h(Sheet, { open: true }, () => [
        h(SheetContent, { side: "right", closeLabel: "Close" }, () => [
          h(SheetTitle, () => "Changes"),
          h(SheetDescription, () => "Two files changed"),
        ]),
      ]),
    );

    const content = get('[role="dialog"]');
    expect(content.dataset.slot).toBe("sheet-content");
    expect(content.dataset.side).toBe("right");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(content.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Changes");
  });
});

describe("DropdownMenu", () => {
  it("wires trigger and menu with haspopup/expanded and menuitem children", async () => {
    await mountPortal(() =>
      h(DropdownMenu, null, () => [
        h(DropdownMenuTrigger, null, () => [
          h("button", { type: "button", "aria-label": "More" }, "More"),
        ]),
        h(DropdownMenuContent, null, () => [
          h(DropdownMenuItem, null, () => "Rename"),
          h(DropdownMenuSeparator),
          h(DropdownMenuItem, { variant: "destructive" }, () => "Delete"),
        ]),
      ]),
    );

    const trigger = get<HTMLButtonElement>('[aria-label="More"]');
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(query('[role="menu"]')).toBeNull();

    trigger.click();
    await flushPromises();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Rename",
      "Delete",
    ]);
    expect(
      get<HTMLElement>('[data-slot="dropdown-menu-item"][data-variant]').dataset
        .variant,
    ).toBe("destructive");
  });

  /*
    `data-[inset]:pl-8` 这条类三份 dropdown primitive 都带着（基类逐字照上游），
    而本仓**没有任何出口能把 `data-inset` 打上去**——reka 没有 `inset` 这个概念，
    它是 shadcn 层的 prop（`ui/dropdown-menu.tsx:74/156/212`）。
    也就是说那条选择器在本仓是**死的**：写着、永远不成立（2026-09-12 第十五轮）。

    **判据落在渲染结果上，不落在源码文本上**：源码里有 `:data-inset` 不等于
    属性真的到了 DOM（`useForwardProps` 会把未知 prop 原样转发，
    `inset` 不从 `delegated` 里剥掉的话，reka 会额外打一个裸 `inset` 属性）。
    所以这一条同时钉「`data-inset` 在」与「裸 `inset` 不在」。

    上游两边都**零消费者**（没有调用点传 `inset`），所以这不是可见缺陷，
    是 primitive 的合同缺口：类串承诺的事，本仓做不到。
  */
  it("inset 打成 data-inset，而不是漏掉或漏成裸属性", async () => {
    await mountPortal(() =>
      h(DropdownMenu, null, () => [
        h(DropdownMenuTrigger, null, () => [
          h("button", { type: "button", "aria-label": "More" }, "More"),
        ]),
        h(DropdownMenuContent, null, () => [
          h(DropdownMenuLabel, { inset: true }, () => "Group"),
          h(DropdownMenuItem, { inset: true }, () => "Rename"),
          h(DropdownMenuItem, null, () => "Plain"),
        ]),
      ]),
    );
    get<HTMLButtonElement>('[aria-label="More"]').click();
    await flushPromises();

    const label = get<HTMLElement>('[data-slot="dropdown-menu-label"]');
    expect(label.getAttribute("data-inset")).toBe("true");
    expect(label.hasAttribute("inset")).toBe(false);

    const items = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-item"]',
      ),
    ];
    expect(items.map((item) => item.getAttribute("data-inset"))).toEqual([
      "true",
      null,
    ]);
    expect(items.some((item) => item.hasAttribute("inset"))).toBe(false);
  });

  it("把子菜单内容留在父菜单的子树里，不 portal 到 body 末尾", async () => {
    /*
      **上游 shadcn 的 `DropdownMenuContent` 包 Portal、`DropdownMenuSubContent`
      不包**；本仓此前照着前者也给后者包了一层，于是子菜单内容被挂到 body 末尾，
      可访问性树读起来变成「整个父菜单读完 → 页面末尾才是子菜单那两项」，
      **与打开它的触发器被拆开**。

      wave 95 给对照加了「公共节点相对顺序」这一档才量出来——aria 那一档按多重集比，
      顺序天然测不出来。这条用例把结论钉在本仓这一侧：**台账只钉「两边一不一致」，
      两边一起改成 portal 时它照样是 0 行**（线索 238）。
    */
    await mountPortal(() =>
      h(DropdownMenu, { open: true }, () => [
        h(DropdownMenuTrigger, null, () => [
          h("button", { type: "button", "aria-label": "More" }, "More"),
        ]),
        h(DropdownMenuContent, null, () => [
          h(DropdownMenuItem, null, () => "Rename"),
          h(DropdownMenuSub, { open: true }, () => [
            h(DropdownMenuSubTrigger, null, () => "Export"),
            h(DropdownMenuSubContent, null, () => [
              h(DropdownMenuItem, null, () => "Export as Markdown"),
            ]),
          ]),
        ]),
      ]),
    );

    const sub = get<HTMLElement>('[data-slot="dropdown-menu-sub-content"]');
    const parent = get<HTMLElement>('[data-slot="dropdown-menu-content"]');
    expect(parent.contains(sub)).toBe(true);
  });

  it("fires select for keyboard activation, not only for clicks", async () => {
    const selected = vi.fn();
    await mountPortal(() =>
      h(DropdownMenu, { open: true }, () => [
        h(DropdownMenuTrigger, null, () => [
          h("button", { type: "button", "aria-label": "More" }, "More"),
        ]),
        h(DropdownMenuContent, null, () => [
          h(DropdownMenuItem, { onSelect: selected }, () => "Rename"),
        ]),
      ]),
    );

    get('[role="menuitem"]').dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(selected).toHaveBeenCalledTimes(1);
  });
});

describe("Popover", () => {
  it("is a dialog that never claims to be modal", async () => {
    await mountPortal(() =>
      h(Popover, { open: true }, () => [
        h(PopoverAnchor, null, () => [h("span", "anchor")]),
        h(PopoverContent, { "aria-label": "Send suggestion?" }, () => [
          h("p", "Append or replace?"),
        ]),
      ]),
    );

    const content = get('[data-slot="popover-content"]');
    expect(content.getAttribute("role")).toBe("dialog");
    // 锚定浮层不锁背景，声明 aria-modal 就是对读屏器撒谎。
    expect(content.getAttribute("aria-modal")).toBeNull();
    expect(content.getAttribute("aria-label")).toBe("Send suggestion?");
  });
});

describe("Select", () => {
  it("is a combobox whose options carry aria-selected", async () => {
    const Host = defineComponent({
      setup() {
        const value = ref("basic");
        return () =>
          h(Select, { modelValue: value.value }, () => [
            h(SelectTrigger, { "aria-label": "Model" }, () => [h(SelectValue)]),
            h(SelectContent, null, () => [
              h(SelectItem, { value: "basic" }, () => "Basic"),
              h(SelectItem, { value: "reasoning" }, () => "Reasoning"),
            ]),
          ]);
      },
    });
    mount(Host, { attachTo: document.body });
    await flushPromises();

    const trigger = get('[aria-label="Model"]');
    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Basic");

    // Reka 的 combobox 用 pointerdown 打开，happy-dom 不派发指针事件，
    // 所以走它同样支持的键盘入口。
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await flushPromises();

    const options = [...document.querySelectorAll('[role="option"]')];
    expect(
      options.map((option) => option.getAttribute("aria-selected")),
    ).toEqual(["true", "false"]);
    // 原生 <option value> 暴露过的信息在自定义 listbox 上要留一条等价出口，
    // 否则「选中值为 X 的那一项」只能靠会被翻译的可见文案去猜。
    expect(options.map((option) => option.getAttribute("data-value"))).toEqual([
      "basic",
      "reasoning",
    ]);
  });
});

describe("Switch", () => {
  it("is a switch whose checked state follows the caller, not the click", async () => {
    const changed = vi.fn();
    await mountPortal(() =>
      h(Switch, {
        "aria-label": "review",
        modelValue: true,
        "onUpdate:modelValue": changed,
      }),
    );

    const control = get<HTMLButtonElement>('[role="switch"]');
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.getAttribute("aria-label")).toBe("review");

    control.click();
    await flushPromises();

    // 受控开关：点击只发出请求，视觉状态等服务端真相回来才动。
    expect(changed).toHaveBeenCalledWith(false);
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("exposes disabled through the native attribute", async () => {
    await mountPortal(() =>
      h(Switch, { "aria-label": "review", modelValue: false, disabled: true }),
    );
    expect(get<HTMLButtonElement>('[role="switch"]').disabled).toBe(true);
  });
});

describe("Tabs", () => {
  it("links each tab to its panel and moves selection with the arrow keys", async () => {
    const Host = defineComponent({
      setup() {
        const active = ref("public");
        return () =>
          h(
            Tabs,
            {
              modelValue: active.value,
              /*
                reka 的 Tabs 收的是 `StringOrNumber`，不是 string——写窄了这里
                编译不过，而运行时它真的可能给数字。
              */
              "onUpdate:modelValue": (next: string | number) =>
                (active.value = String(next)),
            },
            () => [
              h(TabsList, { "aria-label": "Skill source" }, () => [
                h(TabsTrigger, { value: "public" }, () => "Public"),
                h(TabsTrigger, { value: "custom" }, () => "Custom"),
              ]),
              h(TabsContent, { value: "public" }, () => "Public skills"),
              h(TabsContent, { value: "custom" }, () => "Custom skills"),
            ],
          );
      },
    });
    mount(Host, { attachTo: document.body });
    await flushPromises();

    const list = get('[role="tablist"]');
    expect(list.getAttribute("aria-label")).toBe("Skill source");
    const [first, second] = [
      ...document.querySelectorAll<HTMLElement>('[role="tab"]'),
    ];
    expect(first!.getAttribute("aria-selected")).toBe("true");
    expect(second!.getAttribute("aria-selected")).toBe("false");
    expect(
      document.getElementById(first!.getAttribute("aria-controls")!)
        ?.textContent,
    ).toBe("Public skills");

    first!.focus();
    first!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();
    expect(second!.getAttribute("aria-selected")).toBe("true");
  });
});
