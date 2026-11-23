/* W01/W06: current React memory import, unread origin and stable deletion flows.
 * HTTP fixtures and browser actions are identical for both implementations. */
import type { ParityDimension, ParityScenario, ParityStep } from "./scenarios";

const threadId = "00000000-0000-0000-0000-000000000001";
const secondId = "00000000-0000-0000-0000-000000000002";
const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
];
const emptySection = { summary: "", updatedAt: "" };
const memory = {
  version: "1.0",
  lastUpdated: "2026-01-01T00:00:00Z",
  user: {
    workContext: { ...emptySection, summary: "Works on DeerFlow" },
    personalContext: emptySection,
    topOfMind: emptySection,
  },
  history: {
    recentMonths: emptySection,
    earlierContext: emptySection,
    longTermBackground: emptySection,
  },
  facts: [
    { content: "User prefers conclusions first.", category: "cognitive" },
  ],
};
const memoryFile = (payload: unknown): ParityStep => ({
  kind: "set-input-files",
  target: {
    selector:
      '[role="dialog"] input[type="file"][accept=".json,application/json"]',
  },
  file: {
    name: "memory-export.json",
    mimeType: "application/json",
    base64: Buffer.from(JSON.stringify(payload)).toString("base64"),
  },
});
const openDelete: ParityStep[] = [
  {
    kind: "click",
    target: { role: "button", name: "Toggle Sidebar", exact: true },
    viewports: ["mobile"],
  },
  {
    kind: "hover",
    target: {
      selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"]`,
    },
  },
  {
    kind: "click",
    target: {
      selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"] + button`,
    },
  },
  { kind: "click", target: { role: "menuitem", name: "Delete", exact: true } },
  {
    kind: "visible",
    target: { role: "dialog", name: "Delete chat", exact: true },
  },
];
export const THREAD_LIFECYCLE_PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "settings-memory-import",
    upstreamSpecs: ["settings-memory-import"],
    title: "记忆导入校验与旧版导出确认",
    backend: "mock",
    path: "/workspace/chats/new?settings=memory",
    dimensions,
    settle: [
      {
        kind: "visible",
        target: { role: "button", name: "Import memory", exact: true },
      },
    ],
    routes: [
      { pattern: "**/api/memory", json: { ...memory, facts: [] } },
      { pattern: "**/api/memory/import", json: memory },
    ],
    states: [
      ...[
        { facts: [] },
        { user: {}, history: {}, facts: [] },
        {
          version: "1.0",
          lastUpdated: "",
          user: "bad",
          history: 123,
          facts: [],
        },
      ].map((payload, index) => ({
        id: `invalid-${index + 1}`,
        steps: [
          memoryFile(payload),
          {
            kind: "visible",
            target: {
              text: "Failed to read the selected memory file. Please choose a valid JSON export.",
              exact: true,
            },
          },
          {
            kind: "hidden",
            target: { role: "dialog", name: "Import memory?", exact: true },
          },
        ] as ParityStep[],
      })),
      {
        id: "legacy-confirmation",
        steps: [
          memoryFile(memory),
          {
            kind: "visible",
            target: { role: "dialog", name: "Import memory?", exact: true },
          },
        ],
      },
      {
        id: "imported",
        steps: [
          memoryFile(memory),
          {
            kind: "click",
            target: {
              selector:
                '[role="dialog"] button:has-text("Import"):not(:has-text("memory"))',
            },
          },
          {
            kind: "hidden",
            target: { role: "dialog", name: "Import memory?", exact: true },
          },
          {
            kind: "visible",
            target: { text: "Works on DeerFlow", exact: true },
          },
        ],
      },
    ],
  },
  {
    id: "thread-activity",
    upstreamSpecs: ["thread-activity"],
    title: "来源、未读列表与打开后已读",
    backend: "mock",
    path: "/workspace/chats",
    dimensions,
    settle: [],
    mock: {
      threads: [
        {
          thread_id: threadId,
          title: "Scheduled research",
          updated_at: "2026-10-09T00:00:00Z",
          unread: true,
          metadata: { deerflow_origin: { kind: "schedule" } },
        },
        {
          thread_id: secondId,
          title: "Weekly numbers",
          updated_at: "2026-10-08T00:00:00Z",
          metadata: {
            channel_source: { type: "im_channel", provider: "feishu" },
          },
        },
      ],
      features: { threadActivity: { available: true } },
    },
    states: [
      {
        id: "unread-list",
        steps: [
          {
            kind: "visible",
            target: {
              selector: `[role="tabpanel"] a[href="/workspace/chats/${threadId}"][aria-label="Scheduled run, Scheduled research, unread"] [data-testid="thread-unread-dot"]`,
            },
          },
          {
            kind: "visible",
            target: {
              selector:
                '[role="tabpanel"] [role="img"][aria-label="From Feishu"]',
            },
          },
        ],
      },
      {
        id: "opened-read",
        steps: [
          {
            kind: "click",
            target: {
              selector: `[role="tabpanel"] a[href="/workspace/chats/${threadId}"]`,
            },
          },
          {
            kind: "click",
            target: { role: "button", name: "Toggle Sidebar", exact: true },
            viewports: ["mobile"],
          },
          {
            kind: "visible",
            target: {
              selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"][data-active="true"]`,
            },
          },
          {
            kind: "hidden",
            target: {
              selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"] [data-testid="thread-unread-dot"]`,
            },
          },
        ],
      },
    ],
  },
  {
    id: "thread-delete-confirm",
    upstreamSpecs: ["thread-delete-confirm"],
    title: "删除确认目标稳定、可取消且成功后导航",
    backend: "mock",
    path: `/workspace/chats/${threadId}`,
    // The narrow macro also uses the actual mobile drawer entry; registered
    // comparison dimensions remain the original desktop contract.
    dimensions: dimensions.filter(
      (dimension) => dimension.viewport === "desktop",
    ),
    settle: [],
    mock: { threads: [{ thread_id: threadId, title: "Report to keep" }] },
    states: [
      { id: "confirmation", steps: openDelete },
      {
        id: "cancelled",
        steps: [
          ...openDelete,
          {
            kind: "click",
            target: { role: "button", name: "Cancel", exact: true },
          },
          {
            kind: "hidden",
            target: { role: "dialog", name: "Delete chat", exact: true },
          },
          {
            kind: "visible",
            target: {
              selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"]`,
            },
          },
        ],
      },
      {
        id: "deleted",
        steps: [
          ...openDelete,
          {
            kind: "click",
            target: { role: "button", name: "Delete", exact: true },
          },
          {
            kind: "hidden",
            target: { role: "dialog", name: "Delete chat", exact: true },
          },
          {
            kind: "hidden",
            target: {
              selector: `[data-sidebar="sidebar"] a[href="/workspace/chats/${threadId}"]`,
            },
          },
          { kind: "press", key: "Escape", viewports: ["mobile"] },
          {
            kind: "visible",
            target: {
              role: "textbox",
              name: "How can I assist you today?",
              exact: true,
            },
          },
        ],
      },
    ],
  },
];
