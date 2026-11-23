import { defineConfig, devices } from "@playwright/test";

const python = process.platform === "win32" ? "python" : "python3";

const defaultFrontendPort = process.env.E2E_AUTH_FRONTEND_PORT ?? "3001";
const frontendURL =
  process.env.PLAYWRIGHT_AUTH_BASE_URL ??
  `http://localhost:${defaultFrontendPort}`;
const frontendPort = new URL(frontendURL).port || defaultFrontendPort;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";

/**
 * Auth-enabled E2E coverage for the login and setup pages. The default config
 * runs with auth disabled so workspace tests can skip a real session; that
 * would SSR-redirect these pages before page.route() can exercise recovery.
 */
export default defineConfig({
  testDir: "./tests/e2e-auth",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: frontendURL,
    locale: "en-US",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: skipWebServer
    ? undefined
    : {
        command: `${python} ../scripts/pnpm.py --dir frontend build && ${python} ../scripts/pnpm.py --dir frontend exec next start`,
        url: frontendURL,
        reuseExistingServer: false,
        timeout: 240_000,
        env: {
          PORT: frontendPort,
          SKIP_ENV_VALIDATION: "1",
          DEER_FLOW_AUTH_DISABLED: "0",
          DEER_FLOW_INTERNAL_GATEWAY_BASE_URL: "http://127.0.0.1:65535",
          DEER_FLOW_TRUSTED_ORIGINS: frontendURL,
        },
      },
});
