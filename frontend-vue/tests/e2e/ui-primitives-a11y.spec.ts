/*
  【文件职责】     在真实浏览器里钉住 UI primitive 层的焦点、键盘与 aria 合同。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     Playwright scenarios
  【依赖关系】     tests/e2e/utils/mock-api · app/components/ui/**
  【边界与注意】   这里断言的是**可观察行为**——语义角色、focus order、Escape、aria 状态——
                   而不是 DOM 结构或 class。真实焦点必须在浏览器里验证：happy-dom
                   不做布局，对隐藏元素调 focus() 静默无效，单测看不出来。
                   范式沿用 sidebar-ime-a11y.spec.ts。
*/

import { expect, test, type Page } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const SKILL = {
  name: "review",
  description: "Review",
  category: "public",
  license: null,
  enabled: true,
  editable: false,
};

async function openWorkspace(
  page: Page,
  path = "/workspace/chats/new",
  afterMock?: () => Promise<void>,
) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Primitive contract",
        messages: [
          { type: "human", id: "h-1", content: "Ask something" },
          { type: "ai", id: "a-1", content: "An answer" },
        ],
      },
    ],
  });
  await afterMock?.();
  await page.goto(path);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
}

test("settings dialog traps focus, closes on Escape, and returns focus to its trigger", async ({
  page,
}) => {
  await openWorkspace(page);

  const trigger = page.getByTestId("workspace-nav-menu-trigger");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("data-state", "open");

  // 焦点必须真的落在对话框里的可见元素上，而不是留在背景。
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // Tab 循环不出对话框：从最后一个可聚焦元素继续 Tab 仍然在里面。
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("settings-and-more menu is a real menu: arrow keys move, Escape restores focus", async ({
  page,
}) => {
  await openWorkspace(page);

  // 菜单打开时整页背景（含触发器）被标记 aria-hidden——这是模态菜单该有的样子，
  // 但也意味着 getByRole 在打开期间找不到触发器，所以这里按 testid 定位。
  // 收起态下这颗按钮**没有**可访问名（React 的 WorkspaceNavMenu 只给它一个图标），
  // 按名字定位会随侧栏状态时有时无。
  const trigger = page.getByTestId("workspace-nav-menu-trigger");
  await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  // 菜单项之间用方向键移动（一排普通 button 做不到这件事）。
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "DeerFlow's official website" }),
  ).toBeFocused();

  /*
    **roving tabindex：菜单里恰好有一项在 tab 序里，就是当前有焦点的那一项。**

    这是 ARIA APG 的 menu 模式明写的技术，上游的菜单项走 Radix 的
    `RovingFocusGroup.Item`（`isCurrentTabStop ? 0 : -1`）。reka 把菜单项的
    `tabindex` 写死成 `-1`（`Menu/MenuItemImpl.js:64`），于是本仓的菜单打开时
    **一个 tab 停靠点都没有**——台账 `thread-history` 上那条
    `tabbablesOnlyReact: div(menuitem)` 就是它。补法与判词写在
    `app/components/ui/dropdown-menu/use-menu-tab-stop.ts` 的文件头。
  */
  const tabbableItems = menu.locator('[role="menuitem"][tabindex="0"]');
  await expect(tabbableItems).toHaveCount(1);
  await expect(tabbableItems).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("command palette is a combobox: first result is pre-selected and Escape restores focus", async ({
  page,
}) => {
  await openWorkspace(page);

  const composer = page.getByPlaceholder(/how can i assist you/i);
  await composer.click();
  await page.keyboard.press("Meta+k");

  /*
    role 是 combobox 不是 textbox：ui/command 的输入框与 cmdk 同构
    （role="combobox" + aria-expanded + aria-autocomplete="list"），用例名一直
    这么写，定位器以前落后于它。
  */
  const search = page.getByRole("combobox", { name: "Search actions" });
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await expect(search).toHaveAttribute("aria-autocomplete", "list");

  const options = page.getByRole("option");
  await expect(options).toHaveCount(3);
  const first = options.first();
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id"))!,
  );

  // 焦点留在输入框，当前项通过 aria-activedescendant 宣告。
  await page.keyboard.press("ArrowDown");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await options.nth(1).getAttribute("id"))!,
  );

  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(composer).toBeFocused();
});

test("thread rename is a labelled modal that keeps a failed write visible", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);

  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: "Primitive contract" })
    .first();
  await row.hover();
  await row.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  /*
    对话框叫 "Rename"，不是 "Rename chat"：React 的 DialogTitle 就是
    `t.common.rename`。输入框也只有 placeholder，没有 aria-label——补一个名字是更好
    的可访问性，但那样两个应用的这个对话框叫两个名字。
  */
  const dialog = page.getByRole("dialog", { name: "Rename" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.locator(":focus")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("skill source is a tablist and the enable control is a switch", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await page.route(/\/api\/skills$/, (route) =>
    route.fulfill({ json: { skills: [SKILL] } }),
  );
  await openSettingsDialog(page, "/workspace/chats/new?settings=skills");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");

  // tablist 里方向键换 tab，Tab 键整体进出——这正是它和一排 button 的区别。
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  const toggle = page.getByRole("switch", { name: "review" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeChecked();
});

test("composer model selector is a searchable dialog whose current model is announced", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/chats/new", async () => {
    // 共享 mock 默认返回空 models，选择器根本不渲染；这条用例需要真的有模型。
    await page.route("**/api/models", (route) =>
      route.fulfill({
        json: {
          models: [
            {
              id: "basic",
              name: "basic",
              model: "Basic",
              display_name: "Basic Model",
              supports_thinking: false,
              supports_reasoning_effort: false,
            },
            {
              id: "reasoning",
              name: "reasoning",
              model: "Reasoning",
              display_name: "Reasoning Model",
              supports_thinking: true,
              supports_reasoning_effort: true,
            },
          ],
          token_usage: { enabled: false },
        },
      }),
    );
  });

  /*
    上游 ModelSelector 就是 Dialog + Command（ai-elements/model-selector.tsx），
    不是下拉菜单：一个带搜索框的命令面板。这条用例过去断言 aria-haspopup=menu，
    锁的是本仓自己长出来的 DropdownMenu 形状。
  */
  const trigger = page.getByTestId("composer-model-selector");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // sr-only 的标题给对话框一个可访问名，上游默认文案是写死的 "Model Selector"。
  await expect(dialog).toHaveAccessibleName("Model Selector");

  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toContainText("Basic Model");
  await expect(options.nth(1)).toContainText("Reasoning Model");

  // 搜索框是这个形状的全部意义：`inputBox.searchModels` 靠它才有消费者。
  const search = dialog.getByPlaceholder("Search models...");
  await expect(search).toBeFocused();
  await search.fill("reasoning");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Reasoning Model");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("assistant actions keep their accessible name and gain a hover tooltip", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);

  const branch = page
    .getByTestId("assistant-turn-actions")
    .getByRole("button", { name: /branch/i })
    .first();
  await expect(branch).toBeVisible();

  // tooltip 只是补充：可访问名字仍然来自按钮自己的 aria-label，
  // 否则关掉 tooltip 的读屏器就读不到这个按钮是干什么的。
  const label = await branch.getAttribute("aria-label");
  expect(label?.trim()).toBeTruthy();

  const tooltip = page.locator('[data-slot="tooltip-content"]');
  /*
    **一次 hover 赌不到这颗 tooltip**（wave 113）。Reka 的 tooltip 是延时开的
    ——探针实测安静时也要**约 600ms 的持续悬停**才出现（`delayDuration`）。
    在这 600ms 里消息列表只要重渲一次，旧 trigger 卸载、计时器跟着没，
    而鼠标**没有再动**，新 trigger 收不到 `pointerenter`：结果是
    `element(s) not found` 一直等到超时，**而 hover 那一步本身没有报错**。
    这解释了为什么它对负载敏感（重渲落在 hover 之后），也解释了为什么
    wave 109 用 CPU 节流复现不了（整条用例一起变慢，重渲又落回 hover 之前）。

    实测频率：跑完四个套件之后立刻 `--repeat-each=10` 是 **3 失败 / 7 通过**；
    机器安静时 10/10。`toPass` 每一轮重新 hover 一次，把这个竞态消掉——
    **断言本身一个字没松**：tooltip 仍然必须出现、仍然必须念出同一条 label。
  */
  await expect(async () => {
    await branch.hover();
    await expect(tooltip.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(tooltip.first()).toContainText(label!);
  /*
    读屏器读到的那份是内嵌的 visually-hidden `role="tooltip"`：视觉层本身不承担语义。
    它被 1px clip 起来，所以按属性定位而不是按 role。

    **必须有至少一颗不带 `aria-hidden` 的**（wave 215）：reka 自己那颗走的是
    `VisuallyHidden` 的默认 `feature="focusable"`，那一档会写上 `aria-hidden="true"`
    ——节点在、文本也对，却根本不在可访问性树里，读屏器按元素浏览时找不到这条提示。
    上游 Radix 那颗没有 `aria-hidden`，于是台账 `branch-thread#turn-actions` 上
    报出 `ariaOnlyReact: - tooltip "Branch conversation"`。`TooltipContent.vue`
    因此自己补了一颗可达的，判词写在那份文件的头注释。
  */
  await expect(tooltip.locator('[role="tooltip"]').first()).toHaveText(label!);
  const reachableTooltip = tooltip.locator(
    '[role="tooltip"]:not([aria-hidden="true"])',
  );
  await expect(reachableTooltip.first()).toHaveText(label!);
  await expect(tooltip.first()).toMatchAriaSnapshot(`
    - text: ${label}
    - tooltip "${label}"
  `);

  // **wave 62 把这一条反过来了，两边同改。** 原来钉的是「复制那颗是这一排里唯一
  // 没有可访问名的，因为 React 的 CopyButton 就没有」——上游确实没有，但那是一处
  // 缺陷：tooltip 在 Radix / Reka 里挂的都是 aria-describedby，不是可访问名，
  // 读屏器只念得出一颗「按钮」。React 侧已在
  // frontend/src/components/workspace/copy-button.tsx 补上同一句。
  //
  // 名字与 tooltip 现在念的是**同一条词条**（clipboard.copyToClipboard）。
  // 此前本仓的 tooltip 用的是自造的 messages.actions.copyResponse（"Copy response"），
  // 上游根本没有这条——那处分叉一直藏在 tooltip 里、台账看不见，
  // 直到 wave 62 把它顶到可访问名上才被对照门禁抓住。
  const copy = page
    .getByTestId("assistant-turn-actions")
    .getByRole("button")
    .first();
  await expect(copy).toBeVisible();
  const copyLabel = await copy.getAttribute("aria-label");
  expect(copyLabel?.trim()).toBeTruthy();
  await expect(copy).toHaveAccessibleName(copyLabel!);

  await copy.hover();
  await expect(tooltip.first()).toContainText(copyLabel!);
});
