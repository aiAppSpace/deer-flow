from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PNPM_SCRIPT = REPO_ROOT / "scripts" / "pnpm.py"
FRONTEND_DIR = REPO_ROOT / "frontend"
FRONTEND_VUE_DIR = REPO_ROOT / "frontend-vue"


def _load_pnpm_module():
    spec = importlib.util.spec_from_file_location("deerflow_pnpm_runner", PNPM_SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_fake_command(bin_dir: Path, name: str, label: str, exit_code: int = 0) -> Path:
    if os.name == "nt":
        path = bin_dir / f"{name}.cmd"
        path.write_text(
            f"@echo off\r\necho {label}^|%CD%^|%*\r\nexit /b {exit_code}\r\n",
            encoding="utf-8",
        )
    else:
        path = bin_dir / name
        path.write_text(
            f"#!/bin/sh\nprintf '%s|%s|%s\\n' '{label}' \"$PWD\" \"$*\"\nexit {exit_code}\n",
            encoding="utf-8",
        )
        path.chmod(0o755)
    return path


def _run_pnpm(
    path: Path,
    *args: str,
    cwd: Path = FRONTEND_DIR,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PATH"] = str(path)
    return subprocess.run(
        [sys.executable, str(PNPM_SCRIPT), *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        shell=False,
    )


def test_runner_prefers_direct_pnpm_and_forwards_arguments(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm", "direct")
    _write_fake_command(bin_dir, "corepack", "corepack")

    result = _run_pnpm(bin_dir, "run", "dev", "--host", "127.0.0.1")

    assert result.returncode == 0
    assert result.stdout.strip() == f"direct|{FRONTEND_DIR}|run dev --host 127.0.0.1"
    assert "via Corepack" not in result.stderr


def test_runner_uses_corepack_pnpm_from_frontend_directory(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "corepack", "corepack")

    result = _run_pnpm(bin_dir, "--version")

    assert result.returncode == 0
    assert result.stdout.strip() == f"corepack|{FRONTEND_DIR}|pnpm --version"
    assert result.stderr.strip() == "Using pnpm via Corepack."

    package_json = json.loads((FRONTEND_DIR / "package.json").read_text(encoding="utf-8"))
    assert package_json["packageManager"] == "pnpm@10.26.2"


def test_runner_uses_frontend_directory_when_called_from_repo_root(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "corepack", "corepack")

    result = _run_pnpm(bin_dir, "--version", cwd=REPO_ROOT)

    assert result.returncode == 0
    assert result.stdout.strip() == f"corepack|{FRONTEND_DIR}|pnpm --version"


def test_runner_uses_frontend_directory_when_called_from_unrelated_directory(
    tmp_path: Path,
):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    unrelated_dir = tmp_path / "unrelated"
    unrelated_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm", "direct")

    result = _run_pnpm(bin_dir, "--version", cwd=unrelated_dir)

    assert result.returncode == 0
    assert result.stdout.strip() == f"direct|{FRONTEND_DIR}|--version"


def test_runner_strips_explicit_frontend_directory_and_forwards_remaining_arguments(
    tmp_path: Path,
):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm", "direct")

    result = _run_pnpm(
        bin_dir,
        "--dir",
        "frontend",
        "run",
        "dev",
        "--host",
        "127.0.0.1",
        cwd=REPO_ROOT,
    )

    assert result.returncode == 0
    assert result.stdout.strip() == f"direct|{FRONTEND_DIR}|run dev --host 127.0.0.1"


def test_runner_resolves_frontend_vue_from_whitelist(tmp_path: Path):
    module = _load_pnpm_module()
    repo_root = tmp_path / "repo"
    project_dir = repo_root / "frontend-vue"
    project_dir.mkdir(parents=True)
    (project_dir / "package.json").write_text("{}\n", encoding="utf-8")

    assert module.resolve_project_directory("frontend-vue", repo_root) == project_dir


def test_runner_rejects_absolute_directory(tmp_path: Path):
    module = _load_pnpm_module()

    try:
        module.resolve_project_directory(str(tmp_path.resolve()), REPO_ROOT)
    except ValueError as exc:
        assert "absolute" in str(exc).lower()
    else:
        raise AssertionError("absolute project directory was accepted")


def test_runner_rejects_parent_directory_traversal():
    module = _load_pnpm_module()

    try:
        module.resolve_project_directory("../frontend", REPO_ROOT)
    except ValueError as exc:
        assert ".." in str(exc)
    else:
        raise AssertionError("parent path traversal was accepted")


def test_runner_rejects_directory_outside_allowlist():
    module = _load_pnpm_module()

    try:
        module.resolve_project_directory("backend", REPO_ROOT)
    except ValueError as exc:
        assert "frontend or frontend-vue" in str(exc)
    else:
        raise AssertionError("directory outside allowlist was accepted")


def test_runner_rejects_missing_allowed_directory(tmp_path: Path):
    module = _load_pnpm_module()

    try:
        module.resolve_project_directory("frontend-vue", tmp_path)
    except ValueError as exc:
        assert "does not exist" in str(exc)
    else:
        raise AssertionError("missing project directory was accepted")


def test_runner_rejects_allowed_directory_without_package_json(tmp_path: Path):
    module = _load_pnpm_module()
    (tmp_path / "frontend-vue").mkdir()

    try:
        module.resolve_project_directory("frontend-vue", tmp_path)
    except ValueError as exc:
        assert "package.json" in str(exc)
    else:
        raise AssertionError("project directory without package.json was accepted")


def test_runner_rejects_missing_dir_value(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm", "unused")

    result = _run_pnpm(bin_dir, "--dir", cwd=REPO_ROOT)

    assert result.returncode == 2
    assert "requires a value" in result.stderr


def test_runner_can_select_pnpm_cmd_before_corepack(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm.cmd", "direct-cmd")
    _write_fake_command(bin_dir, "corepack", "corepack")

    result = _run_pnpm(bin_dir, "--version")

    assert result.returncode == 0
    assert result.stdout.strip() == f"direct-cmd|{FRONTEND_DIR}|--version"
    assert "via Corepack" not in result.stderr


def test_runner_reports_actionable_error_when_pnpm_and_corepack_are_missing(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    result = _run_pnpm(bin_dir, "--version")

    assert result.returncode == 127
    assert "Neither pnpm nor Corepack is available" in result.stderr
    assert "ensure 'corepack' is on PATH" in result.stderr


def test_runner_propagates_selected_pnpm_failure(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_command(bin_dir, "pnpm", "broken-direct", exit_code=42)
    _write_fake_command(bin_dir, "corepack", "unused-corepack")

    result = _run_pnpm(bin_dir, "install", "--frozen-lockfile")

    assert result.returncode == 42
    assert result.stdout.strip() == f"broken-direct|{FRONTEND_DIR}|install --frozen-lockfile"
    assert "pnpm command failed with exit status 42" in result.stderr


def test_official_entrypoints_route_pnpm_through_shared_runner():
    root_makefile = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    frontend_makefile = (FRONTEND_DIR / "Makefile").read_text(encoding="utf-8")
    serve_script = (REPO_ROOT / "scripts" / "serve.sh").read_text(encoding="utf-8")
    doctor_script = (REPO_ROOT / "scripts" / "doctor.py").read_text(encoding="utf-8")
    support_bundle_script = (REPO_ROOT / "scripts" / "support_bundle.py").read_text(encoding="utf-8")

    assert "cd frontend && $(FRONTEND_PNPM) install" in root_makefile
    assert "PNPM = $(PYTHON) ../scripts/pnpm.py" in frontend_makefile
    assert '"$DEERFLOW_PNPM_PYTHON" "$DEERFLOW_PNPM_RUNNER" install --silent' in serve_script
    assert 'DEERFLOW_PNPM_RUNNER="$REPO_ROOT/scripts/pnpm.py"' in serve_script
    # 本仓把它拆成了 React / Vue 两条；上游 #5053 给 React 那条加了显式 PORT=3000
    # （Windows 上 next dev 不认 .env 里的 PORT）——两样都要断言。
    assert 'REACT_FRONTEND_CMD=\'env PORT=3000 "$DEERFLOW_PNPM_PYTHON" "$DEERFLOW_PNPM_RUNNER" run dev\'' in serve_script
    assert 'VUE_FRONTEND_CMD=\'"$DEERFLOW_PNPM_PYTHON" "$DEERFLOW_PNPM_RUNNER" --dir frontend-vue exec nuxt dev --port 3100\'' in serve_script
    assert '"\\$DEERFLOW_PNPM_RUNNER\\" run preview"' in serve_script
    assert 'Path(__file__).resolve().with_name("pnpm.py")' in doctor_script
    assert 'project_root / "scripts" / "pnpm.py"' in support_bundle_script


@pytest.mark.skipif(shutil.which("make") is None, reason="GNU make is not on PATH (not bundled with Git Bash on Windows)")
def test_make_install_dry_run_does_not_invoke_bare_pnpm():
    result = subprocess.run(
        ["make", "-n", "install"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
        shell=False,
    )

    assert result.returncode == 0
    assert "cd frontend && " in result.stdout
    assert "../scripts/pnpm.py install" in result.stdout
    assert "cd frontend && pnpm install" not in result.stdout
