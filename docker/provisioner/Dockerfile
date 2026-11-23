FROM python:3.12-slim-bookworm

ARG APT_MIRROR
ARG PIP_INDEX_URL

# Optional apt mirror: host-only preserves the source scheme; full http(s) URI overrides it.
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

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    ${PIP_INDEX_URL:+--index-url "$PIP_INDEX_URL"} \
    fastapi \
    "uvicorn[standard]" \
    kubernetes

WORKDIR /app
COPY app.py .

EXPOSE 8002

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
