"""A frontend container that serves production traffic must not run as root.

Measured on 2026-09-08 against the running stack: `docker exec
deer-flow-frontend id` answered `uid=0(root)`.  Nothing in `frontend/`'s `prod`
stage set a user and the node base images leave it at 0, while the Vue image
next door had carried `USER node` all along -- so the two frontends of the same
product disagreed about whether a Node server should own the container's root
account.  The Helm chart had separately forced `runAsUser: 1000`, which meant
Kubernetes was hardened and Compose was not, and the mismatch was invisible
because each deployment path was read on its own.

The criterion is deliberately about the stage Compose actually *ships*, not
about the file containing a `USER` line somewhere: `frontend/Dockerfile` builds
`target: prod` and `frontend-vue/Dockerfile` builds its last stage, and a
`USER` in some earlier builder stage would prove nothing about either.

Zero exemptions. There are exactly two frontend images and both serve browser
traffic; an allow-list here would just record which one we decided to leave
running as root.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml
from support.detectors.repo_root import resolve_repo_root

REPO_ROOT = resolve_repo_root(Path(__file__))
COMPOSE = REPO_ROOT / "docker/docker-compose.yaml"

_FROM = re.compile(r"^FROM\s+\S+(?:\s+AS\s+(\S+))?", re.IGNORECASE)


def _without_comments(text: str) -> str:
    """This file's own prose says "root" and "USER" repeatedly; so does the
    Dockerfile comment explaining the fix. A raw substring search cannot tell
    an instruction from a sentence about one."""
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


def _stages(dockerfile: str) -> list[tuple[str | None, list[str]]]:
    stages: list[tuple[str | None, list[str]]] = []
    for line in _without_comments(dockerfile).splitlines():
        match = _FROM.match(line.strip())
        if match:
            stages.append((match.group(1), []))
        elif stages:
            stages[-1][1].append(line.strip())
    return stages


def _shipped_services() -> dict[str, dict]:
    compose = yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))
    return {name: service for name, service in compose["services"].items() if name in {"frontend", "frontend-vue"}}


def test_both_frontend_images_are_covered() -> None:
    """Self-proving scan surface: "0 images checked" must not read as success."""
    services = _shipped_services()
    assert set(services) == {"frontend", "frontend-vue"}
    for name, service in services.items():
        dockerfile = REPO_ROOT / service["build"]["dockerfile"]
        assert dockerfile.is_file(), name
        assert _stages(dockerfile.read_text(encoding="utf-8")), name


@pytest.mark.parametrize("service_name", sorted(_shipped_services()))
def test_the_stage_compose_ships_drops_privileges(service_name: str) -> None:
    service = _shipped_services()[service_name]
    build = service["build"]
    dockerfile = (REPO_ROOT / build["dockerfile"]).read_text(encoding="utf-8")
    stages = _stages(dockerfile)

    target = build.get("target")
    if target is None:
        # No `target:` means Compose builds the last stage.
        shipped = stages[-1]
    else:
        matching = [stage for stage in stages if stage[0] == target]
        assert matching, f"{service_name}: no stage named {target!r}"
        shipped = matching[-1]

    users = [line.split(None, 1)[1].strip() for line in shipped[1] if line.upper().startswith("USER ")]
    assert users, (
        f"{service_name}: the stage Compose ships ({shipped[0] or 'last'}) never "
        "switches away from root, so the server owns the container's root "
        "account for no reason -- add a `USER` after the final COPY, and copy "
        "the app in with `--chown` so it can still write its own cache"
    )
    assert users[-1] not in {"root", "0", "0:0"}, f"{service_name}: last USER is {users[-1]!r}"
