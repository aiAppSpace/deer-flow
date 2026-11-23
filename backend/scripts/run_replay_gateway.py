"""Start a hermetic *replay* gateway for the full-stack (Layer 2) e2e.

Builds an ephemeral config that points the model at ``ReplayChatModel`` + a
recorded fixture, then runs uvicorn — no API key, deterministic. Used as a
Playwright ``webServer`` (see ``frontend/playwright.real-backend.config.ts``) and
runnable standalone for debugging::

    uv run python scripts/run_replay_gateway.py --port 8011

``tests/`` is put on the path so the config ``use: replay_provider:ReplayChatModel``
resolves; ``GATEWAY_CORS_ORIGINS`` is set so the frontend on :3000 can talk to it.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND))
sys.path.insert(0, str(_BACKEND / "tests"))  # replay_provider + build_config_yaml live here

_OS_ENVIRONMENT = frozenset({"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_NODEJS_PATH"})
_TEST_CONTROLS = frozenset({"DEER_FLOW_AUTH_DISABLED", "DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND", "DEERFLOW_SETTINGS_TEST_HOME_MARKER"})


def isolate_environment(home: Path, config_path: Path) -> None:
    """Drop operator configuration before any production configuration import.

    Explicit suite switches survive; runtime paths, dotenv, JWT and Python
    imports are owned by this runner, irrespective of the invoking shell.
    """
    inherited_imports = {str(Path(entry).resolve()) for entry in os.environ.get("PYTHONPATH", "").split(os.pathsep) if entry}
    trusted_imports = {str(_BACKEND), str(_BACKEND / "tests")}
    # Python already expanded the parent's PYTHONPATH before main(). Changing
    # the environment alone would still allow operator modules to shadow deps.
    sys.path[:] = [entry for entry in sys.path if str(Path(entry).resolve()) not in inherited_imports or str(Path(entry).resolve()) in trusted_imports]
    environment = {key: value for key, value in os.environ.items() if key in _OS_ENVIRONMENT or key in _TEST_CONTROLS or key.startswith("DEERFLOW_ENABLE_")}
    dotenv = home / ".env"
    dotenv.write_text("", encoding="utf-8")
    environment.update(
        DEER_FLOW_HOME=str(home),
        DEER_FLOW_PROJECT_ROOT=str(home),
        DEER_FLOW_CONFIG_PATH=str(config_path),
        DEER_FLOW_ENV_FILE=str(dotenv),
        AUTH_JWT_SECRET="ci-replay-secret-at-least-32-bytes",
        PYTHONPATH=os.pathsep.join((str(_BACKEND), str(_BACKEND / "tests"))),
    )
    os.environ.clear()
    os.environ.update(environment)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--fixture", default=str(_BACKEND / "tests" / "fixtures" / "replay" / "write_read_file.ultra.json"))
    parser.add_argument("--cors", default="http://localhost:3000")
    args = parser.parse_args()

    home = Path(tempfile.mkdtemp(prefix="replay-gw-"))
    cfg = home / "config.yaml"
    isolate_environment(home, cfg)

    from _replay_fixture import REPLAY_MODEL_BLOCK, build_config_yaml, prepare_hermetic_extras

    config_yaml = build_config_yaml(model_block=REPLAY_MODEL_BLOCK, home=home)
    channel_fixture_enabled = os.environ.get("DEERFLOW_ENABLE_CHANNEL_TEST_SEED") == "1"
    agent_fixture_enabled = os.environ.get("DEERFLOW_ENABLE_AGENT_TEST_MODEL") == "1"
    settings_fixture_enabled = os.environ.get("DEERFLOW_ENABLE_SETTINGS_TEST_SEED") == "1"
    settings_memory_backend = os.environ.get("DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND")
    settings_home_marker = os.environ.get("DEERFLOW_SETTINGS_TEST_HOME_MARKER")
    if not settings_fixture_enabled and (settings_memory_backend or settings_home_marker):
        raise RuntimeError("Settings test controls require DEERFLOW_ENABLE_SETTINGS_TEST_SEED=1")
    if agent_fixture_enabled:
        from agent_e2e_fixture import AGENT_E2E_MODEL_BLOCK

        config_yaml = build_config_yaml(model_block=AGENT_E2E_MODEL_BLOCK, home=home)
    if channel_fixture_enabled:
        config_yaml += """\
channel_connections:
  enabled: true
  slack:
    enabled: true
  telegram:
    enabled: true
    bot_username: deerflow_e2e_bot
channels:
  slack:
    enabled: true
    bot_token: xoxb-controlled-e2e
    app_token: xapp-controlled-e2e
  telegram:
    enabled: true
    bot_token: telegram-controlled-e2e
    bot_username: deerflow_e2e_bot
"""
    if settings_memory_backend:
        from settings_e2e_fixture import configure_settings_memory_backend

        config_yaml = configure_settings_memory_backend(config_yaml, settings_memory_backend)
    cfg.write_text(config_yaml, encoding="utf-8")

    extensions_path = prepare_hermetic_extras(home)
    if settings_fixture_enabled:
        from settings_e2e_fixture import prepare_settings_e2e_fixture, publish_settings_test_home

        prepare_settings_e2e_fixture(home, extensions_path)
        if settings_home_marker:
            publish_settings_test_home(home, Path(settings_home_marker))
    os.environ["DEER_FLOW_EXTENSIONS_CONFIG_PATH"] = str(extensions_path)
    os.environ["DEERFLOW_REPLAY_FIXTURE"] = args.fixture
    os.environ["GATEWAY_CORS_ORIGINS"] = args.cors

    import uvicorn

    target: str | object = "app.gateway.app:app"
    if channel_fixture_enabled:
        from channel_e2e_fixture import install_channel_service_fixture

        install_channel_service_fixture()
    if agent_fixture_enabled:
        from agent_e2e_fixture import install_agent_model_fixture

        install_agent_model_fixture()
    # Test-only: attach the run/message seeder used by the multi-run render-order
    # e2e (#3352). Imported from tests/ and mounted here only — never in the
    # production app. Pass the app object (not the import string) so the extra
    # router is registered before uvicorn serves it.
    if os.environ.get("DEERFLOW_ENABLE_TEST_SEED") == "1":
        from seed_runs_router import router as seed_router

        from app.gateway.app import app as gateway_app

        gateway_app.include_router(seed_router)
        target = gateway_app
        print("[replay-gw] test-only seed router mounted at /api/test-only/seed-runs", flush=True)

    if channel_fixture_enabled:
        from channel_e2e_fixture import router as channel_seed_router

        from app.gateway.app import app as gateway_app

        gateway_app.include_router(channel_seed_router)
        target = gateway_app
        print("[replay-gw] controlled external-channel fixture mounted at /api/test-only/channels", flush=True)

    if agent_fixture_enabled:
        from agent_e2e_fixture import router as agent_fixture_router

        from app.gateway.app import app as gateway_app

        gateway_app.include_router(agent_fixture_router)
        target = gateway_app
        print(
            "[replay-gw] controlled Agent model fixture mounted at /api/test-only/agents",
            flush=True,
        )

    print(f"[replay-gw] config={cfg} fixture={args.fixture} cors={args.cors} port={args.port}", flush=True)
    uvicorn.run(target, host="127.0.0.1", port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
