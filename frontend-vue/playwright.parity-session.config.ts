/*
  Real browser sessions, SQL preferences and live RBAC role changes in both apps.
  Separate SQL/home from parity-auth: creating an admin here must never change
  the anonymous login/setup suite's needs_setup precondition.
*/
import { PARITY_USE_OPTIONS } from "./tests/e2e-parity/support/context-options";
import {
  reactAppPresent,
  reactAppUrl,
  reactPreview,
} from "./tests/e2e-parity/support/react-preview";
import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_PARITY_SESSION_PORT ?? "3119";
const reactPort = process.env.E2E_PARITY_SESSION_REACT_PORT ?? "3120";
const gatewayPort = process.env.E2E_PARITY_SESSION_GATEWAY_PORT ?? "8023";
process.env.E2E_REACT_APP_URL ??= reactAppUrl(reactPort);

export default defineSuite({
  name: "e2e-parity-session",
  testDir: "./tests/e2e-parity-session",
  port,
  gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
  serial: true,
  timeout: 180_000,
  servers: [
    {
      command: `../backend/.venv/bin/python tests/support/run_authz_gateway.py --port ${gatewayPort} --cors http://localhost:${port}`,
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
    ...(reactAppPresent
      ? [reactPreview({ port: reactPort, authDisabled: false, gatewayPort })]
      : []),
  ],
  use: PARITY_USE_OPTIONS,
});
