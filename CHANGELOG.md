# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] — 2026-04-25

Stabilization release after a synthetic user-test (5 personas, 30 stories,
24 findings). Closes 7 critical findings (CR-1 to CR-7) and 5 of the
13 major findings without breaking existing API contracts. Backwards-compatible.

### Added

- **AppSidebar Landscape-Sektion** with Network-Icon, plus DiagramTabs +
  CommandPalette + ToolPalette type-erweiterung — Landscape ist jetzt UI-
  voll bedienbar (CR-3).
- **5 Landscape Click-to-Place Tools** in der ToolPalette — Person `6`,
  System `7`, External `8`, Container `9`, Database `0` — plus Cmd+K-
  Add-Aktionen analog (CR-3).
- **ERD Click-to-Place** (Tabellen-Werkzeug `5`) in ToolPalette + Cmd+K-
  Palette + paneClick-Handler (CR-2).
- **Server-Validation an allen 3 PUT-Source-Routen** via neuer
  `writeValidatedRawBody`-Helper (`src/preview/vite-validation.ts`).
  Zod-validiert Body, atomic-rename-write, RFC-7807 application/problem+json
  bei Failure. Loest CR-4 — Live-Test zerstoerte vorher test-schema.erd.json.
- **`set_dbml` Auto-Migration** wenn JSON-Store erkannt: importiert
  migrate-cli, ruft migrateFile auf, swapt Store-Reference im laufenden
  Server. Output enthaelt `migrated: true / oldPath / newPath` (CR-6).
- **`viso-mcp init --format=dbml|json`** + **`--with-samples`**: kopiert
  Demo-Fixtures (4-Tabellen-DBML, 8-Node-BPMN, 5-Node-Landscape) in
  den cwd. DBML ist Default. (CR-6 / MI-3)
- **5 deutsche Relations-Patterns fuer ERD-Narrative-Parser:**
  "Kunden haben mehrere Bestellungen.", "Bestellungen gehoeren zu einem
  Kunden.", "Order referenziert Customer ueber customer_id.", "Jede
  Bestellung enthält mehrere Bestellpositionen.", "Produkte sind einer
  Kategorie zugeordnet." Auto-create Tabellen mit `id uuid primary` (CR-5).
- **6 deutsche Patterns fuer BPMN-Narrative-Parser:**
  "{A} uebergibt {payload} an {B}.", "{A} ruft {service} fuer {B}.",
  "{A} sendet {msg} via {channel}.", "Nach {A} folgt {B}.",
  "{A} prueft {target}.", "{A} verarbeitet {target}." Akzeptieren
  Umlaut + Transliteration (CR-5).
- **LLM-Adapter** (`src/narrative/llm-adapter.ts`): nativer fetch-call
  gegen Anthropic Messages API ohne neue Dependency. Aktivierung via
  `VISO_LLM_PARSE=true` + `ANTHROPIC_API_KEY`. Default-Model
  `claude-haiku-4-5`. Returnt `null` bei Failure → Regex-Fallback
  bleibt der einzige garantierte Code-Pfad fuer Caller.
- **`parseDiagramDescriptionAsync()`** als async-variante mit LLM-First +
  Regex-Fallback. Sync-API unveraendert.
- **`src/cardinality.ts`**: zentrales Long-Form ↔ Short-Form Mapping
  (1:N ↔ many-to-one) plus Mermaid-Notation. `diagram_add_relation`
  akzeptiert ab v1.1.1 beide Formen (MA-3).
- **`EXPORT_OPTIONS`** als Single Source of Truth in
  `src/preview/components/shell/export-options.ts`. Header-Dropdown und
  Cmd+K-Palette lesen beide aus dem gleichen Array — kein Drift mehr (CR-7).
- **Dynamic Header-Badge:** ERD / BPMN / LANDSCAPE / HUB / HYBRID statt
  static "HYBRID" (MA-12).
- **Initial alle Tabs offen + DiagramTabs immer sichtbar** wenn ≥ 1 File
  geladen. "Switch Diagram..." in Cmd+K rotiert echte Tabs. (CR-1)

### Changed

- **`set_bpmn` Param `json` → `process`** (canonical), `json` weiterhin
  als deprecated alias akzeptiert (MA-4).
- **`set_landscape` Param `json` → `landscape`** (canonical), `json`
  weiterhin als deprecated alias (MA-4).
- **`parse_description` reportet jetzt `engineUsed: 'regex' | 'llm' | 'hybrid'`**
  und `noOp: boolean` zusaetzlich zu `persisted`. Bei `noOp: true` wird
  nicht persistiert auch wenn `persist: true` (MA-7).
- **EmptyState-Texte ohne MCP-Tool-Namen.** Statt "Use process_add_node"
  steht jetzt "Klicke das Task-Werkzeug (Shortcut 3) und dann auf den
  Canvas, um deinen ersten Knoten zu setzen." Pro Use Case eigener Text
  (MI-1).
- **Type-Hub:** `src/types.ts` re-exportiert `DiagramTypeEnum` aus
  `bundle/manifest.ts`. Alle UI-Komponenten importieren von dort —
  TypeScript zwingt Vollstaendigkeit ueber `'erd' | 'bpmn' | 'landscape'`.

### Fixed

- **CR-1 — File-Switch UI:** AppSidebar mounted, alle Tabs initial
  offen, DiagramTabs immer sichtbar, "Switch Diagram..." rotiert
  korrekt durch openTabs.
- **CR-4 — Server akzeptiert kaputten Input:** `PUT /__viso-api/source`
  liefert jetzt 400 + RFC-7807 bei JSON-Parse-Error oder Schema-
  Verletzung. Atomic-Write garantiert: Original-File ist nie in einem
  Half-Written-Zustand zu beobachten.
- **CR-7 — Cmd+K vs Header-Dropdown Drift:** beide nutzen jetzt
  `EXPORT_OPTIONS` als Datentopf.
- **MA-1 — `attachmentSlot`-Stub leakte im Vite-Mode:** "Screen-
  Recording starten"-Demo-Button entfernt; Slot rendert nur noch
  wenn Hub einen `attachmentSlot` injiziert.
- **MA-7 — `persisted: false` bei `noOp: true`:** alle 3
  `*_parse_description`-Tools schreiben nicht auf Disk wenn der
  Parser keine neuen Knoten/Spalten/Relations erzeugt hat.

### Tests

- 255 Tests in 26 Test-Files gruen (vorher 207 in 23).
- 4 neue Tests in `vite-validation.test.ts` (CR-4)
- 5 neue Tests in `init-cli.test.ts` (CR-6)
- 9 neue Tests in `parse-description.test.ts` (ERD DE-Patterns)
- 9 neue Tests in `bpmn/parse-description.test.ts` (BPMN DE-Patterns)
- 9 neue Tests in `narrative/llm-adapter.test.ts` (Mock-fetch)
- 12 neue Tests in `cardinality.test.ts`

### Migration

Backwards-compatible. JSON-Mode `*.erd.json` Dateien funktionieren
weiterhin; `set_dbml` migriert automatisch beim ersten Aufruf.
`set_bpmn(json: ...)` und `set_landscape(json: ...)` funktionieren
unveraendert ueber den Deprecated-Alias.

Bekannte Limitierung: Phase 5 hat MA-2/5/6/8/9/10/11 + MI-2/4 noch
offen; geplant fuer einen Folge-Sprint.

## [1.1.0] — 2026-04-22

Consulting-ready release. Turns `viso-mcp` from a diagram editor into a
TAFKA-style audit tool with a third diagram dimension (System-Landscape),
narrative-to-diagram parsing, deterministic Handoff-Bundles, and a DE-first UI.

### Added

- **System-Landscape (C4 L1 + L2)** as third diagram kind alongside ERD and
  BPMN. Full stack: Zod schema (discriminated union on `kind`), `LandscapeStore`
  with atomic FS-IO, 13 MCP tools (add/remove node + relation, update_node,
  set_status, set_parent for boundary containment, set_mode / get_mode,
  parse_description, set_landscape bulk, export_mermaid with
  `variant: 'flowchart' | 'architecture-beta'`, get_schema with metadata
  envelope). HTTP adapter + Vite plugin routes for browser + hub consumers.
  Single memoised React-Flow node component parameterised on 7 kinds (Person,
  System, External, Container, Database, Cloud, Boundary).
- **Narrative-to-Diagram parsers** for all three diagram kinds. Regex-first
  with an LLM-reserved branch that currently degrades to regex (MCP sampling
  not host-supported yet). KMU-entity dictionary (~150 DE-Mittelstand systems)
  hard-separates look-alike entities (Shopify vs Shopware). Layered dedup:
  dictionary → exact → Levenshtein ≤ 2 → trigram-Jaccard length-ratio.
- **Handoff-Bundle** deterministic Zip (STORE, UNIX platform, fixed date)
  with whitelisted entries + 5 MiB / 20-entry caps. `export_bundle` +
  `import_bundle` MCP tools with `onConflict: 'rename' | 'overwrite' | 'abort'`
  so re-imports never silently clobber. Browser export via `html-to-image`
  + JSZip, CLI export via plain `fs`.
- **Status overlay** (`open` | `done` | `blocked`, EN-persistent) on
  BPMN nodes, ERD tables/columns, and Landscape nodes + relations. Rendered
  in canvas as a ring + StatusBadge, in Mermaid as scoped `classDef`.
  `.erd.status.json` sidecar preserves ERD status through DBML round-trips.
- **Two-Mode Prozess** toggle (`simple` vs full `bpmn`). Nondestructive
  downgrade keeps schema nodes; UI filters palette + shows hidden-count.
  `.bpmn.mode.json` sidecar + `process_get_schema` `metadata.mode + hiddenIds`.
- **DE-first UI** via typed const-dictionary in `src/preview/i18n/`.
  `Locale` narrowed to `'de'` in v1.1 until EN values are audited.
- **SVG / PNG canvas export** via pinned `html-to-image@1.11.11` (exact,
  per plan R3 — 1.11.12+ drops edges in React-Flow exports). Retina-safe
  via `getFontEmbedCSS` + `await document.fonts.ready`.
- **Pointer-Events drag-and-drop** from the palette to the canvas, iPad
  Safari-safe (HTML5 DnD has no touch `dataTransfer`). Additive to the
  existing click-to-place flow.
- **Mermaid-label escape** (`escapeMermaidLabel`) applied across ERD, BPMN,
  and Landscape emitters — defeats the CVE-2021-23648 / CVE-2022-35930
  injection class.
- **Sidecar-path guard** (`assertSidecarInsideRoot`) anchors every sidecar
  write to the source's directory, defending against path traversal.
- **MCP tool annotations** (`readOnlyHint` / `destructiveHint` /
  `idempotentHint`) applied per the 2025-06-18 spec across all tools.
  `set_bpmn` + `set_dbml` + `set_landscape` documented as
  `destructiveHint + idempotentHint` with batching-hint in their
  description (`> 3 mutations prefer set_*`).

### Changed

- `package.json`: version bumped to 1.1.0. `peerDependenciesMeta` marks
  React / ReactDOM / @xyflow/react optional so server-only consumers
  install cleanly. `sideEffects: ['**/*.css']` protects `preview.css` from
  tree-shaking in downstream bundlers (plan R6). `engines: >= 20.18`.
  `overrides: { "hono": "^4.12.12" }` closes transitive CVEs from
  `@dbml/core → @hono/node-server` (plan R10).
- `process_get_schema` response shape changed to `{ process, metadata }`.
  `process` is the plain ProcessSchema payload (safe to pipe back through
  `set_bpmn`); `metadata` is read-only sidecar-derived state.
- `ErdStore` interface grew a public `filePath: string` so sidecar
  helpers can derive their paths without leaking the concrete class.
- `TopHeader` shows a segmented Mode-Toggle (Einfach / BPMN-Profi) when
  a BPMN file is open, with optimistic-revert on HTTP-PUT failure.

### Removed / Deprecated

- **Free color picker** in `PropertiesPanel` replaced by the Status-UI.
  `NodeUpdate.color` remains on the type (`@deprecated`) for one minor
  version to give Hub consumers a migration window.

### Security

- Plan Req #1 (Mermaid-label escape), #4 (sidecar-path guard), #8
  (MCP-tool-annotations) shipped. Handoff-Bundle importer enforces
  entry whitelist, 5 MiB / 20-entry caps (plan Req #2).

### Dependencies

- Added: `jszip@^3.10`, `html-to-image@1.11.11` (exact pin), `fast-check`
  (dev), `fastest-levenshtein`.

### Tests

- 207 tests total (baseline v1.0 relaunch: 109). +64 from P0 (status + mermaid
  escape + MCP parity), +10 P1 (mode sidecar + idempotenz + http), +14 P2
  (landscape schema), +9 P2 (mermaid), +12 P2.1 (bundle serialize + tools),
  +22 P3 (parse-description).
- Bundle size 461 kB gzipped (plan gate 650 early-warning, 800 hard).

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
