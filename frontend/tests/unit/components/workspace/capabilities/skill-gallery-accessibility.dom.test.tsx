import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";

import { SkillGallery } from "@/components/workspace/capabilities/skill-gallery";
import { I18nProvider } from "@/core/i18n/context";

rs.mock("@/core/settings/user-preferences", () => ({
  useSyncLocalePreference: rs.fn(),
}));

const skillRead = rs.hoisted(() => ({ error: null as Error | null }));

rs.mock("next/navigation", () => ({ useRouter: () => ({ push: rs.fn() }) }));

rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { system_role: "admin" } }),
}));

rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({
    skills: [
      {
        name: "data-analysis",
        description: "Analyze data",
        category: "public",
        enabled: true,
      },
      {
        name: "frontend-design",
        description: "Design UI",
        category: "public",
        enabled: false,
      },
    ],
    isLoading: false,
    error: skillRead.error,
  }),
  useEnableSkill: () => ({ mutate: rs.fn() }),
  // 上游 #5039 给这一屏加了「安装本地技能包」，组件现在会调它。
  // 这份 mock 少一个成员，整块 rs.mock 就把真模块替换成了不完整的对象，
  // 报出来是 `useUploadSkillArchive is not a function`。
  useUploadSkillArchive: () => ({
    mutate: rs.fn(),
    mutateAsync: rs.fn(),
    isPending: false,
    reset: rs.fn(),
  }),
}));

rs.mock("@/env", () => ({
  env: { NEXT_PUBLIC_STATIC_WEBSITE_ONLY: "false" },
}));

// 每条用例后卸载：不卸载的话第二次 render 会和第一次的 DOM 叠在一起，
// `getByRole` 直接撞 "found multiple elements"，而那和产品无关。
afterEach(cleanup);

beforeEach(() => {
  skillRead.error = null;
});

describe("SkillGallery accessible names", () => {
  // A column of identical unnamed switches tells a screen reader nothing about
  // which skill it is toggling (WCAG 4.1.2).
  it("names each switch after its skill", () => {
    render(
      <I18nProvider initialLocale="en-US">
        <SkillGallery />
      </I18nProvider>,
    );
    const names = screen
      .getAllByRole("switch")
      .map((node) => node.getAttribute("aria-label"));
    expect(names[0]).toContain("data-analysis");
    expect(names[1]).toContain("frontend-design");
    expect(new Set(names).size).toBe(names.length);
  });

  // An unnamed tab list is announced as a bare "tab list", which says nothing
  // about what it filters.
  it("names the public/custom tab list", () => {
    render(
      <I18nProvider initialLocale="en-US">
        <SkillGallery />
      </I18nProvider>,
    );
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe(
      "Skills",
    );
  });
  it("announces a failed catalog load", () => {
    skillRead.error = new Error("Catalog unavailable");
    render(
      <I18nProvider initialLocale="en-US">
        <SkillGallery />
      </I18nProvider>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Catalog unavailable");
  });

  it("keeps the archive carrier out of keyboard and accessible navigation", () => {
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <SkillGallery />
      </I18nProvider>,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input?.getAttribute("aria-hidden")).toBe("true");
    expect(input?.getAttribute("tabindex")).toBe("-1");
  });
});
