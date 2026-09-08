"""前端 dev 容器的平台自查。

事故（2026-09-08，开发机实测）：React 容器答了十小时请求之后开始对 `/` 返回 500——

    Error: Cannot find module '../lightningcss.linux-arm64-musl.node'

容器是 Alpine/arm64，Tailwind v4 需要 `lightningcss-linux-arm64-musl`；
镜像里装的却是 **`lightningcss-darwin-arm64`**（macOS 的构建），而且那一族里没有别的。

**实测证据**：容器 `node_modules/.pnpm` 有 **1087** 个条目，与 macOS 宿主机**同数**；
那个包目录的时间戳比镜像「重建」时间早一个月。也就是说 Docker 复用了缓存的
`dependencies` 层——它的输入（`package.json` / `pnpm-lock.yaml`）没变过。
锁文件里**是有** `lightningcss-linux-arm64-musl` 的，所以不是锁文件的问题。

**为什么藏了十小时**：那个原生模块只在 Tailwind **冷编译** `globals.css` 时才加载。
dev server 的编译缓存把之前所有请求都答掉了，直到容器重启。

**为什么这条是「拒绝启动」而不是「就地自愈」**：`node_modules` 在**镜像层**里，
不在命名卷里。启动时重装会在下一次 `up --build` 被冲掉，而且会掩盖一个坏镜像——
与后端 `.venv` 那条正好相反（那边是命名卷，永远不自愈，所以只能就地重建）。
两条的判据都写在各自的脚本头里。
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "docker" / "node-entrypoint.sh"


def run_check(target: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["sh", str(SCRIPT), "--check-modules", str(target)],
        capture_output=True,
        text=True,
        check=False,
    )


def test_script_exists_and_parses():
    """尺子先量自己：脚本没了或语法坏了，下面每一条都会以别的理由红。"""
    assert SCRIPT.is_file(), SCRIPT
    parsed = subprocess.run(["sh", "-n", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert parsed.returncode == 0, parsed.stderr


def test_native_tree_is_accepted(tmp_path: Path):
    (tmp_path / ".pnpm" / "lightningcss-linux-arm64-musl@1.30.2").mkdir(parents=True)
    result = run_check(tmp_path)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "ok" in result.stdout


def test_macos_package_is_rejected(tmp_path: Path):
    """事故当时容器里的形状。"""
    (tmp_path / ".pnpm" / "lightningcss-darwin-arm64@1.30.2").mkdir(parents=True)
    result = run_check(tmp_path)
    assert result.returncode == 1
    assert "darwin" in result.stdout


def test_windows_package_is_rejected(tmp_path: Path):
    (tmp_path / ".pnpm" / "lightningcss-win32-x64-msvc@1.30.2").mkdir(parents=True)
    result = run_check(tmp_path)
    assert result.returncode == 1
    assert "win32" in result.stdout


def test_missing_pnpm_dir_is_rejected(tmp_path: Path):
    """没装过依赖也不能放行——否则「一条都没扫到」会被当成「干净」。"""
    result = run_check(tmp_path)
    assert result.returncode == 1
    assert ".pnpm" in result.stderr


def test_refusal_names_the_fix():
    """报错必须写出确切修法：这条门禁挡住的是一个十小时后才现形的失败。"""
    text = SCRIPT.read_text(encoding="utf-8")
    assert "--no-cache" in text, "拒绝启动时要告诉人怎么修"
    assert "frontend frontend-vue" in text


@pytest.mark.parametrize("service", ["frontend", "frontend-vue"])
def test_both_frontend_services_run_the_guard(service: str):
    """两个前端容器都要走这条自查，而且脚本要挂进去。"""
    import yaml

    compose = yaml.safe_load((REPO_ROOT / "docker" / "docker-compose-dev.yaml").read_text(encoding="utf-8"))
    spec = compose["services"][service]
    command = spec.get("command")
    # 字符串形式，不是列表：`test_dual_frontend_production_ingress.py` 那三条守卫
    # 用子串匹配钉住 Vue dev server 的端口与参数，改成列表会让它们以「表示法变了」
    # 的名义红——而它们钉的意图并没有变。
    assert isinstance(command, str), f"{service} 的 command 要写成字符串形式"
    assert "/usr/local/bin/node-entrypoint.sh" in command, command
    mounts = spec.get("volumes") or []
    assert any("node-entrypoint.sh" in str(m) for m in mounts), mounts
