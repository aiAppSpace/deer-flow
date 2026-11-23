"""Execute the actual Dockerfile source rewrite without Docker/network access."""

from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(os.name == "nt", reason="Dockerfile build shell is POSIX")

REPOSITORY = Path(__file__).resolve().parents[2]
DOCKERFILES = (
    "backend/Dockerfile",
    "docker/provisioner/Dockerfile",
    "docker/lark-cli-init/Dockerfile",
    "docker/lark-cli-broker/Dockerfile",
)
SOURCES = """Types: deb
URIs: http://deb.debian.org/debian
Suites: bookworm

Types: deb
URIs: https://deb.debian.org/debian-security
Suites: bookworm-security
"""
LEGACY = "deb http://deb.debian.org/debian bookworm main\n"


def run_rewrite(tmp_path: Path, dockerfile: str, value: str):
    source = (REPOSITORY / dockerfile).read_text(encoding="utf-8")
    lines = iter(source.splitlines())
    commands = []
    for line in lines:
        if not line.startswith("RUN "):
            continue
        command = line[4:]
        while command.endswith("\\"):
            command = command[:-1] + "\n" + next(lines)
        if "APT_MIRROR" in command:
            commands.append(command)
    assert len(commands) == 1, dockerfile
    script = commands[0]
    sources = tmp_path / "debian.sources"
    legacy = tmp_path / "sources.list"
    sources.write_text(SOURCES, encoding="utf-8")
    legacy.write_text(LEGACY, encoding="utf-8")
    script = script.replace("/etc/apt/sources.list.d/debian.sources", shlex.quote(str(sources)))
    script = script.replace("/etc/apt/sources.list", shlex.quote(str(legacy)))
    result = subprocess.run(
        ["/bin/sh", "-c", script],
        env={**os.environ, "APT_MIRROR": value},
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    return result, sources.read_text(encoding="utf-8"), legacy.read_text(encoding="utf-8")


@pytest.mark.parametrize("dockerfile", DOCKERFILES)
@pytest.mark.parametrize(
    ("value", "http_base", "https_base"),
    (
        ("", "http://deb.debian.org", "https://deb.debian.org"),
        ("mirror.example.org", "http://mirror.example.org", "https://mirror.example.org"),
        ("127.0.0.1:8080", "http://127.0.0.1:8080", "https://127.0.0.1:8080"),
        ("[::1]:8080", "http://[::1]:8080", "https://[::1]:8080"),
        ("http://mirror.example.org", "http://mirror.example.org", "http://mirror.example.org"),
        ("https://mirror.example.org", "https://mirror.example.org", "https://mirror.example.org"),
        (
            "https://mirror.example.org/proxy/",
            "https://mirror.example.org/proxy",
            "https://mirror.example.org/proxy",
        ),
    ),
)
def test_mirror_rewrites_real_debian_and_legacy_sources(tmp_path, dockerfile, value, http_base, https_base):
    result, sources, legacy = run_rewrite(tmp_path, dockerfile, value)
    assert result.returncode == 0, result.stderr
    assert sources == SOURCES.replace("http://deb.debian.org", http_base).replace("https://deb.debian.org", https_base)
    assert legacy == LEGACY.replace("http://deb.debian.org", http_base)


@pytest.mark.parametrize("dockerfile", DOCKERFILES)
@pytest.mark.parametrize(
    "value",
    (
        "ftp://mirror.example.org",
        "https://mirror.example.org:99999",
        "mirror.example.org:0",
        "https://mirror.example.org:bad",
        "file:///etc/passwd",
        "https:///missing-host",
        "https://user:secret@mirror.example.org",
        "https://mirror.example.org?q=1",
        "mirror.example.org|g;w /tmp/unwanted",
        "mirror.example.org&changed",
        "mirror.example.org\nother",
        "$(touch unwanted)",
        "`touch unwanted`",
        "mirror.example.org\\other",
    ),
)
def test_unsupported_and_malicious_values_fail_before_any_write(tmp_path, dockerfile, value):
    result, sources, legacy = run_rewrite(tmp_path, dockerfile, value)
    assert result.returncode != 0
    assert sources == SOURCES
    assert legacy == LEGACY
    assert "APT_MIRROR" in result.stderr
    assert sorted(path.name for path in tmp_path.iterdir()) == ["debian.sources", "sources.list"]


@pytest.mark.parametrize("dockerfile", ("docker/lark-cli-init/Dockerfile", "docker/lark-cli-broker/Dockerfile"))
def test_debian_builders_bootstrap_trusted_ca_before_using_https_sources(dockerfile):
    source = (REPOSITORY / dockerfile).read_text(encoding="utf-8")
    certificates = "FROM python:3.12-slim-bookworm AS certificate-source"
    copied = "COPY --from=certificate-source /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt"
    assert source.index(certificates) < source.index("FROM debian:bookworm-slim AS builder")
    assert source.index(copied) < source.index("RUN set -eu;")
    assert "ca-certificates \\" in source
