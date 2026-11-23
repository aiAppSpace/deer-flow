import { type ReactNode } from "react";

import { I18nProvider } from "@/core/i18n/context";
import { detectLocaleServer } from "@/core/i18n/server";

/*
  The OAuth callback deliberately sits OUTSIDE the `(auth)` route group.

  `(auth)/layout.tsx` server-redirects to `/workspace` as soon as
  `getServerSideUser()` reports `authenticated`. By the time a real OIDC flow
  lands on `/auth/callback` the session cookie is already set, so that layout
  fired first and the callback page never rendered — which silently discarded
  the `?next=` deep link the user started from and made this page's `next`
  handling dead code.

  This layout provides only locale context. It must not mount AuthProvider or
  probe the session on the server: the callback owns its session check and
  safe next navigation, including an already-authenticated OIDC arrival.
*/
export const dynamic = "force-dynamic";

export default async function AuthCallbackLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await detectLocaleServer();
  return <I18nProvider initialLocale={locale}>{children}</I18nProvider>;
}
