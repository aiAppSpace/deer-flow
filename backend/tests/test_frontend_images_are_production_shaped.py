"""What the stage Compose ships has to look like for a production frontend.

Two properties so far, and both were found the same way: by comparing the two
frontend images against each other instead of reading either on its own.

**Not root.**

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

**Declares a healthcheck.** ``frontend-vue`` has had one all along; ``frontend``
had none, so ``docker ps`` reported health for one of the two frontends of the
same product and nothing for the other.  The two images probe differently on
purpose -- Vue has a real ``/health`` Nitro route, React has no lightweight
route and probing ``/`` would run the landing page's GitHub fetch 360 times an
hour against a limit of 60 -- so the criterion is "declares one", not "declares
the same one".  The Helm chart reached the same conclusion independently: its
frontend Deployment probes with ``tcpSocket``.

Zero exemptions on both. There are exactly two frontend images and both serve
browser traffic; an allow-list here would just record which one we decided to
leave running as root, or unmonitored.
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


def _shipped_stage(service_name: str) -> tuple[str | None, list[str]]:
    """The stage Compose actually builds for this service.

    Not "the file": a `USER` or `HEALTHCHECK` in some earlier builder stage
    proves nothing about what gets shipped, which is why both tests go through
    here. No `target:` means Compose builds the last stage.
    """
    build = _shipped_services()[service_name]["build"]
    stages = _stages((REPO_ROOT / build["dockerfile"]).read_text(encoding="utf-8"))
    target = build.get("target")
    if target is None:
        return stages[-1]
    matching = [stage for stage in stages if stage[0] == target]
    assert matching, f"{service_name}: no stage named {target!r}"
    return matching[-1]


@pytest.mark.parametrize("service_name", sorted(_shipped_services()))
def test_the_stage_compose_ships_drops_privileges(service_name: str) -> None:
    shipped = _shipped_stage(service_name)

    users = [line.split(None, 1)[1].strip() for line in shipped[1] if line.upper().startswith("USER ")]
    assert users, (
        f"{service_name}: the stage Compose ships ({shipped[0] or 'last'}) never "
        "switches away from root, so the server owns the container's root "
        "account for no reason -- add a `USER` after the final COPY, and copy "
        "the app in with `--chown` so it can still write its own cache"
    )
    assert users[-1] not in {"root", "0", "0:0"}, f"{service_name}: last USER is {users[-1]!r}"


@pytest.mark.parametrize("service_name", sorted(_shipped_services()))
def test_the_stage_compose_ships_declares_a_healthcheck(service_name: str) -> None:
    shipped = _shipped_stage(service_name)
    declared = [line for line in shipped[1] if line.upper().startswith("HEALTHCHECK")]
    assert declared, f"{service_name}: the stage Compose ships ({shipped[0] or 'last'}) declares no HEALTHCHECK, so nothing but the process being alive distinguishes a serving container from a wedged one"
    assert "NONE" not in declared[0].upper(), f"{service_name}: {declared[0]!r}"
