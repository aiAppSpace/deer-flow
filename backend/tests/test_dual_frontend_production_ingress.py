"""Production contract for the React/Vue dual-host ingress.

M7 keeps one published nginx surface and one Gateway.  The browser-facing
hostname selects only the HTML frontend; API, SSE, WebSocket, auth, and cookie
traffic stay same-origin through the same server block.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_PATH = REPO_ROOT / "docker/docker-compose.yaml"
DEV_COMPOSE_PATH = REPO_ROOT / "docker/docker-compose-dev.yaml"
NGINX_PATH = REPO_ROOT / "docker/nginx/nginx.conf"
VUE_DOCKERFILE_PATH = REPO_ROOT / "frontend-vue/Dockerfile"
DOCKER_SCRIPT_PATH = REPO_ROOT / "scripts/docker.sh"
DEPLOY_SCRIPT_PATH = REPO_ROOT / "scripts/deploy.sh"


def _compose() -> dict:
    return yaml.safe_load(COMPOSE_PATH.read_text(encoding="utf-8"))


def _nginx() -> str:
    return NGINX_PATH.read_text(encoding="utf-8")


def test_production_compose_builds_secondary_vue_without_publishing_a_port() -> None:
    services = _compose()["services"]
    vue = services["frontend-vue"]

    assert vue["build"]["dockerfile"] == "frontend-vue/Dockerfile"
    assert "ports" not in vue
    assert vue["networks"] == ["deer-flow"]
    assert vue["restart"] == "unless-stopped"
    assert set(services["nginx"]["depends_on"]) >= {"frontend", "frontend-vue", "gateway"}


def test_production_compose_keeps_one_loopback_nginx_entry_and_private_gateway() -> None:
    services = _compose()["services"]

    assert services["nginx"]["ports"] == ["${BIND_HOST:-127.0.0.1}:${PORT:-2026}:2026"]
    assert "ports" not in services["gateway"]
    assert "ports" not in services["frontend"]
    assert "ports" not in services["frontend-vue"]


def test_nginx_templates_only_the_vue_hostname_and_defaults_everything_else_to_react() -> None:
    compose_nginx = _compose()["services"]["nginx"]
    environment = compose_nginx["environment"]
    command = "\n".join(compose_nginx["command"])
    config = _nginx()

    assert "DEER_FLOW_VUE_HOSTNAME=${DEER_FLOW_VUE_HOSTNAME:-vue.localhost}" in environment
    # Compose uses $$ to defer expansion until the nginx container starts.
    assert "envsubst '$$DEER_FLOW_VUE_HOSTNAME'" in command
    assert "map $host $frontend_upstream" in config
    assert '"${DEER_FLOW_VUE_HOSTNAME}" frontend-vue:3000;' in config
    assert "default frontend:3000;" in config
    assert "set $frontend_upstream frontend:3000;" not in config
    assert "listen 2026 default_server;" in config
    assert "server_name _;" in config


def test_development_compose_renders_the_shared_nginx_template_too() -> None:
    dev_nginx = yaml.safe_load(DEV_COMPOSE_PATH.read_text(encoding="utf-8"))["services"]["nginx"]
    command = "\n".join(dev_nginx["command"])

    assert "DEER_FLOW_VUE_HOSTNAME=${DEER_FLOW_VUE_HOSTNAME:-vue.localhost}" in dev_nginx["environment"]
    assert "envsubst '$$DEER_FLOW_VUE_HOSTNAME'" in command


def test_development_compose_runs_vue_dev_server_with_compose_watch_hmr() -> None:
    services = yaml.safe_load(DEV_COMPOSE_PATH.read_text(encoding="utf-8"))["services"]
    vue = services["frontend-vue"]

    assert vue["build"]["dockerfile"] == "frontend-vue/Dockerfile"
    assert vue["build"]["target"] == "dev"
    assert "pnpm exec nuxt dev --host 0.0.0.0 --port 3000" in vue["command"]
    assert "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://gateway:8001" in vue["environment"]
    assert vue["networks"] == ["deer-flow-dev"]
    assert vue["restart"] == "unless-stopped"
    assert "frontend-vue" in services["nginx"]["depends_on"]

    watch = vue["develop"]["watch"]
    assert {
        "action": "sync",
        "path": "../frontend-vue",
        "target": "/workspace/frontend-vue",
        "ignore": [
            "node_modules/",
            ".nuxt/",
            ".output/",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "packages/agent-core/package.json",
            "tests/",
            "test-results/",
            "playwright-report/",
            "coverage/",
        ],
    } in watch
    assert {"action": "rebuild", "path": "../frontend-vue/package.json"} in watch
    assert {"action": "rebuild", "path": "../frontend-vue/pnpm-lock.yaml"} in watch


def test_development_compose_uses_one_watch_path_for_both_frontends() -> None:
    services = yaml.safe_load(DEV_COMPOSE_PATH.read_text(encoding="utf-8"))["services"]
    react = services["frontend"]
    vue = services["frontend-vue"]

    # 规则是「源码走 Compose Watch，不要 bind-mount 进容器」——bind-mount 源码正是
    # 下面那两条环境变量（轮询式文件监听）存在的原因。**但「一个 volumes 都不许有」
    # 比这条意图严**：wave 171 起两个前端各挂一个**只读的单文件**启动脚本
    # （docker/node-entrypoint.sh，做平台自查），gateway 一直就是这么挂 dev-entrypoint.sh 的。
    # 所以断言改成表达意图本身：挂载可以有，但不许挂应用源码。
    for service_name, spec in (("frontend", react), ("frontend-vue", vue)):
        for mount in spec.get("volumes") or []:
            assert isinstance(mount, str), (service_name, mount)
            source, _, rest = mount.partition(":")
            assert mount.endswith(":ro"), f"{service_name} 的挂载必须只读，否则容器能写回宿主机源码：{mount}"
            assert source.endswith(".sh"), f"{service_name} 只能挂单个启动脚本；源码要走 Compose Watch，bind-mount 源码会把轮询式监听重新拖回来：{mount}"
            assert not source.startswith("../"), f"{service_name} 的挂载不许指向仓库里的应用目录：{mount}"
            assert rest, (service_name, mount)
    assert "WATCHPACK_POLLING=true" not in react["environment"]
    assert all("CHOKIDAR" not in item for item in vue["environment"])
    assert react["develop"]["watch"]
    assert vue["develop"]["watch"]


def test_production_compose_has_no_development_watch_configuration() -> None:
    services = _compose()["services"]

    assert all("develop" not in service for service in services.values())


def test_vue_dockerfile_and_dev_launcher_expose_the_vue_hmr_service() -> None:
    dockerfile = VUE_DOCKERFILE_PATH.read_text(encoding="utf-8")
    docker_script = DOCKER_SCRIPT_PATH.read_text(encoding="utf-8")
    dockerignore = (REPO_ROOT / ".dockerignore").read_text(encoding="utf-8")

    assert "FROM dependencies AS dev" in dockerfile
    assert 'services="redis frontend frontend-vue gateway nginx"' in docker_script
    assert 'service="frontend-vue"' in docker_script
    assert "exec $COMPOSE_CMD up --build --watch --remove-orphans $services" in docker_script
    assert "stop_compose_watch" not in docker_script
    assert "WATCH_PID_FILE" not in docker_script
    assert "--frontend)" not in docker_script

    makefile = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    assert "docker-logs-react" in makefile
    assert "docker-logs-vue" in makefile
    assert "docker-logs-frontend" not in makefile

    for ignored_path in (
        "frontend-vue/node_modules",
        "frontend-vue/.nuxt",
        "frontend-vue/.output",
        "frontend-vue/test-results",
        "frontend-vue/playwright-report",
        "frontend-vue/coverage",
    ):
        assert ignored_path in dockerignore


def test_production_launcher_reconciles_both_frontend_containers() -> None:
    deploy_script = DEPLOY_SCRIPT_PATH.read_text(encoding="utf-8")

    assert 'services="redis frontend frontend-vue gateway nginx"' in deploy_script
    assert 'services="$services provisioner"' in deploy_script
    assert '"${COMPOSE_CMD[@]}" up --build -d --remove-orphans $services' in deploy_script


def test_all_gateway_proxy_locations_overwrite_forwarded_host_and_proto() -> None:
    config = _nginx()
    gateway_proxy_count = len(re.findall(r"proxy_pass http://\$gateway_upstream;", config))

    assert gateway_proxy_count > 0
    forwarded_proto_count = config.count("proxy_set_header X-Forwarded-Proto $forwarded_proto;")
    assert forwarded_proto_count >= gateway_proxy_count
    assert config.count("proxy_set_header X-Forwarded-Host $http_host;") == forwarded_proto_count


def test_dual_host_reuses_existing_stream_websocket_and_body_limit_contracts() -> None:
    config = _nginx()

    # One server block owns both hostnames, so these path contracts apply
    # symmetrically to React and Vue without a duplicated route table.
    assert config.count("server {") == 1
    assert "rewrite ^/api/langgraph/(.*) /api/$1 break;" in config
    assert "proxy_set_header X-Accel-Buffering no;" in config
    assert "proxy_buffering off;" in config
    assert "proxy_read_timeout 600s;" in config
    assert "client_max_body_size 20M;" in config
    assert "client_max_body_size 100M;" in config
    assert "proxy_set_header Upgrade $http_upgrade;" in config
    assert "proxy_set_header Connection 'upgrade';" in config
