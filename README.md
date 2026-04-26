# viso-mcp

Agent-native MCP server and browser editor for ER diagrams (DBML) and BPMN
process flows. Drop it into Claude Code, Cursor, Cline, or any other
MCP-compatible AI agent and let the agent build, edit, and export diagrams
directly from natural-language prompts.

> **Status:** v1.0.0 — relaunch of the former `daten-viz-mcp@0.2.0`.
> See [CHANGELOG.md](./CHANGELOG.md) for breaking changes and the
> [migration guide](./docs/migration-guide.md).

## Why viso-mcp

- **Agent-first.** MCP tools emit structured JSON, not tokens wasted on XML.
  Paper-backed: [arXiv 2509.24592](https://arxiv.org/html/2509.24592v2) shows
  JSON > XML for LLM diagram editing (4× fewer tokens, 8× higher success on
  open-weights models).
- **DBML for ERDs.** Source-of-truth is [DBML](https://dbml.dbdiagram.io/docs/)
  via `@dbml/core` — the same parser production apps like dbdiagram.io and
  Holistics use. Composite keys, indexes, enums, and TableGroups are
  first-class.
- **Bulk-mutation tools.** `set_bpmn` / `set_dbml` let an agent generate a
  complete diagram in a single call, with RFC-7807 error responses when the
  input is malformed.
- **Auto-setup.** `npx viso-mcp init` writes `.mcp.json` for you. No manual
  config editing.
- **Browser preview.** React Flow + ELK auto-layout + DBML/JSON code panel
  with live two-way sync.
- **Export everywhere.** Mermaid, SQL DDL (Postgres, MySQL), DBML, SVG, PNG.

## Install

```bash
# Per-project, recommended
npx viso-mcp init

# Or add to package.json
npm install --save-dev viso-mcp
```

## Quick start

### Frisch starten (DBML, empfohlen)

```bash
mkdir my-schema && cd my-schema
npx viso-mcp init                  # writes .mcp.json + ./schema.dbml is the default ERD path
npx viso-mcp serve                 # browser editor on http://localhost:5555
```

### Mit Demo-Fixtures fuer alle 3 Use Cases

```bash
npx viso-mcp init --with-samples
# zusätzlich erzeugt: schema.dbml, process.bpmn.json, landscape.landscape.json
```

### Legacy-JSON nutzen (statt DBML)

```bash
npx viso-mcp init --format=json    # ./schema.erd.json
```

### Bestehendes JSON-Schema migrieren

```bash
npx viso-mcp migrate ./schema.erd.json
# → erzeugt ./schema.dbml, behält die alte JSON-Datei als .bak Backup
```

> **Note:** The `set_dbml` MCP tool runs an auto-migration when the active
> ERD store is JSON-backed. The tool's response payload contains
> `migrated: true` plus the new `.dbml` path so an agent can update its
> own bookkeeping without a follow-up call.

## MCP tools

### ERD (DBML) — `diagram_*`

| Tool | Purpose |
|---|---|
| `diagram_create_table` | Add a table with columns |
| `diagram_remove_table` | Remove a table by name |
| `diagram_add_column` / `diagram_remove_column` | Column CRUD |
| `diagram_add_relation` / `diagram_remove_relation` | Relation CRUD |
| `diagram_get_schema` | Read current schema |
| `diagram_export_mermaid` | Export to Mermaid ER |
| `diagram_export_sql` | Export to SQL DDL (`postgres` \| `mysql`) |
| `set_dbml` | **Bulk replace** the entire schema from DBML text |

### BPMN — `process_*`

| Tool | Purpose |
|---|---|
| `process_add_node` / `process_remove_node` | Node CRUD |
| `process_add_flow` / `process_remove_flow` | Flow CRUD |
| `process_get_schema` | Read current process |
| `process_export_mermaid` | Export to Mermaid flowchart |
| `set_bpmn` | **Bulk replace** the process from JSON |

MCP tool names are frozen for v1.x — your agent prompts and `.mcp.json`
configs will keep working across minor releases.

## Browser editor

```bash
npx viso-mcp serve ./schema.dbml
```

- Hybrid layout: tools sidebar (left), properties panel (right), toggleable
  code panel (bottom, `Cmd+/`).
- Command palette (`Cmd+K`) for everything an agent can do.
- Auto-save with file watchers; positions live in a separate
  `*.erd.pos.json` / `*.bpmn.pos.json` sidecar so git diffs stay clean.
- Dark mode follows system preference.

## Hub integration (Next.js 16 App Router)

```tsx
// app/dashboard/diagram/page.tsx
'use client';
import { VisoEditor } from 'viso-mcp/preview';

export default function DiagramPage({ params }) {
  return (
    <VisoEditor
      workspaceId={params.workspaceId}
      apiBaseUrl={`/api/proxy/viso/${params.workspaceId}`}
      attachmentSlot={(ctx) => <YourAttachmentUi {...ctx} />}
    />
  );
}
```

See [docs/hub-integration.md](./docs/hub-integration.md) for auth, HTTP
adapter, and WebSocket hookup.

## Development

```bash
npm install
npm run build          # tsup → dist/server.cjs (MCP stdio) + dist/server.js (ESM)
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run preview        # vite dev server
```

## License

MIT

---

## Deutsch (TAFKA-Kontext)

`viso-mcp` ist Teil des [TAFKA-KI-Transformationshub]-Stacks und wird
parallel als Standalone-Tool gepflegt. Deutschsprachige Dokumentation
findet sich unter:

- [docs/brainstorms/](./docs/brainstorms/) — Design-Historie
- [docs/plans/](./docs/plans/) — aktiver Release-Plan v1.0.0
- [CHANGELOG.md](./CHANGELOG.md) — Migrations-Hinweise von
  `daten-viz-mcp@0.2.0`

Bei Fragen zur Hub-Integration: [team@tafka.de](mailto:team@tafka.de).
