"""M0 regression tests for explicit Vue/dual root startup wiring."""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_root_make_keeps_react_default_and_exposes_vue_and_dual_targets():
    makefile = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")

    assert "./scripts/serve.sh --dev\n" in makefile
    assert "dev-vue:" in makefile
    assert "./scripts/serve.sh --dev --vue" in makefile
    assert "dev-dual:" in makefile
    assert "./scripts/serve.sh --dev --dual" in makefile


def test_serve_routes_host_pnpm_through_allowlisted_runner_and_stops_vue():
    serve = (REPO_ROOT / "scripts" / "serve.sh").read_text(encoding="utf-8")

    assert 'FRONTEND_MODE="react"' in serve
    assert '"$DEERFLOW_PNPM_RUNNER" --dir frontend-vue install --silent' in serve
    assert '"$DEERFLOW_PNPM_RUNNER" --dir frontend-vue exec nuxt dev --port 3100' in serve
    assert '_kill_repo_processes "nuxt dev"' in serve
    assert "_kill_repo_port 3100" in serve
    assert 'if [ "$FRONTEND_MODE" = "react" ]; then' in serve
    assert "React http://localhost:3200 · Vue http://localhost:3100" in serve


def test_serve_shell_syntax_and_make_dry_runs_are_valid():
    syntax = subprocess.run(
        ["bash", "-n", "scripts/serve.sh"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert syntax.returncode == 0, syntax.stderr

    for target, flag in (("dev-vue", "--vue"), ("dev-dual", "--dual")):
        result = subprocess.run(
            ["make", "-n", target],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        assert flag in result.stdout
        assert f"scripts/check.py --frontend {flag.removeprefix('--')}" in result.stdout

    default = subprocess.run(["make", "-n", "dev"], cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    assert default.returncode == 0, default.stderr
    assert "scripts/check.py\n" in default.stdout
    assert "--frontend" not in default.stdout
