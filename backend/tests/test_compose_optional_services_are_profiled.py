"""被文档标成 optional 的 compose 服务，必须放在 profile 后面。

事故（2026-09-07，开发机实测）：`deer-flow-provisioner` 在崩溃重启循环里，
`RestartCount=4363`，持续三天，没有任何人注意到。日志里是

    ConfigException: Invalid kube-config file. Expected key current-context
                     in /root/.kube/config
    ERROR:    Application startup failed. Exiting.

宿主机的 `~/.kube/config` 是一份 28 字节的空壳（只有 `kind: Config`），
而那台机器的 sandbox 模式是 **aio**（`AioSandboxProvider` 且无 `provisioner_url`）——
`scripts/docker.sh` 在这种模式下**根本不会**把 provisioner 放进 `up` 的服务列表，
还会打印「Provisioner disabled (not required for this sandbox mode)」。

那它是怎么起来的：**compose 文件自己第 2 行写的用法**

    # Usage: docker compose -f docker-compose-dev.yaml up --build --watch

会启动**全部**服务，而 provisioner 当时没有 `profiles:`。加上 `restart: unless-stopped`，
它就无声地循环崩溃。`AGENTS.md` 的拓扑表明写它是
「Optional — only when sandbox is configured for provisioner/K8s mode」——
**一句写下来当规则、却没有任何机器在守的话。**

判据：**凡是被标成 optional 的服务，都必须有非空的 `profiles:`。**
这样一条裸 `docker compose up` 不会启动它；而 `scripts/docker.sh` 是**显式点名**服务的
（`up --build --watch --remove-orphans $services`），Compose v2 在显式点名时会自动启用
该服务的 profile，所以 K8s 那条路不受影响。
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "scripts"
COMPOSE_FILES = (
    REPO_ROOT / "docker" / "docker-compose-dev.yaml",
    REPO_ROOT / "docker" / "docker-compose.yaml",
)

#: 服务名 → 它被标成 optional 的出处。加一项之前先确认那处真的这么写了。
OPTIONAL_SERVICES = {
    "provisioner": "AGENTS.md 的 Service Topology 表：'Optional — only when sandbox is configured for provisioner/K8s mode'",
}


def _services(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))["services"]


@pytest.mark.parametrize("compose", COMPOSE_FILES, ids=lambda p: p.name)
def test_compose_parses_and_has_the_services_we_think_it_has(compose: Path):
    """尺子先量自己：解析或路径写坏会让下面那条静默全绿。"""
    services = _services(compose)
    assert len(services) >= 4, services.keys()
    for name in OPTIONAL_SERVICES:
        assert name in services, f"{compose.name} 里没有 {name} 这个服务——清单过期了"


@pytest.mark.parametrize("compose", COMPOSE_FILES, ids=lambda p: p.name)
def test_optional_services_sit_behind_a_profile(compose: Path):
    services = _services(compose)
    missing = {name: why for name, why in OPTIONAL_SERVICES.items() if not services.get(name, {}).get("profiles")}
    assert not missing, f"{compose.name}：这些服务被文档标成 optional，却没有 profiles: —— 一条裸 `docker compose up` 会把它们一起启动，前置条件不满足时就无声地循环崩溃（2026-09-07 实测 RestartCount=4363）。{missing}"


@pytest.mark.parametrize("compose", COMPOSE_FILES, ids=lambda p: p.name)
def test_non_optional_services_are_not_hidden_behind_a_profile(compose: Path):
    """反方向：核心服务不许躲在 profile 后面，否则裸 `up` 起不全这套栈。"""
    services = _services(compose)
    hidden = sorted(name for name, spec in services.items() if name not in OPTIONAL_SERVICES and (spec or {}).get("profiles"))
    assert not hidden, f"{compose.name}：这些服务不在 optional 清单里，却藏在 profile 后面：{hidden}。要么把它们加进 OPTIONAL_SERVICES 并写明出处，要么去掉 profiles:。"


# ── 另一半：profile 一旦加上，不带服务名的子命令就会静默漏掉它 ────────────────
#
# `profiles:` 的语义是「不被选中就不参与」，而不是「不被 up 启动」。实测
# （Compose v5.4.0，2026-09-07）：
#
#   * `up redis frontend frontend-vue gateway nginx` —— 显式点名会自动启用被点
#     名服务的 profile，所以 K8s 模式那条路照常；点名之外的 profiled 服务不会
#     被带起来。**up 这条路不需要 --profile。**
#   * `down` 和 `down --remove-orphans` —— 都**不会**停掉正在跑的 provisioner
#     容器（哪怕它带着同一个 project 标签）。加 `--profile provisioner` 才会。
#   * `build` 不点名 —— 会漏掉 provisioner 镜像，而 `deploy.sh build` 的横幅
#     自己写着 "Build produces mode-agnostic images"。
#
# 所以判据是：**凡是自己拼 COMPOSE_CMD 的脚本，都必须声明全部 optional
# profile。** 少一个，`stop` 就会留下半拆的栈，`build` 就会少一个镜像。


def _strip_sh_comments(text: str) -> str:
    """去掉 shell 注释再扫。

    2026-09-07 实测的假绿：这份文件的注释里就写着 `--profile provisioner`
    这串字解释它为什么在，于是把命令行上的 flag 整个删掉，守卫照样全绿——
    它核的是散文，不是命令。这是本仓踩过的同一个坑（「扫描前先剥注释」）。
    """
    out = []
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("#"):
            continue
        # 行尾注释：只认前面有空白的 `#`，避免切到 `${VAR#pat}` 之类
        idx = line.find(" #")
        if idx != -1:
            line = line[:idx]
        out.append(line)
    return "\n".join(out)


def _compose_driving_scripts() -> list[Path]:
    """自证扫描面：凡是自己拼 `docker compose ... -f <compose 文件>` 的脚本。"""
    found = []
    for path in sorted(SCRIPTS_DIR.rglob("*.sh")):
        text = path.read_text(encoding="utf-8")
        if "docker compose" in text and "docker-compose" in text:
            found.append(path)
    return found


def test_the_scan_surface_is_not_empty():
    """尺子先量自己：`scripts/` 挪了位置会让下面那条静默全绿。"""
    scripts = _compose_driving_scripts()
    names = {p.name for p in scripts}
    assert {"docker.sh", "deploy.sh"} <= names, f"没扫到已知的两个 compose 驱动脚本，扫描面坏了：{sorted(names)}"


def test_compose_driving_scripts_declare_every_optional_profile():
    profiles = set()
    for compose in COMPOSE_FILES:
        for name, spec in _services(compose).items():
            if name in OPTIONAL_SERVICES:
                profiles.update((spec or {}).get("profiles") or [])
    assert profiles, "compose 里一个 optional profile 都没读到——上面的清单和文件对不上"

    broken = {}
    for script in _compose_driving_scripts():
        text = _strip_sh_comments(script.read_text(encoding="utf-8"))
        missing = sorted(p for p in profiles if f"--profile {p}" not in text)
        if missing:
            broken[script.name] = missing
    assert not broken, f"这些脚本自己拼了 COMPOSE_CMD 却没声明 optional profile；`down`/`stop` 会留下正在跑的 profiled 容器（实测 `--remove-orphans` 也带不走），`build` 会少产出对应镜像：{broken}"
