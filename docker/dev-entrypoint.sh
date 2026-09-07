#!/usr/bin/env sh
#
# DeerFlow gateway dev entrypoint — runs inside the docker-compose-dev gateway
# container. Extracted from docker/docker-compose-dev.yaml's inline `command:`
# (PR #2767, addressing review on Issue #2754).
#
# Responsibilities:
#   1. Resolve `--extra X` flags from UV_EXTRAS (comma- or whitespace-separated,
#      mirroring scripts/detect_uv_extras.py for parity with local `make dev`).
#   2. Validate each extra against [A-Za-z][A-Za-z0-9_-]* so a stray shell
#      metacharacter in `.env` cannot reach `uv sync`.
#   3. `uv sync --all-packages` so workspace member extras (deerflow-harness's
#      postgres extra in particular) are installed — see PR #2584.
#   4. Self-heal (platform): if .venv holds another platform's build artifacts,
#      empty it before syncing. `uv sync` reads .dist-info metadata, not binary
#      architecture, so a foreign .venv passes its check silently — see the
#      block below for the incident this came from.
#   5. Self-heal (sync): if the first sync fails, recreate .venv and retry once.
#   6. Hand off to uvicorn with reload, replacing this shell so uvicorn becomes
#      PID 1 inside the container.
#
# Anchored at /bin/sh (not bash) since alpine-based base images may not ship
# bash. Uses POSIX-only constructs throughout.

set -e

# Two dry-run hooks, both used by backend/tests/test_dev_entrypoint.py and
# useful for ad-hoc debugging:
#
#   --print-extras       parse + validate UV_EXTRAS, print the resulting
#                        `--extra X` flags to stdout, and exit.
#   --check-venv DIR     run *only* the platform self-heal check against DIR and
#                        exit 0 when that venv belongs to this platform, 1 when
#                        it does not. Lets the test build a fake foreign venv
#                        instead of needing a container.
PRINT_EXTRAS_ONLY=0
if [ "${1:-}" = "--print-extras" ]; then
    PRINT_EXTRAS_ONLY=1
fi
CHECK_VENV_ONLY=0
if [ "${1:-}" = "--check-venv" ]; then
    CHECK_VENV_ONLY=1
fi

# Mirror the legacy command's behavior: redirect both stdout and stderr to the
# host-mounted log file (../logs/gateway.log → /app/logs/gateway.log). Skip
# the redirect under --print-extras so the test runner can capture stdout.
if [ "$PRINT_EXTRAS_ONLY" = "0" ] && [ "$CHECK_VENV_ONLY" = "0" ]; then
    exec >/app/logs/gateway.log 2>&1
fi

# ── Platform check helper ───────────────────────────────────────────────────

# Print the first build artifact in $1 that belongs to another platform, if any.
# Compiled extension suffixes carry the build platform: `...-linux-gnu.so` here,
# `...-darwin.so` on macOS, `.pyd` on Windows.
foreign_artifact_in() {
    find "$1" \( -name '*darwin*.so' -o -name '*.pyd' \) -print 2>/dev/null | head -1
}

if [ "$CHECK_VENV_ONLY" = "1" ]; then
    target="${2:-}"
    if [ -z "$target" ] || [ ! -d "$target" ]; then
        echo "[check-venv] usage: dev-entrypoint.sh --check-venv DIR" >&2
        exit 2
    fi
    found=$(foreign_artifact_in "$target")
    if [ -n "$found" ]; then
        echo "foreign artifact: $found"
        exit 1
    fi
    if [ ! -x "$target/bin/python" ]; then
        echo "no usable bin/python"
        exit 1
    fi
    echo "ok"
    exit 0
fi

# ── Resolve extras ──────────────────────────────────────────────────────────

EXTRAS_FLAGS=""
if [ -n "${UV_EXTRAS:-}" ]; then
    # Normalize comma → space, then split on whitespace via the unquoted `for`.
    for raw in $(printf '%s' "$UV_EXTRAS" | tr ',' ' '); do
        [ -z "$raw" ] && continue
        # Reject anything that does not look like an identifier.
        # Two patterns: leading non-letter, or any non-[A-Za-z0-9_-] character.
        case "$raw" in
            [!A-Za-z]* | *[!A-Za-z0-9_-]*)
                echo "[startup] UV_EXTRAS entry '$raw' is invalid (must match [A-Za-z][A-Za-z0-9_-]*) — aborting" >&2
                exit 1
                ;;
        esac
        EXTRAS_FLAGS="$EXTRAS_FLAGS --extra $raw"
    done
fi

if [ "$PRINT_EXTRAS_ONLY" = "1" ]; then
    # Trim leading space for tidier output, then exit.
    printf '%s\n' "${EXTRAS_FLAGS# }"
    exit 0
fi

if [ -n "$EXTRAS_FLAGS" ]; then
    echo "[startup] uv extras:$EXTRAS_FLAGS"
fi

# Keep runtime-owned files out of uvicorn's reload watcher. Each excluded path
# must exist before uvicorn starts so watchfiles treats it as an excluded
# directory, not as a plain glob pattern — on Python 3.12, globbing an absolute
# pattern raises NotImplementedError and crashes startup (#3459 / #3454). That
# means `sandbox` must be created here too, not just `.deer-flow`.
: "${DEER_FLOW_HOME:=/app/backend/.deer-flow}"
export DEER_FLOW_HOME
mkdir -p "$DEER_FLOW_HOME" /app/backend/.deer-flow /app/backend/sandbox

# ── Sync dependencies (with self-heal) ──────────────────────────────────────

cd /app/backend

# ── Self-heal: the .venv must belong to THIS platform ───────────────────────
#
# `/app/backend/.venv` is a *named volume* (`gateway-venv` in
# docker-compose-dev.yaml), mounted over the bind-mounted host `backend/` so the
# host's venv cannot shadow the one built into the image. Named volumes are
# populated from the image **only when they are first created and empty** —
# after that, every image rebuild leaves the volume untouched, silently.
#
# Measured incident (2026-09-07): the gateway container had been running for
# days on a volume created 2026-03-18 that contained a **macOS** venv —
# 121 `*darwin*.so`, zero `*linux-gnu.so`, and no `.venv/bin/python` — while the
# image itself carried the correct `_regex.cpython-312-aarch64-linux-gnu.so`.
# The user-visible symptom was a toast in the product:
#
#     Error importing module deerflow.community.jina_ai.tools: cannot import
#     name '_regex' from partially initialized module 'regex' (most likely due
#     to a circular import)
#
# — which names neither Docker nor the platform. `uv sync` does not catch this:
# it compares `.dist-info` metadata against the lock file, never the binary
# architecture, so a foreign venv with correct metadata is "already in sync".
# The existing retry below only fires when `uv sync` *fails*, and it did not.
#
# So check the one thing that actually differs: compiled extension suffixes
# carry their build platform (`...cpython-312-aarch64-linux-gnu.so` here,
# `...cpython-312-darwin.so` on macOS, `.pyd` on Windows). A foreign marker, or
# a missing interpreter, means this venv was not built for this container.
if [ -d .venv ]; then
    foreign=$(foreign_artifact_in .venv)
    if [ -n "$foreign" ] || [ ! -x .venv/bin/python ]; then
        if [ -n "$foreign" ]; then
            echo "[startup] .venv holds another platform's build artifact ($foreign)"
        else
            echo "[startup] .venv has no usable bin/python"
        fi
        echo "[startup] emptying .venv and rebuilding — a named volume is populated"
        echo "[startup] from the image only once, so a stale one never self-corrects"
        find .venv -mindepth 1 -delete
    fi
fi

# `--all-packages` propagates extras into workspace members (PR #2584).
# `--extra redis` is always installed because docker-compose-dev defaults the
# stream bridge to Redis (DEER_FLOW_STREAM_BRIDGE_REDIS_URL); redis is an
# optional extra elsewhere. It is kept out of EXTRAS_FLAGS so the --print-extras
# contract (UV_EXTRAS-derived flags only) stays unchanged.
# `$EXTRAS_FLAGS` intentionally unquoted so each `--extra X` becomes its own arg.
# shellcheck disable=SC2086 # word-splitting is intentional here
if ! uv sync --all-packages --extra redis $EXTRAS_FLAGS; then
    echo "[startup] uv sync failed; recreating .venv and retrying once"
    uv venv --allow-existing .venv
    # shellcheck disable=SC2086
    uv sync --all-packages --extra redis $EXTRAS_FLAGS
fi

# ── Hand off to uvicorn ─────────────────────────────────────────────────────

PYTHONPATH=. exec uv run uvicorn app.gateway.app:app \
    --host 0.0.0.0 --port 8001 \
    --reload \
    --reload-include='*.yaml' \
    --reload-include='.env' \
    --reload-exclude=/app/backend/sandbox \
    --reload-exclude="$DEER_FLOW_HOME" \
    --reload-exclude=/app/backend/.deer-flow
