import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import SetupPage from "@/app/(auth)/setup/page";
import AuthCallbackPage from "@/app/auth/callback/page";
import { I18nProvider } from "@/core/i18n/context";

const mocks = rs.hoisted(() => ({
  router: { push: rs.fn(), replace: rs.fn() },
  user: null as null | { id: string; email: string; needs_setup: boolean },
  next: "/workspace/chats?view=safe#answer",
}));
rs.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams({ next: mocks.next }),
}));
rs.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light" }),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, isAuthenticated: mocks.user !== null }),
}));
rs.mock("@/components/ui/flickering-grid", () => ({
  FlickeringGrid: () => null,
}));

beforeEach(() => {
  mocks.user = null;
  mocks.next = "/workspace/chats?view=safe#answer";
  mocks.router.push.mockReset();
  mocks.router.replace.mockReset();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  rs.useRealTimers();
  rs.unstubAllGlobals();
});

function renderPage(locale: "en-US" | "zh-CN", callback = false) {
  document.cookie = `locale=${locale}; path=/`;
  return render(
    <I18nProvider initialLocale={locale}>
      {callback ? <AuthCallbackPage /> : <SetupPage />}
    </I18nProvider>,
  );
}

for (const [locale, copy] of [
  [
    "en-US",
    {
      title: "Create admin account",
      email: "Email",
      password: "Password",
      confirm: "Confirm Password",
      create: "Create Admin Account",
      mismatch: "Passwords do not match",
      yourEmail: "Your email",
      current: "Current password",
      next: "New password",
      confirmNext: "Confirm new password",
      complete: "Complete Setup",
      signing: "Signing you in...",
      redirecting: "Redirecting...",
      failed: "Authentication failed. Redirecting to login...",
      unavailable:
        "Gateway is temporarily unavailable. Redirecting to recovery...",
    },
  ],
  [
    "zh-CN",
    {
      title: "创建管理员账号",
      email: "邮箱",
      password: "密码",
      confirm: "确认密码",
      create: "创建管理员账号",
      mismatch: "两次输入的密码不一致",
      yourEmail: "你的邮箱",
      current: "当前密码",
      next: "新密码",
      confirmNext: "确认新密码",
      complete: "完成设置",
      signing: "正在登录...",
      redirecting: "正在跳转...",
      failed: "认证失败，正在跳转到登录页...",
      unavailable: "Gateway 暂时不可用，正在跳转到恢复页...",
    },
  ],
] as const) {
  describe(`actual auth pages ${locale}`, () => {
    it("localizes initialization and validates without submitting mismatched passwords", async () => {
      const fetchMock = rs
        .fn()
        .mockResolvedValue(Response.json({ needs_setup: true }));
      rs.stubGlobal("fetch", fetchMock);
      renderPage(locale);
      expect(
        await screen.findByText(copy.title, { selector: "p" }),
      ).toBeTruthy();
      fireEvent.change(screen.getByLabelText(copy.email, { exact: true }), {
        target: { value: "admin@example.com" },
      });
      fireEvent.change(screen.getByLabelText(copy.password, { exact: true }), {
        target: { value: "password-123" },
      });
      fireEvent.change(screen.getByLabelText(copy.confirm, { exact: true }), {
        target: { value: "different-123" },
      });
      fireEvent.submit(
        screen.getByRole("button", { name: copy.create }).closest("form")!,
      );
      expect((await screen.findByRole("alert")).textContent).toBe(
        copy.mismatch,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps change-password fields explicit and posts the existing CSRF contract", async () => {
      mocks.user = {
        id: "setup-owner",
        email: "temporary@example.com",
        needs_setup: true,
      };
      document.cookie = "csrf_token=auth-page-csrf; path=/";
      const fetchMock = rs.fn().mockResolvedValue(Response.json({}));
      rs.stubGlobal("fetch", fetchMock);
      renderPage(locale);
      const email = await screen.findByPlaceholderText(copy.yourEmail);
      expect((email as HTMLInputElement).value).toBe("");
      expect(
        screen.getByLabelText(copy.yourEmail).getAttribute("autocomplete"),
      ).toBe("email");
      expect(
        screen.getByLabelText(copy.current).getAttribute("autocomplete"),
      ).toBe("current-password");
      expect(
        screen
          .getByLabelText(copy.next, { exact: true })
          .getAttribute("autocomplete"),
      ).toBe("new-password");
      expect(
        screen.getByLabelText(copy.confirmNext).getAttribute("autocomplete"),
      ).toBe("new-password");
      fireEvent.change(email, { target: { value: "real@example.com" } });
      fireEvent.change(screen.getByPlaceholderText(copy.current), {
        target: { value: "temporary-password" },
      });
      fireEvent.change(
        screen.getByPlaceholderText(copy.next, { exact: true }),
        { target: { value: "new-password-123" } },
      );
      fireEvent.change(screen.getByPlaceholderText(copy.confirmNext), {
        target: { value: "new-password-123" },
      });
      fireEvent.submit(
        screen.getByRole("button", { name: copy.complete }).closest("form")!,
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/change-password",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "X-CSRF-Token": "auth-page-csrf",
          }),
          body: JSON.stringify({
            current_password: "temporary-password",
            new_password: "new-password-123",
            new_email: "real@example.com",
            remember_me: true,
          }),
        }),
      );
      expect(mocks.router.push).toHaveBeenCalledWith("/workspace");
    });

    for (const [status, text, expected] of [
      [200, copy.redirecting, "/workspace/chats?view=safe#answer"],
      [401, copy.failed, "/login?error=sso_failed"],
      [
        503,
        copy.unavailable,
        "/login?error=gateway_unavailable&next=%2Fworkspace%2Fchats%3Fview%3Dsafe%23answer",
      ],
    ] as const) {
      it(`renders localized callback ${status} and preserves safe replace navigation`, async () => {
        rs.useFakeTimers();
        let resolve!: (response: Response) => void;
        const fetchMock = rs.fn().mockImplementation(
          () =>
            new Promise<Response>((done) => {
              resolve = done;
            }),
        );
        rs.stubGlobal("fetch", fetchMock);
        renderPage(locale, true);
        expect(screen.getByText(copy.signing)).toBeTruthy();
        await act(async () => {
          resolve(new Response(null, { status }));
        });
        expect(screen.getByText(text)).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(async () => {
          await rs.advanceTimersByTimeAsync(status === 200 ? 300 : 1500);
        });
        expect(mocks.router.replace).toHaveBeenCalledWith(expected);
      });
    }

    it("rejects an external callback next even with a valid session", async () => {
      rs.useFakeTimers();
      mocks.next = "https://evil.example/phish";
      rs.stubGlobal(
        "fetch",
        rs.fn().mockResolvedValue(new Response(null, { status: 200 })),
      );
      renderPage(locale, true);
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await rs.advanceTimersByTimeAsync(300);
      });
      expect(mocks.router.replace).toHaveBeenCalledWith("/workspace");
    });
  });
}

it("a callback unmounted while the actual session probe is pending cannot navigate later", async () => {
  rs.useFakeTimers();
  let resolve!: (response: Response) => void;
  rs.stubGlobal(
    "fetch",
    rs.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const wrapper = renderPage("en-US", true);
  wrapper.unmount();
  await act(async () => {
    resolve(new Response(null, { status: 200 }));
  });
  await act(async () => {
    await rs.advanceTimersByTimeAsync(1500);
  });
  expect(mocks.router.replace).not.toHaveBeenCalled();
});
