# syntax=docker/dockerfile:1
#
# DeerFlow "lark-cli broker" image (Pattern B, issue #4338).
#
# Purpose: hold `lark-cli` + the per-user Lark credentials in a long-running
# sidecar and expose only the command surface over loopback, so the plaintext
# app secret / OAuth tokens never get mounted into the sandbox container.
#
# The one image runs in two modes (dispatched by the first CLI arg):
#
#   install-shim <dest>   init-container mode: write the Python shim +
#                         runtime marker into the shared emptyDir at <dest>
#                         (default /mnt/integrations/lark-cli/runtime), so the
#                         sandbox finds `bin/lark-cli` on PATH — same layout the
#                         Pattern A init image produces, marked kind=shim.
#
#   serve  (default CMD)  sidecar mode: run the broker HTTP server on loopback
#                         with the real `lark-cli` and credential env pointing at
#                         the sidecar-only /var/lark/{config,data} mounts.
#
# At BUILD time (network available) this image downloads and SHA-256-verifies the
# official `larksuite/cli` Linux release binaries (via the shared build-runtime.sh
# from docker/lark-cli-init) into /opt/lark-cli, so the sidecar has a real binary.
#
# The shim itself is written from the in-process constant
# LARK_CLI_BROKER_SHIM_SCRIPT (deerflow.integrations.lark_broker), so the image's
# shim can never drift from the Gateway's copy.
#
# Build (defaults to the pinned version below):
#   docker build -t deer-flow/lark-cli-broker:v1.0.65 \
#     --build-arg LARK_CLI_VERSION=v1.0.65 \
#     -f docker/lark-cli-broker/Dockerfile .
#
# NOTE: build context is the repo root (the module lives under backend/).

# Bootstrap verified HTTPS before apt can install its existing CA package.
# This copies only public trust roots, never the Python runtime.
FROM python:3.12-slim-bookworm AS certificate-source

FROM debian:bookworm-slim AS builder
COPY --from=certificate-source /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ARG APT_MIRROR
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

# Reuse the Pattern A build script so the real sidecar binary is staged with the
# identical download + SHA-256 verification path.
COPY docker/lark-cli-init/build-runtime.sh /usr/local/bin/build-runtime.sh
RUN chmod +x /usr/local/bin/build-runtime.sh \
    && LARK_CLI_VERSION="${LARK_CLI_VERSION}" /usr/local/bin/build-runtime.sh /opt/lark-cli

# ── Final image: python3 + the staged real binary + the broker module ────────
FROM python:3.12-slim

ARG LARK_CLI_VERSION=v1.0.65
ENV LARK_CLI_VERSION=${LARK_CLI_VERSION}

COPY --from=builder /opt/lark-cli /opt/lark-cli
# Single stdlib-only module drives both install-shim and serve.
COPY backend/packages/harness/deerflow/integrations/lark_broker.py /opt/broker/lark_broker.py
COPY docker/lark-cli-broker/entrypoint.sh /usr/local/bin/lark-cli-broker
RUN chmod +x /usr/local/bin/lark-cli-broker

# serve mode: the sidecar runs the real arch-dispatch launcher and reads the
# credential dirs the provisioner mounts into the sidecar only.
ENV DEERFLOW_LARK_BROKER_CLI=/opt/lark-cli/bin/lark-cli \
    LARKSUITE_CLI_CONFIG_DIR=/var/lark/config \
    LARKSUITE_CLI_DATA_DIR=/var/lark/data \
    DEERFLOW_LARK_BROKER_HOST=127.0.0.1 \
    DEERFLOW_LARK_BROKER_PORT=8788 \
    LARK_CLI_RUNTIME_DEST=/mnt/integrations/lark-cli/runtime

ENTRYPOINT ["/usr/local/bin/lark-cli-broker"]
CMD ["serve"]
