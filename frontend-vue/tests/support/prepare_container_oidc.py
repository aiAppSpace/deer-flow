"""Add the controlled OIDC phase to an existing isolated ingress project.

No production config, nginx template, SQL state, image or existing Compose
service is rewritten. The issuer is identical in the real browser and Gateway:
Chromium resolves *.localhost to loopback, while the fixture network alias
resolves to the IdP container listening on the same port.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from run_m0_gateway import _oidc_block


def prepare(runtime: Path, *, port: int, fixture: Path) -> dict:
    runtime = runtime.resolve()
    fixture = fixture.resolve(strict=True)
    metadata = json.loads((runtime / "metadata.json").read_text(encoding="utf-8"))
    compose = json.loads((runtime / "compose.json").read_text(encoding="utf-8"))
    project = metadata["project"]
    if not re.fullmatch(r"deerflow-vue-ingress-[\da-f]{10}", project):
        raise ValueError("Expected the dedicated ingress project")
    if compose["name"] != project or metadata["authDisabled"] is not False:
        raise ValueError("Project or real authentication boundary changed")
    if not 1024 <= port <= 65535 or port == metadata["hostPort"]:
        raise ValueError("Use a distinct non-privileged loopback IdP port")
    if fixture.name != "run_m0_idp.py":
        raise ValueError("Reuse the existing controlled IdP fixture")

    issuer = f"http://idp.localhost:{port}"
    config = (runtime / "home/config-replay.yaml").read_text(encoding="utf-8")
    config += _oidc_block(issuer, "deerflow-m0", "m0-idp-secret")
    config_path = runtime / "home/config-oidc.yaml"
    config_path.write_text(config, encoding="utf-8")
    os.chmod(config_path, 0o600)
    gateway = compose["services"]["gateway"]
    no_proxy = gateway["environment"].get("NO_PROXY", "")
    no_proxy = ",".join(filter(None, [no_proxy, "idp.localhost"]))
    overlay = {
        "services": {
            "idp": {
                "image": gateway["image"],
                "container_name": f"{project}-idp",
                "restart": "no",
                # Forward Docker's SIGTERM to the Python fixture instead of
                # leaving its default handler as the Linux namespace's PID 1.
                "init": True,
                "working_dir": "/app/backend",
                "command": [
                    "/app/backend/.venv/bin/python",
                    "/acceptance/run_m0_idp.py",
                    "--host",
                    "0.0.0.0",
                    "--port",
                    str(port),
                    "--issuer",
                    issuer,
                ],
                "volumes": [f"{fixture}:/acceptance/run_m0_idp.py:ro"],
                "ports": [f"127.0.0.1:{port}:{port}"],
                "networks": {"acceptance": {"aliases": ["idp.localhost"]}},
                "healthcheck": {
                    "test": [
                        "CMD",
                        "/app/backend/.venv/bin/python",
                        "-c",
                        f"import urllib.request; urllib.request.urlopen('http://127.0.0.1:{port}/health', timeout=2)",
                    ],
                    "interval": "2s",
                    "timeout": "3s",
                    "start_period": "5s",
                    "retries": 10,
                },
            },
            "gateway": {
                "environment": {
                    "DEER_FLOW_CONFIG_PATH": "/state/config-oidc.yaml",
                    "NO_PROXY": no_proxy,
                    "no_proxy": no_proxy,
                },
                "depends_on": {"idp": {"condition": "service_healthy"}},
            },
        }
    }
    overlay_path = runtime / "oidc.overlay.json"
    overlay_path.write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
    os.chmod(overlay_path, 0o600)
    metadata["oidc"] = {
        "issuer": issuer,
        "port": port,
        "provider": "m0idp",
        "expectedEmail": "m0-oidc-user@example.com",
        "reactOrigin": f"http://react.localhost:{metadata['hostPort']}",
        "vueOrigin": metadata["vueOrigin"],
    }
    (runtime / "metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    return metadata["oidc"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--fixture", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.runtime, port=args.port, fixture=args.fixture)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
