"""Regression tests for cache-stable React container dependency layers."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "frontend" / "Dockerfile"


def test_react_dependencies_are_installed_before_application_source_is_copied():
    """A source-only edit must not invalidate the 1,000+ package install layer."""
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    manifest_copy = dockerfile.index("COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/")
    patch_copy = dockerfile.index("COPY frontend/patches ./frontend/patches")
    dependency_install = dockerfile.index("pnpm install --frozen-lockfile")
    source_copy = dockerfile.index("COPY frontend ./frontend", dependency_install)

    dependency_stage = dockerfile.index("FROM base AS dependencies")
    first_consumer_stage = dockerfile.index("FROM dependencies AS")
    assert dependency_stage < manifest_copy < patch_copy < dependency_install < first_consumer_stage < source_copy


def test_react_dependency_install_uses_a_buildkit_store_cache():
    """Clean image builds may download once; subsequent builds must reuse pnpm's store."""
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "RUN --mount=type=cache" in dockerfile
    assert "target=${PNPM_STORE_PATH}" in dockerfile
    assert "FROM dependencies AS dev" in dockerfile
    assert "FROM dependencies AS builder" in dockerfile


def test_vue_dependency_patch_inputs_precede_the_frozen_install():
    """A clean build must install exactly the same patched DOM package as local CI."""
    dockerfile = (REPO_ROOT / "frontend-vue" / "Dockerfile").read_text(encoding="utf-8")
    manifest_copy = dockerfile.index("COPY frontend-vue/package.json")
    patch_copy = dockerfile.index("COPY frontend-vue/patches ./frontend-vue/patches")
    install = dockerfile.index("pnpm install --frozen-lockfile --strict-peer-dependencies")
    dev = dockerfile.index("FROM dependencies AS dev")
    build = dockerfile.index("FROM dependencies AS build")
    assert manifest_copy < patch_copy < install < dev < build
