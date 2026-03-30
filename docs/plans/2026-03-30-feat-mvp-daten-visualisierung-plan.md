---
title: "feat: MVP Daten & Prozess Visualisierungs-Tool"
type: feat
status: active
date: 2026-03-30
deepened: 2026-03-30
---

# feat: MVP Daten & Prozess Visualisierungs-Tool

## Enhancement Summary

**Deepened on:** 2026-03-30
**Agents used:** Agent-Native Architecture, Frontend Design, TypeScript Reviewer, Performance Oracle, Agent-Native Reviewer, Frontend Races Reviewer, Pattern Recognition, MCP Best Practices Research

### Key Improvements
1. **Separate Positions-Datei** (`.erd.positions.json`) — eliminiert die gefaehrlichste Race Condition zwischen MCP und Browser komplett
2. **9 statt 7 MCP Tools** — `diagram_rename_table` und `diagram_set_position` hinzugefuegt (CRUD-Completeness + Agent-Parity)
3. **Tool Annotations** auf jedem Tool (readOnlyHint, destructiveHint etc.) — verbessert UX in Claude Desktop
4. **Phase 2 aufgeteilt** in 2a (statischer Preview) und 2b (Live-Sync) — frueherer Checkpoint
5. **Dark Blueprint Design Spec** fuer Browser Preview erstellt (separates Dokument)
6. **8 Race Conditions** identifiziert und Mitigations definiert
7. **TypeScript-Haertung** — `noUncheckedIndexedAccess`, `z.record()` mit Key-Validation, `node:util/parseArgs`

### New Considerations Discovered
- Positions muessen in separater Datei leben (2 Prozesse schreiben sonst in dieselbe Datei)
- Content-Hash statt Self-Write-Flag fuer Chokidar Feedback-Loop (race-free)
- Promise-basierte Write-Queue in `store.ts` gegen In-Process-Interleaving
- Inkrementelles ELK-Layout (nur neue Nodes positionieren, nicht alles neu)
- Zoom-basiertes Column-Collapsing fuer Performance bei 200+ Tabellen

---

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

**Wichtig: MCP-Server und Vite-Preview sind separate OS-Prozesse.** Der MCP-Server nutzt stdio (stdin/stdout fuer Protokoll-Messages), was mit Vites Console-Output kollidieren wuerde. Beide koordinieren ueber das Dateisystem.

**Kritische Aenderung nach Races-Review:** Positionen leben in einer **separaten Datei** (`.erd.positions.json`). Dadurch schreiben MCP-Server und Browser nie in dieselbe Datei — die gefaehrlichste Race Condition ist eliminiert.

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
                                   chokidar │  watches both
                                            ▼
┌─────────────────┐   WebSocket    ┌──────────────────┐
│  Browser        │ ◄────────────► │  Vite Dev Server │ ← Prozess 2
│  (React Flow)   │                │  + WS Plugin     │   schreibt NUR .erd.pos.json
└─────────────────┘                └──────────────────┘
```

- **Prozess 1** (MCP Server): Schreibt `.erd.json` (Schema). Liest `.erd.pos.json` fuer `diagram_get_schema`.
- **Prozess 2** (Preview): Schreibt `.erd.pos.json` (Positions). Liest `.erd.json` fuer Rendering.
- **Keine Cross-Writes:** Kein Prozess schreibt in die Datei des anderen. Race Condition eliminiert.

### Projekt-Struktur

**Phase 1 — minimal (4 Dateien):**

```
src/
  schema.ts       # Zod v4 Schemas + inferred Types (kein separates types/)
  store.ts        # DiagramFileStore: load(), save(), atomic writes, write queue
  tools.ts        # Alle 9 MCP Tool-Definitionen
  server.ts       # MCP Server init + stdio transport (Entry Point)
```

**Phase 2a — Static Preview:**

```
src/
  ...
  preview/
    App.tsx              # React Flow Canvas
    components/
      TableNode.tsx      # Custom Node (memoized)
      RelationEdge.tsx   # Custom Edge
    layout/
      elk-layout.ts      # ELK.js Auto-Layout (incremental)
    canvas.css           # Dark Blueprint Theme (CSS Custom Properties)
    index.html + main.tsx
```

**Phase 2b — Live Sync hinzu:**

```
src/
  ...
  preview/
    ...
    vite-plugin.ts      # chokidar watch → WS broadcast (path: /__daten-viz-ws)
    hooks/
      useDiagramSync.ts # WS Client Hook mit State Machine + Auto-Reconnect
```

**Phase 3 — Export hinzu:**

```
src/
  ...
  export/
    mermaid.ts    # Internal → Mermaid ER Syntax (sorted, deterministic output)
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

**Positions-Datei (.erd.pos.json)** — nur vom Browser/Vite geschrieben:

```json
{
  "users": { "x": 0, "y": 0 },
  "orders": { "x": 400, "y": 0 }
}
```

**Design-Entscheidungen:**
- **Separate Dateien fuer Schema + Positions** — eliminiert Cross-Process Race Condition komplett
- **`format`-Feld** — macht Datei selbst-beschreibend (Pattern Recognition Empfehlung)
- **Tables als keyed Object** (nicht Array) — git-diffs zeigen nur neue Keys
- **Optionale `description`-Felder** auf Tables und Columns — Agent kann Intent dokumentieren, nicht nur Struktur
- **Relation Natural Key:** `from.table + from.column` muss unique sein (ein Column kann nur eine ausgehende FK haben). Dokumentiert als Constraint, nicht als Bug
- **Kardinalitaeten:** `z.enum(['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'])`

#### Research Insights: Dateiformat

- **Token-Effizienz:** `diagram_get_schema` gibt Positions NICHT zurueck (spart ~20 Tokens/Table). Compact JSON (kein Pretty-Print) in MCP-Responses (~15-20% Token-Ersparnis)
- **10 Tabellen ≈ 1800 Tokens**, 50 Tabellen ≈ 12.000 Tokens. Bei 50+ Tabellen wird `diagram_get_schema` mit optionalem `tables`-Filter noetig (Post-MVP)
- **Deterministic Export:** Mermaid-Export muss sortierte Keys verwenden fuer saubere Git-Diffs

### MCP Tools (Phase 1 — 9 Tools)

Nach Agent-Native Review von 7 auf 9 erweitert. `diagram_rename_table` verhindert Datenverlust, `diagram_set_position` stellt Agent-Parity mit Browser-Drag her.

| Tool | Beschreibung | Parameter | Annotations |
|------|-------------|-----------|-------------|
| `diagram_create_table` | Neue Tabelle erstellen | `name`, `columns[]`, `description?` | destructive: false, readOnly: false |
| `diagram_remove_table` | Tabelle + zugehoerige Relations entfernen | `name` | destructive: true, idempotent: true |
| `diagram_rename_table` | Tabelle umbenennen, alle Relation-Referenzen aktualisieren | `oldName`, `newName` | destructive: false |
| `diagram_add_column` | Spalte zu Tabelle hinzufuegen | `table`, `column` (name, type, primary?, nullable?, description?) | destructive: false |
| `diagram_remove_column` | Spalte entfernen | `table`, `columnName` | destructive: true |
| `diagram_add_relation` | FK-Beziehung erstellen | `fromTable`, `fromColumn`, `toTable`, `toColumn`, `type` | destructive: false |
| `diagram_remove_relation` | Beziehung entfernen | `fromTable`, `fromColumn` | destructive: true |
| `diagram_get_schema` | Schema auslesen (ohne Positions) | `tables?` (optionaler Filter) | readOnly: true, idempotent: true |
| `diagram_set_position` | Tabellen-Position setzen | `table`, `x`, `y` | destructive: false |

#### Research Insights: MCP Tool Design

**Tool Annotations** (MCP Spec 2025-06-18): Auf jedem Tool setzen. `readOnlyHint: true` auf `get_schema` erlaubt Claude Desktop Auto-Approve ohne User-Confirmation. `openWorldHint: false` auf allen Tools (nur lokale Dateien).

**Tool Descriptions** muessen Preconditions enthalten:
```typescript
description: 'Create a new database table with columns. Table names must be valid identifiers (letters, numbers, underscores). At least one column required. Use diagram_get_schema first to check existing tables.'
```

**Flache Relation-Parameter** (LLM-freundlicher als verschachtelte Objekte):
```typescript
// Statt: from: { table: "orders", column: "user_id" }
// Besser: fromTable: "orders", fromColumn: "user_id"
```

**Cascade auf `diagram_remove_table`:** Auto-Entfernung aller Relations die diese Tabelle referenzieren. Anzahl entfernter Relations in Response melden: `'Removed table "users" and 3 relations.'`

**Error-Response-Template** fuer alle Tools:
```
Error: {was schiefging}. {aktuelle Situation}. {Recovery-Hint mit Tool-Name}.
```
Beispiel: `'Error: Column "user_id" not found in table "orders". Available columns: id, total, created_at. Did you mean one of these?'`

**Output Schema:** `diagram_get_schema` bekommt ein Zod `outputSchema` + `structuredContent` neben dem Text-Content. SDK v2 API: `server.registerTool()` verwenden (nicht deprecated `server.tool()`).

**Schema Summary in Mutation-Responses:**
```
'Created table "users" with 3 columns. Schema now has 4 tables, 2 relations.'
```

### Tech Stack

| Komponente | Technologie | Phase |
|-----------|-------------|-------|
| MCP Server | `@modelcontextprotocol/server` + `@modelcontextprotocol/node` | 1 |
| Schema Validation | `zod` (v4, import via `zod/v4`) | 1 |
| Build | `tsup` (CJS output, target node20, dts: false) | 1 |
| Rendering | `@xyflow/react` (React Flow) | 2a |
| Auto-Layout | `elkjs` (layered algorithm, persistent Web Worker) | 2a |
| Dev Server | `vite` + `@vitejs/plugin-react` | 2a |
| File Watcher | `chokidar` v5 (ESM) | 2b |
| WebSocket | `ws` (attached to Vite HTTP server, path `/__daten-viz-ws`) | 2b |

### Implementation Phases

#### Phase 1: Foundation (Core + MCP Server)

Ziel: MCP Server funktioniert in Claude Code, Agent kann Schemas erstellen/lesen/umbenennen.

**Dependencies:** `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `zod`, `tsup`

- [ ] `package.json` + `tsconfig.json` (strict: true, **noUncheckedIndexedAccess: true**)
- [ ] `src/schema.ts`:
  - Shared `SAFE_IDENTIFIER` Regex als Zod-Refinement (Name-Validation + Prototype-Blocklist)
  - `z.record(SAFE_IDENTIFIER, TableSchema)` fuer Tables (Key-Validation im Schema, nicht manuell)
  - `z.enum()` fuer RelationType
  - `.refine()` auf Relations-Array: `from.table + from.column` muss unique sein
  - Alle Types via `z.infer<>` exportieren (kein separates types/)
- [ ] `src/store.ts`:
  - `load()`, `save()` mit atomic writes (tmp mit `randomUUID()` + rename)
  - **Promise-basierte Write-Queue** (serialisiert alle Writes innerhalb eines Prozesses)
  - Pfad-Validation (`path.resolve()`, `.erd.json`-Extension, kein `..`)
  - `fs.stat()` Groessen-Check vor Parse (Limit 10MB)
  - ESM-kompatibel von Tag 1 (`node:` Imports, kein `__dirname`)
  - Leeres Schema via `satisfies z.infer<typeof DiagramSchema>`
  - Positions-Datei separat lesen/schreiben (`.erd.pos.json`)
- [ ] `src/tools.ts`:
  - 9 Tools mit `server.registerTool()` (nicht deprecated `server.tool()`)
  - Tool Annotations auf jedem Tool (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
  - `.describe()` auf jedem Zod-Feld
  - Tool Descriptions mit Preconditions
  - Error-Template: `Error: {was}. {wo}. {Recovery-Hint mit Tool-Name}.`
  - Mutation-Responses mit Schema-Summary
  - `diagram_get_schema`: Compact JSON, ohne Positions, mit `outputSchema` + `structuredContent`
  - `diagram_rename_table`: Atomisches Rename + alle Relation-Referenzen updaten
  - `diagram_remove_table`: Cascade-Delete aller zugehoerigen Relations
  - `diagram_set_position`: Schreibt in `.erd.pos.json`
  - Split `tools.ts` wenn >400 Zeilen
- [ ] `src/server.ts`:
  - McpServer init mit `server.registerTool()`
  - `--file` via `node:util/parseArgs` (kein commander)
  - StdioServerTransport
- [ ] `tsup.config.ts`: `format: ['cjs']`, `target: 'node20'`, `dts: false`
- [ ] **Tests (Vitest):**
  - Unit: `schema.ts` — Validation Edge Cases (leere Tabelle, Prototype-Namen, doppelte Relation-Keys)
  - Unit: `store.ts` — load, save, missing file, corrupt file, atomic write, write queue
  - Integration: MCP Tool programmatisch aufrufen → `.erd.json` + `.erd.pos.json` pruefen
  - Integration: MCP Server als Child-Process spawnen, via MCP Client SDK Tool-Calls senden

**Akzeptanzkriterien:**
- [ ] `npx daten-viz-mcp` startet MCP Server via stdio
- [ ] Claude kann `diagram_create_table` aufrufen und bekommt Bestaetigung mit Schema-Summary
- [ ] `.erd.json` wird korrekt geschrieben, `.erd.pos.json` wird bei `set_position` geschrieben
- [ ] `diagram_get_schema` gibt kompaktes JSON ohne Positions zurueck
- [ ] `diagram_rename_table` aktualisiert alle Relation-Referenzen atomar
- [ ] Fehlerhafte Inputs geben klare Fehlermeldungen mit Recovery-Hints
- [ ] `diagram_remove_table` entfernt zugehoerige Relations und meldet Anzahl

#### Phase 2a: Static Browser Preview

Ziel: Schema-Datei oeffnen und als ER-Diagramm im Browser anzeigen. Noch kein Live-Sync.

**Neue Dependencies:** `@xyflow/react`, `elkjs`, `vite`, `@vitejs/plugin-react`

- [ ] `src/preview/canvas.css` — Dark Blueprint Theme (CSS Custom Properties, kein Tailwind)
  - Design Spec: `docs/plans/2026-03-30-phase2-browser-preview-design-spec.md`
  - Near-black Canvas (#0B0E14), Cyan Accents, Amber fuer Primary Keys
  - JetBrains Mono als Monospace-Font
- [ ] `src/preview/App.tsx` — React Flow Canvas mit MiniMap, Controls, Background (Dots)
  - `nodeTypes` und `edgeTypes` als stabile Referenzen AUSSERHALB der Komponente
- [ ] `src/preview/components/TableNode.tsx` — Custom Node (React.memo):
  - Header mit Tabellenname, Grid-Rows fuer Columns (Name | Type Badge | PK/Nullable)
  - PK-Rows mit Amber-Hintergrund
  - **Zoom-basiertes Column-Collapsing:** Unter Zoom <0.4 nur Header zeigen (90% weniger DOM)
  - Row-Level Handles die nur bei Hover erscheinen
- [ ] `src/preview/components/RelationEdge.tsx` — smoothstep Edge mit symbolischer Kardinalitaet (`1 : N`)
- [ ] `src/preview/layout/elk-layout.ts`:
  - **Inkrementelles Layout:** Nur Nodes ohne Position layouten, existierende Positionen beibehalten
  - ELK `layered` Algorithm (nicht `force` — schneller fuer ER)
  - Persistenter Web Worker (nicht pro Layout-Call neu erstellen)
  - Sequence-Number auf Layout-Requests (veraltete Results verwerfen)
- [ ] `src/preview/index.html` + `main.tsx` — Laedt Schema + Positions von Disk, rendert einmalig
- [ ] Leerer-Canvas Empty-State mit MCP-Tool-Syntax als Hint

**Akzeptanzkriterien:**
- [ ] `npx vite --config src/preview/vite.config.ts` zeigt ER-Diagramm im Browser
- [ ] Dark Blueprint Aesthetic erkennbar
- [ ] Auto-Layout positioniert Tabellen sauber (ELK layered)
- [ ] Tabellen sind draggbar

#### Phase 2b: Live Sync

Ziel: Browser aktualisiert sich automatisch wenn der Agent Aenderungen macht. Positionen werden persistent.

**Neue Dependencies:** `chokidar`, `ws`

- [ ] `src/preview/vite-plugin.ts`:
  - WebSocket an Vites HTTP Server anhaengen (path `/__daten-viz-ws`, NICHT separater Port)
  - Chokidar watch auf `.erd.json` UND `.erd.pos.json` (spezifische Dateien, nicht Verzeichnis)
  - **Content-Hash Vergleich** vor Broadcast (SHA-256, NICHT Self-Write-Flag — race-free)
  - Broadcast-Debounce: 200ms (separat von Chokidar-Debounce)
  - `awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }` auf Chokidar
  - Position-Writes: Nur `.erd.pos.json` schreiben (nie `.erd.json` beruehren)
  - Origin-Validation auf WebSocket (nur localhost/127.0.0.1)
  - Zod-Validation auf eingehende WS-Messages
- [ ] `src/preview/hooks/useDiagramSync.ts`:
  - **State Machine:** `IDLE | LAYING_OUT` — neue Schemas waehrend Layout queuen, nicht sofort anwenden
  - **Drag-Awareness:** Nodes die gerade gedraggt werden von eingehenden Updates ausschliessen
  - Auto-Reconnect mit exponential backoff
  - Full-Sync bei Reconnect (Diff-Merge mit lokalen Positions)
  - Per-Node Debounce fuer Position-Writes (500ms, nicht global)
- [ ] `diagram_auto_layout` MCP Tool hinzufuegen
- [ ] Vite an `127.0.0.1` binden (nicht `0.0.0.0`)

**Akzeptanzkriterien:**
- [ ] Wenn Agent via MCP eine Tabelle erstellt, erscheint sie innerhalb von <1s im Browser
- [ ] Positionen werden in `.erd.pos.json` gespeichert (debounced 500ms)
- [ ] Kein Position-Snapback beim Draggen waehrend MCP-Updates
- [ ] Kein Feedback-Loop (Chokidar → WS → Browser → WS → Chokidar)
- [ ] Auto-Reconnect nach WebSocket-Disconnect mit Full-Sync

#### Phase 3: Mermaid Export

Ziel: Schema als Mermaid exportieren fuer Dokumentation und Sharing.

- [ ] `src/export/mermaid.ts` — Internal → Mermaid erDiagram Syntax
  - **Deterministic Output:** Sortierte Table-Keys und Relations fuer saubere Git-Diffs
  - Column-Types escapen (kein `}` oder `|` in Mermaid-Syntax)
- [ ] `diagram_export_mermaid` MCP Tool (mit Tool Annotations)
- [ ] Einfaches CLI-Script: `node dist/export-mermaid.js schema.erd.json`

**Akzeptanzkriterien:**
- [ ] Export produziert valides Mermaid das in GitHub/GitLab rendert
- [ ] Agent kann `diagram_export_mermaid` aufrufen und das Ergebnis in eine Datei schreiben

## Race Conditions & Timing (aus Frontend Races Review)

8 identifizierte Race Conditions mit Mitigations:

| # | Race | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Write Feedback Loop (Chokidar) | CRITICAL | **Content-Hash** (SHA-256), nicht Self-Write-Flag |
| 2 | Cross-Process Read-Modify-Write | HIGH | **Separate Positions-Datei** — eliminiert die Race komplett |
| 3 | Rapid MCP-Updates waehrend ELK-Layout | MEDIUM | **State Machine** in useDiagramSync — Queue waehrend Layout |
| 4 | Stale State nach WS-Reconnect | MEDIUM | **Diff-Merge** auf Full-Sync, lokale Positions beibehalten |
| 5 | Position-Snapback beim Draggen | MEDIUM | **Drag-Tracking** — Incoming Updates fuer aktiv gedraggte Nodes ignorieren |
| 6 | macOS FSEvents Quirks | LOW-MEDIUM | Spezifische Dateien watchen, `awaitWriteFinish`, Content-Hash |
| 7 | Async ELK Layout Ordering | LOW-MEDIUM | **Sequence-Number** auf Layout-Requests — veraltete Results droppen |
| 8 | In-Process Write Interleaving | LOW | **Promise-basierte Write-Queue** in store.ts |

## Performance Budget (aus Performance Oracle)

| Metrik | 10 Tables | 50 Tables | 200 Tables |
|--------|-----------|-----------|------------|
| get_schema Tokens | ~1800 | ~12.000 | ~50.000 |
| JSON File Size | ~5 KB | ~25 KB | ~100 KB |
| ELK Layout (layered) | <50ms | 200-400ms | 1-3s |
| React Flow DOM Elements | ~90 | ~450 | ~1800 (200 collapsed) |
| Initial Render | <50ms | <100ms | <400ms |
| WS Broadcast Frequency | Every change | Max every 200ms | Max every 500ms |
| Memory (Vite + Browser) | ~200 MB | ~250 MB | ~350 MB |

**Skalierungsgrenze:** ~500 Tables / 4000 Columns. Danach braucht es: get_schema Filter, ELK Streaming, JSON-Parse-Optimierung.

## Acceptance Criteria

### Functional Requirements

- [ ] MCP Server laeuft via stdio und ist in Claude Desktop/Code konfigurierbar
- [ ] 9 MCP Tools funktionieren korrekt (CRUD + Rename + Position + Schema lesen)
- [ ] Browser Preview zeigt ER-Diagramm mit Dark Blueprint Aesthetic
- [ ] Live-Updates: MCP-Aenderungen erscheinen innerhalb von 1 Sekunde im Browser
- [ ] Auto-Layout mit ELK.js (inkrementell — nur neue Nodes)
- [ ] Export zu Mermaid produziert valide, deterministische Syntax

### Non-Functional Requirements

- [ ] Lokal: Kein Netzwerk-Traffic, keine Cloud-Abhaengigkeit
- [ ] Performance: 50 Tabellen rendern fluessig (60fps Pan/Zoom)
- [ ] Token-Effizienz: `diagram_get_schema` fuer 10 Tabellen < 2000 Tokens (compact, ohne Positions)
- [ ] Keine Race Conditions zwischen MCP-Server und Browser (separate Dateien)

### Quality Gates

- [ ] TypeScript strict mode + `noUncheckedIndexedAccess: true`
- [ ] Zod-Validation auf allen Inputs (MCP Tools + File Load + WebSocket Messages + Record Keys)
- [ ] Tool Annotations auf jedem MCP Tool
- [ ] Unit Tests (Vitest) fuer Core (schema, store)
- [ ] Integration Tests: MCP Server als Child-Process → Tool-Calls → File-Output pruefen
- [ ] Security: Pfad-Validation, Name-Validation, Origin-Check, Prototype-Blocklist

## Security Considerations

### Phase 1

| Finding | Severity | Mitigation |
|---------|----------|------------|
| Path Traversal via `--file` | MEDIUM | `path.resolve()`, `.erd.json`-Extension erzwingen, kein `..` nach Resolution |
| JSON-Dateigroesse | LOW | `fs.stat()` vor Parse, Limit 10MB |
| Prototype Pollution | LOW | `z.record(SAFE_IDENTIFIER, ...)` mit Blocklist im Zod-Schema |
| Relation from-Key Uniqueness | LOW | `.refine()` auf Relations-Array |

### Phase 2b

| Finding | Severity | Mitigation |
|---------|----------|------------|
| WebSocket ohne Origin-Validation | MEDIUM | Origin-Header pruefen, Vite an `127.0.0.1` binden |
| WS-Messages ohne Validation | MEDIUM | Zod-Schema fuer Position-Updates, nur `x`/`y` eines existierenden Tables mergen |
| Dedicated WS Path | LOW | `/__daten-viz-ws` statt Root-Path (kein Konflikt mit Vite HMR `/__vite_ws`) |

## Architektur-Entscheidungen

### E1: Separate Dateien fuer Schema + Positions (NEU nach Races-Review)

**Entscheidung:** `.erd.json` enthaelt nur Schema (Tables, Columns, Relations). `.erd.pos.json` enthaelt nur Positions. MCP-Server schreibt nur `.erd.json`. Vite/Browser schreibt nur `.erd.pos.json`.

**Warum:** Zwei Prozesse in dieselbe Datei schreiben zu lassen ist die Hauptquelle fuer Race Conditions. "Disjunkte Writes" klingt gut, aber in der Praxis liest Prozess B den Zustand von Prozess A bevor er schreibt — und ueberschreibt damit Prozess As Aenderungen. Separate Dateien eliminieren das komplett.

**Auswirkung:** `diagram_get_schema` merged beide Dateien beim Lesen. `diagram_set_position` schreibt `.erd.pos.json`. Browser-Rendering merged beide Dateien.

### E2: Content-Hash statt Self-Write-Flag (NEU nach Races-Review)

**Entscheidung:** Chokidar Feedback-Loop wird per Content-Hash (SHA-256) verhindert, nicht per temporalem Flag.

```typescript
let lastBroadcastHash: string | null = null;
onFileChange(async () => {
  const content = await readFile(filePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  if (hash === lastBroadcastHash) return;
  lastBroadcastHash = hash;
  broadcast(content);
});
```

**Warum:** Self-Write-Flags haben ein Timing-Window. Wenn FSEvents auf macOS zwei Writes coalesced (bis zu 75ms Delay), wird ein Flag fuer Write A gesetzt aber die Notification deckt auch Write B ab. Write B wird verschluckt. Content-Hash ist deterministisch und hat kein Timing-Window.

### E3: Promise-basierte Write-Queue (NEU nach Races-Review)

```typescript
let writePromise = Promise.resolve();
async function save(data: DiagramSchema) {
  writePromise = writePromise.then(() => doAtomicWrite(data));
  return writePromise;
}
```

Serialisiert alle Writes innerhalb eines Prozesses. Verhindert dass zwei async MCP-Tool-Calls sich gegenseitig ueberschreiben.

### E4: First-Run Experience

- `diagram_get_schema` ohne existierende Datei → leeres Schema `{ format: "daten-viz-erd-v1", name: "", tables: {}, relations: [] }`
- `diagram_create_table` ohne existierende Datei → erstellt die Datei automatisch
- `npx daten-viz serve` ohne Datei → leerer Canvas mit MCP-Tool-Syntax als Hint

### E5: File-Targeting

MCP-Server empfaengt `--file` Argument via `node:util/parseArgs`. Default: `./schema.erd.json`.

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

`diagram_get_schema` Response enthaelt `filePath` fuer Agent-Kontext.

### E6: Validation Rules

- Self-referencing FKs: **erlaubt**
- Zirkulaere Relations: **erlaubt**
- Tabelle ohne Spalten: **nicht erlaubt**
- Column Types: **Freitext-Strings** (max 128 Zeichen)
- **Namen:** `SAFE_IDENTIFIER` Regex `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/` + Prototype-Blocklist. Verwendet als `z.record()` Key-Schema UND in Tool-Input-Schemas (Single Source of Truth)
- **Relation from-Key:** `from.table + from.column` muss unique sein (`.refine()` auf Array)
- `diagram_remove_table` cascaded: entfernt alle Relations die diese Tabelle referenzieren

### E7: Browser Scope (MVP)

Browser ist **Preview mit Drag-to-Reposition**. Kein Schema-Editing im Browser. MCP-Server bleibt Single Source of Truth.

### E8: MVP Scope — Explizite Ausschluesse

- Browser-Editing (Tabellen/Columns/Relations im Browser anlegen/aendern)
- Undo/Redo (Git ist der Fallback)
- Multi-Diagram Support
- D2 Export, Mermaid Import, SQL DDL Import
- Commander.js CLI-Framework
- Tauri Desktop-App, VS Code Extension
- Prozess-/BPMN-Diagramme
- Collaboration / Multiplayer
- MCP Resources (kommen in Phase 2 mit Subscriptions)
- `diagram_batch` Tool (Post-MVP, fuer atomische Multi-Step-Ops)
- `diagram_validate` / `diagram_diff` / `diagram_clear` Tools (Post-MVP)

## Risk Analysis & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Cross-Process Race Condition | ~~Mittel~~ Eliminiert | Hoch | Separate Dateien (.erd.json + .erd.pos.json) |
| Feedback Loop (Chokidar) | Mittel | Mittel | Content-Hash (SHA-256) |
| In-Process Write Interleaving | Mittel | Mittel | Promise-basierte Write-Queue |
| ELK Layout unterbrochen durch Rapid Updates | Mittel | Niedrig | State Machine + Sequence Numbers |
| Position-Snapback beim Draggen | Mittel | Niedrig | Drag-Tracking in useDiagramSync |
| React Flow Performance 200+ Tabellen | Niedrig | Mittel | Zoom-Collapsing, stabile nodeTypes |
| MCP SDK Breaking Changes | Niedrig | Hoch | Version pinnen |
| Onboarding-Friction | Hoch | Hoch | README mit Copy-Paste Config-Snippet |

## Future Considerations (Post-MVP)

- `diagram_batch` Tool fuer atomische Multi-Table-Creation
- `diagram_validate` / `diagram_diff` Tools
- MCP Resource mit Schema-Subscription (Ambient Context fuer Agent)
- `AGENT_GUIDE.md` als MCP Resource (Vocabulary, Best Practices, Workflow)
- Update-Tools (`diagram_update_column`)
- D2 Export, Mermaid Import, SQL DDL Import
- Multi-Diagram Support via `diagram_open_file`
- Tauri-Wrap, VS Code Extension
- Schema-Migrationen (`format` v1 → v2)
- Cloud-Version mit Collaboration
- `daten-viz setup` fuer automatische MCP-Konfiguration
- `package.json` bin: `{ "daten-viz": "dist/cli.js", "daten-viz-mcp": "dist/server.js" }`

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-03-30-daten-visualisierung-brainstorm.md`
- Design Spec: `docs/plans/2026-03-30-phase2-browser-preview-design-spec.md`

### External References
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Tool Annotations Spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Writing Effective Tools](https://modelcontextprotocol.info/docs/tutorials/writing-effective-tools/)
- [React Flow Docs](https://reactflow.dev)
- [React Flow DatabaseSchemaNode](https://reactflow.dev/ui/components/database-schema-node)
- [ELK.js Layout](https://reactflow.dev/examples/layout/elkjs)
- [Vite JavaScript API](https://vite.dev/guide/api-javascript)
- [Chokidar v5](https://www.npmjs.com/package/chokidar)

### Deepen-Plan Review-Protokoll (2026-03-30)

| Agent | Top Finding |
|-------|------------|
| Agent-Native Architecture | `diagram_rename_table` + `diagram_set_position` als Must-Have, MCP Resource Post-MVP |
| Frontend Design | Dark Blueprint Aesthetic, JetBrains Mono, Amber fuer PKs, CSS Custom Properties |
| TypeScript Reviewer | `noUncheckedIndexedAccess`, `z.record()` Key-Validation, `node:util/parseArgs` |
| Performance Oracle | Strip Positions aus get_schema, inkrementelles ELK-Layout, Zoom-Collapsing |
| Agent-Native Reviewer | Cascade auf remove_table, Error-Messages mit available columns, filePath in get_schema |
| Frontend Races Reviewer | Separate Positions-Datei, Content-Hash, State Machine, Drag-Tracking, Write-Queue |
| Pattern Recognition | `format`-Feld, Relation-Key-Uniqueness, WS an Vite-Server (/__daten-viz-ws), Phase 2a/2b Split |
| MCP Best Practices | Tool Annotations, registerTool() API, outputSchema, structured Error-Responses |
