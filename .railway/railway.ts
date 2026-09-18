// Railway Infrastructure as Code: railway config plan | apply
//
// An apply deletes every resource this file does not declare, so link it to a
// project dedicated to this template.
//
// Secrets stay out of here. Export them for the first apply; later runs omit
// them and preserve() keeps what Railway holds.
//
//   export API_KEYS=$(openssl rand -hex 32)
//   export PAPERCLIP_API_URL=http://paperclip.railway.internal:3100
//   export PAPERCLIP_API_KEY=pcp_board_...
//   export PAPERCLIP_COMPANY_ID=<uuid>

import { defineRailway, github, preserve, project, service } from "railway/iac";

const REPO = "FournyP/paperclip-mcp-railway-template";

// Matched by name, so keep these identical to Railway: a mismatch is a
// delete and recreate, not a rename.
const GATEWAY_SERVICE = "paperclip-mcp-gateway";
const MCP_SERVICE = "paperclip-mcp";

// The gateway needs this as a literal for its upstream URL and Host rewrite.
const MCP_PORT = "8000";

/** Push the value from the local environment if present, else keep Railway's. */
const fromEnvOrPreserve = (name: string) => process.env[name] ?? preserve();

export default defineRailway(() => {
  // No domain here: auth lives in the gateway, and this service has none.
  // Paperclip itself is external to this template.
  const mcp = service(MCP_SERVICE, {
    // Each service builds from its own directory; there is no root Dockerfile.
    source: github(REPO, { branch: "main", rootDirectory: "mcp" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    env: {
      // The port the upstream binds. Pinned rather than left to Railway, so the
      // gateway's MCP_PORT literal below cannot drift from it.
      PORT: "8000",

      // On Railway: http://<paperclip-service>.railway.internal:<port>.
      // "/api" is appended by the server when missing.
      PAPERCLIP_API_URL: fromEnvOrPreserve("PAPERCLIP_API_URL"),

      // Board key (pcp_board_..., full operator access) or agent key. Preserved
      // rather than dropped: an apply without it would leave every call 401.
      PAPERCLIP_API_KEY: fromEnvOrPreserve("PAPERCLIP_API_KEY"),

      // The company every company-scoped tool targets; the UUID in the
      // Paperclip UI URL, /companies/<uuid>.
      PAPERCLIP_COMPANY_ID: fromEnvOrPreserve("PAPERCLIP_COMPANY_ID"),

      // Optional default agent for checkout_issue under a board key.
      PAPERCLIP_AGENT_ID: fromEnvOrPreserve("PAPERCLIP_AGENT_ID"),

      // Optional, and only ever a real heartbeat run id: forwarded as
      // X-Paperclip-Run-Id on writes, where a made-up UUID breaks a foreign key.
      PAPERCLIP_RUN_ID: fromEnvOrPreserve("PAPERCLIP_RUN_ID"),
    },
  });

  const gateway = service(GATEWAY_SERVICE, {
    source: github(REPO, { branch: "main", rootDirectory: "gateway" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      // Answered by nginx, so it stays green while the mcp service restarts.
      healthcheckPath: "/health",
    },
    env: {
      // Comma-separated bearer tokens. Per key: A-Z a-z 0-9 . _ ~ + / = -
      API_KEYS: fromEnvOrPreserve("API_KEYS"),

      MCP_HOST: mcp.env.RAILWAY_PRIVATE_DOMAIN,
      MCP_PORT,

      // true also accepts /k/<key>/mcp, for clients that cannot send a header.
      PATH_KEY_AUTH: process.env.PATH_KEY_AUTH ?? "false",
    },
  });

  return project("Paperclip MCP", { resources: [mcp, gateway] });
});
