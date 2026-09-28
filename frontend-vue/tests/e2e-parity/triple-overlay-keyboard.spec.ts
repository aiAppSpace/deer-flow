/*
  Wave 69 三轴浮层内部键盘语义门禁。

  `triple-keyboard.spec.ts` 已经证明 360px × 360px × 200% 下真实 Tab / Shift+Tab
  不会吞键、陷住或停在不可见元素上；但 menu / listbox 依法使用 roving focus 接管
  Tab 时，那条门禁只把它视为合法 owner，并没有继续证明浮层内部还能操作。

  Wave 69 先补三件事：
  1. ArrowDown 必须把当前项推进到一个真实、可见、未禁用的 item；
  2. Enter 必须激活该 item（click、关闭、选中态或 URL 至少发生一项可观察变化）；
  3. Escape 必须关闭当前浮层，并把焦点还给控制链上的合法 trigger，且 trigger 仍在
     真实裁剪交集内。Radix / Reka 的 submenu Escape 会关闭整个 root menu，因此子菜单
     同时接受仍存在的父 trigger 或 root trigger，但不接受 body / 任意旁路元素。

  Wave 70 在同一套运行时发现上继续补内部导航：menu 验证 ArrowUp / Home / End /
  typeahead；可编辑 combobox 所拥有的 listbox 验证 ArrowUp 与真实过滤语义（Home / End
  仍属于文本光标合同，不能误压成 option 导航）；运行时发现的 submenu 验证
  ArrowRight 进入、ArrowLeft 关闭并回到父 trigger。单项 menu 也必须保持合法可见焦点，
  不能因为“没有第二项”被跳过。

  Wave 71 不把「第一次 typeahead 命中」偷换成完整合同：menu 还要验证 Space 激活；
  同首字符项要按连续按键逐项循环并回到起点；每个运行时发现的 subtrigger 都要实际展开，
  若子菜单含 disabled item，则 ArrowDown / ArrowUp 都必须越过它。可编辑 listbox 的 Space
  与重复字符仍属于文本过滤输入，不套 menu 合同。Move-to-project 这类终态未展开的子菜单
  由 subtrigger 运行时遍历覆盖，不新增场景白名单。

  场景范围不写白名单：仍遍历全部 61 个终态，再按运行时实际可见的 `[role=menu]` /
  `[role=listbox]` 发现待测浮层。父菜单与 portal 子菜单可以同时存在；测父层前先用
  Escape 合法退回父层，不能把「当前焦点在子层」误报成父层 ArrowDown 失效。
  `TRIPLE_OVERLAY_ONLY` 只用于定位，默认必须走完双端全部终态。
*/

import { expect, test, type Browser, type Page } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

const WIDTH = 360;
const HEIGHT = 360;
const ROOT_PX = 32;
const ONLY = new Set(
  (process.env.TRIPLE_OVERLAY_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const SCENARIOS = ONLY.size
  ? PARITY_SCENARIOS.filter((scenario) => ONLY.has(scenario.id))
  : PARITY_SCENARIOS;
const EXPECTED_STATES = SCENARIOS.reduce(
  (count, scenario) => count + scenarioStates(scenario).length,
  0,
);

const MARK_VISIBLE_OVERLAYS = () => {
  const isVisible = (element: Element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.contentVisibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const label = (element: Element) =>
    (
      element.getAttribute("aria-label") ??
      (element as HTMLElement).innerText ??
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menu"],[role="listbox"]'),
  ).filter(isVisible);
  const actionable = overlays
    .map((overlay) => {
      const allItems = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
        ),
      ).filter(
        (item) =>
          item.closest('[role="menu"],[role="listbox"]') === overlay &&
          isVisible(item),
      );
      const disabled = (item: HTMLElement) =>
        item.hasAttribute("disabled") ||
        item.getAttribute("aria-disabled") === "true" ||
        (item.getAttribute("data-disabled") !== null &&
          item.getAttribute("data-disabled") !== "false");
      return {
        overlay,
        items: allItems.filter((item) => !disabled(item)),
        disabledItems: allItems.filter(disabled),
        submenuTriggers: allItems.filter(
          (item) =>
            !disabled(item) && item.getAttribute("aria-haspopup") === "menu",
        ),
      };
    })
    .filter(({ items }) => items.length > 0);
  return actionable.map(
    ({ overlay, items, disabledItems, submenuTriggers }, index) => {
      overlay.dataset.wave69Overlay = String(index);
      overlay.id ||= `wave69-overlay-${index}`;
      return {
        index,
        role: overlay.getAttribute("role") ?? "",
        items: items.map(label),
        disabledItems: disabledItems.map(label),
        submenuTriggers: submenuTriggers.map(label),
      };
    },
  );
};

type OverlayDescriptor = {
  index: number;
  role: string;
  items: string[];
  disabledItems: string[];
  submenuTriggers: string[];
};

const READ_OVERLAY = async (index: number) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay)
    return {
      present: false,
      role: "",
      ownsActive: false,
      itemCount: 0,
      activeIndex: -1,
      activeVisible: false,
      states: [] as string[],
      labels: [] as string[],
    };
  const isVisible = (element: Element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.contentVisibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const items = Array.from(
    overlay.querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
    ),
  ).filter(
    (item) =>
      item.closest('[role="menu"],[role="listbox"]') === overlay &&
      isVisible(item) &&
      !item.hasAttribute("disabled") &&
      item.getAttribute("aria-disabled") !== "true" &&
      (item.getAttribute("data-disabled") === null ||
        item.getAttribute("data-disabled") === "false"),
  );
  const active = document.activeElement as HTMLElement | null;
  const activeDescendant =
    active?.getAttribute("aria-activedescendant") ??
    overlay.getAttribute("aria-activedescendant");
  const focusIndex = items.findIndex(
    (item) =>
      item === active ||
      item.contains(active) ||
      (activeDescendant && item.id === activeDescendant),
  );
  const highlightedIndex = items.findIndex((item) =>
    item.hasAttribute("data-highlighted"),
  );
  const selectedIndex = items.findIndex(
    (item) =>
      item.getAttribute("data-selected") === "true" ||
      item.getAttribute("aria-selected") === "true" ||
      item.getAttribute("aria-checked") === "true",
  );
  const activeIndex =
    focusIndex >= 0
      ? focusIndex
      : highlightedIndex >= 0
        ? highlightedIndex
        : selectedIndex;
  const current = activeIndex >= 0 ? items[activeIndex] : null;
  const intersection = current
    ? await new Promise<{ width: number; height: number }>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          const rect = entries[0]?.intersectionRect;
          observer.disconnect();
          resolve({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
        });
        observer.observe(current);
      })
    : { width: 0, height: 0 };
  const label = (element: Element) =>
    (
      element.getAttribute("aria-label") ??
      (element as HTMLElement).innerText ??
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
  return {
    present: isVisible(overlay),
    role: overlay.getAttribute("role") ?? "",
    ownsActive:
      !!active &&
      (overlay.contains(active) ||
        (!!activeDescendant &&
          items.some((item) => item.id === activeDescendant))),
    itemCount: items.length,
    activeIndex,
    activeVisible: intersection.width > 0 && intersection.height > 0,
    states: items.map(
      (item) =>
        `${item.getAttribute("aria-selected") ?? ""}/` +
        `${item.getAttribute("aria-checked") ?? ""}/` +
        `${item.getAttribute("data-state") ?? ""}`,
    ),
    labels: items.map(label),
  };
};

const INSTALL_ACTIVATION_LOG = () => {
  const scope = globalThis as unknown as { __wave69Activations?: string[] };
  scope.__wave69Activations = [];
  document.addEventListener(
    "click",
    (event) => {
      const target = (event.target as Element | null)?.closest(
        '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
      );
      if (!target) return;
      scope.__wave69Activations?.push(
        (
          target.getAttribute("aria-label") ??
          (target as HTMLElement).innerText ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40),
      );
    },
    true,
  );
};

const READ_ACTIVATIONS = () =>
  (globalThis as unknown as { __wave69Activations?: string[] })
    .__wave69Activations ?? [];

const FOCUS_LISTBOX_CONTROLLER = (index: number) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay) return { id: "", label: "" };
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const active =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  const acceptsKeys = (element: HTMLElement | undefined) =>
    !!element &&
    (element.matches('input,textarea,[contenteditable="true"]') ||
      element.getAttribute("role") === "combobox");
  let controller = acceptsKeys(active) && visible(active!) ? active : undefined;
  if (!controller) {
    const dialog = overlay.closest<HTMLElement>('[role="dialog"]');
    const root: ParentNode = dialog ?? document;
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input,textarea,[contenteditable="true"],[role="combobox"]',
      ),
    ).filter(visible);
    const rect = overlay.getBoundingClientRect();
    controller = candidates
      .map((element) => {
        const candidate = element.getBoundingClientRect();
        return {
          element,
          distance:
            Math.abs(
              candidate.left +
                candidate.width / 2 -
                (rect.left + rect.width / 2),
            ) +
            Math.abs(
              candidate.top +
                candidate.height / 2 -
                (rect.top + rect.height / 2),
            ),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0]?.element;
  }
  controller?.focus();
  return controller
    ? `${controller.tagName.toLowerCase()}${controller.getAttribute("role") ? `(${controller.getAttribute("role")})` : ""}`
    : "";
};

const FOCUS_MENU_ITEM = ({
  index,
  itemIndex,
}: {
  index: number;
  itemIndex: number;
}) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay) return false;
  const items = Array.from(
    overlay.querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
    ),
  ).filter(
    (item) =>
      item.closest('[role="menu"],[role="listbox"]') === overlay &&
      !item.hasAttribute("disabled") &&
      item.getAttribute("aria-disabled") !== "true" &&
      (item.getAttribute("data-disabled") === null ||
        item.getAttribute("data-disabled") === "false"),
  );
  const target = items[itemIndex] ?? items[0];
  target?.focus();
  return !!target;
};

type TypeaheadCandidate = {
  kind: "roving" | "filter";
  key: string;
  targetIndex: number;
  targetLabel: string;
};

const PICK_TYPEAHEAD_CANDIDATE = (index: number): TypeaheadCandidate => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay)
    return { kind: "roving", key: "", targetIndex: -1, targetLabel: "" };
  const items = Array.from(
    overlay.querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
    ),
  ).filter(
    (item) =>
      item.closest('[role="menu"],[role="listbox"]') === overlay &&
      !item.hasAttribute("disabled") &&
      item.getAttribute("aria-disabled") !== "true" &&
      (item.getAttribute("data-disabled") === null ||
        item.getAttribute("data-disabled") === "false"),
  );
  const labels = items.map((item) =>
    (
      item.getAttribute("aria-label") ??
      item.innerText ??
      item.textContent ??
      ""
    )
      .trim()
      .replace(/\s+/g, " "),
  );
  if (overlay.getAttribute("role") === "listbox") {
    const tokenOwners = new Map<string, Set<number>>();
    labels.forEach((label, itemIndex) => {
      const tokens = new Set(
        (
          label.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []
        ).filter((token) => token.length >= 2),
      );
      for (const token of tokens) {
        const owners = tokenOwners.get(token) ?? new Set<number>();
        owners.add(itemIndex);
        tokenOwners.set(token, owners);
      }
    });
    const unique = [...tokenOwners.entries()]
      .filter(([, owners]) => owners.size === 1)
      .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))[0];
    const targetIndex = unique ? [...unique[1]][0]! : 0;
    return {
      kind: "filter",
      key: unique?.[0] ?? labels[0]?.slice(0, 1).toLocaleLowerCase() ?? "",
      targetIndex,
      targetLabel: labels[targetIndex] ?? "",
    };
  }

  const keys = labels.map(
    (label) =>
      label
        .normalize("NFKD")
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]/u)?.[0] ?? "",
  );
  const groups = new Map<string, number[]>();
  keys.forEach((key, itemIndex) => {
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), itemIndex]);
  });
  const uniqueAwayFromFirst = [...groups.entries()].find(
    ([, itemIndexes]) => itemIndexes.length === 1 && itemIndexes[0] !== 0,
  );
  if (uniqueAwayFromFirst)
    return {
      kind: "roving",
      key: uniqueAwayFromFirst[0],
      targetIndex: uniqueAwayFromFirst[1][0]!,
      targetLabel: labels[uniqueAwayFromFirst[1][0]!] ?? "",
    };
  const repeated = [...groups.entries()].find(
    ([, itemIndexes]) => itemIndexes.includes(0) && itemIndexes.length > 1,
  );
  if (repeated)
    return {
      kind: "roving",
      key: repeated[0],
      targetIndex: repeated[1][1]!,
      targetLabel: labels[repeated[1][1]!] ?? "",
    };
  return {
    kind: "roving",
    key: keys[0] ?? "",
    targetIndex: 0,
    targetLabel: labels[0] ?? "",
  };
};

type RepeatedTypeaheadCandidate = {
  key: string;
  indices: number[];
  labels: string[];
};

const PICK_REPEATED_TYPEAHEAD_CANDIDATE = (
  index: number,
): RepeatedTypeaheadCandidate | null => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay || overlay.getAttribute("role") !== "menu") return null;
  const items = Array.from(
    overlay.querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
    ),
  ).filter(
    (item) =>
      item.closest('[role="menu"]') === overlay &&
      !item.hasAttribute("disabled") &&
      item.getAttribute("aria-disabled") !== "true" &&
      (item.getAttribute("data-disabled") === null ||
        item.getAttribute("data-disabled") === "false"),
  );
  const labels = items.map((item) =>
    (
      item.getAttribute("aria-label") ??
      item.innerText ??
      item.textContent ??
      ""
    )
      .trim()
      .replace(/\s+/g, " "),
  );
  const groups = new Map<string, number[]>();
  labels.forEach((label, itemIndex) => {
    const key =
      label
        .normalize("NFKD")
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]/u)?.[0] ?? "";
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), itemIndex]);
  });
  const repeated = [...groups.entries()].find(
    ([, itemIndexes]) => itemIndexes.length > 1,
  );
  if (!repeated) return null;
  return {
    key: repeated[0],
    indices: repeated[1],
    labels: repeated[1].map((itemIndex) => labels[itemIndex] ?? ""),
  };
};

const READ_FILTER_RESULT = ({ token }: { token: string }) => {
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const labels = Array.from(
    document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]'),
  )
    .filter(
      (item) =>
        visible(item) &&
        item.closest('[role="listbox"]') instanceof HTMLElement &&
        visible(item.closest<HTMLElement>('[role="listbox"]')!),
    )
    .map((item) =>
      (
        item.getAttribute("aria-label") ??
        item.innerText ??
        item.textContent ??
        ""
      )
        .trim()
        .replace(/\s+/g, " "),
    );
  const needle = token.toLocaleLowerCase();
  return {
    labels,
    matching: labels.filter((label) =>
      label.toLocaleLowerCase().includes(needle),
    ),
    foreign: labels.filter(
      (label) => !label.toLocaleLowerCase().includes(needle),
    ),
  };
};

type SubmenuRelation = {
  parentIndex: number;
  childIndex: number;
  triggerId: string;
  triggerLabel: string;
  childId: string;
};

const MARK_SUBMENU_RELATIONS = (): SubmenuRelation[] => {
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="menu"][data-wave69-overlay]',
    ),
  ).filter(visible);
  const relations: SubmenuRelation[] = [];
  for (const child of overlays) {
    const parent = child.parentElement?.closest<HTMLElement>(
      '[role="menu"][data-wave69-overlay]',
    );
    if (!parent || parent === child) continue;
    const directItems = Array.from(
      parent.querySelectorAll<HTMLElement>(
        '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
      ),
    ).filter(
      (item) => item.closest('[role="menu"]') === parent && visible(item),
    );
    child.id ||= `wave69-submenu-${relations.length}`;
    const trigger = directItems.find(
      (item) =>
        item.getAttribute("aria-controls") === child.id ||
        item.contains(child) ||
        (item.getAttribute("aria-haspopup") === "menu" &&
          item.getAttribute("aria-expanded") === "true"),
    );
    if (!trigger) continue;
    trigger.id ||= `wave69-submenu-trigger-${relations.length}`;
    relations.push({
      parentIndex: Number(parent.dataset.wave69Overlay),
      childIndex: Number(child.dataset.wave69Overlay),
      triggerId: trigger.id,
      triggerLabel: (
        trigger.getAttribute("aria-label") ??
        trigger.innerText ??
        trigger.textContent ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60),
      childId: child.id,
    });
  }
  return relations;
};

type SubmenuTriggerCandidate = {
  id: string;
  label: string;
};

const MARK_SUBMENU_TRIGGERS = (index: number): SubmenuTriggerCandidate[] => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay || overlay.getAttribute("role") !== "menu") return [];
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  return Array.from(
    overlay.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]'),
  )
    .filter(
      (item) =>
        item.closest('[role="menu"]') === overlay &&
        visible(item) &&
        !item.hasAttribute("disabled") &&
        item.getAttribute("aria-disabled") !== "true" &&
        (item.getAttribute("data-disabled") === null ||
          item.getAttribute("data-disabled") === "false"),
    )
    .map((item, triggerIndex) => {
      item.id ||= `wave71-subtrigger-${index}-${triggerIndex}`;
      item.dataset.wave71Subtrigger = `${index}-${triggerIndex}`;
      return {
        id: item.id,
        label: (
          item.getAttribute("aria-label") ??
          item.innerText ??
          item.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 60),
      };
    });
};

const FOCUS_SUBMENU_TRIGGER = ({
  index,
  triggerIndex,
}: {
  index: number;
  triggerIndex: number;
}) => {
  const trigger = document.querySelector<HTMLElement>(
    `[data-wave71-subtrigger="${index}-${triggerIndex}"]`,
  );
  trigger?.focus();
  return trigger
    ? {
        id: trigger.id,
        label: (
          trigger.getAttribute("aria-label") ??
          trigger.innerText ??
          trigger.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 60),
      }
    : null;
};

type DisabledSkipCandidate = {
  disabledLabels: string[];
  startEnabledIndex: number;
  expectedEnabledIndex: number;
  startLabel: string;
  expectedLabel: string;
};

const PICK_DISABLED_SKIP_CANDIDATE = (
  index: number,
): DisabledSkipCandidate | null => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay) return null;
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const allItems = Array.from(
    overlay.querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
    ),
  ).filter(
    (item) =>
      item.closest('[role="menu"],[role="listbox"]') === overlay &&
      visible(item),
  );
  const disabled = (item: HTMLElement) =>
    item.hasAttribute("disabled") ||
    item.getAttribute("aria-disabled") === "true" ||
    (item.getAttribute("data-disabled") !== null &&
      item.getAttribute("data-disabled") !== "false");
  const enabledItems = allItems.filter((item) => !disabled(item));
  const disabledIndexes = allItems
    .map((item, itemIndex) => (disabled(item) ? itemIndex : -1))
    .filter((itemIndex) => itemIndex >= 0);
  if (enabledItems.length === 0 || disabledIndexes.length === 0) return null;
  const firstDisabled = disabledIndexes[0]!;
  let previous = firstDisabled;
  do previous = (previous - 1 + allItems.length) % allItems.length;
  while (disabled(allItems[previous]!));
  let next = firstDisabled;
  do next = (next + 1) % allItems.length;
  while (disabled(allItems[next]!));
  const label = (item: HTMLElement) =>
    (
      item.getAttribute("aria-label") ??
      item.innerText ??
      item.textContent ??
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  return {
    disabledLabels: disabledIndexes.map((itemIndex) =>
      label(allItems[itemIndex]!),
    ),
    startEnabledIndex: enabledItems.indexOf(allItems[previous]!),
    expectedEnabledIndex: enabledItems.indexOf(allItems[next]!),
    startLabel: label(allItems[previous]!),
    expectedLabel: label(allItems[next]!),
  };
};

const READ_SUBMENU_RESULT = async ({
  childId,
  triggerId,
}: {
  childId: string;
  triggerId: string;
}) => {
  const visible = (element: HTMLElement | null) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const child = document.getElementById(childId);
  const trigger = document.getElementById(triggerId);
  const items = child
    ? Array.from(
        child.querySelectorAll<HTMLElement>(
          '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
        ),
      ).filter(
        (item) => item.closest('[role="menu"]') === child && visible(item),
      )
    : [];
  const active = document.activeElement;
  const activeIndex = items.findIndex(
    (item) =>
      item === active ||
      item.contains(active) ||
      item.hasAttribute("data-highlighted"),
  );
  const activeElement = activeIndex >= 0 ? items[activeIndex] : trigger;
  const intersection = activeElement
    ? await new Promise<{ width: number; height: number }>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          const rect = entries[0]?.intersectionRect;
          observer.disconnect();
          resolve({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
        });
        observer.observe(activeElement);
      })
    : { width: 0, height: 0 };
  return {
    childOpen: visible(child),
    childActiveIndex: activeIndex,
    triggerActive:
      !!trigger &&
      (trigger === active || (!!active && trigger.contains(active))),
    activeVisible: intersection.width > 0 && intersection.height > 0,
  };
};

const FIND_NESTED_OVERLAY = (index: number) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay) return null;
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const nested = Array.from(
    overlay.querySelectorAll<HTMLElement>('[role="menu"][data-wave69-overlay]'),
  ).filter((candidate) => candidate !== overlay && visible(candidate));
  const deepest = nested.at(-1);
  const value = deepest?.getAttribute("data-wave69-overlay");
  return value === null || value === undefined ? null : Number(value);
};

const DIAGNOSE_OVERLAYS = () => {
  const active = document.activeElement as HTMLElement | null;
  const describe = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      role: element.getAttribute("role") ?? "",
      label: (
        element.getAttribute("aria-label") ??
        (element as HTMLElement).innerText ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 30),
      rect: [
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
      ],
    };
  };
  return {
    active: active ? describe(active) : null,
    overlays: Array.from(
      document.querySelectorAll<HTMLElement>('[role="menu"],[role="listbox"]'),
    ).map((overlay) => ({
      ...describe(overlay),
      items: Array.from(
        overlay.querySelectorAll<HTMLElement>(
          '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]',
        ),
      ).map(describe),
    })),
  };
};

const MARK_TRIGGER = (index: number) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  if (!overlay) return { ids: [] as string[], labels: [] as string[] };
  const controlledIds = new Set<string>();
  let owner: HTMLElement | null = overlay;
  while (owner) {
    if (owner.id) controlledIds.add(owner.id);
    owner =
      owner.parentElement?.closest<HTMLElement>(
        '[role="menu"],[role="listbox"]',
      ) ?? null;
  }
  const dialog = overlay.closest<HTMLElement>('[role="dialog"]');
  if (dialog?.id) controlledIds.add(dialog.id);
  const visible = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const exact = Array.from(
    document.querySelectorAll<HTMLElement>("[aria-controls]"),
  ).filter(
    (element) =>
      controlledIds.has(element.getAttribute("aria-controls") ?? "") &&
      visible(element),
  );
  const expanded = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-expanded="true"]'),
  ).filter(visible);
  const candidates = [...new Set([...exact, ...expanded])];
  const active =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  if (active && !candidates.includes(active)) candidates.push(active);
  const returnOwners = [...new Set(candidates)];
  returnOwners.forEach((element, candidateIndex) => {
    element.dataset.wave69Return = `${index}-${candidateIndex}`;
    element.id ||= `wave69-return-${index}-${candidateIndex}`;
  });
  return {
    ids: returnOwners.map((element) => element.id),
    labels: returnOwners.map((element) =>
      (
        element.getAttribute("aria-label") ??
        element.innerText ??
        element.getAttribute("placeholder") ??
        element.getAttribute("title") ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60),
    ),
  };
};

const READ_ESCAPE_RESULT = async ({
  index,
  returnIds,
}: {
  index: number;
  returnIds: string[];
}) => {
  const overlay = document.querySelector<HTMLElement>(
    `[data-wave69-overlay="${index}"]`,
  );
  const triggers = returnIds
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => !!element);
  const active = document.activeElement;
  const closed =
    !overlay ||
    getComputedStyle(overlay).display === "none" ||
    getComputedStyle(overlay).visibility === "hidden" ||
    overlay.getBoundingClientRect().width === 0 ||
    overlay.getBoundingClientRect().height === 0;
  const trigger = triggers.find(
    (element) => element === active || (!!active && element.contains(active)),
  );
  const intersection = trigger
    ? await new Promise<{ width: number; height: number }>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          const rect = entries[0]?.intersectionRect;
          observer.disconnect();
          resolve({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
        });
        observer.observe(trigger);
      })
    : { width: 0, height: 0 };
  return {
    closed,
    focusReturned: !!trigger,
    triggerVisible: intersection.width > 0 && intersection.height > 0,
    active:
      active instanceof HTMLElement
        ? `${active.getAttribute("role") ?? active.tagName.toLowerCase()}:${(
            active.getAttribute("aria-label") ??
            active.innerText ??
            ""
          )
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 60)}`
        : "",
  };
};

async function openState(
  browser: Browser,
  base: string,
  scenario: (typeof PARITY_SCENARIOS)[number],
  state: ReturnType<typeof scenarioStates>[number],
) {
  const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
  const page = await context.newPage();
  const dimension =
    state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION;
  await runScenario(page, base, scenario, dimension, state, 30_000);
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.addStyleTag({
    content: `html{font-size:${ROOT_PX}px !important}`,
  });
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  return { context, page };
}

async function prepareOverlay(page: Page, index: number) {
  await page.evaluate(MARK_VISIBLE_OVERLAYS);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nestedIndex = await page.evaluate(FIND_NESTED_OVERLAY, index);
    if (nestedIndex === null) break;
    await page.evaluate(FOCUS_MENU_ITEM, {
      index: nestedIndex,
      itemIndex: 0,
    });
    await page.keyboard.press("ArrowLeft");
    await waitForFiniteAnimations(page);
    await waitForDomQuiet(page);
  }
  let state = await page.evaluate(READ_OVERLAY, index);
  if (
    state.present &&
    state.role === "menu" &&
    (!state.ownsActive || state.activeIndex < 0)
  ) {
    await page.evaluate(FOCUS_MENU_ITEM, {
      index,
      itemIndex: state.activeIndex >= 0 ? state.activeIndex : 0,
    });
    state = await page.evaluate(READ_OVERLAY, index);
  } else if (state.present && state.role === "listbox") {
    await page.evaluate(FOCUS_LISTBOX_CONTROLLER, index);
    state = await page.evaluate(READ_OVERLAY, index);
  }
  return state;
}

async function exerciseArrowEnter(page: Page, index: number) {
  const before = await prepareOverlay(page, index);
  await page.evaluate(INSTALL_ACTIVATION_LOG);
  const beforeUrl = page.url();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(50);
  const afterArrow = await page.evaluate(READ_OVERLAY, index);
  const arrowWorked =
    afterArrow.present &&
    afterArrow.activeIndex >= 0 &&
    afterArrow.activeVisible &&
    (before.activeIndex < 0 ||
      before.itemCount <= 1 ||
      afterArrow.activeIndex !== before.activeIndex);
  await page.keyboard.press("Enter");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterEnter = await page.evaluate(READ_OVERLAY, index);
  const activations = await page.evaluate(READ_ACTIVATIONS);
  const enterWorked =
    activations.length > 0 ||
    !afterEnter.present ||
    page.url() !== beforeUrl ||
    JSON.stringify(afterArrow.states) !== JSON.stringify(afterEnter.states);
  return {
    before,
    afterArrow,
    afterEnter,
    activations,
    arrowWorked,
    enterWorked,
  };
}

async function exerciseEscape(page: Page, index: number) {
  await prepareOverlay(page, index);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(50);
  const trigger = await page.evaluate(MARK_TRIGGER, index);
  await page.keyboard.press("Escape");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  return {
    trigger,
    ...(await page.evaluate(READ_ESCAPE_RESULT, {
      index,
      returnIds: trigger.ids,
    })),
  };
}

async function exerciseSpace(page: Page, index: number) {
  const before = await prepareOverlay(page, index);
  if (before.role !== "menu") return null;
  await page.evaluate(INSTALL_ACTIVATION_LOG);
  const beforeUrl = page.url();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(50);
  const beforeSpace = await page.evaluate(READ_OVERLAY, index);
  await page.keyboard.press("Space");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterSpace = await page.evaluate(READ_OVERLAY, index);
  const activations = await page.evaluate(READ_ACTIVATIONS);
  return {
    before,
    beforeSpace,
    afterSpace,
    activations,
    worked:
      activations.length > 0 ||
      !afterSpace.present ||
      page.url() !== beforeUrl ||
      JSON.stringify(beforeSpace.states) !== JSON.stringify(afterSpace.states),
  };
}

async function exerciseRovingNavigation(page: Page, index: number) {
  const before = await prepareOverlay(page, index);
  const candidate = await page.evaluate(PICK_TYPEAHEAD_CANDIDATE, index);
  if (before.role === "listbox") {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);
    const afterFirstDown = await page.evaluate(READ_OVERLAY, index);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);
    const afterSecondDown = await page.evaluate(READ_OVERLAY, index);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(50);
    const afterArrowUp = await page.evaluate(READ_OVERLAY, index);
    const arrowUpWorked =
      afterArrowUp.present &&
      afterArrowUp.activeIndex >= 0 &&
      afterArrowUp.activeVisible &&
      (before.itemCount <= 1 ||
        afterArrowUp.activeIndex !== afterSecondDown.activeIndex);
    await page.keyboard.type(candidate.key);
    await page.waitForTimeout(100);
    await waitForDomQuiet(page);
    const filter = await page.evaluate(READ_FILTER_RESULT, {
      token: candidate.key,
    });
    return {
      role: before.role,
      before,
      afterFirstDown,
      afterSecondDown,
      afterArrowUp,
      afterEnd: null,
      afterHome: null,
      afterTypeahead: null,
      candidate,
      filter,
      arrowUpWorked,
      homeWorked: null,
      endWorked: null,
      typeaheadWorked:
        candidate.key.length > 0 &&
        filter.matching.length > 0 &&
        filter.foreign.length === 0,
    };
  }

  await page.evaluate(FOCUS_MENU_ITEM, { index, itemIndex: 0 });
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  const afterEnd = await page.evaluate(READ_OVERLAY, index);
  await page.keyboard.press("Home");
  await page.waitForTimeout(50);
  const afterHome = await page.evaluate(READ_OVERLAY, index);
  await page.evaluate(FOCUS_MENU_ITEM, {
    index,
    itemIndex: before.itemCount > 1 ? 1 : 0,
  });
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(50);
  const afterArrowUp = await page.evaluate(READ_OVERLAY, index);
  await page.evaluate(FOCUS_MENU_ITEM, { index, itemIndex: 0 });
  await page.keyboard.type(candidate.key);
  await page.waitForTimeout(50);
  const afterTypeahead = await page.evaluate(READ_OVERLAY, index);
  return {
    role: before.role,
    before,
    afterFirstDown: null,
    afterSecondDown: null,
    afterArrowUp,
    afterEnd,
    afterHome,
    afterTypeahead,
    candidate,
    filter: null,
    arrowUpWorked:
      afterArrowUp.present &&
      afterArrowUp.activeIndex === 0 &&
      afterArrowUp.activeVisible,
    endWorked:
      afterEnd.present &&
      afterEnd.activeIndex === Math.max(0, before.itemCount - 1) &&
      afterEnd.activeVisible,
    homeWorked:
      afterHome.present &&
      afterHome.activeIndex === 0 &&
      afterHome.activeVisible,
    typeaheadWorked:
      candidate.key.length > 0 &&
      afterTypeahead.present &&
      afterTypeahead.activeIndex === candidate.targetIndex &&
      afterTypeahead.activeVisible,
  };
}

async function exerciseRepeatedTypeahead(page: Page, index: number) {
  const before = await prepareOverlay(page, index);
  if (before.role !== "menu") return null;
  const candidate = await page.evaluate(
    PICK_REPEATED_TYPEAHEAD_CANDIDATE,
    index,
  );
  if (!candidate) return null;
  await page.evaluate(FOCUS_MENU_ITEM, {
    index,
    itemIndex: candidate.indices[0]!,
  });
  const observed: number[] = [];
  const visible: boolean[] = [];
  for (let press = 0; press < candidate.indices.length; press += 1) {
    await page.keyboard.press(candidate.key);
    await page.waitForTimeout(50);
    const state = await page.evaluate(READ_OVERLAY, index);
    observed.push(state.activeIndex);
    visible.push(state.activeVisible);
  }
  const expected = [...candidate.indices.slice(1), candidate.indices[0]!];
  return {
    candidate,
    observed,
    expected,
    visible,
    worked:
      JSON.stringify(observed) === JSON.stringify(expected) &&
      visible.every(Boolean),
  };
}

async function exerciseSubmenu(page: Page, relationIndex: number) {
  await page.evaluate(MARK_VISIBLE_OVERLAYS);
  const relations = await page.evaluate(MARK_SUBMENU_RELATIONS);
  const relation = relations[relationIndex];
  if (!relation)
    throw new Error(`submenu relation ${relationIndex} disappeared`);
  await page.evaluate(FOCUS_MENU_ITEM, {
    index: relation.childIndex,
    itemIndex: 0,
  });
  await page.keyboard.press("ArrowLeft");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterInitialLeft = await page.evaluate(READ_SUBMENU_RESULT, relation);
  await page.keyboard.press("ArrowRight");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterRight = await page.evaluate(READ_SUBMENU_RESULT, relation);
  await page.keyboard.press("ArrowLeft");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterFinalLeft = await page.evaluate(READ_SUBMENU_RESULT, relation);
  return {
    relation,
    afterInitialLeft,
    afterRight,
    afterFinalLeft,
    rightWorked:
      afterInitialLeft.triggerActive &&
      afterInitialLeft.activeVisible &&
      afterRight.childOpen &&
      afterRight.childActiveIndex >= 0 &&
      afterRight.activeVisible,
    leftWorked:
      !afterInitialLeft.childOpen &&
      afterInitialLeft.triggerActive &&
      afterInitialLeft.activeVisible &&
      !afterFinalLeft.childOpen &&
      afterFinalLeft.triggerActive &&
      afterFinalLeft.activeVisible,
  };
}

async function exerciseSubmenuTrigger(
  page: Page,
  parentIndex: number,
  triggerIndex: number,
) {
  await prepareOverlay(page, parentIndex);
  await page.evaluate(MARK_SUBMENU_TRIGGERS, parentIndex);
  const trigger = await page.evaluate(FOCUS_SUBMENU_TRIGGER, {
    index: parentIndex,
    triggerIndex,
  });
  if (!trigger)
    throw new Error(
      `submenu trigger ${parentIndex}/${triggerIndex} disappeared`,
    );
  await page.keyboard.press("ArrowRight");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  await page.evaluate(MARK_VISIBLE_OVERLAYS);
  const relations = await page.evaluate(MARK_SUBMENU_RELATIONS);
  const relation = relations.find((entry) => entry.triggerId === trigger.id);
  if (!relation)
    throw new Error(
      `submenu trigger ${JSON.stringify(trigger.label)} did not open`,
    );
  const afterRight = await page.evaluate(READ_SUBMENU_RESULT, relation);
  const disabled = await page.evaluate(
    PICK_DISABLED_SKIP_CANDIDATE,
    relation.childIndex,
  );
  let afterDown: Awaited<ReturnType<typeof READ_OVERLAY>> | null = null;
  let afterUp: Awaited<ReturnType<typeof READ_OVERLAY>> | null = null;
  if (disabled) {
    await page.evaluate(FOCUS_MENU_ITEM, {
      index: relation.childIndex,
      itemIndex: disabled.startEnabledIndex,
    });
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);
    afterDown = await page.evaluate(READ_OVERLAY, relation.childIndex);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(50);
    afterUp = await page.evaluate(READ_OVERLAY, relation.childIndex);
  }
  await page.keyboard.press("ArrowLeft");
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const afterLeft = await page.evaluate(READ_SUBMENU_RESULT, relation);
  return {
    trigger,
    relation,
    afterRight,
    afterLeft,
    disabled,
    afterDown,
    afterUp,
    traverseWorked:
      afterRight.childOpen &&
      afterRight.childActiveIndex >= 0 &&
      afterRight.activeVisible &&
      !afterLeft.childOpen &&
      afterLeft.triggerActive &&
      afterLeft.activeVisible,
    disabledWorked:
      !disabled ||
      (afterDown?.activeIndex === disabled.expectedEnabledIndex &&
        afterDown.activeVisible &&
        afterUp?.activeIndex === disabled.startEnabledIndex &&
        afterUp.activeVisible),
  };
}

test("三轴浮层量具能分别抓住激活、关闭、roving-focus 与 submenu 断路", async ({
  page,
}) => {
  const mutation = process.env.TRIPLE_OVERLAY_KEYBOARD_MUTATE ?? "";
  const axes = [
    ["baseline", 1280, 720, 16],
    ["width", WIDTH, 720, 16],
    ["height", 1280, HEIGHT, 16],
    ["text", 1280, 720, ROOT_PX],
    ["widthHeight", WIDTH, HEIGHT, 16],
    ["widthText", WIDTH, 720, ROOT_PX],
    ["heightText", 1280, HEIGHT, ROOT_PX],
    ["triple", WIDTH, HEIGHT, ROOT_PX],
  ] as const;

  const mount = async (width: number, height: number, rootPx: number) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`
      <style>html{font-size:${rootPx}px}</style>
      <button id="trigger" aria-haspopup="menu" aria-controls="menu" aria-expanded="true">open</button>
      <div id="menu" role="menu">
        <button id="first" role="menuitem">Alpha</button>
        <button id="disabled" role="menuitem" aria-disabled="true">Atlas disabled</button>
        <button id="second" role="menuitem" aria-haspopup="menu" aria-controls="submenu" aria-expanded="false">Beta</button>
        <button id="repeat" role="menuitem">Bravo</button>
        <button id="third" role="menuitem">Charlie</button>
      </div>
      <div id="submenu" role="menu" hidden>
        <button id="sub-first" role="menuitem">Delta</button>
        <button id="sub-second" role="menuitem">Echo</button>
      </div>
      <script>
        (() => {
        const triple = innerWidth <= ${WIDTH} && innerHeight <= ${HEIGHT} && parseFloat(getComputedStyle(document.documentElement).fontSize) >= ${ROOT_PX};
        const broken = triple ? ${JSON.stringify(mutation)} : "";
        const trigger = document.querySelector("#trigger");
        const menu = document.querySelector("#menu");
        const submenu = document.querySelector("#submenu");
        const submenuTrigger = document.querySelector("#second");
        const disabledItem = document.querySelector("#disabled");
        const items = [...menu.querySelectorAll(':scope > [role="menuitem"]')].filter(item => item.getAttribute("aria-disabled") !== "true");
        const submenuItems = [...submenu.querySelectorAll('[role="menuitem"]')];
        let lastTypeaheadKey = "";
        menu.addEventListener("keydown", event => {
          const at = items.indexOf(document.activeElement);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (broken === "disabled" && document.activeElement === items[0]) disabledItem.focus();
            else if (!(broken === "arrow" && document.activeElement === submenuTrigger)) items[(at + 1 + items.length) % items.length].focus();
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (broken !== "up") items[(at - 1 + items.length) % items.length].focus();
          }
          if (event.key === "Home") {
            event.preventDefault();
            if (broken !== "home") items[0].focus();
          }
          if (event.key === "End") {
            event.preventDefault();
            if (broken !== "end") items.at(-1).focus();
          }
          if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
            event.preventDefault();
            const key = event.key.toLowerCase();
            const matches = items.filter(item => item.textContent.trim().toLowerCase().startsWith(key));
            const current = matches.indexOf(document.activeElement);
            const match = broken === "repeat" && lastTypeaheadKey === key
              ? matches[0]
              : matches[(current + 1 + matches.length) % matches.length];
            if (broken !== "typeahead") match?.focus();
            lastTypeaheadKey = key;
          }
          if (event.key === "ArrowRight" && document.activeElement === submenuTrigger) {
            event.preventDefault();
            if (broken !== "right") {
              submenu.hidden = false;
              submenuTrigger.setAttribute("aria-expanded", "true");
              submenuItems[0].focus();
            }
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const activationBroken = event.key === "Enter" ? broken === "enter" : broken === "space";
            if (!activationBroken) {
              menu.dataset.activated = document.activeElement.id;
              menu.hidden = true;
              trigger.focus();
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            if (broken !== "escape") {
              menu.hidden = true;
              trigger.focus();
            }
          }
        });
        submenu.addEventListener("keydown", event => {
          if (event.key !== "ArrowLeft") return;
          event.preventDefault();
          if (broken !== "left") {
            submenu.hidden = true;
            submenuTrigger.setAttribute("aria-expanded", "false");
            submenuTrigger.focus();
          }
        });
        items[0].focus();
        })();
      </script>
    `);
  };

  for (const [name, width, height, rootPx] of axes) {
    await mount(width, height, rootPx);
    await page.locator("#second").focus();
    await page.keyboard.press("ArrowDown");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[ArrowDown]`,
    ).toBe("repeat");
    await page.keyboard.press("Enter");
    expect(
      await page.locator("#menu").getAttribute("data-activated"),
      `${name}[Enter]`,
    ).toBe("repeat");

    await mount(width, height, rootPx);
    await page.keyboard.press("ArrowDown");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[disabled-skip]`,
    ).toBe("second");

    await mount(width, height, rootPx);
    await page.locator("#second").focus();
    await page.keyboard.press("Space");
    expect(
      await page.locator("#menu").getAttribute("data-activated"),
      `${name}[Space]`,
    ).toBe("second");

    await mount(width, height, rootPx);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    expect(
      await page.locator("#menu").isHidden(),
      `${name}[Escape-close]`,
    ).toBe(true);
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[Escape-focus]`,
    ).toBe("trigger");

    await mount(width, height, rootPx);
    await page.keyboard.press("ArrowUp");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[ArrowUp]`,
    ).toBe("third");
    await page.keyboard.press("Home");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[Home]`,
    ).toBe("first");
    await page.keyboard.press("End");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[End]`,
    ).toBe("third");
    await page.keyboard.type("b");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[typeahead]`,
    ).toBe("second");
    await page.keyboard.type("b");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[typeahead-repeat-next]`,
    ).toBe("repeat");
    await page.keyboard.type("b");
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[typeahead-repeat-wrap]`,
    ).toBe("second");
    await page.keyboard.press("ArrowRight");
    expect(
      await page.locator("#submenu").isVisible(),
      `${name}[ArrowRight-open]`,
    ).toBe(true);
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[ArrowRight-focus]`,
    ).toBe("sub-first");
    await page.keyboard.press("ArrowLeft");
    expect(
      await page.locator("#submenu").isHidden(),
      `${name}[ArrowLeft-close]`,
    ).toBe(true);
    expect(
      await page.locator(":focus").getAttribute("id"),
      `${name}[ArrowLeft-focus]`,
    ).toBe("second");
  }
});

test("Vue / React 的三轴 menu 与 listbox 支持完整内部键盘导航并归还焦点", async ({
  browser,
}) => {
  test.setTimeout(3_600_000);
  const shapes = new Map<string, string[]>();
  const allFailures: string[] = [];

  expect(
    SCENARIOS.length,
    `TRIPLE_OVERLAY_ONLY=${[...ONLY].join(",")} 没有匹配到任何场景`,
  ).toBeGreaterThan(0);
  expect(
    SCENARIOS.length,
    "TRIPLE_OVERLAY_ONLY 中至少一个场景 id 没有匹配",
  ).toBe(ONLY.size || PARITY_SCENARIOS.length);

  for (const [name, base] of APPS) {
    let scanned = 0;
    let overlayStates = 0;
    let overlays = 0;
    let arrowPassed = 0;
    let enterPassed = 0;
    let escapePassed = 0;
    let arrowUpPassed = 0;
    let homePassed = 0;
    let endPassed = 0;
    let typeaheadPassed = 0;
    let spacePassed = 0;
    let repeatedTypeaheadCandidates = 0;
    let repeatedTypeaheadPassed = 0;
    let menuOverlays = 0;
    let submenuRelations = 0;
    let submenuRightPassed = 0;
    let submenuLeftPassed = 0;
    let submenuTriggerCount = 0;
    let submenuTraversePassed = 0;
    let disabledSkipCandidates = 0;
    let disabledSkipPassed = 0;
    const appShapes: string[] = [];

    for (const scenario of SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        let descriptors: OverlayDescriptor[] = [];
        let relations: SubmenuRelation[] = [];
        const discovery = await openState(browser, base, scenario, state);
        try {
          descriptors = await discovery.page.evaluate(MARK_VISIBLE_OVERLAYS);
          relations = await discovery.page.evaluate(MARK_SUBMENU_RELATIONS);
          if (ONLY.size > 0) {
            const diagnostic = await discovery.page.evaluate(DIAGNOSE_OVERLAYS);
            if (diagnostic.overlays.length > 0)
              console.info(
                `[triple-overlay-diagnostic] ${name}:${key} ${JSON.stringify(diagnostic)}`,
              );
          }
        } catch (error) {
          allFailures.push(
            `${name}:${key}[discover] ${String(error).split("\n")[0]?.slice(0, 160)}`,
          );
        } finally {
          await discovery.context.close();
        }
        scanned += 1;
        if (descriptors.length > 0) overlayStates += 1;
        overlays += descriptors.length;
        menuOverlays += descriptors.filter(
          (descriptor) => descriptor.role === "menu",
        ).length;
        submenuRelations += relations.length;
        submenuTriggerCount += descriptors.reduce(
          (count, descriptor) => count + descriptor.submenuTriggers.length,
          0,
        );
        appShapes.push(
          `${key}:${descriptors
            .map(
              (descriptor) =>
                `${descriptor.role}(${descriptor.items.length}+${descriptor.disabledItems.length}d/` +
                `${descriptor.submenuTriggers.length}s)`,
            )
            .sort()
            .join("+")}`,
        );

        for (const descriptor of descriptors) {
          const label = `${name}:${key}:${descriptor.role}[${descriptor.index}]`;
          const activation = await openState(browser, base, scenario, state);
          try {
            await activation.page.evaluate(MARK_VISIBLE_OVERLAYS);
            const result = await exerciseArrowEnter(
              activation.page,
              descriptor.index,
            );
            if (result.arrowWorked) arrowPassed += 1;
            else
              allFailures.push(
                `${label}[ArrowDown] before=${result.before.activeIndex}/${result.before.itemCount} ` +
                  `after=${result.afterArrow.activeIndex} visible=${result.afterArrow.activeVisible} ` +
                  `items=${JSON.stringify(result.before.labels)}`,
              );
            if (result.enterWorked) enterPassed += 1;
            else
              allFailures.push(
                `${label}[Enter] active=${result.afterArrow.activeIndex} ` +
                  `present=${result.afterEnter.present} ` +
                  `states=${JSON.stringify(result.afterEnter.states)} ` +
                  `activations=${JSON.stringify(result.activations)}`,
              );
          } catch (error) {
            allFailures.push(
              `${label}[ArrowDown/Enter] ${String(error).split("\n")[0]?.slice(0, 160)}`,
            );
          } finally {
            await activation.context.close();
          }

          const dismissal = await openState(browser, base, scenario, state);
          try {
            await dismissal.page.evaluate(MARK_VISIBLE_OVERLAYS);
            const result = await exerciseEscape(
              dismissal.page,
              descriptor.index,
            );
            if (
              result.trigger.ids.length > 0 &&
              result.closed &&
              result.focusReturned &&
              result.triggerVisible
            )
              escapePassed += 1;
            else
              allFailures.push(
                `${label}[Escape] triggers=${JSON.stringify(result.trigger.labels)} closed=${result.closed} ` +
                  `focusReturned=${result.focusReturned} triggerVisible=${result.triggerVisible} active=${JSON.stringify(result.active)}`,
              );
          } catch (error) {
            allFailures.push(
              `${label}[Escape] ${String(error).split("\n")[0]?.slice(0, 160)}`,
            );
          } finally {
            await dismissal.context.close();
          }

          const navigation = await openState(browser, base, scenario, state);
          try {
            await navigation.page.evaluate(MARK_VISIBLE_OVERLAYS);
            const result = await exerciseRovingNavigation(
              navigation.page,
              descriptor.index,
            );
            if (result.arrowUpWorked) arrowUpPassed += 1;
            else
              allFailures.push(
                `${label}[ArrowUp] role=${result.role} before=${result.before.activeIndex}/${result.before.itemCount} ` +
                  `after=${result.afterArrowUp.activeIndex} visible=${result.afterArrowUp.activeVisible}`,
              );
            if (result.homeWorked === true) homePassed += 1;
            else if (result.homeWorked === false)
              allFailures.push(
                `${label}[Home] active=${result.afterHome?.activeIndex} visible=${result.afterHome?.activeVisible}`,
              );
            if (result.endWorked === true) endPassed += 1;
            else if (result.endWorked === false)
              allFailures.push(
                `${label}[End] active=${result.afterEnd?.activeIndex}/${result.before.itemCount} ` +
                  `visible=${result.afterEnd?.activeVisible}`,
              );
            if (result.typeaheadWorked) typeaheadPassed += 1;
            else
              allFailures.push(
                `${label}[typeahead] key=${JSON.stringify(result.candidate.key)} ` +
                  `target=${result.candidate.targetIndex}:${JSON.stringify(result.candidate.targetLabel)} ` +
                  `active=${result.afterTypeahead?.activeIndex ?? "filter"} ` +
                  `labels=${JSON.stringify(result.filter?.labels ?? result.afterTypeahead?.labels ?? [])}`,
              );
          } catch (error) {
            allFailures.push(
              `${label}[roving] ${String(error).split("\n")[0]?.slice(0, 160)}`,
            );
          } finally {
            await navigation.context.close();
          }

          if (descriptor.role === "menu") {
            const space = await openState(browser, base, scenario, state);
            try {
              await space.page.evaluate(MARK_VISIBLE_OVERLAYS);
              const result = await exerciseSpace(space.page, descriptor.index);
              if (result?.worked) spacePassed += 1;
              else
                allFailures.push(
                  `${label}[Space] active=${result?.beforeSpace.activeIndex ?? "missing"} ` +
                    `present=${result?.afterSpace.present ?? "missing"} ` +
                    `states=${JSON.stringify(result?.afterSpace.states ?? [])} ` +
                    `activations=${JSON.stringify(result?.activations ?? [])}`,
                );
            } catch (error) {
              allFailures.push(
                `${label}[Space] ${String(error).split("\n")[0]?.slice(0, 160)}`,
              );
            } finally {
              await space.context.close();
            }

            const repeated = await openState(browser, base, scenario, state);
            try {
              await repeated.page.evaluate(MARK_VISIBLE_OVERLAYS);
              const result = await exerciseRepeatedTypeahead(
                repeated.page,
                descriptor.index,
              );
              if (result) {
                repeatedTypeaheadCandidates += 1;
                if (result.worked) repeatedTypeaheadPassed += 1;
                else
                  allFailures.push(
                    `${label}[typeahead-repeat] key=${JSON.stringify(result.candidate.key)} ` +
                      `labels=${JSON.stringify(result.candidate.labels)} expected=${JSON.stringify(result.expected)} ` +
                      `observed=${JSON.stringify(result.observed)} visible=${JSON.stringify(result.visible)}`,
                  );
              }
            } catch (error) {
              allFailures.push(
                `${label}[typeahead-repeat] ${String(error).split("\n")[0]?.slice(0, 160)}`,
              );
            } finally {
              await repeated.context.close();
            }
          }

          for (
            let triggerIndex = 0;
            triggerIndex < descriptor.submenuTriggers.length;
            triggerIndex += 1
          ) {
            const traversal = await openState(browser, base, scenario, state);
            try {
              await traversal.page.evaluate(MARK_VISIBLE_OVERLAYS);
              const result = await exerciseSubmenuTrigger(
                traversal.page,
                descriptor.index,
                triggerIndex,
              );
              if (result.traverseWorked) submenuTraversePassed += 1;
              else
                allFailures.push(
                  `${label}[submenu-traverse:${result.trigger.label}] right=${JSON.stringify(result.afterRight)} ` +
                    `left=${JSON.stringify(result.afterLeft)}`,
                );
              if (result.disabled) {
                disabledSkipCandidates += 1;
                if (result.disabledWorked) disabledSkipPassed += 1;
                else
                  allFailures.push(
                    `${label}[disabled-skip:${result.trigger.label}] disabled=${JSON.stringify(result.disabled.disabledLabels)} ` +
                      `start=${result.disabled.startEnabledIndex}:${JSON.stringify(result.disabled.startLabel)} ` +
                      `expected=${result.disabled.expectedEnabledIndex}:${JSON.stringify(result.disabled.expectedLabel)} ` +
                      `down=${result.afterDown?.activeIndex ?? "missing"} up=${result.afterUp?.activeIndex ?? "missing"}`,
                  );
              }
            } catch (error) {
              allFailures.push(
                `${label}[submenu-traverse:${triggerIndex}] ${String(error).split("\n")[0]?.slice(0, 160)}`,
              );
            } finally {
              await traversal.context.close();
            }
          }
        }

        for (const [relationIndex, relation] of relations.entries()) {
          const relationLabel = `${name}:${key}:submenu[${relation.triggerLabel}]`;
          const submenu = await openState(browser, base, scenario, state);
          try {
            const result = await exerciseSubmenu(submenu.page, relationIndex);
            if (result.rightWorked) submenuRightPassed += 1;
            else
              allFailures.push(
                `${relationLabel}[ArrowRight] initial=${JSON.stringify(result.afterInitialLeft)} ` +
                  `after=${JSON.stringify(result.afterRight)}`,
              );
            if (result.leftWorked) submenuLeftPassed += 1;
            else
              allFailures.push(
                `${relationLabel}[ArrowLeft] initial=${JSON.stringify(result.afterInitialLeft)} ` +
                  `final=${JSON.stringify(result.afterFinalLeft)}`,
              );
          } catch (error) {
            allFailures.push(
              `${relationLabel}[submenu] ${String(error).split("\n")[0]?.slice(0, 160)}`,
            );
          } finally {
            await submenu.context.close();
          }
        }
      }

    shapes.set(name, appShapes);
    console.info(
      `[triple-overlay-keyboard] ${name} scanned=${scanned} overlayStates=${overlayStates} ` +
        `overlays=${overlays} arrow=${arrowPassed}/${overlays} enter=${enterPassed}/${overlays} ` +
        `escape=${escapePassed}/${overlays} arrowUp=${arrowUpPassed}/${overlays} ` +
        `home=${homePassed}/${menuOverlays} end=${endPassed}/${menuOverlays} ` +
        `typeahead=${typeaheadPassed}/${overlays} space=${spacePassed}/${menuOverlays} ` +
        `typeaheadRepeat=${repeatedTypeaheadPassed}/${repeatedTypeaheadCandidates} ` +
        `submenuRight=${submenuRightPassed}/${submenuRelations} submenuLeft=${submenuLeftPassed}/${submenuRelations} ` +
        `submenuTraverse=${submenuTraversePassed}/${submenuTriggerCount} ` +
        `disabledSkip=${disabledSkipPassed}/${disabledSkipCandidates}`,
    );
    if (allFailures.length > 0)
      console.info(
        `[triple-overlay-failures:${name}] ${JSON.stringify(allFailures)}`,
      );
    expect(scanned, `${name} 没走完全部终态`).toBe(EXPECTED_STATES);
    expect(overlayStates, `${name} 没发现任何运行时浮层`).toBeGreaterThan(0);
    expect(overlays, `${name} 的浮层发现空转`).toBeGreaterThanOrEqual(
      overlayStates,
    );
    expect(
      menuOverlays,
      `${name} 没发现可验证 Home / End 的 menu`,
    ).toBeGreaterThan(0);
    expect(
      submenuRelations,
      `${name} 没发现可验证 ArrowRight / ArrowLeft 的 submenu`,
    ).toBeGreaterThan(0);
    expect(
      repeatedTypeaheadCandidates,
      `${name} 没发现可验证重复首字符循环的 menu`,
    ).toBeGreaterThan(0);
    expect(
      submenuTriggerCount,
      `${name} 没发现可遍历的 submenu trigger`,
    ).toBeGreaterThan(0);
    expect(
      disabledSkipCandidates,
      `${name} 没发现可验证方向键跳过 disabled item 的 submenu`,
    ).toBeGreaterThan(0);
  }

  console.info(`[triple-overlay-failures] ${JSON.stringify(allFailures)}`);
  expect(
    allFailures,
    `三轴浮层键盘语义失败：\n${allFailures.join("\n")}`,
  ).toEqual([]);
  expect(
    shapes.get("vue"),
    "两个应用运行时发现的 menu/listbox 终态与 item 数不一致",
  ).toEqual(shapes.get("react"));
});
