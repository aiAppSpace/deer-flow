import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const python = `${repository}backend/.venv/bin/python`;

function runOidcFlow(container: boolean, poisonProxy = false) {
  return spawnSync(
    python,
    [
      "-c",
      String.raw`
import base64, hashlib, http.server, json, os, socket, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request
import jwt
fixture, container = sys.argv[1], sys.argv[2] == "true"
poisoned = sys.argv[3] == "true"
with socket.socket() as reservation:
    reservation.bind(("127.0.0.1", 0)); port = reservation.getsockname()[1]
local = f"http://127.0.0.1:{port}"
issuer = f"http://idp.localhost:{port}" if container else local
args = [sys.executable, fixture, "--port", str(port)]
if container: args += ["--host", "0.0.0.0", "--issuer", issuer]
process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
poison_server = None
poison_requests = 0
try:
    if poisoned:
        class PoisonProxy(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_args): return
            def do_GET(self):
                global poison_requests
                poison_requests += 1
                self.send_response(502)
                self.send_header("Content-Length", "0")
                self.end_headers()
            do_POST = do_GET
        poison_server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), PoisonProxy)
        threading.Thread(target=poison_server.serve_forever, daemon=True).start()
        proxy = f"http://127.0.0.1:{poison_server.server_port}"
        for name in ("HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy"):
            os.environ[name] = proxy
        for name in ("NO_PROXY", "no_proxy"):
            os.environ[name] = ""
    local_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 8
    while True:
        try:
            with local_opener.open(local + "/health", timeout=.2) as response:
                assert response.status == 200
            break
        except (OSError, urllib.error.URLError):
            if process.poll() is not None or time.monotonic() > deadline:
                raise AssertionError(process.stderr.read().decode() if process.poll() is not None else "IdP did not become ready")
            time.sleep(.02)
    with local_opener.open(local + "/.well-known/openid-configuration") as response:
        discovery = json.load(response)
    assert discovery["issuer"] == issuer
    assert discovery["authorization_endpoint"] == issuer + "/authorize"
    assert discovery["token_endpoint"] == issuer + "/token"
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args): return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect)
    verifier = "fixture-verifier-" * 4
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    callback = "http://vue.localhost:2326/api/v1/auth/callback/m0idp"
    params = dict(client_id="deerflow-m0", redirect_uri=callback, state="fixture-state", nonce="fixture-nonce", code_challenge=challenge)
    try:
        opener.open(local + "/authorize?" + urllib.parse.urlencode(params))
        raise AssertionError("Expected the real authorization redirect")
    except urllib.error.HTTPError as response:
        assert response.code == 302
        location = response.headers["Location"]
    parsed = urllib.parse.urlparse(location)
    query = urllib.parse.parse_qs(parsed.query)
    assert location.startswith(callback + "?") and query["state"] == ["fixture-state"]
    payload = urllib.parse.urlencode(dict(code=query["code"][0], redirect_uri=callback, code_verifier=verifier)).encode()
    with local_opener.open(urllib.request.Request(local + "/token", data=payload)) as response:
        token = json.load(response)
    claims = jwt.decode(token["id_token"], options={"verify_signature": False})
    assert claims["iss"] == issuer and claims["nonce"] == "fixture-nonce"
    assert claims["email"] == "m0-oidc-user@example.com"
    print(json.dumps(dict(issuer=issuer, pkce=True, nonce=True, callback=callback, poisonProxyHits=poison_requests)))
finally:
    process.terminate()
    try: process.wait(timeout=5)
    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)
    if poison_server is not None:
        poison_server.shutdown()
        poison_server.server_close()
        print(f"CONTROLLED_PROXY_REQUESTS={poison_requests}", file=sys.stderr)
`,
      join(repository, "frontend-vue/tests/support/run_m0_idp.py"),
      String(container),
      String(poisonProxy),
    ],
    { cwd: repository, encoding: "utf8", timeout: 20_000 },
  );
}

describe.skipIf(!existsSync(python))(
  "controlled container OIDC fixture",
  () => {
    it.each([false, true])(
      "executes real discovery/code/PKCE/nonce with container options=%s and preserves defaults",
      (container) => {
        const result = runOidcFlow(container);
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
          pkce: true,
          nonce: true,
        });
      },
    );

    it.each([false, true])(
      "keeps real OIDC isolated from a controlled poison proxy with container options=%s",
      (container) => {
        const result = runOidcFlow(container, true);
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
          pkce: true,
          nonce: true,
          poisonProxyHits: 0,
        });
        expect(result.stderr).toContain("CONTROLLED_PROXY_REQUESTS=0");
      },
    );

    it("adds only an isolated loopback IdP and OIDC overlay while retaining the original project, SQL and nginx", () => {
      const temporary = mkdtempSync(join(tmpdir(), "ingress-oidc-test-"));
      try {
        const output = join(temporary, "prepared");
        const initial = spawnSync(
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
        expect(initial.status, initial.stderr).toBe(0);
        const composeBefore = readFileSync(
          join(output, "compose.json"),
          "utf8",
        );
        const replayBefore = readFileSync(
          join(output, "home/config-replay.yaml"),
          "utf8",
        );
        const browserBefore = readFileSync(
          join(output, "home/config-browser.yaml"),
          "utf8",
        );
        const prepared = spawnSync(
          python,
          [
            "frontend-vue/tests/support/prepare_container_oidc.py",
            "--runtime",
            output,
            "--port",
            "2386",
            "--fixture",
            join(repository, "frontend-vue/tests/support/run_m0_idp.py"),
          ],
          { cwd: repository, encoding: "utf8" },
        );
        expect(prepared.status, prepared.stderr).toBe(0);
        const overlay = JSON.parse(
          readFileSync(join(output, "oidc.overlay.json"), "utf8"),
        );
        const metadata = JSON.parse(
          readFileSync(join(output, "metadata.json"), "utf8"),
        );
        expect(Object.keys(overlay.services).sort()).toEqual([
          "gateway",
          "idp",
        ]);
        expect(overlay.services.idp.ports).toEqual(["127.0.0.1:2386:2386"]);
        expect(overlay.services.idp.init).toBe(true);
        expect(overlay.services.idp.image).toBe("acceptance-gateway:test");
        expect(overlay.services.idp.container_name).toBe(
          `${metadata.project}-idp`,
        );
        expect(overlay.services.idp.networks).toEqual({
          acceptance: { aliases: ["idp.localhost"] },
        });
        expect(overlay.services.idp.command).toEqual([
          "/app/backend/.venv/bin/python",
          "/acceptance/run_m0_idp.py",
          "--host",
          "0.0.0.0",
          "--port",
          "2386",
          "--issuer",
          "http://idp.localhost:2386",
        ]);
        expect(overlay.services.gateway.environment.DEER_FLOW_CONFIG_PATH).toBe(
          "/state/config-oidc.yaml",
        );
        const config = readFileSync(
          join(output, "home/config-oidc.yaml"),
          "utf8",
        );
        expect(config).toContain("issuer: http://idp.localhost:2386");
        expect(config).not.toContain("frontend_base_url:");
        expect(config).not.toContain("redirect_uri:");
        expect(readFileSync(join(output, "compose.json"), "utf8")).toBe(
          composeBefore,
        );
        expect(
          readFileSync(join(output, "home/config-replay.yaml"), "utf8"),
        ).toBe(replayBefore);
        expect(
          readFileSync(join(output, "home/config-browser.yaml"), "utf8"),
        ).toBe(browserBefore);
        expect(metadata.oidc).toMatchObject({
          issuer: "http://idp.localhost:2386",
          reactOrigin: "http://react.localhost:2326",
          vueOrigin: "http://vue.localhost:2326",
        });
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    });
  },
);
