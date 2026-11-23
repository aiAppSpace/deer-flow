import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const python = `${repository}backend/.venv/bin/python`;

describe.skipIf(!existsSync(python))(
  "isolated production ingress preparation",
  () => {
    it.each([
      "frontend/test-results",
      "frontend/playwright-report",
      "frontend-vue/test-results",
      "frontend-vue/playwright-report",
    ])(
      "rejects runtime state under auto-cleaned %s before writing files",
      (directory) => {
        const output = join(repository, directory, "ingress-must-not-exist");
        expect(existsSync(output)).toBe(false);
        const result = spawnSync(
          python,
          [
            "frontend-vue/tests/support/prepare_container_ingress.py",
            "--output",
            output,
            "--vue-image",
            "acceptance-vue:test",
            "--react-image",
            "acceptance-react:test",
            "--gateway-image",
            "acceptance-gateway:test",
          ],
          { cwd: repository, encoding: "utf8" },
        );
        try {
          expect(result.status).not.toBe(0);
          expect(result.stderr).toContain(
            "Playwright clears this output directory",
          );
          expect(existsSync(output)).toBe(false);
        } finally {
          rmSync(output, { recursive: true, force: true });
        }
      },
    );

    it("reuses real nginx routing while isolating identities, runtime files and published ports without invoking Docker", () => {
      const temporary = mkdtempSync(join(tmpdir(), "ingress-prepare-test-"));
      try {
        const output = join(temporary, "prepared");
        const result = spawnSync(
          python,
          [
            "frontend-vue/tests/support/prepare_container_ingress.py",
            "--output",
            output,
            "--port",
            "2326",
            "--vue-image",
            "acceptance-vue:test",
            "--react-image",
            "acceptance-react:test",
            "--gateway-image",
            "acceptance-gateway:test",
          ],
          { cwd: repository, encoding: "utf8" },
        );
        expect(result.status, result.stderr).toBe(0);
        const metadata = JSON.parse(
          readFileSync(join(output, "metadata.json"), "utf8"),
        );
        const compose = JSON.parse(
          readFileSync(join(output, "compose.json"), "utf8"),
        );
        expect(compose.name).toMatch(/^deerflow-vue-ingress-[\da-f]{10}$/);
        expect(Object.keys(compose.services).sort()).toEqual([
          "frontend",
          "frontend-vue",
          "gateway",
          "nginx",
        ]);
        for (const [name, service] of Object.entries(compose.services) as [
          string,
          Record<string, unknown>,
        ][]) {
          expect(service.container_name).toBe(`${compose.name}-${name}`);
          expect(service.env_file).toBeUndefined();
          expect(service.build).toBeUndefined();
          expect(service.networks).toEqual(["acceptance"]);
          if (name !== "nginx") expect(service.ports).toBeUndefined();
        }
        expect(compose.services.nginx.ports).toEqual(["127.0.0.1:2326:2026"]);
        expect(compose.services.nginx.volumes).toEqual([
          `${repository}docker/nginx/nginx.conf:/etc/nginx/nginx.conf.template:ro`,
        ]);
        expect(compose.services.nginx.command.at(-1)).toContain(
          "envsubst '$$DEER_FLOW_VUE_HOSTNAME'",
        );
        expect(compose.services["frontend-vue"].environment).toMatchObject({
          NUXT_PUBLIC_AUTH_DISABLED: "0",
          NUXT_GATEWAY_INTERNAL_BASE_URL: "http://gateway:8001",
        });
        expect(compose.services.gateway.environment).toMatchObject({
          DEER_FLOW_HOME: "/state",
          DEER_FLOW_PROJECT_ROOT: "/state",
          DEER_FLOW_ENV_FILE: "/state/.env",
          DEER_FLOW_AUTH_DISABLED: "0",
          DEER_FLOW_CONFIG_PATH: "/state/config-replay.yaml",
        });
        expect(compose.services.gateway.volumes).toEqual([
          `${realpathSync(output)}/home:/state`,
          `${repository}backend/tests:/acceptance/backend-tests:ro`,
          `${repository}frontend-vue/tests/support:/acceptance/frontend-support:ro`,
        ]);
        expect(readFileSync(join(output, "home/.env"), "utf8")).toBe("");
        expect(
          JSON.parse(
            readFileSync(join(output, "home/extensions_config.json"), "utf8"),
          ),
        ).toEqual({ mcpServers: {}, skills: {} });
        const replay = readFileSync(
          join(output, "home/config-replay.yaml"),
          "utf8",
        );
        const browser = readFileSync(
          join(output, "home/config-browser.yaml"),
          "utf8",
        );
        expect(replay).not.toContain("browser_navigate");
        expect(browser).toContain("browser_navigate");
        expect(browser).toContain("allow_private_addresses: true");
        expect(metadata.authDisabled).toBe(false);
        expect(readFileSync(join(output, ".dockerignore"), "utf8")).toBe(
          "*\n!Dockerfile.browser\n",
        );
        const browserDockerfile = readFileSync(
          join(output, "Dockerfile.browser"),
          "utf8",
        );
        const backendDockerfile = readFileSync(
          join(repository, "backend/Dockerfile"),
          "utf8",
        );
        const mirrorStart = backendDockerfile.indexOf("RUN set -eu;");
        const mirrorStep = backendDockerfile.slice(
          mirrorStart,
          backendDockerfile.indexOf("\n\n", mirrorStart),
        );
        expect(browserDockerfile).toContain("ARG APT_MIRROR");
        expect(browserDockerfile).toContain(mirrorStep);
        expect(browserDockerfile.indexOf(mirrorStep)).toBeLessThan(
          browserDockerfile.indexOf("-m playwright install --with-deps"),
        );
        expect(metadata.unrun).toContain("compose startup");
        expect(result.stdout).not.toContain(
          compose.services.gateway.environment.AUTH_JWT_SECRET,
        );
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    });
  },
);
