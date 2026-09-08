"""Every nginx config this repo ships -- found, not listed.

Two guards need "the nginx configs": the compression policy
(``test_nginx_compression.py``) and the ``/api/langgraph/`` request-body
settings (``test_nginx_langgraph_body_size.py``).  Both used to carry their own
literal tuple, and they disagreed: one named two paths, the other three.  The
one that named two was missing the Kubernetes ConfigMap template, which carried
no ``gzip`` directive at all -- a Helm install served every asset uncompressed
while ``AGENTS.md`` described the compression policy as a property of Nginx,
unqualified.  Nothing went red, because each guard's idea of "the nginx
configs" was something it had been told rather than something it went and
found.

So there is now one definition, and it discovers.  ``KNOWN`` stays alongside it
so a guard can assert that discovery still finds what we expect: a green run
has to mean "checked all of them", never "found none".
"""

from __future__ import annotations

from pathlib import Path

from support.detectors.repo_root import resolve_repo_root

# Where an nginx config can live. Both are deployment surfaces; application
# code never ships one.
_SEARCH_ROOTS = ("docker", "deploy")

# A ConfigMap template embeds its config inside YAML, so the extension cannot
# be the test. These two blocks are what make a file an nginx config, and every
# one of ours has both.
_NGINX_MARKERS = ("events {", "http {")

_CANDIDATE_SUFFIXES = frozenset({".conf", ".yaml", ".yml"})

KNOWN: frozenset[str] = frozenset(
    {
        "docker/nginx/nginx.conf",
        "docker/nginx/nginx.local.conf",
        "deploy/helm/deer-flow/templates/configmap-nginx.yaml",
    }
)


def repo_root() -> Path:
    return resolve_repo_root(Path(__file__))


def discover() -> tuple[Path, ...]:
    """Return every nginx config in the repo, sorted, as absolute paths."""
    root = repo_root()
    found: list[Path] = []
    for name in _SEARCH_ROOTS:
        for path in sorted((root / name).rglob("*")):
            if not path.is_file() or path.suffix not in _CANDIDATE_SUFFIXES:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if all(marker in text for marker in _NGINX_MARKERS):
                found.append(path)
    return tuple(found)


def discovered_names() -> frozenset[str]:
    root = repo_root()
    return frozenset(path.relative_to(root).as_posix() for path in discover())
