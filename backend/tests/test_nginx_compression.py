"""The compression policy holds for *every* nginx config this repo ships.

``AGENTS.md`` states it as a property of Nginx, unqualified: the proxy
compresses HTML and configured textual assets and deliberately leaves SSE,
fonts, images, audio and video alone.  There is no "except on Kubernetes" in
that sentence, and there is no annotation on the Helm ``Ingress`` doing the
job one layer up either.

This file used to name its two configs in a literal tuple, and the repo has
three: the Kubernetes ConfigMap template was simply absent from the list, and
it carried no ``gzip`` directive at all -- so a Helm install served every
asset uncompressed while the docs said otherwise.  Nothing went red, because
the guard's idea of "the nginx configs" was a hand-written list rather than
something it went and found.

So the scan surface discovers the configs instead of listing them, and the
first test below is the one that fails when a fourth appears.
``test_nginx_langgraph_body_size.py`` already says this config "is maintained
in three places"; that sentence is now checked rather than trusted.
"""

from pathlib import Path

import pytest
from support.nginx_configs import KNOWN, discover, discovered_names

CONFIGS = discover()


def test_this_file_checks_every_nginx_config() -> None:
    """Shape assert: a green run here must mean "checked all of them".

    ``test_nginx_config_discovery.py`` owns the question of whether discovery
    still finds the right set. This one is narrower and belongs here: whatever
    that set is, *this file* parametrized over all of it. Without it, running
    this file alone passes vacuously when discovery returns fewer -- and
    "0 configs checked" reads exactly like "all configs fine".
    """
    assert len(CONFIGS) == len(KNOWN)
    assert discovered_names() == KNOWN


def _without_comments(text: str) -> str:
    """Drop ``#`` comments so a sentence *about* a directive is not read as one.

    These files talk about their own directives -- "SSE and already-compressed
    media are deliberately absent", "kept byte-identical to ..." -- and a raw
    substring search cannot tell a directive from prose that mentions it.  A
    commented-out ``gzip on;`` would otherwise satisfy every assertion below.
    """
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


@pytest.mark.parametrize("config_path", CONFIGS, ids=lambda path: path.name)
def test_nginx_compresses_only_safe_textual_responses(config_path: Path) -> None:
    config = _without_comments(config_path.read_text(encoding="utf-8"))

    assert "gzip on;" in config
    assert "gzip_vary on;" in config
    assert "gzip_proxied any;" in config
    assert "gzip_min_length 1024;" in config
    assert "gzip_comp_level 5;" in config

    gzip_types = config.split("gzip_types", 1)[1].split(";", 1)[0].split()
    assert gzip_types == [
        "text/css",
        "text/javascript",
        "application/javascript",
        "application/json",
        "application/xml",
        "image/svg+xml",
    ]
    assert "text/event-stream" not in gzip_types
    assert not any(content_type.startswith(("font/", "audio/", "video/")) for content_type in gzip_types)
