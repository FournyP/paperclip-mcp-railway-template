# Changelog

Notable changes to this template. Entries are named after the paperclip-mcp version they
ship, or after the change itself when a release only touches this template. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## paperclip-mcp 0.2.0 — 2026-09-18

### Added

- Initial release. Two services: an nginx gateway holding a public domain and validating
  `Authorization: Bearer <key>` against `API_KEYS`, and a private mcp service built from
  `wizarck/paperclip-mcp` at the `v0.2.0` tag, run with `--transport=streamable-http`.
- The mcp service's dependency tree is frozen in `mcp/requirements.txt` (FastMCP 4.0.5),
  since upstream pins only `fastmcp>=3.0` and ships no lockfile.
- Optional `PATH_KEY_AUTH=true` accepts the key as a path segment (`/k/<key>/mcp`) for
  clients that cannot send an `Authorization` header.
- `.railway/railway.ts`, an Infrastructure as Code definition of the project, with an
  `iac-typecheck` workflow alongside the `docker-build` one.
