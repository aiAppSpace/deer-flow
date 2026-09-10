import "katex/dist/katex.min.css";
import "streamdown/styles.css";

import { QueryClientProvider } from "@/components/query-client-provider";
// See workspace-content.tsx: the wrapper, not `sonner` directly.
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/core/i18n/context";
import { detectLocaleServer } from "@/core/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Chrome-free layout for the standalone artifact window.
 *
 * Deliberately not nested under `/workspace`: this route opens in its own
 * browser window, so it wants the same rich-content styles as the chat page
 * but none of its sidebar/thread shell.
 *
 * The auth guard lives in the page rather than here. A layout cannot read
 * `searchParams`, and this route carries its whole target in the query string
 * — guarding here would redirect to /login with nothing to come back to.
 * No AuthProvider either: nothing under this route reads `useAuth`.
 *
 * The `Toaster` is not decoration: the citation panel rendered under this
 * route calls `toast.success(t.clipboard.copiedToClipboard)` after a copy
 * (citation-sources-panel.tsx:105). Without a mounted viewport that call is a
 * silent no-op — the user copies a source and gets no feedback at all. Both
 * other routes that render this panel already mount one (workspace-content.tsx,
 * showcase/[thread_id]/layout.tsx); this window was the only one missing it.
 */
export default async function ArtifactViewerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await detectLocaleServer();

  return (
    <I18nProvider initialLocale={locale}>
      <QueryClientProvider>
        {children}
        <Toaster position="top-center" />
      </QueryClientProvider>
    </I18nProvider>
  );
}
