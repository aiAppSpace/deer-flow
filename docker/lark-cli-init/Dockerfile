# syntax=docker/dockerfile:1
#
# DeerFlow "lark-cli init" image (Pattern A).
#
# Purpose: provide the sandbox `lark-cli` runtime binary to a Kubernetes sandbox
# Pod via an init container + shared `emptyDir`, instead of downloading Linux
# binaries from GitHub at install time and mounting them via hostPath/PVC.
#
# At BUILD time (network available) this image downloads and SHA-256-verifies the
# official `larksuite/cli` Linux release binaries and stages the runtime layout:
#
#   /opt/lark-cli/bin/lark-cli            # arch-dispatch launcher (uname -m)
#   /opt/lark-cli/linux-amd64/lark-cli
#   /opt/lark-cli/linux-arm64/lark-cli
#   /opt/lark-cli/.deerflow-lark-cli-runtime.json   # {"version": "vX.Y.Z"}
#
# This layout is byte-identical to what the Gateway writer
# (`_write_lark_cli_sandbox_launcher`) produces and what
# `_validate_lark_cli_sandbox_runtime` enforces, so the sandbox PATH contract
# (`/mnt/integrations/lark-cli/runtime/bin/lark-cli`) is unchanged.
#
# At RUN time the default command copies `/opt/lark-cli/.` into the shared
# emptyDir mounted at `/mnt/integrations/lark-cli/runtime` and exits.
#
# The image tag should encode the lark-cli version so it can be bumped
# independently of the upstream `all-in-one-sandbox` image.
#
# Build (defaults to the pinned version below):
#   docker build -t deer-flow/lark-cli-init:v1.0.65 \
#     --build-arg LARK_CLI_VERSION=v1.0.65 docker/lark-cli-init

# Bootstrap verified HTTPS before apt can install its existing CA package.
# This copies only public trust roots, never the Python runtime.
FROM python:3.12-slim-bookworm AS certificate-source

FROM debian:bookworm-slim AS builder
COPY --from=certificate-source /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ARG APT_MIRROR
# Version tag on the larksuite/cli GitHub releases (with or without leading "v").
ARG LARK_CLI_VERSION=v1.0.65

RUN set -eu; \
    if [ -n "${APT_MIRROR:-}" ]; then \
      case "${APT_MIRROR}" in *[[:space:]]*) echo "Invalid APT_MIRROR" >&2; exit 1 ;; esac; \
      if ! printf '%s\n' "${APT_MIRROR}" | LC_ALL=C grep -Eq '^(https?://)?([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$'; then \
        echo "APT_MIRROR must be a host or an http(s) base URI" >&2; exit 1; \
      fi; \
      apt_mirror_base="${APT_MIRROR%/}"; \
      apt_mirror_authority="${apt_mirror_base#*://}"; \
      apt_mirror_authority="${apt_mirror_authority%%/*}"; \
      case "${apt_mirror_authority}" in \
        \[*\]) apt_mirror_port="" ;; \
        *:*) apt_mirror_port="${apt_mirror_authority##*:}" ;; \
        *) apt_mirror_port="" ;; \
      esac; \
      if [ -n "${apt_mirror_port}" ] && { [ "${apt_mirror_port}" -lt 1 ] || [ "${apt_mirror_port}" -gt 65535 ]; }; then \
        echo "Invalid APT_MIRROR port" >&2; exit 1; \
      fi; \
      for apt_sources_file in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do \
        if [ -f "${apt_sources_file}" ]; then \
          case "${apt_mirror_base}" in \
            http://*|https://*) apt_mirror_expression="s|https?://deb[.]debian[.]org|${apt_mirror_base}|g" ;; \
            *) apt_mirror_expression="s|deb[.]debian[.]org|${apt_mirror_base}|g" ;; \
          esac; \
          apt_sources_tmp="$(mktemp)"; \
          sed -E "${apt_mirror_expression}" "${apt_sources_file}" > "${apt_sources_tmp}"; \
          cat "${apt_sources_tmp}" > "${apt_sources_file}"; \
          rm -f "${apt_sources_tmp}"; \
        fi; \
      done; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY build-runtime.sh /usr/local/bin/build-runtime.sh
RUN chmod +x /usr/local/bin/build-runtime.sh \
    && LARK_CLI_VERSION="${LARK_CLI_VERSION}" /usr/local/bin/build-runtime.sh /opt/lark-cli

# ── Final image: minimal, just the staged runtime + a copy entrypoint ────────
FROM debian:bookworm-slim

COPY --from=builder /opt/lark-cli /opt/lark-cli
COPY entrypoint.sh /usr/local/bin/lark-cli-init
RUN chmod +x /usr/local/bin/lark-cli-init

# Destination is the emptyDir the provisioner mounts into both this init
# container and the main sandbox container.
ENV LARK_CLI_RUNTIME_DEST=/mnt/integrations/lark-cli/runtime

ENTRYPOINT ["/usr/local/bin/lark-cli-init"]
