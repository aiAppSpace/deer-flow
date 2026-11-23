"""Prepare an isolated Compose ingress acceptance; never build/start Docker.

The public ingress uses the repository's actual nginx template and launcher.
Only runtime state, images, external integrations and model output are isolated.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import secrets
import sys
import uuid
from pathlib import Path

import yaml

_REPOSITORY = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPOSITORY / "backend" / "tests"))


def _apt_mirror_build_step() -> str:
    """Reuse the real validated build entry for the test-only browser layer."""
    lines = iter(
        (_REPOSITORY / "backend/Dockerfile").read_text(encoding="utf-8").splitlines()
    )
    commands = []
    for line in lines:
        if not line.startswith("RUN "):
            continue
        command = [line]
        while command[-1].endswith("\\"):
            command.append(next(lines))
        text = "\n".join(command)
        if "APT_MIRROR" in text:
            commands.append(text)
    if len(commands) != 1:
        raise RuntimeError("Expected one canonical APT_MIRROR build step")
    return commands[0]


def prepare(
    output: Path, *, port: int, vue_image: str, react_image: str, gateway_image: str
) -> dict:
    from _replay_fixture import (
        REPLAY_MODEL_BLOCK,
        build_config_yaml,
        prepare_hermetic_extras,
    )
    from run_m0_gateway import _enable_browser_control

    if not 1024 <= port <= 65535:
        raise ValueError("Use a non-privileged loopback ingress port")
    output = output.resolve()
    for frontend in ("frontend", "frontend-vue"):
        for cleaned in ("test-results", "playwright-report"):
            if output.is_relative_to(_REPOSITORY / frontend / cleaned):
                raise ValueError(
                    "Playwright clears this output directory; keep Compose runtime "
                    "state separately (for example docker/.cache/container-ingress-<run>)"
                )
    output.mkdir(parents=True, exist_ok=False)
    os.chmod(output, 0o700)
    home = output / "home"
    home.mkdir()
    (home / ".env").write_text("", encoding="utf-8")
    prepare_hermetic_extras(home)
    # Container paths enter config; only the output directory is writable.
    model = REPLAY_MODEL_BLOCK.replace(
        "replay_provider:ReplayChatModel", "m0_replay_provider:M0ReplayChatModel"
    )
    config = build_config_yaml(model_block=model, home=Path("/state"))
    (home / "config-replay.yaml").write_text(config, encoding="utf-8")
    # Browser tool admission changes the prompt, so WS is a second phase after
    # replay SSE finishes. Never accept a replay miss as a successful SSE run.
    (home / "config-browser.yaml").write_text(
        _enable_browser_control(config), encoding="utf-8"
    )
    project = f"deerflow-vue-ingress-{uuid.uuid4().hex[:10]}"
    source = yaml.safe_load(
        (_REPOSITORY / "docker" / "docker-compose.yaml").read_text(encoding="utf-8")
    )
    services = {
        name: copy.deepcopy(source["services"][name])
        for name in ("nginx", "frontend", "frontend-vue", "gateway")
    }
    for name, service in services.items():
        service.pop("build", None)
        service.pop("env_file", None)
        service.pop("extra_hosts", None)
        service["container_name"] = f"{project}-{name}"
        service["restart"] = "no"
        service["networks"] = ["acceptance"]
    services["nginx"].update(
        ports=[f"127.0.0.1:{port}:2026"],
        volumes=[
            f"{_REPOSITORY / 'docker/nginx/nginx.conf'}:/etc/nginx/nginx.conf.template:ro"
        ],
        environment={"DEER_FLOW_VUE_HOSTNAME": "vue.localhost"},
    )
    services["frontend"].update(
        image=react_image,
        environment={
            "BETTER_AUTH_SECRET": secrets.token_urlsafe(32),
            "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL": "http://gateway:8001",
            "NEXT_PUBLIC_AUTH_DISABLED": "0",
        },
    )
    services["frontend-vue"].update(
        image=vue_image,
        volumes=[
            f"{_REPOSITORY / 'backend/tests/fixtures/replay/write_read_file.ultra.json'}:/acceptance/write_read_file.ultra.json:ro"
        ],
        environment={
            "HOST": "0.0.0.0",
            "PORT": "3000",
            "NUXT_PUBLIC_AUTH_DISABLED": "0",
            "NUXT_GATEWAY_INTERNAL_BASE_URL": "http://gateway:8001",
        },
    )
    services["gateway"].pop("depends_on", None)
    services["gateway"].update(
        image=gateway_image,
        working_dir="/app/backend",
        command=[
            "/app/backend/.venv/bin/python",
            "-m",
            "uvicorn",
            "app.gateway.app:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8001",
            "--timeout-graceful-shutdown",
            "10",
        ],
        volumes=[
            f"{home}:/state",
            f"{_REPOSITORY / 'backend/tests'}:/acceptance/backend-tests:ro",
            f"{_REPOSITORY / 'frontend-vue/tests/support'}:/acceptance/frontend-support:ro",
        ],
        environment={
            "CI": "true",
            "DEER_FLOW_PROJECT_ROOT": "/state",
            "DEER_FLOW_HOME": "/state",
            "DEER_FLOW_ENV_FILE": "/state/.env",
            "DEER_FLOW_CONFIG_PATH": "/state/config-replay.yaml",
            "DEER_FLOW_EXTENSIONS_CONFIG_PATH": "/state/extensions_config.json",
            "DEER_FLOW_AUTH_DISABLED": "0",
            "AUTH_JWT_SECRET": secrets.token_urlsafe(32),
            "DEERFLOW_REPLAY_FIXTURE": "/acceptance/backend-tests/fixtures/replay/write_read_file.ultra.json",
            "DEERFLOW_M0_REPLAY_DELAY_SECONDS": "2",
            "PYTHONPATH": "/app/backend:/acceptance/backend-tests:/acceptance/frontend-support",
            "NO_PROXY": "localhost,127.0.0.1,::1,gateway,frontend,frontend-vue,nginx",
            "no_proxy": "localhost,127.0.0.1,::1,gateway,frontend,frontend-vue,nginx",
        },
    )
    manifest = {
        "name": project,
        "services": services,
        "networks": {"acceptance": {"driver": "bridge"}},
    }
    # Private generated manifests contain ephemeral fixture secrets. Do not
    # attach their contents or docker-inspect environment output to reports.
    for name, data in (
        ("compose.json", manifest),
        (
            "browser.overlay.json",
            {
                "services": {
                    "gateway": {
                        "environment": {
                            "DEER_FLOW_CONFIG_PATH": "/state/config-browser.yaml"
                        }
                    }
                }
            },
        ),
    ):
        path = output / name
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        os.chmod(path, 0o600)
    # The backend's browser extra installs Python dependencies only. This test
    # image layer supplies the actual Chromium runtime and OS dependencies.
    (output / "Dockerfile.browser").write_text(
        "ARG BASE_IMAGE\nFROM ${BASE_IMAGE}\nARG APT_MIRROR\n"
        + _apt_mirror_build_step()
        + "\nRUN /app/backend/.venv/bin/python -m playwright install --with-deps chromium\n",
        encoding="utf-8",
    )
    (output / ".dockerignore").write_text("*\n!Dockerfile.browser\n", encoding="utf-8")
    metadata = {
        "project": project,
        "directory": str(output),
        "vueOrigin": f"http://vue.localhost:{port}",
        "reactOrigin": f"http://localhost:{port}",
        "hostPort": port,
        "authDisabled": False,
        "publicTopology": {
            "html": "nginx -> selected frontend",
            "apiAuthSseWs": "nginx -> Gateway",
        },
        "internalNuxtProxy": "frontend-vue:3000 -> gateway:8001 (configured explicitly for the separate proxy probe)",
        "images": {"vue": vue_image, "react": react_image, "gateway": gateway_image},
        "unrun": [
            "image builds",
            "compose startup",
            "browser auth/API/SSE/upload/download",
            "internal Nuxt proxy",
            "real browser WS",
        ],
    }
    (output / "metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--port", type=int, default=2326)
    parser.add_argument("--vue-image", required=True)
    parser.add_argument("--react-image", required=True)
    parser.add_argument("--gateway-image", required=True)
    args = parser.parse_args()
    metadata = prepare(
        args.output,
        port=args.port,
        vue_image=args.vue_image,
        react_image=args.react_image,
        gateway_image=args.gateway_image,
    )
    print(json.dumps(metadata, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
