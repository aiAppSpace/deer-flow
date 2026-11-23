"""Proxy boundary for test-owned IPv4 loopback HTTP server lifetimes only.

The clients and sockets stay real. A host proxy must not intercept traffic to
the server the fixture itself owns. macOS proxy discovery falls back to system
settings only while the environment mapping is empty, so adding NO_PROXY alone
would also remove its external proxy mappings. Materialize those effective
scheme mappings first, then add the owned loopback bypass entries.

This context is deliberately not an autouse fixture or a production setting.
SystemConfiguration rules such as exclude_simple are not fully representable
by NO_PROXY; callers must restrict its lifetime to their owned loopback peer.
"""

from __future__ import annotations

import urllib.request
from collections.abc import Iterator
from contextlib import contextmanager

import pytest

_LOOPBACK_HOSTS = ("127.0.0.1", "localhost")


@contextmanager
def loopback_http_proxy_environment() -> Iterator[None]:
    """Keep an owned IPv4 local HTTP peer direct and restore temporary env edits.

    An explicit empty proxy variable does not disable urllib's system fallback.
    When its complete environment mapping is empty, preserve that effective
    policy by supplying the lower-case scheme value (temporarily replacing an
    empty lower-case key if necessary). Nonempty environment mappings retain
    all original proxy keys and their precedence unchanged.
    """
    environment_proxies = urllib.request.getproxies_environment()
    effective_proxies = environment_proxies or urllib.request.getproxies()
    with pytest.MonkeyPatch.context() as environment:
        if not environment_proxies:
            for scheme in ("http", "https", "all"):
                value = effective_proxies.get(scheme)
                if value:
                    environment.setenv(f"{scheme}_proxy", value)

        # urllib gives lower-case no_proxy precedence. Use that effective value
        # rather than unioning a shadowed upper-case value into the policy.
        existing_bypass = effective_proxies.get("no", "")
        # urllib recognizes the complete literal '*', unlike HTTPX which also
        # recognizes it inside a comma-separated list. Retain both semantics.
        bypass = "*" if existing_bypass == "*" else ",".join(filter(None, (existing_bypass, *_LOOPBACK_HOSTS)))
        environment.setenv("NO_PROXY", bypass)
        environment.setenv("no_proxy", bypass)
        yield
