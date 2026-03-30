---
title: "feat: MVP Daten & Prozess Visualisierungs-Tool"
type: feat
status: active
date: 2026-03-30
---

# feat: MVP Daten & Prozess Visualisierungs-Tool

## Overview

Ein lokales, Agent-natives Tool zur Visualisierung von Datenbank-Schemas. Der MCP-Server ist das primaere Interface — AI-Agents erstellen, lesen und modifizieren ER-Diagramme ueber strukturierte Tool-Calls. Ein Browser-basierter Preview zeigt das Diagramm live via React Flow mit WebSocket-Updates.

**Kern-Differentiator:** Kein existierendes Tool vereint local-first + MCP-native + visuell ansprechend + ER-Diagramme. Eraser.io ist am naechsten, aber cloud-only und ohne MCP.

## Problem Statement / Motivation

Entwickler, die mit AI-Agents arbeiten (Claude Code, Cursor), haben kein Tool, mit dem ihr Agent Datenbank-Schemas visuell erstellen und modifizieren kann. Bestehende Optionen:
- Mermaid: LLM-freundlich, aber visuell limitiert
- dbdiagram.io: Schoen, aber kein AI/MCP-Zugang
- Excalidraw: Lokal und schoen, aber nicht maschinenlesbar
- Eraser.io: AI-native, aber cloud-only

## Technical Approach

### Architecture

```
┌─────────────────┐     stdio      ┌──────────────────┐
│  Claude Code /  │ ◄────────────► │   MCP Server     │
│  Claude Desktop │                │  (@mcp/server)   │
└─────────────────┘                └────────┬─────────┘
                                            │
                                   writes   │  reads
                                            ▼
                                   ┌──────────────────┐
                                   │  .erd.json File  │
                                   │  (local disk)    │
                                   └────────┬─────────┘
                                            │
                                   chokidar │  watches
                                            ▼
┌─────────────────┐   WebSocket    ┌──────────────────┐
│  Browser        │ ◄────────────► │  Vite Dev Server │
│  (React Flow)   │                │  + WS Plugin     │
└─────────────────┘                └──────────────────┘
```

### Projekt-Struktur

```
src/
├── mcp/                    # MCP Server
│   ├── server.ts           # McpServer init + transport
│   ├── tools/
│   │   ├── table-tools.ts  # diagram_create_table, diagram_remove_table, diagram_update_table
│   │   ├── column-tools.ts # diagram_add_column, diagram_remove_column, diagram_update_column
│   │   ├── relation-tools.ts # diagram_add_relation, diagram_remove_relation
│   │   └── query-tools.ts  # diagram_get_schema, diagram_get_table, diagram_query_relations
│   └── index.ts            # Entry point (stdio transport)
├── core/
│   ├── schema.ts           # Zod v4 validation schemas (DiagramSchema, TableSchema, etc.)
│   ├── store.ts            # DiagramFileStore — JSON file read/write + chokidar watcher
│   └── defaults.ts         # Default values, empty schema template
├── preview/
│   ├── vite-plugin.ts      # Vite plugin: WebSocket bridge to browser
│   ├── App.tsx             # React Flow canvas with MiniMap, Controls, Background
│   ├── components/
│   │   ├── TableNode.tsx   # Custom React Flow node fuer Datenbank-Tabellen
│   │   ├── RelationEdge.tsx # Custom edge mit Kardinalitaets-Labels
│   │   └── Toolbar.tsx     # Auto-Layout Button, Export, Theme Toggle
│   ├── hooks/
│   │   └── useDiagramSync.ts # WebSocket client hook
│   ├── layout/
│   │   └── elk-layout.ts   # ELK.js auto-layout integration
│   ├── index.html
│   └── main.tsx
├── cli/
│   ├── index.ts            # Commander.js CLI entry point
│   ├── commands/
│   │   ├── serve.ts        # `daten-viz serve` — startet Vite + MCP
│   │   ├── export.ts       # `daten-viz export --format mermaid|d2`
│   │   ├── validate.ts     # `daten-viz validate schema.erd.json`
│   │   └── init.ts         # `daten-viz init` — erstellt leere .erd.json
│   └── utils.ts
├── export/
│   ├── mermaid.ts          # Internal format → Mermaid ER syntax
│   └── d2.ts               # Internal format → D2 syntax
├── import/
│   ├── mermaid.ts          # Mermaid ER → Internal format
│   └── sql-ddl.ts          # SQL CREATE TABLE → Internal format
└── types/
    └── index.ts            # Shared TypeScript types
```

### Dateiformat (.erd.json)

JSON-basiert, git-diffable, token-effizient (~2000-3000 Tokens fuer 10 Tabellen):

```jsonc
{
  "version": 1,
  "type": "er-diagram",
  "meta": {
    "name": "My Database Schema",
    "created": "2026-03-30T10:00:00Z",
    "modified": "2026-03-30T12:30:00Z"
  },
  "tables": {
    "users": {
      "columns": [
        { "name": "id", "type": "uuid", "primary": true },
        { "name": "email", "type": "varchar", "nullable": false },
        { "name": "name", "type": "varchar" },
        { "name": "created_at", "type": "timestamp" }
      ],
      "position": { "x": 0, "y": 0 },
      "color": "#3b82f6"
    }
  },
  "relations": [
    {
      "id": "orders_user_id_fk",
      "from": { "table": "orders", "column": "user_id" },
      "to": { "table": "users", "column": "id" },
      "type": "many-to-one"
    }
  ],
  "layout": {
    "direction": "LR",
    "autoLayout": false
  }
}
```

**Design-Entscheidungen:**
- **Tables als keyed Object** (nicht Array) — git-diffs zeigen nur neue Keys, kein Array-Index-Shift
- **Human-readable IDs** (`"orders_user_id_fk"`) statt UUIDs — spart Tokens, lesbar ohne Tool
- **Positions pro Table** — kein separater Layout-Bereich noetig
- **Kardinalitaeten:** `one-to-one`, `one-to-many`, `many-to-one`, `many-to-many`

### MCP Tools (Phase 1)

Alle Tools mit Prefix `diagram_`, Zod v4 Schemas, `.describe()` auf jedem Feld:

| Tool | Beschreibung | Parameter |
|------|-------------|-----------|
| `diagram_create_table` | Neue Tabelle erstellen | `name`, `columns[]` (name, type, primary, nullable) |
| `diagram_remove_table` | Tabelle entfernen | `name` |
| `diagram_add_column` | Spalte zu Tabelle hinzufuegen | `table`, `column` (name, type, primary, nullable) |
| `diagram_remove_column` | Spalte entfernen | `table`, `column` |
| `diagram_add_relation` | FK-Beziehung erstellen | `from` (table, column), `to` (table, column), `type` |
| `diagram_remove_relation` | Beziehung entfernen | `id` |
| `diagram_get_schema` | Gesamtes Schema auslesen | — |
| `diagram_get_table` | Einzelne Tabelle mit Relations | `name` |
| `diagram_query_relations` | Relations filtern | `table?`, `type?` |
| `diagram_update_table` | Tabelle umbenennen oder Farbe aendern | `name`, `newName?`, `color?` |
| `diagram_update_column` | Spalte umbenennen oder Typ aendern | `table`, `column`, `newName?`, `newType?` |
| `diagram_auto_layout` | ELK.js Layout ausloesen | `direction?` (LR, TB) |
| `diagram_export_mermaid` | Schema als Mermaid-Text zurueckgeben | — |
| `diagram_export_d2` | Schema als D2-Text zurueckgeben | — |

### Tech Stack

| Komponente | Technologie | Version |
|-----------|-------------|---------|
| MCP Server | `@modelcontextprotocol/server` + `@modelcontextprotocol/node` | v1.x |
| Schema Validation | `zod` (v4, import via `zod/v4`) | v4 |
| Rendering | `@xyflow/react` (React Flow) | v12+ |
| Auto-Layout | `elkjs` | latest |
| Dev Server | `vite` + `@vitejs/plugin-react` | v8 |
| CLI | `commander` | v14 |
| File Watcher | `chokidar` | v5 (ESM) |
| WebSocket | `ws` | latest |
| Build | `tsup` (fuer MCP/CLI), Vite (fuer Preview) | latest |

### Implementation Phases

#### Phase 1: Foundation (Core + MCP Server)

Ziel: MCP Server funktioniert in Claude Code, Agent kann Schemas erstellen/lesen.

- [ ] `package.json` + `tsconfig.json` + Monorepo-Setup (oder single package mit mehreren Entry Points)
- [ ] `src/core/schema.ts` — Zod v4 Schemas fuer DiagramSchema, TableSchema, ColumnSchema, RelationSchema
- [ ] `src/core/store.ts` — DiagramFileStore: `load()`, `save()`, `watchForExternalChanges()`
- [ ] `src/core/defaults.ts` — Leeres Schema-Template, Default-Werte
- [ ] `src/mcp/tools/table-tools.ts` — `diagram_create_table`, `diagram_remove_table`
- [ ] `src/mcp/tools/column-tools.ts` — `diagram_add_column`, `diagram_remove_column`
- [ ] `src/mcp/tools/relation-tools.ts` — `diagram_add_relation`, `diagram_remove_relation`
- [ ] `src/mcp/tools/query-tools.ts` — `diagram_get_schema`, `diagram_get_table`, `diagram_query_relations`
- [ ] `src/mcp/server.ts` — McpServer init, alle Tools registrieren
- [ ] `src/mcp/index.ts` — StdioServerTransport, Entry Point
- [ ] Build mit `tsup` → `dist/mcp/index.js`
- [ ] Test: MCP Server in Claude Desktop konfigurieren, Schema erstellen lassen

**Akzeptanzkriterien:**
- [ ] `npx daten-viz-mcp` startet MCP Server via stdio
- [ ] Claude kann `diagram_create_table` aufrufen und bekommt Bestaetigung
- [ ] `.erd.json` Datei wird korrekt geschrieben und ist valide
- [ ] `diagram_get_schema` gibt das komplette Schema zurueck

#### Phase 2: Browser Preview

Ziel: Live-Vorschau im Browser, die sich automatisch aktualisiert wenn der Agent Aenderungen macht.

- [ ] `src/preview/App.tsx` — React Flow Canvas mit MiniMap, Controls, Background
- [ ] `src/preview/components/TableNode.tsx` — Custom Node: Tabellenname als Header, Spalten als Rows mit Typ-Badges
- [ ] `src/preview/components/RelationEdge.tsx` — Custom Edge mit Kardinalitaets-Label
- [ ] `src/preview/hooks/useDiagramSync.ts` — WebSocket Client Hook
- [ ] `src/preview/layout/elk-layout.ts` — ELK.js Auto-Layout Funktion
- [ ] `src/preview/vite-plugin.ts` — Vite Plugin: chokidar watch auf `.erd.json` → WebSocket broadcast
- [ ] `src/preview/index.html` + `src/preview/main.tsx` — Vite Entry Points
- [ ] Dark/Light Theme mit CSS Variables
- [ ] `src/preview/components/Toolbar.tsx` — Auto-Layout Button, Direction Toggle, Theme Switch

**Akzeptanzkriterien:**
- [ ] `npx daten-viz serve` oeffnet Browser mit leerem Canvas
- [ ] Wenn Agent via MCP eine Tabelle erstellt, erscheint sie innerhalb von <1s im Browser
- [ ] Tabellen sind drag-bar, Positionen werden in `.erd.json` gespeichert
- [ ] Auto-Layout ordnet alle Tabellen sauber an
- [ ] Relations zeigen Kardinalitaet (1:1, 1:N, N:M)

#### Phase 3: CLI + Export/Import

Ziel: Eigenstaendige CLI-Commands fuer Export, Import, Validation.

- [ ] `src/cli/index.ts` — Commander.js Setup mit Subcommands
- [ ] `src/cli/commands/serve.ts` — Startet Vite Preview Server
- [ ] `src/cli/commands/init.ts` — Erstellt leere `.erd.json` mit Wizard
- [ ] `src/cli/commands/export.ts` — Export zu Mermaid und D2
- [ ] `src/cli/commands/validate.ts` — Schema-Validation gegen Zod Schema
- [ ] `src/export/mermaid.ts` — Internal → Mermaid erDiagram Syntax
- [ ] `src/export/d2.ts` — Internal → D2 Syntax
- [ ] `src/import/mermaid.ts` — Mermaid ER → Internal Format (basic)
- [ ] `src/import/sql-ddl.ts` — SQL CREATE TABLE → Internal Format

**Akzeptanzkriterien:**
- [ ] `daten-viz init` erstellt eine valide `.erd.json`
- [ ] `daten-viz export --format mermaid schema.erd.json` gibt valides Mermaid aus
- [ ] `daten-viz validate schema.erd.json` prueft Integritaet (fehlende FK-Targets, etc.)
- [ ] `daten-viz export --format d2 schema.erd.json` gibt valides D2 aus

## Alternative Approaches Considered

| Ansatz | Verworfen weil |
|--------|----------------|
| D3.js fuer Rendering | Zu low-level, kein Node/Edge-Konzept, alles manuell bauen |
| Konva (Canvas-based) | Kein DOM in Nodes → keine interaktiven Elemente, kein Edge-Routing |
| Dagre fuer Layout | Kein port-basiertes Edge-Routing, weniger Konfiguration als ELK |
| Eigener WebSocket-Server (getrennt von Vite) | Port-Konflikte, extra Prozess, Vite-Plugin ist eleganter |
| DBML als Format (wie dbdiagram.io) | Proprietaer, kein Standard, schlechter fuer LLM-Interaktion als JSON |
| Binaeresformat (wie Pencil .pen) | Nicht git-diffable, nicht human-readable, Overengineering fuer MVP |

## Acceptance Criteria

### Functional Requirements

- [ ] MCP Server laeuft via stdio und ist in Claude Desktop/Code konfigurierbar
- [ ] Alle 10 MCP Tools funktionieren korrekt (create, read, update, delete fuer Tables, Columns, Relations)
- [ ] Browser Preview zeigt ER-Diagramm mit Tabellen, Spalten, Typen und Relations
- [ ] Live-Updates: MCP-Aenderungen erscheinen innerhalb von 1 Sekunde im Browser
- [ ] Auto-Layout mit ELK.js funktioniert in beide Richtungen (LR, TB)
- [ ] Export zu Mermaid und D2 produziert valide Syntax
- [ ] CLI Commands: `init`, `serve`, `export`, `validate`

### Non-Functional Requirements

- [ ] Lokal: Kein Netzwerk-Traffic, keine Cloud-Abhaengigkeit
- [ ] Performance: 50 Tabellen rendern fluessig (60fps Pan/Zoom)
- [ ] Dateigroesse: 10 Tabellen < 5KB JSON
- [ ] Token-Effizienz: `diagram_get_schema` fuer 10 Tabellen < 3000 Tokens

### Quality Gates

- [ ] TypeScript strict mode
- [ ] Zod-Validation auf allen Inputs (MCP Tools + File Load)
- [ ] Unit Tests fuer Core (schema, store, export/import)
- [ ] Integration Test: MCP Tool → File → WebSocket → Browser

## Dependencies & Prerequisites

- Node.js >= 20 (fuer chokidar v5 ESM)
- Claude Desktop oder Claude Code mit MCP-Support
- Moderne Browser (Chrome, Firefox, Safari) fuer Preview

## Architektur-Entscheidungen (aus SpecFlow-Analyse)

Die folgenden kritischen Fragen wurden durch die SpecFlow-Analyse identifiziert und hier beantwortet:

### E1: Browser → File Kommunikation (bidirektional)

**Entscheidung:** Browser sendet Position-Updates via WebSocket an den Vite-Server, der schreibt auf Disk (debounced 500ms).

**Ablauf:** React Flow `onNodeDragStop` → WebSocket `{ type: 'position-update', nodeId, position }` → Vite Plugin empfaengt → Merged mit aktuellem .erd.json → Atomic Write (tmp + rename).

### E2: Concurrency-Modell (MCP + Browser gleichzeitig)

**Entscheidung:** Optimistic Locking mit `version`-Counter im .erd.json.

- Jeder Write inkrementiert `version`
- Vor jedem Write: aktuelle `version` lesen, vergleichen, nur schreiben wenn match
- Bei Konflikt: Re-Read, Merge (Positions vs. Schema-Aenderungen sind disjunkt), Retry
- Atomic File Writes: Schreibe `.erd.json.tmp`, dann `rename()` → kein korrupter Zwischenzustand

### E3: First-Run Experience

**Entscheidung:**
- `diagram_get_schema` ohne existierende Datei → gibt leeres Schema zurueck `{ tables: {}, relations: [] }`
- `diagram_create_table` ohne existierende Datei → erstellt die Datei automatisch
- `daten-viz serve` ohne Datei → zeigt leeren Canvas mit Hint "Erstelle dein erstes Schema mit dem MCP-Server oder `daten-viz init`"

### E4: File-Targeting (welche .erd.json?)

**Entscheidung:** MCP-Server empfaengt `--file` Argument beim Start (in `claude_desktop_config.json`). Default: `./schema.erd.json` im Working Directory.

```json
{
  "mcpServers": {
    "daten-viz": {
      "command": "npx",
      "args": ["daten-viz-mcp", "--file", "./schema.erd.json"]
    }
  }
}
```

Spaeter (Post-MVP): Multi-Diagram Support via `diagram_open_file` Tool.

### E5: Validation Rules

- Self-referencing FKs: **erlaubt** (z.B. `employees.manager_id → employees.id`)
- Zirkulaere Relations: **erlaubt** (A→B→C→A ist valide)
- Tabelle ohne Spalten: **nicht erlaubt** (mindestens 1 Column)
- Column Types: **Freitext-Strings** (kein geschlossenes Enum — verschiedene DB-Dialekte)
- Tabellen-/Spaltennamen: **snake_case empfohlen**, alphanumerisch + Underscore, kein Leerzeichen
- Relation muss existierende Tabelle + Column referenzieren

### E6: Browser Scope (MVP)

**Entscheidung:** Browser ist **Preview mit Drag-to-Reposition**. Kein Editing von Tabellen/Columns/Relations im Browser fuer MVP. Das haelt den Frontend-Scope klein und den MCP-Server als Single Source of Truth.

### E7: MCP Tool Error Responses

Alle Tools geben strukturierte Fehlermeldungen zurueck, die der LLM versteht:

```typescript
// Erfolg
{ content: [{ type: 'text', text: 'Created table "users" with 3 columns.' }] }

// Fehler
{ content: [{ type: 'text', text: 'Error: Table "users" already exists. Use diagram_get_table to inspect it, or diagram_remove_table to delete it first.' }], isError: true }
```

### E8: Import/Export Entry Points

| Operation | CLI | MCP Tool | Browser |
|-----------|-----|----------|---------|
| Import Mermaid | `daten-viz import schema.mmd` | `diagram_import` (Post-MVP) | Nein |
| Import SQL DDL | Post-MVP | Post-MVP | Nein |
| Export Mermaid | `daten-viz export --format mermaid` | `diagram_export_mermaid` | Export-Button |
| Export D2 | `daten-viz export --format d2` | `diagram_export_d2` | Export-Button |

### E9: MVP Scope — Explizite Ausschluesse

Folgende Features sind **bewusst nicht im MVP**:
- Browser-Editing (Tabellen/Columns/Relations im Browser anlegen/aendern)
- Undo/Redo (Git ist der Fallback)
- Multi-Diagram Support (ein .erd.json pro MCP-Session)
- SQL DDL Import
- Tauri Desktop-App
- Prozess-/BPMN-Diagramme
- Collaboration / Multiplayer

## Risk Analysis & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Race Condition: MCP + Browser schreiben gleichzeitig | Mittel | Hoch | Optimistic Locking mit Version-Counter + Atomic Writes (siehe E2) |
| React Flow Performance bei 200+ Tabellen | Niedrig | Mittel | Virtualisierung, `nodesDraggable={false}` als Fallback |
| MCP SDK Breaking Changes | Niedrig | Hoch | SDK-Version pinnen, Changelog beobachten |
| WebSocket-Verbindung bricht ab | Mittel | Niedrig | Auto-Reconnect mit exponential backoff, Full-Sync bei Reconnect |
| Chokidar false-positives (doppelte Events) | Hoch | Niedrig | Debounce (100ms) + Atomic Writes verhindern Partial Reads |
| Korrupte .erd.json (manueller Edit, Merge-Konflikt) | Mittel | Mittel | Zod-Validation beim Load, klare Fehlermeldung + `daten-viz validate` |
| Onboarding-Friction (MCP-Konfiguration) | Hoch | Hoch | `daten-viz setup` Command der `claude_desktop_config.json` automatisch konfiguriert |

## Success Metrics

- **MVP-Kriterium:** Ein Entwickler kann in Claude Code sagen "Erstelle ein Schema fuer eine Blog-App" und sieht das Ergebnis live im Browser
- **Adoption-Signal:** 10 Nutzer testen das Tool innerhalb der ersten Woche nach Release
- **Qualitaet:** Kein Datenverlust durch Race Conditions oder File-Corruption

## Future Considerations (Post-MVP)

- Tauri-Wrap fuer native Desktop-App
- SQL DDL Import (PostgreSQL, MySQL)
- Reverse-Engineering: Live-DB-Connection → Auto-Generate Schema
- Prozess-/BPMN-Visualisierung als zweiter Diagramm-Typ
- Cloud-Version mit Collaboration (Multiplayer-Editing)
- npm-Package: `npx create-daten-viz` Scaffold
- VS Code Extension mit Preview-Panel

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-03-30-daten-visualisierung-brainstorm.md`
- JSON-Repair Pattern: `/Users/fabianwillisimon/Documents/Claude_Code/Stundentracking_Fabian/docs/solutions/integration-issues/gemini-api-malformed-json-response.md`
- Theme-Pattern: `/Users/fabianwillisimon/Documents/Claude_Code/lalick_präsentation/docs/solutions/ui-bugs/pitch-deck-design-polish.md`

### External References
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [React Flow Docs](https://reactflow.dev)
- [React Flow DatabaseSchemaNode](https://reactflow.dev/ui/components/database-schema-node)
- [ELK.js Layout](https://reactflow.dev/examples/layout/elkjs)
- [Vite JavaScript API](https://vite.dev/guide/api-javascript)
- [Commander.js v14](https://github.com/tj/commander.js)
- [Chokidar v5](https://www.npmjs.com/package/chokidar)

### Marktanalyse
- Eraser.io (Cloud-only, AI-native, kein MCP)
- D2 Language (Open Source, CLI, aber kein ER+Prozess)
- dbdiagram.io (DBML-basiert, kein AI)
- Mermaid (LLM-freundlich, visuell limitiert)
