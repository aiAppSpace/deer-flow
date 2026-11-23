import type { ParityDimension, ParityScenario, ParityStep } from "./scenarios";

const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
];
const owner = "00000000-0000-0000-0000-000000000025";
const preferences = {
  model_name: null,
  mode: null,
  reasoning_effort: null,
  notification_enabled: false,
  locale: "en-US",
};
// Match the original React settings-sync browser flow: hydrate the dialog,
// refresh the session through the shared native event, then select the panel
// again after the account boundary may have remounted its contents.
const accountPanel: ParityStep[] = [
  // Desktop collapses to the named icon; mobile opens the same sidebar menu.
  {
    kind: "click",
    target: { role: "button", name: "Toggle Sidebar", exact: true },
  },
  {
    kind: "click",
    target: { role: "button", name: "Settings and more", exact: true },
  },
  {
    kind: "click",
    target: { role: "menuitem", name: "Settings", exact: true },
  },
  {
    kind: "visible",
    target: { role: "dialog", name: "Settings", exact: true },
  },
  {
    kind: "visible",
    target: { role: "button", name: "Notification", exact: true },
  },
  { kind: "visibility-change" },
  {
    kind: "click",
    target: { role: "button", name: "Notification", exact: true },
  },
];

export const PREFERENCES_PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "settings-sync",
    title: "账户通知偏好优先于本地缓存并在重新加载后恢复",
    backend: "mock",
    path: "/workspace/chats/new",
    dimensions,
    settle: [],
    stubs: {
      notification: "granted",
      localStorage: {
        "deerflow.local-settings": JSON.stringify({
          notification: { enabled: true },
        }),
      },
    },
    routes: [
      {
        pattern: "**/api/v1/auth/me",
        json: {
          id: owner,
          email: "preferences@example.com",
          system_role: "admin",
          needs_setup: false,
        },
      },
      { pattern: "**/api/v1/auth/preferences", json: preferences },
    ],
    states: [
      {
        id: "account-preference",
        steps: [
          ...accountPanel,
          {
            kind: "visible",
            target: {
              selector:
                '[role="switch"][aria-label="Notification"][aria-checked="false"]',
            },
          },
        ],
      },
      {
        id: "restored",
        steps: [
          { kind: "reload" },
          ...accountPanel,
          {
            kind: "visible",
            target: {
              selector:
                '[role="switch"][aria-label="Notification"][aria-checked="false"]',
            },
          },
        ],
      },
      {
        id: "toggle",
        steps: [
          ...accountPanel,
          {
            kind: "visible",
            target: {
              selector:
                '[role="switch"][aria-label="Notification"][aria-checked="false"]',
            },
          },
          {
            kind: "click",
            target: { role: "switch", name: "Notification", exact: true },
          },
          {
            kind: "visible",
            target: {
              selector:
                '[role="switch"][aria-label="Notification"][aria-checked="true"]',
            },
          },
        ],
      },
    ],
  },
];
