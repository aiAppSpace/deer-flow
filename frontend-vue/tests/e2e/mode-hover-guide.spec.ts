/*
  【文件职责】     证明主 composer 与 sidecar 的模式触发器都带一层可用的模式说明浮层。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     无；Playwright cases
  【依赖关系】     ModeHoverGuide · ui/tooltip · ChatComposer · SidecarPanel
  【边界与注意】   两个断言点都不能省：浮层本身要出现，**并且**它包住的下拉触发器
                   仍然能开菜单——tooltip 与 dropdown 都用 as-child 落在同一个
                   button 上，接错的表现正是「说明有了，菜单点不开了」。
                   Reka 把 role="tooltip" 放在一个 visually-hidden 的节点上，
                   可见层是 aria-hidden 的，所以按 data-slot 定位而不是按 role。
*/

import { expect, test, type Page } from "@playwright/test";

import {
  mockLangGraphAPI,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_THREAD_ID,
} from "./utils/mock-api";

const THINKING_MODELS = {
  models: [
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
};

const guide = (page: Page) => page.getByTestId("mode-hover-guide");

/*
  Reka 在浮层里同时渲染可见文本和一份 aria-hidden 的读屏器副本，所以整个容器的
  textContent 是**两遍**同样的话。取那份带 role="tooltip" 的节点才是一句完整说明。
*/
async function guideText(page: Page) {
  const spoken = guide(page).locator('[role="tooltip"]').first();
  await expect(spoken).toBeVisible();
  const text = (await spoken.textContent())?.trim() ?? "";
  await expect(guide(page)).toContainText(text);
  return text;
}

const MAIN_MESSAGES = [
  {
    type: "human",
    id: "parent-human-1",
    content: [{ type: "text", text: "Plan the feature." }],
  },
  { type: "ai", id: "parent-ai-1", content: "Here is the plan." },
];

/** 不支持 thinking 的模型：档位列表与强度控件都应该收敛到 flash 那一支。 */
const FLASH_ONLY_MODELS = {
  models: [
    {
      id: "plain",
      name: "plain",
      model: "Plain",
      display_name: "Plain Model",
    },
  ],
  token_usage: { enabled: false },
};

async function openWorkspace(
  page: Page,
  path: string,
  options: { withSidecar?: boolean; thinking?: boolean } = {},
) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Mode guide",
        messages: MAIN_MESSAGES,
      },
      ...(options.withSidecar
        ? [
            {
              thread_id: MOCK_SIDECAR_THREAD_ID,
              title: "Existing side chat",
              updated_at: "2025-01-01T00:00:01Z",
              metadata: {
                deerflow_sidecar: true,
                parent_thread_id: MOCK_THREAD_ID,
                sidecar_context_type: "referenced_message",
                sidecar_context_label: "Selected assistant text",
                sidecar_context_count: 1,
                referenced_message_id: "parent-ai-1",
                referenced_message_ids: ["parent-ai-1"],
                referenced_message_role: "assistant",
                referenced_message_roles: ["assistant"],
              },
              messages: [
                {
                  type: "human",
                  id: "side-human-1",
                  content: [{ type: "text", text: "Follow-up" }],
                },
                { type: "ai", id: "side-ai-1", content: "Side answer." },
              ],
            },
          ]
        : []),
    ],
  });
  await page.route("**/api/models", (route) =>
    route.fulfill({
      json: options.thinking === false ? FLASH_ONLY_MODELS : THINKING_MODELS,
    }),
  );
  await page.goto(path);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
}

test("lets the reasoning effort be overridden independently of the mode", async ({
  page,
}) => {
  // mode 只给出一个起点，effort 是它旁边的第二个选择器。没有这个控件时 pro 模式
  // 的用户永远只能跑 medium——四档强度的文案在词典里翻译好了，界面上没有出口。
  await openWorkspace(page, "/workspace/chats/new");

  const modeTrigger = page.getByTestId("composer-mode-trigger");
  await modeTrigger.click();
  await page.getByRole("menuitemradio").nth(2).click(); // pro

  const effortTrigger = page.getByTestId("composer-reasoning-effort-trigger");
  // 用户没显式选过时落在 medium，与 React 的 `medium || !reasoning_effort` 同一分支。
  await expect(effortTrigger).toHaveText(/Reasoning Effort:\s*Medium/);

  await effortTrigger.click();
  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(4);
  await expect(options.first()).toContainText("Retrieval + Direct Output");
  await options.last().click();
  await expect(effortTrigger).toHaveText(/Reasoning Effort:\s*High/);
});

/*
  **触发器被 CSS 隐藏时，它那块菜单必须跟着关。**

  那颗键的类是 `hidden gap-1! px-2! sm:inline-flex`——`sm`（40rem）以下它的盒子
  塌成 0×0，而 popper 会**老老实实锚在那个 0×0 上**。2026-09-18 第三十九轮实测
  （700px 开菜单，缩到 600px 跨过 `sm`）：

      触发器  [180, 739, 162]  →  [0, 0, 0]
      菜单    [180, 409, 280]  →  [0, 4, 280]，aria-expanded 一直是 "true"

  也就是一块悬在左上角、离输入区十万八千里的菜单，再 resize 也不纠正。
  **两个应用当时一模一样**，按两边同改修（上游是 input-box.tsx 的
  `REASONING_TRIGGER_VISIBLE_QUERY`）。

  ⚠ 这条账差点被判成本仓单边：从 1280px 缩下来时上游先跨 `md`、把输入区整块重挂，
  菜单跟着没了，看起来上游是对的。**从 700px 起步才看得见共有的那一半。**
  所以这条用例的起点宽度是 700，不是 1280——改它之前先读这一段。

  断言挑 `aria-expanded` 与菜单节点数，不挑几何：几何是症状，状态才是判据。
*/
test("closes the reasoning effort menu when its trigger stops being rendered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await openWorkspace(page, "/workspace/chats/new");

  const effortTrigger = page.getByTestId("composer-reasoning-effort-trigger");
  await expect(effortTrigger).toBeVisible();
  await effortTrigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(effortTrigger).toHaveAttribute("aria-expanded", "true");

  // 跨过 `sm`：那颗键从这里开始是 `hidden`。
  await page.setViewportSize({ width: 600, height: 800 });

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(effortTrigger).toHaveAttribute("aria-expanded", "false");
});

test("hides the reasoning effort control in flash mode", async ({ page }) => {
  // flash 的语义就是不推理，给它一个强度选择器没有意义（与 React 同条件）。
  await openWorkspace(page, "/workspace/chats/new");

  // 显式切到 flash，而不是假设它是默认值——默认模式由本地设置决定，会漂。
  await page.getByTestId("composer-mode-trigger").click();
  await page.getByRole("menuitemradio").first().click();
  await expect(page.getByTestId("composer-mode-trigger")).toHaveText("Flash");
  await expect(
    page.getByTestId("composer-reasoning-effort-trigger"),
  ).toHaveCount(0);

  await page.getByTestId("composer-mode-trigger").click();
  await page.getByRole("menuitemradio").nth(1).click(); // thinking
  await expect(
    page.getByTestId("composer-reasoning-effort-trigger"),
  ).toBeVisible();
});

test("explains the active mode on hover without hiding the mode menu", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/chats/new");

  const trigger = page.getByTestId("composer-mode-trigger");
  await expect(trigger).toBeVisible();
  const label = (await trigger.textContent())?.trim() ?? "";
  expect(label).not.toBe("");

  await trigger.hover();
  const described = await guideText(page);
  expect(described.startsWith(`${label}: `)).toBe(true);
  expect(described.length).toBeGreaterThan(label.length + 2);

  // 说明浮层不能把触发器变成一个只能看不能点的东西。
  await trigger.click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(4);
});

test("follows the mode the user selects", async ({ page }) => {
  await openWorkspace(page, "/workspace/chats/new");

  const trigger = page.getByTestId("composer-mode-trigger");
  await trigger.click();
  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(4);
  const target = options.last();
  const targetLabel = (await target.textContent())?.trim() ?? "";
  await target.click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);

  await trigger.hover();
  const described = await guideText(page);
  const triggerLabel = (await trigger.textContent())?.trim() ?? "";
  expect(targetLabel.startsWith(triggerLabel)).toBe(true);
  expect(described.startsWith(`${triggerLabel}: `)).toBe(true);
});

test("reaches the guide from the keyboard", async ({ page }) => {
  await openWorkspace(page, "/workspace/chats/new");

  const trigger = page.getByTestId("composer-mode-trigger");
  await trigger.focus();
  // 键盘用户没有 hover。焦点必须是第二条入口，否则这层说明对他们不存在。
  await expect(guide(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(guide(page)).toHaveCount(0);
});

test("explains the sidecar mode too", async ({ page }) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`, {
    withSidecar: true,
  });

  await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("sidecar-header-trigger").click();
  const panel = page.getByTestId("sidecar-panel");
  await expect(panel).toBeVisible();

  const trigger = panel.getByTestId("sidecar-mode-trigger");
  await expect(trigger).toBeVisible();
  const label = (await trigger.textContent())?.trim() ?? "";
  expect(label).not.toBe("");

  await trigger.hover();
  const described = await guideText(page);
  expect(described.startsWith(`${label}: `)).toBe(true);
  expect(described.length).toBeGreaterThan(label.length + 2);
});

/*
  分组标题。上游两个菜单都在内容顶上放一条 DropdownMenuLabel（input-box.tsx 与
  sidecar-panel.tsx 各一处），本仓一条都没有——`inputBox.mode` 因此在本仓零消费，
  而未引用扫描器按叶子名匹配看不见它（同名叶子在别处有消费者）。
*/
test("titles both composer menus with their group label", async ({ page }) => {
  await openWorkspace(page, "/workspace/chats/new");

  const modeTrigger = page.getByTestId("composer-mode-trigger");
  await modeTrigger.click();
  const modeMenu = page.getByRole("menu");
  await expect(modeMenu).toContainText("Mode");
  // 标题不是菜单项：它不该进方向键序列，也不该被当成第五档。
  await expect(page.getByRole("menuitemradio")).toHaveCount(4);
  await page.keyboard.press("Escape");

  const effortTrigger = page.getByTestId("composer-reasoning-effort-trigger");
  await effortTrigger.click();
  await expect(page.getByRole("menu")).toContainText("Reasoning Effort");
  await expect(page.getByRole("menuitemradio")).toHaveCount(4);
});

/*
  模型不支持 thinking 时只列 Flash。上游原来把另外三档也列出来，但 getResolvedMode
  会把它们拉回 flash——勾永远不动，只有隐藏的 reasoning_effort 被改了。两边同改成
  「选不中就不列」（frontend/src/components/workspace/input-box.tsx 与
  sidecar/sidecar-panel.tsx 同一处）。
*/
test("lists only flash when the model cannot think", async ({ page }) => {
  await openWorkspace(page, "/workspace/chats/new", { thinking: false });

  const trigger = page.getByTestId("composer-mode-trigger");
  await expect(trigger).toHaveText("Flash");
  await trigger.click();
  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Flash");
  // 强度选择器跟着 flash 一起消失。
  await expect(
    page.getByTestId("composer-reasoning-effort-trigger"),
  ).toHaveCount(0);
});

/*
  sidecar 的模式菜单与主输入框同构。本仓原来是 w-32 的裸标签列表，于是同一个下拉
  在主输入框里读得出「Flash 快速高效……」、在 sidecar 里只读得出「Flash」。
*/
test("gives the sidecar mode menu the same title and descriptions", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`, {
    withSidecar: true,
  });
  await page.getByTestId("sidecar-header-trigger").click();
  const panel = page.getByTestId("sidecar-panel");
  await expect(panel).toBeVisible();

  await panel.getByTestId("sidecar-mode-trigger").click();
  await expect(page.getByRole("menu")).toContainText("Mode");
  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(4);
  await expect(options.first()).toContainText(
    "Fast and efficient, but may not be accurate",
  );
});

/*
  ultra 档把欢迎语的表情从 👋 换成 🚀，与金色 welcomeColors 是同一个判据
  （上游 welcome.tsx:53 的 `isUltra ? "🚀" : "👋"`）。本仓原来只换了颜色，
  于是 ultra 会话的欢迎语颜色变了、表情没变。
*/
test("swaps the welcome emoji in ultra mode", async ({ page }) => {
  await openWorkspace(page, "/workspace/chats/new");

  await expect(page.getByText("👋")).toBeVisible();
  await expect(page.getByText("🚀")).toHaveCount(0);

  await page.getByTestId("composer-mode-trigger").click();
  await page.getByRole("menuitemradio").last().click(); // ultra

  await expect(page.getByText("🚀")).toBeVisible();
  await expect(page.getByText("👋")).toHaveCount(0);
});
