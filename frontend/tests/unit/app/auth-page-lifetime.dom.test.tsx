import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LoginPage from "@/app/(auth)/login/page";
import SetupPage from "@/app/(auth)/setup/page";
import { I18nProvider } from "@/core/i18n/context";
const mocks = rs.hoisted(() => ({
  router: { push: rs.fn(), replace: rs.fn() },
  user: null as null | { id: string; needs_setup: boolean },
}));
rs.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams({ next: "/workspace/chats" }),
}));
rs.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light" }),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  ...rs.requireActual("@/core/auth/AuthProvider"),
  useAuth: () => ({ user: mocks.user, isAuthenticated: mocks.user !== null }),
}));
rs.mock("@/components/ui/flickering-grid", () => ({
  FlickeringGrid: () => null,
}));
function pending<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mocks.user = null;
  mocks.router.push.mockClear();
  mocks.router.replace.mockClear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  rs.unstubAllGlobals();
});
for (const kind of ["login", "initialize", "password"] as const)
  for (const leave of [false, true]) {
    it(`${kind} success navigates only while its page is mounted (leave=${leave})`, async () => {
      const response = pending<Response>();
      if (kind === "password") mocks.user = { id: "owner", needs_setup: true };
      const fetchMock = rs.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.endsWith("/setup-status"))
          return Promise.resolve(
            Response.json({ needs_setup: kind === "initialize" }),
          );
        if (url.endsWith("/providers"))
          return Promise.resolve(Response.json({ providers: [] }));
        return response.promise;
      });
      rs.stubGlobal("fetch", fetchMock);
      const view = render(
        <I18nProvider initialLocale="en-US">
          {kind === "login" ? <LoginPage /> : <SetupPage />}
        </I18nProvider>,
      );
      const submit = await screen.findByRole("button", {
        name:
          kind === "login"
            ? "Sign In"
            : kind === "initialize"
              ? "Create Admin Account"
              : "Complete Setup",
      });
      const inputs = view.container.querySelectorAll<HTMLInputElement>(
        "input:not([type=checkbox])",
      );
      const values =
        kind === "login"
          ? ["user@example.com", "password-123"]
          : kind === "initialize"
            ? ["user@example.com", "password-123", "password-123"]
            : [
                "user@example.com",
                "old-password",
                "password-123",
                "password-123",
              ];
      inputs.forEach((input, i) =>
        fireEvent.change(input, { target: { value: values[i] } }),
      );
      fireEvent.submit(submit.closest("form")!);
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
        `/api/v1/auth/${kind === "login" ? "login/local" : kind === "initialize" ? "initialize" : "change-password"}`,
      );
      if (leave) view.unmount();
      await act(async () => {
        response.resolve(Response.json({}));
      });
      if (leave) expect(mocks.router.push).not.toHaveBeenCalled();
      else
        expect(mocks.router.push).toHaveBeenCalledWith(
          kind === "login" ? "/workspace/chats" : "/workspace",
        );
    });
  }
it("an old setup probe cannot redirect after the page is unmounted", async () => {
  const response = pending<Response>();
  rs.stubGlobal(
    "fetch",
    rs.fn(() => response.promise),
  );
  const view = render(
    <I18nProvider initialLocale="en-US">
      <SetupPage />
    </I18nProvider>,
  );
  view.unmount();
  await act(async () => {
    response.resolve(Response.json({ needs_setup: false }));
  });
  expect(mocks.router.replace).not.toHaveBeenCalled();
});
