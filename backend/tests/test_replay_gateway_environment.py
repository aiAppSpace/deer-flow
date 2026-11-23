"""Replay runners isolate real configuration loading before importing Gateway."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
RUNNER = BACKEND / "scripts/run_replay_gateway.py"
PROBE = r"""
import json
import os
import runpy
import shutil
import sys
import types
from pathlib import Path

ambient_pythonpath = os.environ['PYTHONPATH']

def inspect(target, **options):
    from app.gateway.auth.config import get_auth_config
    from deerflow.config.app_config import get_app_config
    from deerflow.config.runtime_paths import project_root, runtime_home

    config = get_app_config()
    home = runtime_home()
    dotenv = Path(os.environ['DEER_FLOW_ENV_FILE'])
    routes = [] if isinstance(target, str) else [route.path for route in target.routes]
    result = {
        'isolated_project': project_root() == home,
        'isolated_dotenv': dotenv.resolve().parent == home and dotenv.read_text(encoding='utf-8') == '',
        'isolated_config': Path(os.environ['DEER_FLOW_CONFIG_PATH']).resolve().parent == home,
        'isolated_sql': Path(config.database.sqlite_dir).resolve().parent == home,
        'fixture_secret': get_auth_config().jwt_secret == 'ci-replay-secret-at-least-32-bytes',
        'ambient_absent': not any(key in os.environ for key in ('OPENAI_API_KEY', 'HTTP_PROXY', 'REPLAY_OPERATOR_SENTINEL', 'PYTHON_DOTENV_DISABLED')),
        'pythonpath': os.environ['PYTHONPATH'].split(os.pathsep),
        'ambient_import_path_absent': ambient_pythonpath not in sys.path,
        'auth_disabled': os.environ.get('DEER_FLOW_AUTH_DISABLED'),
        'controls': {key: value for key, value in os.environ.items() if key.startswith('DEERFLOW_ENABLE_')},
        'models': [model.name for model in config.models],
        'memory_backend': config.memory.manager_class,
        'channel_enabled': config.channel_connections.enabled,
        'seed_route': '/api/test-only/seed-runs' in routes,
        'agent_route': '/api/test-only/agents/set-enabled' in routes,
        'channel_routes': any(path.startswith('/api/test-only/channels') for path in routes),
        'settings_marker': (Path(os.environ['DEERFLOW_SETTINGS_TEST_HOME_MARKER']).read_text(encoding='utf-8') == str(home.resolve())) if 'DEERFLOW_SETTINGS_TEST_HOME_MARKER' in os.environ else None,
        'port': options['port'],
    }
    print('REPLAY_ENVIRONMENT=' + json.dumps(result), flush=True)
    shutil.rmtree(home)

sys.modules['uvicorn'] = types.SimpleNamespace(run=inspect)
sys.argv = [sys.argv[1], '--port', '18473', '--cors', 'http://localhost:3198']
runpy.run_path(sys.argv[0], run_name='__main__')
"""


@pytest.mark.parametrize("scenario", ["default", "seed", "agent", "channel", "settings"])
def test_replay_gateway_isolates_ambient_config_and_preserves_explicit_controls(tmp_path: Path, scenario: str) -> None:
    operator_dotenv = tmp_path / ".env"
    operator_dotenv.write_text("REPLAY_OPERATOR_SENTINEL=must-not-load\n", encoding="utf-8")
    marker = tmp_path / "settings-home.txt"
    controls = {
        "DEERFLOW_ENABLE_FUTURE_TEST_CONTROL": "1",
        **({"DEERFLOW_ENABLE_TEST_SEED": "1"} if scenario == "seed" else {}),
        **({"DEERFLOW_ENABLE_AGENT_TEST_MODEL": "1"} if scenario == "agent" else {}),
        **({"DEERFLOW_ENABLE_CHANNEL_TEST_SEED": "1"} if scenario == "channel" else {}),
        **({"DEERFLOW_ENABLE_SETTINGS_TEST_SEED": "1", "DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND": "noop", "DEERFLOW_SETTINGS_TEST_HOME_MARKER": str(marker)} if scenario == "settings" else {}),
    }
    env = {
        **os.environ,
        "DEER_FLOW_PROJECT_ROOT": str(tmp_path),
        "DEER_FLOW_ENV_FILE": str(operator_dotenv),
        "DEER_FLOW_HOME": str(tmp_path / "operator-home"),
        "DEER_FLOW_AUTH_DISABLED": "1" if scenario == "seed" else "0",
        "AUTH_JWT_SECRET": "ambient-must-not-be-used",
        "OPENAI_API_KEY": "ambient-not-a-real-key",
        "HTTP_PROXY": "http://127.0.0.1:1",
        "PYTHONPATH": str(tmp_path / "operator-python-path"),
        **controls,
    }
    result = subprocess.run([sys.executable, "-c", PROBE, str(RUNNER)], cwd=BACKEND, env=env, capture_output=True, text=True, encoding="utf-8", timeout=45, check=False)
    assert result.returncode == 0, result.stdout + result.stderr
    line = next(line for line in result.stdout.splitlines() if line.startswith("REPLAY_ENVIRONMENT="))
    observed = json.loads(line.split("=", 1)[1])
    for field in ("isolated_project", "isolated_dotenv", "isolated_config", "isolated_sql", "fixture_secret", "ambient_absent", "ambient_import_path_absent"):
        assert observed[field], (scenario, field)
    assert observed["pythonpath"] == [str(BACKEND), str(BACKEND / "tests")]
    assert observed["auth_disabled"] == ("1" if scenario == "seed" else "0")
    assert observed["controls"] == {key: value for key, value in controls.items() if key.startswith("DEERFLOW_ENABLE_")}
    assert observed["models"] == (["basic-model", "reasoning-model"] if scenario == "agent" else ["scenario-model"])
    assert observed["memory_backend"] == ("noop" if scenario == "settings" else "deermem")
    assert observed["channel_enabled"] is (scenario == "channel")
    assert observed["seed_route"] is (scenario == "seed")
    assert observed["agent_route"] is (scenario == "agent")
    assert observed["channel_routes"] is (scenario == "channel")
    assert observed["settings_marker"] is (True if scenario == "settings" else None)
    assert observed["port"] == 18473
    assert operator_dotenv.read_text(encoding="utf-8") == "REPLAY_OPERATOR_SENTINEL=must-not-load\n"
    assert not (tmp_path / "operator-home").exists()
