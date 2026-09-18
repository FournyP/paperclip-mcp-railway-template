# Paperclip MCP Railway Template

Deploys [paperclip-mcp](https://github.com/wizarck/paperclip-mcp) — an operator-side MCP server for the [Paperclip](https://github.com/paperclipai/paperclip) AI agent orchestration platform, giving you 95 tools over issues, agents, goals, projects, approvals, costs, routines, decisions and pipelines — behind an NGINX bearer-token auth gateway.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/paperclip-mcp?referralCode=C3Uv6n&utm_medium=integration&utm_source=template&utm_campaign=generic)

## 🏗️ Architecture

```
client ──Authorization: Bearer <key>──► paperclip-mcp-gateway (nginx, public)
                                              │
                                              ▼ private network
                                   paperclip-mcp (private) ──► Paperclip
```

Two Railway services:

- **`paperclip-mcp-gateway`** — `nginx:1.29.8-alpine`, exposes a public domain, validates the `Authorization: Bearer <key>` header against `API_KEYS`, and forwards streamable-HTTP traffic to the mcp service via Railway's private network.
- **`paperclip-mcp`** — built from the upstream source at a pinned commit (see `mcp/Dockerfile`), run with `--transport=streamable-http`. **Do not give this service a public domain**; it is only reachable at `paperclip-mcp.railway.internal:8000`.

The gateway talks to Paperclip through nothing but the mcp service, and the mcp service reaches Paperclip over `PAPERCLIP_API_URL` — point that at your Paperclip's private endpoint so Paperclip itself never needs to be public either.

## ✨ Features

- Bearer-token auth with a comma-separated allowlist of keys
- Streamable HTTP passthrough (`/mcp`)
- Unauthenticated `/health` (and `/healthz`) on the gateway for Railway healthchecks
- Board or agent API key — the Paperclip-side boundary on top of the network-level bearer auth
- Optional keyed-path entrypoint for MCP clients that cannot send an `Authorization` header
- Zero custom code — gateway is plain nginx, mcp is the upstream package with a pinned dependency set

## 💁‍♀️ How to use

1. Click the Railway button 👆
2. Fill in the variables (see below)
3. Deploy! 🚄
4. Point your MCP client at `https://<gateway-domain>/mcp` (streamable-HTTP, `"type": "http"`) with header `Authorization: Bearer <your-key>`. Quick check:
   ```bash
   curl -sS -X POST https://<gateway-domain>/mcp \
     -H "Authorization: Bearer <your-key>" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
   ```
   With Claude Code:
   ```bash
   claude mcp add paperclip --transport http https://<gateway-domain>/mcp \
     --header "Authorization: Bearer <your-key>"
   ```

## 🧱 Infrastructure as Code

`.railway/railway.ts` defines the whole project — both services and every variable.

```bash
railway link
npm install

# First apply only; later runs omit these and preserve() keeps the values.
export API_KEYS=$(openssl rand -hex 32)
export PAPERCLIP_API_URL=http://paperclip.railway.internal:3100
export PAPERCLIP_API_KEY=pcp_board_...
export PAPERCLIP_COMPANY_ID=<uuid>

npm run plan     # read the diff before applying
npm run apply
railway domain --service paperclip-mcp-gateway
```

Give the domain to the gateway only. `paperclip-mcp` holds your Paperclip key and has no
authentication of its own.

Paperclip is external to this template. Point `PAPERCLIP_API_URL` at whichever instance
the operator should run.

Needs the Railway CLI 5.42.1 or newer: the IaC engine ships in the CLI, not in the npm
package. If you forked this repo, change `REPO` in `railway.ts` to your own before applying.

Link it to a project dedicated to this template. An apply deletes every resource **and
every variable** the file does not declare, so from then on variables live in `railway.ts`,
not the dashboard. Do not point it at a project created from the deploy button — the
service names differ, and a mismatch is a delete and recreate, not a rename.

## ⬆️ Upgrading

Railway template updates are opt-in — an existing deployment keeps running until you apply the update. See the [changelog](CHANGELOG.md) for what each update contains.

## 🔧 Variables

### Gateway service

| Variable        | Required | Description                                                                                       |
| --------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `API_KEYS`      | yes      | Comma-separated list of allowed bearer tokens. Allowed chars per key: `A-Z a-z 0-9 . _ ~ + / = -` |
| `MCP_HOST`      | no       | Defaults to `paperclip-mcp.railway.internal`. Only override if you rename the mcp service.        |
| `MCP_PORT`      | no       | Defaults to `8000`.                                                                               |
| `PATH_KEY_AUTH` | no       | `true` enables the keyed-path entrypoint (see below). Default `false`.                            |

### MCP service

| Variable               | Required | Description                                                                                                                                                                                                                  |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAPERCLIP_API_URL`    | yes      | Base URL of your Paperclip, e.g. `http://paperclip.railway.internal:3100`. `/api` is appended when missing.                                                                                                                  |
| `PAPERCLIP_API_KEY`    | no       | A **board** API key (`pcp_board_...`) for full operator access, or an **agent** API key scoped to that agent. Leave empty only for a `local_trusted` Paperclip, which then treats every request as the local board operator. |
| `PAPERCLIP_COMPANY_ID` | yes      | Company UUID every company-scoped tool targets — the UUID in the Paperclip UI URL, `/companies/<uuid>`.                                                                                                                      |
| `PAPERCLIP_AGENT_ID`   | no       | Default agent UUID for `checkout_issue` when using a board key.                                                                                                                                                              |
| `PAPERCLIP_RUN_ID`     | no       | Forwarded as `X-Paperclip-Run-Id` on writes. Only ever a **real** heartbeat run id; a made-up UUID breaks a foreign key server-side.                                                                                         |
| `PORT`                 | no       | Defaults to `8000`. Railway injects this.                                                                                                                                                                                    |

Mint a board key with `paperclipai login`, or `POST /api/board-api-keys` from a logged-in board session. Run the `whoami` tool to confirm which credential is active — the mcp service also logs it at startup.

## 🔑 Keyed-path entrypoint (opt-in)

Some MCP clients enumerate a server's tools before they have anywhere to store a
credential, so their discovery request arrives with no `Authorization` header and
takes a `401`. Setting `PATH_KEY_AUTH=true` on the gateway adds a second way in:

```
https://<gateway-domain>/k/<your-key>/mcp
```

The key is validated against the same `API_KEYS` allowlist. An absent or wrong
key is still `401`, and a valid key unlocks nothing but `/mcp` — the key segment
is stripped before proxying, so the mcp service only ever sees `/mcp`.

**The key travels in the URL**, where it can be recorded by edge and proxy logs
outside your control (the gateway itself logs nothing for this path). So:

- Issue a **separate key** in `API_KEYS` for each client that uses this path, so
  it can be rotated without touching the others.
- Leave `PATH_KEY_AUTH` off and use the header form everywhere else.
- Keys used on this path may not contain `/` (the header form allows it), since
  a slash would split the path segment.

## 🔒 Two layers of protection

- **Bearer auth at the gateway** is the network boundary — nothing reaches the MCP without a valid key.
- **The Paperclip API key** is the Paperclip-side boundary. A board key can approve hires, pause and terminate agents, set budgets and mint API keys, so a leaked gateway key hands all of that over. An agent key limits the blast radius to what that one agent may do (board-only tools return `403`), at the cost of the operator features this server exists for.

paperclip-mcp has **no client authentication of its own** — it binds to loopback upstream precisely because it is meant to sit next to your MCP client. The gateway is therefore mandatory if the service is reachable from anything outside Railway's private network.

## 📝 Notes

- **Generate strong keys:** `openssl rand -hex 32`
- **Rotating a key:** update `API_KEYS` on the gateway service and redeploy it. The mcp service is untouched.
- **`/health` and `/healthz` are unauthenticated** so Railway (and any uptime monitor) can probe without a token. Everything else requires `Authorization: Bearer <key>`.
- **Invalid / missing token:** the gateway returns `401` with a `WWW-Authenticate: Bearer realm="paperclip-mcp"` header.
- **Do not expose the mcp service publicly.** All traffic should enter through the gateway.
- **Startup is best-effort:** the mcp service probes Paperclip's `/health` and classifies the key when it boots, but an unreachable Paperclip is logged, not fatal. Check the service logs if every tool errors.
- **The PyPI `paperclip-mcp` package is a different project** (older, another author). This template builds the `wizarck/paperclip-mcp` source at a pinned SHA via `ARG PAPERCLIP_MCP_SHA` in `mcp/Dockerfile`, with its dependency tree frozen in `mcp/requirements.txt`. Bump the SHA and regenerate the requirements to pick up upstream changes.

## ⚖️ License

[MIT](LICENSE)
