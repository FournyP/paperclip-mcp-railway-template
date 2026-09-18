# Build paperclip-mcp from source at a pinned commit (the v0.2.0 tag). The
# `paperclip-mcp` package on PyPI is an unrelated, older codebase from a
# different author, so there is nothing to `pip install` here.
# https://github.com/wizarck/paperclip-mcp

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0

ARG PAPERCLIP_MCP_SHA=7b66b8719984385af5985f7459296f8bab21dd3c

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/wizarck/paperclip-mcp.git /src \
  && git -C /src checkout "${PAPERCLIP_MCP_SHA}"

# Dependencies come from the pinned requirements file, then the package itself
# is installed without resolving anything, so the build cannot drift.
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN uv venv /app/.venv \
  && uv pip sync --python /app/.venv/bin/python /app/requirements.txt \
  && uv pip install --python /app/.venv/bin/python --no-deps /src


FROM python:3.12-slim-bookworm

RUN groupadd -r app && useradd -r -g app app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# No startup banner, and no call home to PyPI for a newer FastMCP.
ENV FASTMCP_SHOW_SERVER_BANNER=false \
    FASTMCP_CHECK_FOR_UPDATES=off

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER app
EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
