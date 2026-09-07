"""AGENTS.md 的 Service Topology 表必须和 compose / nginx / 入口脚本一致。

为什么需要这条（wave 155 实测）：那张表的表头写着「A single `make dev` / **Docker
stack** runs four cooperating services」，五行里四行（2026 / 8001 / 3000 / 8002）确实
是 Docker 里的端口，**只有 Vue 那行写的是 `3100`**——那是本机 `make dev-vue` 的端口
（`frontend-vue/nuxt.config.ts` 的 `devServer.port`），而 Docker 里 Vue 跑的是
`nuxt dev --port 3000`，nginx 也是代理到 `frontend-vue:3000`。

代价不是「文档不好看」：AGENTS.md 是这个仓库的入门层，是每个 agent 进来读的第一份
文件。照着它去 Docker 栈里找 3100 上的 Vue，什么都找不到。

全仓其余写 `3100` 的地方**都是对的**（`make dev-vue` / `make dev-dual` /
`make -C frontend-vue dev`，ENTRY.md 甚至明标「本地开发端口」），所以判据不能是
「文档里不许出现 3100」——那会把正确的十几处一起打红。判据只钉**这一张表**，
逐行对上它各自的真实来源。
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_MD = REPO_ROOT / "AGENTS.md"
NGINX_CONF = REPO_ROOT / "docker" / "nginx" / "nginx.conf"
DEV_COMPOSE = REPO_ROOT / "docker" / "docker-compose-dev.yaml"
PROD_COMPOSE = REPO_ROOT / "docker" / "docker-compose.yaml"
ENTRYPOINT = REPO_ROOT / "docker" / "dev-entrypoint.sh"


def _topology_table() -> dict[str, str]:
    """`{服务名: 端口}`，从 AGENTS.md 的 Service Topology 表里读。"""
    text = AGENTS_MD.read_text(encoding="utf-8")
    start = text.index("## Service Topology")
    end = text.index("Nginx is the single public entry", start)
    rows = re.findall(r"^\|\s+\*\*(.+?)\*\*\s+\|\s+`(\d+)`\s+\|", text[start:end], re.M)
    return {name.strip(): port for name, port in rows}


def test_table_parses_into_every_documented_service():
    """尺子先量自己：正则或锚点写坏会让下面每一条静默全绿。"""
    table = _topology_table()
    assert set(table) == {
        "Nginx",
        "Gateway API",
        "React frontend",
        "Vue frontend",
        "Provisioner",
    }, table


def test_nginx_port_is_the_published_one_in_both_compose_files():
    """两份 compose 里发布的那个端口，就是表里 Nginx 那一行。

    实际那行长这样（`test_compose_default_bind_host.py` 钉的是它的**绑定地址**那一半，
    这里钉的是**端口**那一半）：

        - "${BIND_HOST:-127.0.0.1}:${PORT:-2026}:2026"
    """
    published = _topology_table()["Nginx"]
    pattern = re.compile(r"\$\{PORT:-" + re.escape(published) + r"\}:" + re.escape(published) + r'"')
    for compose in (DEV_COMPOSE, PROD_COMPOSE):
        text = compose.read_text(encoding="utf-8")
        assert pattern.search(text), f"{compose.name} 发布的端口与 AGENTS.md 的 {published} 对不上"


def test_gateway_port_is_the_one_uvicorn_binds():
    port = _topology_table()["Gateway API"]
    assert f"--port {port}" in ENTRYPOINT.read_text(encoding="utf-8")


def _nginx_upstreams() -> dict[str, str]:
    """nginx 按 hostname 选后端：`default frontend:3000;` / `"$VUE" frontend-vue:3000;`"""
    text = NGINX_CONF.read_text(encoding="utf-8")
    return dict(re.findall(r"(frontend(?:-vue)?):(\d+);", text))


def test_frontend_ports_match_what_nginx_proxies_to():
    """两行前端写的必须是**容器里**的端口，不是本机 `make dev-*` 的端口。

    这正是 wave 155 修掉的那处：Vue 那行原来写 `3100`（本机口），而 nginx 代理的是
    `frontend-vue:3000`。
    """
    table = _topology_table()
    upstreams = _nginx_upstreams()
    assert upstreams, "nginx.conf 里没解析到 frontend 上游——先修这条测试"
    assert table["React frontend"] == upstreams["frontend"]
    assert table["Vue frontend"] == upstreams["frontend-vue"]


def test_vue_service_command_uses_that_same_port():
    """再从另一头核一次：dev compose 里 Vue 的启动命令。"""
    port = _topology_table()["Vue frontend"]
    text = DEV_COMPOSE.read_text(encoding="utf-8")
    assert f"nuxt dev --host 0.0.0.0 --port {port}" in text


def test_provisioner_port_matches_its_dockerfile():
    port = _topology_table()["Provisioner"]
    dockerfile = (REPO_ROOT / "docker" / "provisioner" / "Dockerfile").read_text(encoding="utf-8")
    assert f"EXPOSE {port}" in dockerfile
