import { env } from "@/env";

// Resolve deployment credentials on requests, never while prerendering a build.
// The explicit fetch revalidate below still caches GitHub data for one hour.
export const revalidate = 0;

/**
 * Return only the public star count using the server's runtime GitHub token.
 * No input; missing credentials, upstream failures, or invalid counts yield 204
 * so the header hides the counter. Stays outside nginx's /api Gateway proxy.
 */
export async function GET() {
  const token = env.GITHUB_OAUTH_TOKEN;
  const headers = { "Cache-Control": "no-store" };
  if (!token) return new Response(null, { status: 204, headers });

  try {
    const response = await fetch(
      "https://api.github.com/repos/bytedance/deer-flow",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600 },
        /*
          A route handler must not be able to hang on somebody else's server.
          The `try/catch` below catches an *error*; it does not catch "never
          answers", and without a bound this request holds a server worker for
          as long as api.github.com keeps the socket open.

          This is the same defect wave 174 fixed when the call still lived in
          `landing/header.tsx` as an async Server Component. #5302 moved the
          call here — which fixed the worse half (a slow GitHub no longer
          stalls the whole `/` render) but carried the missing bound along.
          The 204 fallback below is already the designed answer for "we could
          not read it", so timing out simply uses it.

          `frontend/tests/unit/styles/external-fetch-timeout.test.ts` is what
          caught it: that guard scans every `fetch(` in `src/` for an external
          host without a `signal:`.
        */
        signal: AbortSignal.timeout(3000),
      },
    );
    if (response.ok) {
      const data = (await response.json()) as { stargazers_count?: unknown };
      if (
        typeof data.stargazers_count === "number" &&
        Number.isSafeInteger(data.stargazers_count) &&
        data.stargazers_count >= 0
      ) {
        return Response.json({ stars: data.stargazers_count }, { headers });
      }
    }
  } catch {
    // The counter is optional; do not return upstream errors or credentials.
  }
  return new Response(null, { status: 204, headers });
}
