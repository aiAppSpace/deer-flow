import { StarFilledIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DEFAULT_LOCALE, type Locale } from "@/core/i18n/locale";
import { getI18n } from "@/core/i18n/server";
import { env } from "@/env";
import { cn } from "@/lib/utils";

import { MobileNav } from "./mobile-nav";

export type HeaderProps = {
  className?: string;
  homeURL?: string;
  locale?: Locale;
};

export async function Header({ className, homeURL, locale }: HeaderProps) {
  const isExternalHome = !homeURL;
  const { locale: resolvedLocale, t } = await getI18n(locale ?? DEFAULT_LOCALE);
  const lang = resolvedLocale.substring(0, 2);
  return (
    <header
      className={cn(
        "container-md fixed top-0 right-0 left-0 z-20 flex h-16 items-center justify-between gap-3 px-4 backdrop-blur-xs",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-6">
        <a
          href={homeURL ?? "https://github.com/bytedance/deer-flow"}
          target={isExternalHome ? "_blank" : "_self"}
          rel={isExternalHome ? "noopener noreferrer" : undefined}
          className="font-serif text-xl whitespace-nowrap"
        >
          DeerFlow
        </a>
      </div>
      <nav className="ml-auto hidden items-center gap-5 text-sm font-medium sm:flex md:mr-8 md:gap-8">
        <Link
          href={`/${lang}/docs`}
          className="text-secondary-foreground hover:text-foreground transition-colors"
        >
          {t.home.docs}
        </Link>
        <Link
          href="/blog/posts"
          className="text-secondary-foreground hover:text-foreground transition-colors"
        >
          {t.home.blog}
        </Link>
      </nav>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-full opacity-30 blur-2xl"
          style={{
            background: "linear-gradient(90deg, #ff80b5 0%, #9089fc 100%)",
            filter: "blur(16px)",
          }}
        />
        <Button
          variant="outline"
          size="sm"
          asChild
          className="group relative z-10"
        >
          <a
            href="https://github.com/bytedance/deer-flow"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubLogoIcon className="size-4" />
            <span className="hidden sm:inline">Star on GitHub</span>
            {env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" &&
              env.GITHUB_OAUTH_TOKEN && <StarCounter />}
          </a>
        </Button>
      </div>
      <MobileNav
        links={[
          { href: `/${lang}/docs`, label: t.home.docs },
          { href: "/blog/posts", label: t.home.blog },
        ]}
      />
      <hr className="from-border/0 via-border/70 to-border/0 absolute top-16 right-0 left-0 z-10 m-0 h-px w-full border-none bg-linear-to-r" />
    </header>
  );
}

async function StarCounter() {
  let stars = 10000; // Default value

  try {
    const response = await fetch(
      "https://api.github.com/repos/bytedance/deer-flow",
      {
        headers: env.GITHUB_OAUTH_TOKEN
          ? {
              Authorization: `Bearer ${env.GITHUB_OAUTH_TOKEN}`,
              "Content-Type": "application/json",
            }
          : {},
        next: {
          revalidate: 3600,
        },
        /*
          A page render must not be able to hang on somebody else's server.
          `try/catch` below catches an *error*; it does not catch "never
          answers", and this runs inside an async Server Component — so a slow
          api.github.com stalls the whole `/` response, not just the badge.

          Unauthenticated GitHub allows 60 requests an hour per IP, which a
          test suite reaches quickly: on 2026-09-08 `landing.spec.ts` was
          timing out at 30s under load, and this is the only external fetch in
          the app. The fallback below (10000) is already the designed answer
          for "we could not read it", so timing out simply uses it.
        */
        signal: AbortSignal.timeout(3000),
      },
    );

    if (response.ok) {
      const data = await response.json();
      stars = data.stargazers_count ?? stars; // Update stars if API response is valid
    }
  } catch (error) {
    console.error("Error fetching GitHub stars:", error);
  }
  return (
    <>
      <StarFilledIcon className="size-4 transition-colors duration-300 group-hover:text-yellow-500" />
      {stars && (
        <NumberTicker className="font-mono tabular-nums" value={stars} />
      )}
    </>
  );
}
