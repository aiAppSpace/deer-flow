"""The one definition of "the nginx configs this repo ships" must stay honest.

This lives with the definition rather than inside one of its consumers.  The
first version of this work put the completeness check in
``test_nginx_compression.py``; narrowing the discovery then turned that file
red while ``test_nginx_langgraph_body_size.py`` quietly ran against two configs
instead of three and still reported success.  A guard that silently checks less
is the failure this whole module exists to prevent, so the assertion belongs
where the set is defined, and every consumer gets a shape assert of its own.
"""

from __future__ import annotations

from support.nginx_configs import KNOWN, discover, discovered_names, repo_root


def test_discovery_finds_exactly_the_known_configs() -> None:
    assert discovered_names() == KNOWN, "the set of nginx configs changed; update support/nginx_configs.KNOWN once every policy guarded across these files holds for the new one too"


def test_discovery_returns_real_readable_files() -> None:
    """`discovered_names()` alone can be satisfied by a set of strings."""
    paths = discover()
    assert len(paths) == len(KNOWN)
    for path in paths:
        assert path.is_file()
        assert path.read_text(encoding="utf-8", errors="ignore").strip()


def test_repo_root_resolution_is_marker_based_not_depth_based() -> None:
    """Moving this file to another depth must not silently scan an empty tree."""
    assert (repo_root() / ".git").exists()
    assert (repo_root() / "docker" / "nginx" / "nginx.conf").is_file()
