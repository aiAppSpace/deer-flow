/*
  两排 turn actions 的合同。

  助手那排此前用错了两颗图标（GitBranch / RefreshCw，上游是 GitBranchPlus /
  RefreshCcw），人类那排干脆是两颗裸 `<button>`——一个 14px 的 svg 加一段带下划线
  的文字。这两处对照台账都看不见：可访问性树看不见 svg 长什么样，而整排
  `opacity-0` 又不是几何锚点，图标 + aria-label 与可见文字念出来还恰好是同一句。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AssistantTurnActions from "@/components/chat/AssistantTurnActions.vue";
import HumanTurnActions from "@/components/chat/HumanTurnActions.vue";

const assistantProps = {
  copied: false,
  copyLabel: "Copy response",
  branchLabel: "Branch",
  regenerateLabel: "Regenerate",
  showBranch: true,
  showRegenerate: true,
};

describe("AssistantTurnActions", () => {
  it("draws the upstream branch and regenerate icons", () => {
    const wrapper = mount(AssistantTurnActions, { props: assistantProps });

    expect(wrapper.find(".lucide-git-branch-plus").exists()).toBe(true);
    expect(wrapper.find(".lucide-refresh-ccw").exists()).toBe(true);
    // 名字只差一两个字母的另外两颗。
    expect(wrapper.find(".lucide-git-branch-icon").exists()).toBe(false);
    expect(wrapper.find(".lucide-refresh-cw-icon").exists()).toBe(false);
    expect(wrapper.get(".lucide-refresh-ccw").classes()).toContain("size-4");
  });

  /*
    与 HumanTurnActions 那颗同一条修法（wave 62 两边同改）：tooltip 挂的是
    `aria-describedby`，不是可访问名。这里钉的是 assistant 那一排也念得出来。
  */
  it("names the copy button", () => {
    const copy = mount(AssistantTurnActions, {
      props: assistantProps,
    }).findAll("button")[0];

    expect(copy?.attributes("aria-label")).toBe(assistantProps.copyLabel);
    expect(copy?.text()).toBe("");
  });

  it("leaves the row colour to the ghost buttons", () => {
    const row = mount(AssistantTurnActions, {
      props: assistantProps,
    }).get("[data-testid='assistant-turn-actions']");

    expect(row.classes()).not.toContain("text-muted-foreground");
    expect(row.classes()).toContain("gap-1");
  });

  it("keeps mobile actions visible and reveals desktop actions for focus and open menus", () => {
    const row = mount(AssistantTurnActions, { props: assistantProps }).get(
      "[data-testid='assistant-turn-actions']",
    );
    expect(row.classes()).toEqual(
      expect.arrayContaining([
        "opacity-100",
        "sm:opacity-0",
        "sm:group-hover/assistant-turn:opacity-100",
        "focus-within:opacity-100",
        "has-[[data-state=open]]:opacity-100",
      ]),
    );
    expect(row.classes()).not.toContain("opacity-0");
  });

  it("announces the copied state with the same icon size and restores the copy label", async () => {
    const wrapper = mount(AssistantTurnActions, {
      props: { ...assistantProps, copiedLabel: "Copied to clipboard" },
    });
    await wrapper.setProps({ copied: true });
    expect(wrapper.findAll("button")[0]?.attributes("aria-label")).toBe(
      "Copied to clipboard",
    );
    expect(wrapper.get(".lucide-check").classes()).toEqual(
      expect.arrayContaining(["size-4", "text-green-500"]),
    );
    await wrapper.setProps({ copied: false });
    expect(wrapper.findAll("button")[0]?.attributes("aria-label")).toBe(
      assistantProps.copyLabel,
    );
  });
});

describe("HumanTurnActions", () => {
  const props = {
    copied: false,
    copyLabel: "Copy response",
    editLabel: "Edit and rerun",
    showEdit: true,
  };

  it("uses icon buttons instead of a text link", () => {
    const wrapper = mount(HumanTurnActions, { props });
    const buttons = wrapper.findAll("button");

    expect(buttons).toHaveLength(2);
    expect(wrapper.find(".lucide-pencil").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Edit and rerun");
    expect(buttons[1]?.attributes("aria-label")).toBe("Edit and rerun");
    expect(wrapper.get(".lucide-pencil").classes()).toContain("size-4");
  });

  /*
    **wave 62 把这一条反过来了，两边同改。** 原来钉的是「复制那颗确实没有名字，
    照着上游抄」——上游确实没有，但那是一处缺陷：tooltip 在 Radix / Reka 里挂的是
    `aria-describedby`，不是可访问名，读屏器只念得出一颗「按钮」。
    React 侧已在 `frontend/src/components/workspace/copy-button.tsx` 补上同一句。

    仍然钉「按钮里没有可见文字」：名字只能来自 aria-label，图标按钮不该冒出文字。
  */
  it("names the copy button, matching upstream after the shared fix", () => {
    const copy = mount(HumanTurnActions, { props }).findAll("button")[0];

    expect(copy?.attributes("aria-label")).toBe("Copy response");
    expect(copy?.text()).toBe("");
  });

  /*
    这一排从 16px 高变成 32px 高（icon-sm 按钮），底边偏移要跟着从 -bottom-7
    变成 -bottom-9，气泡与按钮之间才还是 4px。
  */
  it("keeps the upstream toolbar geometry classes", () => {
    const row = mount(HumanTurnActions, { props }).get(
      "[data-testid='human-turn-actions']",
    );

    expect(row.classes()).toContain("-bottom-9");
    expect(row.classes()).toContain("mt-4");
    expect(row.classes()).toContain("z-20");
    expect(row.classes()).toContain("justify-end");
    expect(row.classes()).not.toContain("-bottom-7");
    expect(row.classes()).not.toContain("justify-between");
    expect(row.get("div").classes()).toContain("pointer-events-auto");
  });

  it("hides the edit button when the turn is not editable", () => {
    const wrapper = mount(HumanTurnActions, {
      props: { ...props, showEdit: false },
    });

    expect(wrapper.findAll("button")).toHaveLength(1);
  });

  it("announces the copied state and restores the original label", async () => {
    const wrapper = mount(HumanTurnActions, {
      props: { ...props, copiedLabel: "Copied to clipboard" },
    });
    await wrapper.setProps({ copied: true });
    expect(wrapper.findAll("button")[0]?.attributes("aria-label")).toBe(
      "Copied to clipboard",
    );
    expect(wrapper.get(".lucide-check").classes()).toContain("size-4");
    await wrapper.setProps({ copied: false });
    expect(wrapper.findAll("button")[0]?.attributes("aria-label")).toBe(
      props.copyLabel,
    );
  });
});
