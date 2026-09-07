"""Unit tests for docker/dev-entrypoint.sh (UV_EXTRAS validation + parsing).

Exercises the script via its `--print-extras` dry-run hook so we don't actually
launch uvicorn or hit /app/logs. Together with test_detect_uv_extras.py these
cover both the local make-dev path and the docker-compose-dev path with the
same shape — see PR #2767 / Issue #2754.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
ENTRYPOINT = REPO_ROOT / "docker" / "dev-entrypoint.sh"


def _run(uv_extras: str | None) -> subprocess.CompletedProcess[str]:
    """Invoke `dev-entrypoint.sh --print-extras` with UV_EXTRAS set."""
    env = os.environ.copy()
    env.pop("UV_EXTRAS", None)
    if uv_extras is not None:
        env["UV_EXTRAS"] = uv_extras
    return subprocess.run(
        ["sh", str(ENTRYPOINT), "--print-extras"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_entrypoint_script_exists_and_is_posix_sh():
    assert ENTRYPOINT.is_file()
    # Catch syntax errors before runtime — `sh -n` is a parse-only check.
    proc = subprocess.run(["sh", "-n", str(ENTRYPOINT)], capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stderr


def test_entrypoint_excludes_runtime_state_from_uvicorn_reload():
    content = ENTRYPOINT.read_text(encoding="utf-8")

    assert ': "${DEER_FLOW_HOME:=/app/backend/.deer-flow}"' in content
    # sandbox must be created too, not just .deer-flow (#3459 / #3454).
    assert 'mkdir -p "$DEER_FLOW_HOME" /app/backend/.deer-flow /app/backend/sandbox' in content
    assert "--reload-include='*.yaml .env'" not in content
    assert "--reload-include='*.yaml'" in content
    assert "--reload-include='.env'" in content
    assert "--reload-exclude=/app/backend/sandbox" in content
    assert '--reload-exclude="$DEER_FLOW_HOME"' in content
    assert "--reload-exclude=/app/backend/.deer-flow" in content


def test_no_uv_extras_yields_empty_flags():
    proc = _run(None)
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""


def test_single_extra():
    proc = _run("postgres")
    assert proc.returncode == 0
    assert proc.stdout.strip() == "--extra postgres"


def test_multi_extra_comma_separated():
    proc = _run("postgres,ollama")
    assert proc.returncode == 0
    assert proc.stdout.strip() == "--extra postgres --extra ollama"


def test_multi_extra_whitespace_separated():
    proc = _run("postgres ollama")
    assert proc.returncode == 0
    assert proc.stdout.strip() == "--extra postgres --extra ollama"


def test_multi_extra_mixed_separators():
    proc = _run(" postgres ,  ollama ,")
    assert proc.returncode == 0
    assert proc.stdout.strip() == "--extra postgres --extra ollama"


def test_empty_string_yields_empty_flags():
    proc = _run("")
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""


@pytest.mark.parametrize(
    "bad_value",
    [
        "; rm -rf /",  # the canonical injection attempt
        "$(whoami)",  # command substitution
        "`echo bad`",  # backticks
        "postgres;evil",  # mixed legal+illegal in a single token
        "1postgres",  # leading digit
        "-postgres",  # leading hyphen
        "post gres extra/path",  # contains slash
    ],
)
def test_metacharacters_abort_with_nonzero_exit(bad_value):
    proc = _run(bad_value)
    assert proc.returncode != 0, f"expected abort for {bad_value!r}, got 0"
    assert "is invalid" in proc.stderr
    assert proc.stdout.strip() == ""


def test_underscores_and_hyphens_in_name_are_allowed():
    """Mirrors uv's accepted shape for `[project.optional-dependencies]` keys."""
    proc = _run("post_gres,post-gres")
    assert proc.returncode == 0
    assert proc.stdout.strip() == "--extra post_gres --extra post-gres"


# ── Platform self-heal (`--check-venv`) ─────────────────────────────────────
#
# Why this exists, measured 2026-09-07: the docker-compose-dev gateway had been
# running for days against `/app/backend/.venv`, which is a *named volume*
# (`gateway-venv`). Named volumes are populated from the image only when first
# created and empty — after that no image rebuild touches them, silently. That
# volume held a **macOS** venv: 121 `*darwin*.so`, zero `*linux-gnu.so`, no
# `bin/python`, while the image itself carried the correct
# `_regex.cpython-312-aarch64-linux-gnu.so`.
#
# The product only showed this:
#
#     Error importing module deerflow.community.jina_ai.tools: cannot import
#     name '_regex' from partially initialized module 'regex'
#
# — a message that names neither Docker nor the platform. `uv sync` does not
# catch it either: it compares `.dist-info` metadata against the lock file, not
# binary architecture, so a foreign venv with correct metadata reads as
# "already in sync", and the existing retry only fires when `uv sync` *fails*.
#
# So the entrypoint checks the one thing that actually differs — compiled
# extension suffixes carry their build platform — and empties the venv when it
# does not belong here. These tests exercise that check through the
# `--check-venv` dry-run hook, the same shape as `--print-extras` above.


def _check_venv(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["sh", str(ENTRYPOINT), "--check-venv", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )


def _make_venv(root: Path, *, artifacts: tuple[str, ...] = (), interpreter: bool = True) -> Path:
    venv = root / ".venv"
    (venv / "lib" / "python3.12" / "site-packages" / "regex").mkdir(parents=True)
    for name in artifacts:
        (venv / "lib" / "python3.12" / "site-packages" / "regex" / name).touch()
    if interpreter:
        (venv / "bin").mkdir(parents=True)
        python = venv / "bin" / "python"
        python.write_text("#!/bin/sh\n")
        python.chmod(0o755)
    return venv


def test_check_venv_accepts_a_native_venv(tmp_path):
    venv = _make_venv(tmp_path, artifacts=("_regex.cpython-312-aarch64-linux-gnu.so",))
    proc = _check_venv(venv)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "ok" in proc.stdout


def test_check_venv_rejects_a_macos_venv():
    """The exact shape of the 2026-09-07 incident."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        venv = _make_venv(Path(tmp), artifacts=("_regex.cpython-312-darwin.so",))
        proc = _check_venv(venv)
        assert proc.returncode == 1, proc.stdout + proc.stderr
        assert "darwin" in proc.stdout


def test_check_venv_rejects_a_windows_venv():
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        venv = _make_venv(Path(tmp), artifacts=("_regex.cp312-win_amd64.pyd",))
        proc = _check_venv(venv)
        assert proc.returncode == 1, proc.stdout + proc.stderr


def test_check_venv_rejects_a_venv_without_an_interpreter():
    """The polluted volume had no `bin/python` either — that alone is enough."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        venv = _make_venv(Path(tmp), interpreter=False)
        proc = _check_venv(venv)
        assert proc.returncode == 1, proc.stdout + proc.stderr
        assert "bin/python" in proc.stdout


def test_entrypoint_heals_a_foreign_venv_before_syncing():
    """The heal must run *before* `uv sync`, because uv cannot see this."""
    script = ENTRYPOINT.read_text()
    heal = script.index("foreign_artifact_in .venv")
    # 找**真正的调用**，不是文件头注释里那句 —— 第一版写成 index("uv sync
    # --all-packages") 命中的是第 11 行的说明文字，于是断言比的是注释的位置。
    sync = script.index("if ! uv sync --all-packages")
    assert heal < sync, "platform self-heal must precede uv sync"
    # 具名卷是挂载点，删不掉自己——只能清空内容。
    assert "find .venv -mindepth 1 -delete" in script
