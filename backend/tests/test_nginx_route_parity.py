"""The three nginx configs describe one system, so their route sets must agree.

``test_nginx_langgraph_body_size.py`` already says this config "is maintained
in three places".  Waves of drift showed what that sentence costs when nothing
checks it: the Kubernetes ConfigMap had no ``gzip`` at all, then no
``map $http_upgrade``, and the local config served the API docs at a different
URL than the other two.  Each was found by hand, one at a time.

The criterion here is deliberately not "all three are identical" -- they are
not, and should not be.  It is:

    every ``location`` that appears in at least two of the three configs must
    appear in all three.

A route present in one config is a legitimate environment-specific addition
(``/nginx-health`` exists only for Kubernetes probes).  A route present in two
but not the third is drift: two independent authors decided the system needs
it, and one copy was missed.  That shape has **zero** exemptions today, which
is the point -- a list of "these three are allowed to differ" would just record
which environments we decided to leave broken.

Applying it found two live gaps that reading had missed:

* the Helm ConfigMap had no ``~ ^/api/threads/[^/]+/browser/stream`` location,
  so the live browser stream fell through to the generic ``/api/threads``
  regex -- which, in this repo's own words, "omits Upgrade/Connection
  forwarding and would downgrade it to plain HTTP".  The browser panel could
  not stream on Kubernetes.
* ``nginx.local.conf`` had no ``/api/sandboxes``, so under ``make dev`` a
  provisioner-mode sandbox API was unreachable: the request fell through to
  ``location /api/`` and the Gateway 404'd it.
"""

from __future__ import annotations

import re
from collections import defaultdict

from support.nginx_configs import KNOWN, discover, repo_root

_LOCATION = re.compile(r"location\s+(.*?)\s*\{")
_MAP = re.compile(r"map\s+(\S+)\s")


def _locations(text: str) -> set[str]:
    found = set()
    for line in text.splitlines():
        # Strip comments first: these files discuss their own routes, and a
        # sentence naming one is not one.
        stripped = line.split("#", 1)[0].strip()
        match = _LOCATION.match(stripped)
        if match:
            found.add(match.group(1).strip())
    return found


def _maps(text: str) -> set[str]:
    """The source variable of every ``map`` block.

    ``map`` derives a variable from the request. Unlike a log path or a pid
    file it never depends on where the process runs, so "two of the three
    configs need it" settles the question for the third with no room for an
    environment-specific exception -- which is what makes this a second
    zero-exemption criterion rather than a second list. `nginx.local.conf` was
    missing `map $http_x_forwarded_proto`, so running `make dev` behind another
    TLS terminator sent the Gateway `http` and its login POST came back 403.
    """
    found = set()
    for line in text.splitlines():
        stripped = line.split("#", 1)[0].strip()
        match = _MAP.match(stripped)
        if match:
            found.add(match.group(1))
    return found


def _drifted(by_config: dict[str, set[str]]) -> dict[str, list[str]]:
    """Items present in every config but one -- see the module docstring."""
    owners: dict[str, set[str]] = defaultdict(set)
    for name, items in by_config.items():
        for item in items:
            owners[item].add(name)
    return {item: sorted(set(by_config) - present) for item, present in owners.items() if len(present) == len(by_config) - 1}


def _maps_by_config() -> dict[str, set[str]]:
    root = repo_root()
    return {path.relative_to(root).as_posix(): _maps(path.read_text(encoding="utf-8")) for path in discover()}


def _routes_by_config() -> dict[str, set[str]]:
    root = repo_root()
    return {path.relative_to(root).as_posix(): _locations(path.read_text(encoding="utf-8")) for path in discover()}


def test_this_file_checks_every_nginx_config() -> None:
    """Shape assert -- see the same test in test_nginx_compression.py."""
    routes = _routes_by_config()
    assert set(routes) == set(KNOWN)
    # A config with no `location` at all would satisfy every set comparison
    # below by being vacuously consistent with nothing.
    for name, locations in routes.items():
        assert len(locations) >= 5, name


def test_a_route_two_configs_agree_on_is_in_all_three() -> None:
    routes = _routes_by_config()
    assert _drifted(routes) == {}, (
        "these routes exist in every nginx config but one, which is drift rather than an environment-specific addition; add them to the config listed against each, or explain in that config why the system does not need the route there"
    )


def test_a_map_two_configs_agree_on_is_in_all_three() -> None:
    by_config = _maps_by_config()
    # Shape assert: a config whose maps all stopped matching would otherwise
    # make the comparison below vacuously true.
    for name, found in by_config.items():
        assert found, name

    assert _drifted(by_config) == {}, "these `map` blocks exist in every nginx config but one. A map derives a variable from the request, so it cannot be environment-specific: add it to the config listed against each"
