from __future__ import annotations

import importlib
import os
import urllib.request

import httpx
import httpx._utils
import pytest
from support import loopback_http


def _proxy_discovery(monkeypatch: pytest.MonkeyPatch, system: dict[str, str]) -> None:
    for key in tuple(os.environ):
        if key.lower().endswith("_proxy") or key == "REQUEST_METHOD":
            monkeypatch.delenv(key)

    def selected() -> dict[str, str]:
        return urllib.request.getproxies_environment() or system

    # This platform-source seam supplies controlled system settings on all OSes;
    # the helper and HTTPX still use their real environment selection/routing.
    monkeypatch.setattr(urllib.request, "getproxies", selected)
    monkeypatch.setattr(httpx._utils, "getproxies", selected)


def _route(client: httpx.Client, origin: str) -> tuple[str, str | None, int | None]:
    # Observe HTTPX's selected real transport without any external request.
    pool = client._transport_for_url(httpx.URL(origin))._pool
    proxy = getattr(pool, "_proxy_url", None)
    return type(pool).__name__, proxy.host.decode() if proxy else None, proxy.port if proxy else None


def test_explicit_external_proxy_environment_values_stay_identical(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000"})
    values = {"HTTP_PROXY": "http://upper.invalid:8000", "http_proxy": "http://lower.invalid:8001", "HTTPS_PROXY": "http://secure.invalid:8002", "ALL_PROXY": "http://all.invalid:8003"}
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    before = dict(os.environ)
    with loopback_http.loopback_http_proxy_environment():
        assert {key: os.environ[key] for key in values} == values
        assert urllib.request.getproxies()["http"] == values["http_proxy"]
    assert dict(os.environ) == before


def test_system_scheme_mappings_and_external_httpx_routes_are_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    system = {"http": "http://system.invalid:9000", "https": "http://secure.invalid:9001", "all": "http://all.invalid:9002"}
    _proxy_discovery(monkeypatch, system)
    before_environment = dict(os.environ)
    origins = ("http://external.invalid", "https://external.invalid")
    with httpx.Client() as client:
        before_routes = [_route(client, origin) for origin in origins]
    with loopback_http.loopback_http_proxy_environment():
        assert {scheme: urllib.request.getproxies()[scheme] for scheme in system} == system
        with httpx.Client() as client:
            assert [_route(client, origin) for origin in origins] == before_routes
            assert before_routes == [("HTTPProxy", "system.invalid", 9000), ("HTTPProxy", "secure.invalid", 9001)]
            assert [_route(client, f"http://{host}")[0] for host in ("127.0.0.1", "localhost")] == ["ConnectionPool"] * 2
    assert dict(os.environ) == before_environment


def test_existing_lowercase_bypass_precedence_is_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {})
    monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:9000")
    monkeypatch.setenv("NO_PROXY", "shadowed.invalid")
    monkeypatch.setenv("no_proxy", ".kept.invalid")
    before = dict(os.environ)
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert _route(client, "http://child.kept.invalid")[0] == "ConnectionPool"
        assert _route(client, "http://shadowed.invalid")[0] == "HTTPProxy"
        assert urllib.request.getproxies()["no"].startswith(".kept.invalid,")
    assert dict(os.environ) == before


def test_uppercase_only_existing_bypass_survives_added_lowercase_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {})
    monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:9000")
    monkeypatch.setenv("NO_PROXY", "kept.invalid")
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert _route(client, "http://kept.invalid")[0] == "ConnectionPool"
        assert _route(client, "http://external.invalid")[0] == "HTTPProxy"


def test_existing_wildcard_bypass_remains_wildcard(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {})
    monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:9000")
    monkeypatch.setenv("NO_PROXY", "*")
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert urllib.request.getproxies()["no"] == "*"
        assert urllib.request.proxy_bypass_environment("external.invalid:80")
        assert _route(client, "http://external.invalid")[0] == "ConnectionPool"


@pytest.mark.parametrize("empty_keys", [("HTTP_PROXY",), ("http_proxy",), ("HTTP_PROXY", "http_proxy")])
def test_empty_proxy_keys_preserve_effective_system_route_and_restore_bytes(monkeypatch: pytest.MonkeyPatch, empty_keys: tuple[str, ...]) -> None:
    system = {"http": "http://system.invalid:9000", "https": "http://secure.invalid:9001"}
    _proxy_discovery(monkeypatch, system)
    for key in empty_keys:
        monkeypatch.setenv(key, "")
    before = dict(os.environ)
    assert urllib.request.getproxies_environment() == {}
    with httpx.Client() as client:
        before_route = _route(client, "http://external.invalid")
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert _route(client, "http://external.invalid") == before_route == ("HTTPProxy", "system.invalid", 9000)
        assert os.environ["http_proxy"] == system["http"]
        if "HTTP_PROXY" in empty_keys:
            assert os.environ["HTTP_PROXY"] == ""
    assert dict(os.environ) == before


@pytest.mark.parametrize("system_bypass", ["kept.invalid", "*"])
def test_system_mapping_bypass_entries_survive_materialization(monkeypatch: pytest.MonkeyPatch, system_bypass: str) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000", "no": system_bypass})
    before = dict(os.environ)
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert urllib.request.getproxies()["no"].split(",")[0] == system_bypass
        assert urllib.request.proxy_bypass_environment("kept.invalid:80")
        assert _route(client, "http://kept.invalid")[0] == "ConnectionPool"
    assert dict(os.environ) == before


def test_stdlib_owned_ipv4_and_localhost_bypass_uses_real_environment_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000"})
    with loopback_http.loopback_http_proxy_environment():
        assert urllib.request.proxy_bypass_environment("127.0.0.1:54321")
        assert urllib.request.proxy_bypass_environment("localhost:54321")
        assert not urllib.request.proxy_bypass_environment("external.invalid:80")


def test_no_proxy_only_environment_does_not_adopt_system_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000"})
    monkeypatch.setenv("NO_PROXY", "existing.invalid")
    before = dict(os.environ)
    with loopback_http.loopback_http_proxy_environment():
        assert "http" not in urllib.request.getproxies()
        assert "http_proxy" not in os.environ
        assert urllib.request.getproxies()["no"].startswith("existing.invalid,")
    assert dict(os.environ) == before


def test_nested_context_restores_outer_then_original_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000"})
    before = dict(os.environ)
    with loopback_http.loopback_http_proxy_environment():
        outer = dict(os.environ)
        with loopback_http.loopback_http_proxy_environment():
            assert urllib.request.getproxies()["http"] == "http://system.invalid:9000"
            assert "127.0.0.1" in urllib.request.getproxies()["no"].split(",")
        assert dict(os.environ) == outer
    assert dict(os.environ) == before


def test_exception_restores_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"https": "http://system.invalid:9000"})
    before = dict(os.environ)
    with pytest.raises(RuntimeError, match="fixture failed"), loopback_http.loopback_http_proxy_environment():
        raise RuntimeError("fixture failed")
    assert dict(os.environ) == before


def test_no_system_proxy_keeps_external_route_direct(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {})
    with loopback_http.loopback_http_proxy_environment(), httpx.Client() as client:
        assert _route(client, "http://external.invalid")[0] == "ConnectionPool"
        assert _route(client, "http://127.0.0.1")[0] == "ConnectionPool"


def test_import_is_inert_and_helper_is_not_autouse(monkeypatch: pytest.MonkeyPatch) -> None:
    _proxy_discovery(monkeypatch, {"http": "http://system.invalid:9000"})
    before = dict(os.environ)
    importlib.reload(loopback_http)
    assert dict(os.environ) == before
    assert not hasattr(loopback_http.loopback_http_proxy_environment, "_pytestfixturefunction")
