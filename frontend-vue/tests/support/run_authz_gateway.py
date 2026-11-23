"""Run real session/SQL/RBAC routes with the existing deterministic replay model.

Only test configuration and the model's idle window differ from production.
No authentication, permission, preference, role-assignment or run route is mocked.
The temporary home/config never reads or modifies an operator's runtime files.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
import tempfile
from pathlib import Path

_REPOSITORY = Path(__file__).resolve().parents[3]
_BACKEND = _REPOSITORY / "backend"
_SUPPORT = Path(__file__).resolve().parent
sys.path[:0] = [str(_BACKEND), str(_BACKEND / "tests"), str(_SUPPORT)]

AUTHORIZATION_BLOCK = """
authorization:
  enabled: true
  fail_closed: true
  default_role: user
  provider:
    use: deerflow.authz.rbac:RbacAuthorizationProvider
    config:
      roles:
        admin:
          routes: {allow: "*"}
        user:
          routes: {allow: "*"}
        restricted:
          routes:
            allow: "*"
            deny: ["runs:create", "runs:cancel", "threads:delete"]
        no_cancel:
          routes:
            allow: "*"
            deny: ["runs:cancel"]
        no_access:
          routes: {allow: []}
"""


def configure_gateway(home: Path, cors: str) -> None:
    """Select a fresh SQL store and deterministic model before importing app."""
    # Importing the Gateway must never load tracked operator dotenv/config or
    # inherit another suite's auth bypass, SQL path, providers or router flags.
    inherited_imports = {
        str(Path(entry).resolve())
        for entry in os.environ.get("PYTHONPATH", "").split(os.pathsep)
        if entry
    }
    trusted_imports = {str(_BACKEND), str(_BACKEND / "tests"), str(_SUPPORT)}
    sys.path[:] = [
        entry
        for entry in sys.path
        if str(Path(entry).resolve()) not in inherited_imports
        or str(Path(entry).resolve()) in trusted_imports
    ]
    retained = {
        key: value
        for key, value in os.environ.items()
        if key in {"PATH", "SYSTEMROOT", "LANG", "LC_ALL"}
    }
    os.environ.clear()
    os.environ.update(retained)

    from _replay_fixture import (
        REPLAY_MODEL_BLOCK,
        build_config_yaml,
        prepare_hermetic_extras,
    )

    env_path = home / ".env"
    env_path.write_text("", encoding="utf-8")
    config_path = home / "config.yaml"
    model = REPLAY_MODEL_BLOCK.replace(
        "replay_provider:ReplayChatModel", "m0_replay_provider:M0ReplayChatModel"
    )
    config_path.write_text(
        build_config_yaml(model_block=model, home=home) + AUTHORIZATION_BLOCK,
        encoding="utf-8",
    )
    os.environ["DEER_FLOW_HOME"] = str(home)
    os.environ["DEER_FLOW_PROJECT_ROOT"] = str(home)
    os.environ["DEER_FLOW_ENV_FILE"] = str(env_path)
    os.environ["DEER_FLOW_CONFIG_PATH"] = str(config_path)
    os.environ["DEER_FLOW_EXTENSIONS_CONFIG_PATH"] = str(prepare_hermetic_extras(home))
    os.environ["DEERFLOW_REPLAY_FIXTURE"] = str(
        _BACKEND / "tests" / "fixtures" / "replay" / "write_read_file.ultra.json"
    )
    os.environ["DEER_FLOW_AUTH_DISABLED"] = "0"
    os.environ["AUTH_JWT_SECRET"] = secrets.token_urlsafe(32)
    # Existing M0 provider pauses before its first model result, making real
    # in-flight role revocation/cancellation observable without remote services.
    os.environ["DEERFLOW_M0_REPLAY_DELAY_SECONDS"] = "45"
    os.environ["GATEWAY_CORS_ORIGINS"] = cors
    os.environ["PYTHONPATH"] = os.pathsep.join(
        [str(_BACKEND), str(_BACKEND / "tests"), str(_SUPPORT)]
    )


def verify_fixture() -> None:
    """Prove this fixture really boots session/SQL/RBAC production routes."""
    import uuid

    from starlette.testclient import TestClient

    from app.gateway.app import app

    password = "very-strong-password-123"
    with TestClient(app) as client:
        assert client.get("/api/v1/auth/setup-status").json()["needs_setup"] is True
        assert client.get("/api/v1/auth/me").status_code == 401
        assert (
            client.post(
                "/api/v1/auth/initialize",
                json={"email": "admin@example.com", "password": password},
            ).status_code
            == 201
        )
        administrator = client.get("/api/v1/auth/me").json()
        assert administrator["system_role"] == "admin"
        assert client.get("/api/v1/auth/setup-status").json()["needs_setup"] is False
        # The same Gateway persists across browser worker restarts. A later
        # case must reopen the administrator via login, not initialize again.
        client.cookies.clear()
        assert (
            client.post(
                "/api/v1/auth/login/local",
                data={"username": "admin@example.com", "password": password},
            ).status_code
            == 200
        )
        assert client.get("/api/v1/auth/me").json()["id"] == administrator["id"]
        admin_headers = {
            "Cookie": "; ".join(
                f"{cookie.name}={cookie.value}" for cookie in client.cookies.jar
            ),
            "X-CSRF-Token": client.cookies["csrf_token"],
        }
        assert client.get("/api/v1/auth/setup-status").json()["needs_setup"] is False
        assert (
            client.post(
                "/api/v1/auth/register",
                json={"email": "user@example.com", "password": password},
            ).status_code
            == 201
        )
        user = client.get("/api/v1/auth/me").json()
        assert user["system_role"] == "user"
        assert {"runs:create", "runs:cancel", "threads:delete"} <= set(
            user["permissions"]
        )
        preferences = "/api/v1/auth/preferences"
        user_headers = {
            "X-CSRF-Token": client.cookies["csrf_token"],
            "X-Expected-User-Id": user["id"],
        }
        assert (
            client.patch(
                preferences, headers=user_headers, json={"notification_enabled": False}
            ).status_code
            == 204
        )
        assert (
            client.get(preferences, headers=user_headers).json()["notification_enabled"]
            is False
        )
        assert (
            client.patch(
                preferences,
                headers={"X-Expected-User-Id": user["id"]},
                json={"notification_enabled": True},
            ).status_code
            == 403
        )
        assert (
            client.get(
                preferences, headers={"X-Expected-User-Id": str(uuid.uuid4())}
            ).status_code
            == 409
        )
        thread_id = str(uuid.uuid4())
        assert (
            client.post(
                "/api/threads",
                headers=user_headers,
                json={"thread_id": thread_id, "metadata": {}},
            ).status_code
            == 200
        )
        role_path = f"/api/v1/admin/users/{user['id']}"
        assert (
            client.patch(
                role_path, headers=admin_headers, json={"system_role": "restricted"}
            ).status_code
            == 200
        )
        restricted = client.get("/api/v1/auth/me").json()
        assert restricted["system_role"] == "restricted"
        assert not (
            {"runs:create", "runs:cancel", "threads:delete"}
            & set(restricted["permissions"])
        )
        assert (
            client.post(
                f"/api/threads/{thread_id}/runs/stream",
                headers=user_headers,
                json={"assistant_id": "lead_agent", "input": {"messages": []}},
            ).status_code
            == 403
        )
        assert (
            client.delete(f"/api/threads/{thread_id}", headers=user_headers).status_code
            == 403
        )
        assert (
            client.patch(
                role_path, headers=admin_headers, json={"system_role": "no_access"}
            ).status_code
            == 200
        )
        assert client.get("/api/v1/auth/me").json()["permissions"] == []
        assert client.get(preferences, headers=user_headers).status_code == 200
        # Every case registers a fresh ordinary identity. A preceding user's
        # explicit empty role must not contaminate the following account.
        assert (
            client.post(
                "/api/v1/auth/register",
                json={
                    "email": f"user-{uuid.uuid4()}@example.com",
                    "password": password,
                },
            ).status_code
            == 201
        )
        following_user = client.get("/api/v1/auth/me").json()
        assert following_user["id"] != user["id"]
        assert following_user["system_role"] == "user"
        assert {"runs:create", "runs:cancel", "threads:delete"} <= set(
            following_user["permissions"]
        )
        client.cookies.clear()
        assert (
            client.post(
                "/api/v1/auth/login/local",
                data={"username": "user@example.com", "password": password},
            ).status_code
            == 200
        )
        assert client.get("/api/v1/auth/me").json()["id"] == user["id"]
        assert client.get("/api/v1/auth/me").json()["permissions"] == []
        user_headers["X-CSRF-Token"] = client.cookies["csrf_token"]
        assert (
            client.patch(
                role_path, headers=admin_headers, json={"system_role": "user"}
            ).status_code
            == 200
        )
        assert (
            client.delete(f"/api/threads/{thread_id}", headers=user_headers).status_code
            == 200
        )
    print(
        "PASS: isolated first-boot session, SQL preferences, CSRF, expected-owner, real role revocation and re-grant"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8023)
    parser.add_argument("--cors", default="http://localhost:3119")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check real session/SQL/RBAC fixture admission without starting a network server.",
    )
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="session-authz-gw-") as directory:
        configure_gateway(Path(directory), args.cors)
        if args.check:
            verify_fixture()
        else:
            import uvicorn

            uvicorn.run(
                "app.gateway.app:app",
                host="127.0.0.1",
                port=args.port,
                log_level="warning",
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
