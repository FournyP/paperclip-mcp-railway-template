#!/bin/sh
set -e

PORT="${PORT:-8000}"

# Upstream defaults PAPERCLIP_API_URL to http://localhost:3100, which on Railway
# is the mcp container itself. Fail here rather than let every tool call time
# out against nothing. Upstream also honours the legacy PAPERCLIP_BASE_URL
# alias; this template does not, so there is exactly one variable to set.
if [ -z "${PAPERCLIP_API_URL:-}" ]; then
  echo "mcp: PAPERCLIP_API_URL is required (e.g. http://paperclip.railway.internal:3100)" >&2
  exit 1
fi

if [ -z "${PAPERCLIP_COMPANY_ID:-}" ]; then
  echo "mcp: PAPERCLIP_COMPANY_ID is required (the UUID in the Paperclip UI URL, /companies/<uuid>)" >&2
  exit 1
fi

# paperclip-mcp reads its credential straight from the environment. An empty
# key is legal upstream (local_trusted deployments treat it as the local board
# operator) but on Railway it almost always means a forgotten variable.
if [ -n "${PAPERCLIP_API_KEY:-}" ]; then
  case "$PAPERCLIP_API_KEY" in
    pcp_board_*) echo "mcp: authenticating to Paperclip with a board API key" >&2 ;;
    *)           echo "mcp: authenticating to Paperclip with an agent API key (board-only tools will 403)" >&2 ;;
  esac
else
  echo "mcp: PAPERCLIP_API_KEY is empty; only a local_trusted Paperclip accepts that" >&2
fi

# Upstream binds 127.0.0.1 by default; the gateway reaches this container over
# Railway's private network, so bind every interface. Bearer auth lives in the
# gateway, and this service must never get a public domain.
exec paperclip-mcp \
  --transport=streamable-http \
  --host=0.0.0.0 \
  --port="${PORT}"
