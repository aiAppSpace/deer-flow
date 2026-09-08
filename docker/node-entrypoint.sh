#!/bin/sh
# Refuse to start a frontend dev server whose node_modules was resolved for
# another platform.
#
# The incident (2026-09-08, developer machine): the React container answered
# every request for ten hours and then started returning 500 on `/` with
#
#     Error: Cannot find module '../lightningcss.linux-arm64-musl.node'
#
# The container is Alpine/arm64, so Tailwind v4 needs
# `lightningcss-linux-arm64-musl`. What the image actually carried was
# `lightningcss-darwin-arm64` — the macOS build — and nothing else from that
# family. Measured: the container's `node_modules/.pnpm` had 1087 entries, the
# same count as the macOS host's, and the package directory was dated a month
# before the image was "rebuilt". Docker had reused the cached `dependencies`
# layer because its inputs (package.json, pnpm-lock.yaml) had not changed.
#
# Why it stayed hidden that long: the missing module is only loaded when
# Tailwind compiles `globals.css` from cold. The dev server's compile cache
# answered everything until the container was restarted.
#
# Why this refuses instead of self-healing: `node_modules` lives in the image
# layer, not in a named volume. Reinstalling at startup would be thrown away on
# the next `up --build` and would hide a broken image — the opposite of the
# backend's `.venv` case, where the named volume never self-corrects and
# rebuilding in place is the only fix (see dev-entrypoint.sh).
#
# Usage:
#   node-entrypoint.sh --check-modules DIR   run only the check against DIR
#   node-entrypoint.sh <command...>          check, then exec the command
set -eu

# Print the first platform package in $1 that belongs to another operating
# system, if any. pnpm installs exactly the optional platform package matching
# the install host, so a `*-darwin-*` or `*-win32-*` directory here means the
# tree was resolved somewhere else.
foreign_platform_package_in() {
    find "$1/.pnpm" -maxdepth 1 -type d \
        \( -name '*-darwin-*' -o -name '*-win32-*' \) -print 2>/dev/null | head -1
}

check_modules() {
    target="$1"
    if [ ! -d "$target/.pnpm" ]; then
        echo "[check-modules] $target/.pnpm is missing" >&2
        return 1
    fi
    found=$(foreign_platform_package_in "$target")
    if [ -n "$found" ]; then
        echo "foreign platform package: $found"
        return 1
    fi
    echo "ok"
    return 0
}

if [ "${1:-}" = "--check-modules" ]; then
    target="${2:-}"
    if [ -z "$target" ]; then
        echo "[check-modules] usage: node-entrypoint.sh --check-modules DIR" >&2
        exit 2
    fi
    check_modules "$target" || exit 1
    exit 0
fi

if ! result=$(check_modules node_modules); then
    echo "[startup] $result" >&2
    echo "[startup] node_modules was resolved for another platform — this image's" >&2
    echo "[startup] dependency layer is stale. Docker reuses it whenever" >&2
    echo "[startup] package.json and pnpm-lock.yaml are unchanged, so a plain" >&2
    echo "[startup] rebuild will not replace it. Fix it with:" >&2
    echo "[startup]" >&2
    echo "[startup]   docker compose -p deer-flow-dev -f docker/docker-compose-dev.yaml \\" >&2
    echo "[startup]     build --no-cache frontend frontend-vue" >&2
    echo "[startup]" >&2
    echo "[startup] Refusing to start: the failure it causes surfaces much later," >&2
    echo "[startup] as a 500 the first time a stylesheet is compiled from cold." >&2
    exit 1
fi

exec "$@"
