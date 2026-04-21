# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

This is a **full relaunch** of `daten-viz-mcp@0.2.0` under a new name,
`viso-mcp`, with a new ERD format (DBML) and a dual-format build for both
MCP stdio (CJS) and Node/browser ESM consumers.

### Breaking changes

- **Package name:** `daten-viz-mcp` → `viso-mcp`. The old package stays on
  npm (deprecated via `npm deprecate`), but new features ship only under
  `viso-mcp`.
- **Repository:** planned rename `Daten_Prozess_Visualisierungs_Tool` →
  `viso-mcp`. Manual follow-up outside the editor session — git history is
  preserved when the directory is moved.
- **ERD format literal:** `daten-viz-erd-v1` → `viso-erd-v1`. Old files are
  rejected by the schema validator with a hint to run `npx viso-mcp migrate`
  (migration CLI ships in v1.0 Phase 1).
- **BPMN format literal:** `daten-viz-bpmn-v1` → `viso-bpmn-v1`. Bump is
  synchronized with ERD for consistency; no content migration required, the
  CLI rewrites files on first save.
- **ERD source of truth:** custom JSON → DBML (`.dbml` files). Existing
  `.erd.json` files must be migrated via `npx viso-mcp migrate <file>`.
  Positions remain in the separate `.erd.pos.json` sidecar and are preserved
  across the migration (orphan node positions are dropped with a warning).
- **Environment variables:** `DATEN_VIZ_FILE` → `VISO_FILE`,
  `DATEN_VIZ_BPMN_FILE` → `VISO_BPMN_FILE`. Old names continue to work in
  v1.0 with a stderr deprecation warning; they are removed in v1.1.
- **Vite plugin endpoints:** `/__daten-viz-api/*` → `/__viso-api/*`,
  `/__daten-viz-ws` → `/__viso-ws`. Only relevant if you consumed the
  preview server's HTTP API directly.
- **CLI name:** `daten-viz` → `viso-mcp`. `daten-viz serve` and
  `daten-viz-mcp` binaries are no longer exposed. Commands are now
  `viso-mcp serve`, `viso-mcp init`, `viso-mcp migrate`, `viso-mcp export`.

### Added

- **Dual-format build** via `tsup --format cjs,esm`. `dist/server.cjs`
  continues to serve MCP stdio; `dist/server.js` enables ESM consumers
  (Node 20+, Next.js 16 App Router).
- **MCP tools** `set_bpmn` and `set_dbml` (Phase 2) for agent-driven bulk
  diagram generation, with RFC 7807 `application/problem+json` error
  responses.
- **Auto-setup CLI** `npx viso-mcp init` (Phase 3) writes or merges
  `.mcp.json` for Claude Code, Cursor, Cline, and other MCP clients.
- **SQL DDL export** (Phase 1) via `diagram_export_sql` for Postgres and
  MySQL. Additional dialects (`mssql`, `oracle`, `snowflake`) are planned
  for v1.1.
- **Hybrid-UX editor** (Phase 4) with tools sidebar, properties panel,
  toggleable code panel (CodeMirror, `Cmd+/`), command palette (`Cmd+K`),
  auto-layout button (ELK), and undo/redo.
- **HTTP-API adapter** (Phase 5) via `npx viso-mcp serve --http <port>`
  backed by Fastify, with auth pass-through, CORS whitelist, and WebSocket
  live updates. Enables Hub integration outside Vite.
- **`attachmentSlot` React prop** (Phase 5) on `VisoEditor` for Hub-side
  screen-recording and annotation injection.
- **Dark mode, WCAG 2.1 AA compliance, touch support** (Phase 6) for
  consultant-desktop and iPad workshop scenarios.

### Deprecated

- `daten-viz-mcp` npm package (still functional, receives no new features).
  Run `npx viso-mcp init` in existing projects to migrate.
- `DATEN_VIZ_FILE` and `DATEN_VIZ_BPMN_FILE` env vars. Will be removed in
  v1.1.

### Migration

1. Update your `.mcp.json`:
   ```bash
   npx viso-mcp init
   ```
2. Migrate ERD files once Phase 1 ships:
   ```bash
   npx viso-mcp migrate ./schema.erd.json
   # Creates ./schema.dbml + ./schema.erd.json.bak
   ```
3. Rename any environment variables you set manually:
   - `DATEN_VIZ_FILE` → `VISO_FILE`
   - `DATEN_VIZ_BPMN_FILE` → `VISO_BPMN_FILE`
4. If you hit the preview server directly: update endpoint paths from
   `/__daten-viz-api/*` to `/__viso-api/*`.

### Internal

- MCP tool names (`diagram_*`, `process_*`) are unchanged for v1.x to
  preserve agent-prompt compatibility. A namespace bump is planned for
  v2.0 with alias support for one release.

## [0.2.0] — 2026-03-31

Final release under the `daten-viz-mcp` name. See git history for details.
