---
title: "feat: MVP Daten & Prozess Visualisierungs-Tool"
type: feat
status: completed
date: 2026-03-30
simplified: 2026-03-30
---

# feat: MVP Daten & Prozess Visualisierungs-Tool

## Overview

Ein lokales, Agent-natives Tool zur Visualisierung von Datenbank-Schemas. Der MCP-Server ist das primaere Interface — AI-Agents erstellen, lesen und modifizieren ER-Diagramme ueber strukturierte Tool-Calls. Ein Browser-basierter Preview zeigt das Diagramm live via React Flow.

**Kern-Differentiator:** Kein existierendes Tool vereint local-first + MCP-native + visuell ansprechend + ER-Diagramme. Eraser.io ist am naechsten, aber cloud-only und ohne MCP.

## Problem Statement / Motivation

Entwickler, die mit AI-Agents arbeiten (Claude Code, Cursor), haben kein Tool, mit dem ihr Agent Datenbank-Schemas visuell erstellen und modifizieren kann. Bestehende Optionen:
- Mermaid: LLM-freundlich, aber visuell limitiert
- dbdiagram.io: Schoen, aber kein AI/MCP-Zugang
- Excalidraw: Lokal und schoen, aber nicht maschinenlesbar
- Eraser.io: AI-native, aber cloud-only

## Technical Approach

### Architecture

**MCP-Server und Vite-Preview sind separate OS-Prozesse.** Der MCP-Server nutzt stdio (stdin/stdout fuer Protokoll-Messages), was mit Vites Console-Output kollidieren wuerde. Beide koordinieren ueber das Dateisystem.

**Ownership-Regel:** MCP-Server schreibt **nur** `.erd.json`. Browser/Vite schreibt **nur** `.erd.pos.json`. Kein Prozess schreibt in die Datei des anderen.

```
┌─────────────────┐     stdio      ┌──────────────────┐
│  Claude Code /  │ ◄────────────► │   MCP Server     │ ← Prozess 1
│  Claude Desktop │                │  (node)          │   schreibt NUR .erd.json
└─────────────────┘                └────────┬─────────┘
                                            │
                                   writes   │  reads
                                            ▼
                                   ┌──────────────────┐
                                   │  .erd.json       │ ← Schema (Tables, Columns, Relations)
                                   │  .erd.pos.json   │ ← Positions (nur x/y pro Table)
                                   └────────┬─────────┘
                                            │
                                   chokidar │  watches .erd.json only
                                            ▼
┌─────────────────┐   WebSocket    ┌──────────────────┐
│  Browser        │ ◄────────────► │  Vite Dev Server │ ← Prozess 2
│  (React Flow)   │                │  + WS Plugin     │   schreibt NUR .erd.pos.json
└─────────────────┘                └──────────────────┘
```

**Wichtig:** Chokidar watched nur `.erd.json` (Schema-Aenderungen vom MCP-Server). `.erd.pos.json` wird nicht gewatched — der Browser ist der einzige Schreiber und kennt seine eigenen Positions bereits. Kein Feedback-Loop moeglich.

### Projekt-Struktur

**Phase 1 — 4 Dateien:**

```
src/
  schema.ts       # Zod v4 Schemas + inferred Types
  store.ts        # load(), save(), atomic writes
  tools.ts        # 7 MCP Tool-Definitionen
  server.ts       # MCP Server init + stdio transport (Entry Point)
```

**Phase 2 — Preview hinzu:**

```
src/
  ...
  preview/
    App.tsx              # React Flow Canvas
    components/
      TableNode.tsx      # Custom Node (React.memo)
      RelationEdge.tsx   # Custom Edge
    layout/
      elk-layout.ts      # ELK.js Auto-Layout
    vite-plugin.ts       # chokidar watch → WS broadcast
    hooks/
      useDiagramSync.ts  # WS Client Hook + Auto-Reconnect
    canvas.css           # Dark Blueprint Theme
    index.html + main.tsx
```

**Phase 3 — Export hinzu:**

```
src/
  ...
  export/
    mermaid.ts    # Internal → Mermaid ER Syntax
```

### Dateiformat

**Schema-Datei (.erd.json)** — nur vom MCP-Server geschrieben:

```json
{
  "format": "daten-viz-erd-v1",
  "name": "My Database Schema",
  "tables": {
    "users": {
      "columns": [
        { "name": "id", "type": "uuid", "primary": true },
        { "name": "email", "type": "varchar", "nullable": false, "description": "Login identifier" }
      ],
      "description": "Application users"
    }
  },
  "relations": [
    {
      "from": { "table": "orders", "column": "user_id" },
      "to": { "table": "users", "column": "id" },
      "type": "many-to-one"
    }
  ]
}
```

**Positions-Datei (.erd.pos.json)** — nur vom Browser geschrieben:

```json
{
  "users": { "x": 0, "y": 0 },
  "orders": { "x": 400, "y": 0 }
}
```

**Design-Entscheidungen:**
- **Separate Dateien fuer Schema + Positions** — kein Prozess schreibt in die Datei des anderen
- **`format`-Feld** — macht Datei selbst-beschreibend, ermoeglicht spaetere Migration
- **Tables als keyed Object** (nicht Array) — git-diffs zeigen nur neue Keys
- **Optionale `description`-Felder** auf Tables und Columns — Agent kann Intent dokumentieren
- **Kardinalitaeten:** `z.enum(['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'])`
- **Flache Relation-Parameter** in Tools (LLM-freundlicher): `fromTable`, `fromColumn` statt verschachteltem Objekt

### MCP Tools (Phase 1 — 7 Tools)

| Tool | Beschreibung | Parameter |
|------|-------------|-----------|
| `diagram_create_table` | Neue Tabelle erstellen | `name`, `columns[]`, `description?` |
| `diagram_remove_table` | Tabelle + zugehoerige Relations entfernen (cascade) | `name` |
| `diagram_add_column` | Spalte zu Tabelle hinzufuegen | `table`, `column` (name, type, primary?, nullable?, description?) |
| `diagram_remove_column` | Spalte entfernen | `table`, `columnName` |
| `diagram_add_relation` | FK-Beziehung erstellen | `fromTable`, `fromColumn`, `toTable`, `toColumn`, `type` |
| `diagram_remove_relation` | Beziehung entfernen | `fromTable`, `fromColumn` |
| `diagram_get_schema` | Schema auslesen (compact JSON, ohne Positions) | — |

**Tool-Design-Regeln:**
- `readOnlyHint: true` auf `get_schema` (erlaubt Auto-Approve in Claude Desktop)
- `diagram_remove_table` cascaded: entfernt alle Relations, meldet Anzahl in Response
- Mutation-Responses mit Schema-Summary: `'Created table "users" with 3 columns. Schema now has 4 tables, 2 relations.'`
- Klare Fehlermeldungen: `'Column "user_id" not found in table "orders". Available columns: id, total, created_at.'`
- `server.registerTool()` API (nicht deprecated `server.tool()`)

### Tech Stack

| Komponente | Technologie | Phase |
|-----------|-------------|-------|
| MCP Server | `@modelcontextprotocol/server` + `@modelcontextprotocol/node` | 1 |
| Schema Validation | `zod` (v4, import via `zod/v4`) | 1 |
| Build | `tsup` (CJS output, target node20, dts: false) | 1 |
| Rendering | `@xyflow/react` (React Flow) | 2 |
| Auto-Layout | `elkjs` (layered algorithm) | 2 |
| Dev Server | `vite` + `@vitejs/plugin-react` | 2 |
| File Watcher | `chokidar` v5 | 2 |
| WebSocket | `ws` (attached to Vite HTTP server, path `/__daten-viz-ws`) | 2 |

### Implementation Phases

#### Phase 1: Foundation (Core + MCP Server)

Ziel: MCP Server funktioniert in Claude Code, Agent kann Schemas erstellen und lesen.

**Dependencies:** `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `zod`, `tsup`

- [x] `package.json` + `tsconfig.json` (strict: true)
- [x] `src/schema.ts`:
  - `SAFE_IDENTIFIER` Regex als Zod-Refinement: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`
  - `z.record(SAFE_IDENTIFIER, TableSchema)` fuer Tables
  - `z.enum()` fuer RelationType
  - Alle Types via `z.infer<>` exportieren
- [x] `src/store.ts`:
  - `load()`, `save()` mit atomic writes (tmp mit `randomUUID()` + rename)
  - ESM-kompatibel (`node:` Imports)
  - Leeres Schema als Default wenn Datei nicht existiert
  - Auto-Create bei erstem Write
- [x] `src/tools.ts`:
  - 7 Tools mit `server.registerTool()`
  - `.describe()` auf jedem Zod-Feld
  - `diagram_remove_table`: Cascade-Delete aller zugehoerigen Relations
  - `diagram_get_schema`: Compact JSON, ohne Positions
- [x] `src/server.ts`:
  - McpServer init + StdioServerTransport
  - `--file` via `node:util/parseArgs` (Default: `./schema.erd.json`)
- [x] `tsup.config.ts`: `format: ['cjs']`, `target: 'node20'`, `dts: false`
- [x] **Tests (Vitest):**
  - Unit: `schema.ts` — Validation Edge Cases
  - Unit: `store.ts` — load, save, missing file, corrupt file
  - Integration: MCP Server als Child-Process → Tool-Calls → File-Output pruefen

**Akzeptanzkriterien:**
- [x] `npx daten-viz-mcp` startet MCP Server via stdio
- [x] Claude kann `diagram_create_table` aufrufen und bekommt Bestaetigung
- [x] `.erd.json` wird korrekt geschrieben
- [x] `diagram_get_schema` gibt kompaktes JSON zurueck
- [x] `diagram_remove_table` entfernt zugehoerige Relations
- [x] Fehlerhafte Inputs geben klare Fehlermeldungen

#### Phase 2: Browser Preview mit Live Sync

Ziel: Schema im Browser als ER-Diagramm anzeigen, Live-Updates wenn der Agent Aenderungen macht. Positionen persistent.

**Neue Dependencies:** `@xyflow/react`, `elkjs`, `vite`, `@vitejs/plugin-react`, `chokidar`, `ws`

- [x] `src/preview/canvas.css` — Dark Blueprint Theme (CSS Custom Properties)
  - Design Spec: `docs/plans/2026-03-30-phase2-browser-preview-design-spec.md`
  - Near-black Canvas (#0B0E14), Cyan Accents, Amber fuer Primary Keys
  - JetBrains Mono als Monospace-Font
- [x] `src/preview/App.tsx` — React Flow Canvas mit MiniMap, Controls, Background (Dots)
  - `nodeTypes` und `edgeTypes` als stabile Referenzen AUSSERHALB der Komponente
- [x] `src/preview/components/TableNode.tsx` — Custom Node (React.memo):
  - Header mit Tabellenname, Rows fuer Columns (Name | Type | PK/Nullable)
  - PK-Rows mit Amber-Hintergrund
- [x] `src/preview/components/RelationEdge.tsx` — smoothstep Edge mit Kardinalitaet (`1 : N`)
- [x] `src/preview/layout/elk-layout.ts`:
  - ELK `layered` Algorithm (main thread, kein Web Worker)
  - Nur Nodes ohne bestehende Position layouten
- [x] `src/preview/vite-plugin.ts`:
  - WebSocket an Vites HTTP Server (path `/__daten-viz-ws`)
  - Chokidar watch **nur auf `.erd.json`** (nicht `.erd.pos.json` — Browser kennt seine Positions)
  - Debounce: 300ms auf File-Watch-Events
  - Vite an `127.0.0.1` binden
- [x] `src/preview/hooks/useDiagramSync.ts`:
  - WS Client Hook
  - Auto-Reconnect mit fixem 2s Interval
  - Full Reload bei Reconnect (beide Dateien neu laden)
  - Globaler 500ms Debounce auf Position-Writes nach `.erd.pos.json`
- [x] Leerer-Canvas Empty-State mit MCP-Tool-Syntax als Hint

**Akzeptanzkriterien:**
- [x] `npx daten-viz serve` zeigt ER-Diagramm im Browser
- [x] Dark Blueprint Aesthetic erkennbar
- [x] Auto-Layout positioniert Tabellen sauber (ELK layered)
- [x] Tabellen sind draggbar, Positionen werden in `.erd.pos.json` gespeichert
- [x] MCP-Aenderungen erscheinen innerhalb von <1s im Browser
- [x] Kein Feedback-Loop (Chokidar watched nur `.erd.json`)

#### Phase 3: Mermaid Export

Ziel: Schema als Mermaid exportieren fuer Dokumentation und Sharing.

- [x] `src/export/mermaid.ts` — Internal → Mermaid erDiagram Syntax
  - Sortierte Table-Keys und Relations fuer deterministische Git-Diffs
- [x] `diagram_export_mermaid` MCP Tool
- [x] CLI: `node dist/export-mermaid.js schema.erd.json`

**Akzeptanzkriterien:**
- [x] Export produziert valides Mermaid das in GitHub/GitLab rendert
- [x] Agent kann `diagram_export_mermaid` aufrufen

## Acceptance Criteria

### Functional Requirements

- [x] MCP Server laeuft via stdio und ist in Claude Desktop/Code konfigurierbar
- [x] 7 MCP Tools funktionieren korrekt (CRUD + Schema lesen)
- [x] Browser Preview zeigt ER-Diagramm mit Dark Blueprint Aesthetic
- [x] Live-Updates: MCP-Aenderungen erscheinen innerhalb von 1 Sekunde im Browser
- [x] Auto-Layout mit ELK.js
- [x] Export zu Mermaid produziert valide Syntax

### Non-Functional Requirements

- [x] Lokal: Kein Netzwerk-Traffic, keine Cloud-Abhaengigkeit
- [x] Performance: Fluessig mit bis zu 50 Tabellen. Optimierung spaeter bei Bedarf.
- [x] TypeScript strict mode
- [x] Zod-Validation auf MCP Tool Inputs und File Load

## Architektur-Entscheidungen

### E1: Separate Dateien, strikte Ownership

`.erd.json` = Schema (MCP-Server only). `.erd.pos.json` = Positions (Browser only). Kein Cross-Write. Chokidar watched nur `.erd.json` — kein Feedback-Loop moeglich weil der Browser `.erd.pos.json` schreibt aber nicht darauf reagiert.

### E2: First-Run Experience

- `diagram_get_schema` ohne existierende Datei → leeres Schema
- `diagram_create_table` ohne existierende Datei → erstellt die Datei automatisch
- `npx daten-viz serve` ohne Datei → leerer Canvas mit MCP-Tool-Syntax als Hint

### E3: File-Targeting

`--file` via `node:util/parseArgs`. Default: `./schema.erd.json`.

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

### E4: Validation Rules

- Self-referencing FKs: **erlaubt**
- Zirkulaere Relations: **erlaubt**
- Tabelle ohne Spalten: **nicht erlaubt**
- Column Types: **Freitext-Strings** (max 128 Zeichen)
- **Namen:** `SAFE_IDENTIFIER` Regex `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`
- `diagram_remove_table` cascaded: entfernt alle Relations die diese Tabelle referenzieren

### E5: Browser Scope (MVP)

Browser ist **Preview mit Drag-to-Reposition**. Kein Schema-Editing im Browser. MCP-Server ist Single Source of Truth fuer Schema.

### E6: MVP Scope — Explizite Ausschluesse

- Browser-Editing (Schema-Aenderungen im Browser)
- Undo/Redo (Git ist der Fallback)
- Multi-Diagram Support
- D2 Export, Mermaid Import, SQL DDL Import
- Tauri Desktop-App, VS Code Extension
- Prozess-/BPMN-Diagramme
- Collaboration / Multiplayer

## Post-MVP Considerations

### Naechste Tools (bei Bedarf)
- `diagram_rename_table` — atomisches Rename + Relation-Referenzen updaten
- `diagram_set_position` — Agent setzt Positions (benoetigt Koordination mit Browser-Writes)
- `diagram_auto_layout` — ELK-Layout per Agent triggern
- `diagram_batch` — atomische Multi-Table-Creation
- `diagram_validate` / `diagram_diff` / `diagram_update_column`

### Performance-Optimierungen (bei Bedarf)
- Zoom-basiertes Column-Collapsing (DOM-Reduktion bei 200+ Tabellen)
- Persistenter ELK Web Worker (bei langsamen Layouts)
- Sequence-Numbers auf Layout-Requests (bei Race Conditions)
- `diagram_get_schema` Filter-Parameter (bei 50+ Tabellen / Token-Limit)
- Inkrementelles ELK-Layout mit Position-Preservation

### Robustheit (bei Bedarf)
- Promise-basierte Write-Queue (gegen In-Process Write Interleaving)
- Content-Hash auf File-Watch (falls Feedback-Loops auftreten)
- State Machine in useDiagramSync (IDLE | LAYING_OUT)
- Drag-Tracking (Position-Snapback verhindern)
- Exponential Backoff auf WS-Reconnect
- Per-Node Debounce auf Position-Writes

### Security-Haertung (bei Netzwerk-Exposure)
- Prototype-Pollution Blocklist auf SAFE_IDENTIFIER
- Path Traversal Protection auf `--file`
- WebSocket Origin-Validation
- Zod-Validation auf WS-Messages
- File-Size Limit (10MB) vor Parse

### Weitere Features
- MCP Resource mit Schema-Subscription (Ambient Context)
- `AGENT_GUIDE.md` als MCP Resource
- D2 Export, Mermaid Import, SQL DDL Import
- Multi-Diagram Support
- Tauri-Wrap, VS Code Extension
- Cloud-Version mit Collaboration
- `daten-viz setup` fuer automatische MCP-Konfiguration
- `outputSchema` + `structuredContent` auf `diagram_get_schema`
- Tool Annotations auf allen Tools (nicht nur `get_schema`)

## Risk Analysis

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| MCP SDK Breaking Changes | Niedrig | Hoch | Version pinnen |
| Onboarding-Friction | Hoch | Hoch | README mit Copy-Paste Config-Snippet |
| React Flow Performance bei vielen Tabellen | Niedrig | Mittel | Spaeter optimieren (siehe Post-MVP) |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-03-30-daten-visualisierung-brainstorm.md`
- Design Spec: `docs/plans/2026-03-30-phase2-browser-preview-design-spec.md`

### External
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [React Flow Docs](https://reactflow.dev)
- [ELK.js Layout](https://reactflow.dev/examples/layout/elkjs)
- [Vite JavaScript API](https://vite.dev/guide/api-javascript)

### Review-Protokoll (2026-03-30)

Plan wurde durch 3 Reviews vereinfacht:

| Reviewer | Kern-Feedback | Umgesetzt |
|----------|--------------|-----------|
| DHH-Style | "Stop planning, start building." 9 Tools zu viel, Race Conditions overengineered. | Tools 9→7, Race Table raus, Performance Budget raus |
| Architecture | `diagram_set_position` verletzt No-Cross-Writes. Positions-Feedback-Loop nicht geloest. | `set_position` raus, Chokidar watched nur `.erd.json` |
| Code Simplicity | Write-Queue, State Machine, Web Worker, Zoom-Collapsing sind YAGNI. Phase 2a/2b mergen. | Alles in Post-MVP verschoben, Phases gemerged |
