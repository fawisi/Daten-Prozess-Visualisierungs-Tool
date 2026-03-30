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

**Wichtig: MCP-Server und Vite-Preview sind separate OS-Prozesse.** Der MCP-Server nutzt stdio (stdin/stdout fuer Protokoll-Messages), was mit Vites Console-Output kollidieren wuerde. Beide koordinieren ausschliesslich ueber das Dateisystem.

```
┌─────────────────┐     stdio      ┌──────────────────┐
│  Claude Code /  │ ◄────────────► │   MCP Server     │ ← Prozess 1
│  Claude Desktop │                │  (node)          │
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
│  Browser        │ ◄────────────► │  Vite Dev Server │ ← Prozess 2
│  (React Flow)   │                │  + WS Plugin     │
└─────────────────┘                └──────────────────┘
```

- **Prozess 1** (MCP Server): Gestartet von Claude Desktop/Code via `claude_desktop_config.json`
- **Prozess 2** (Preview): Gestartet vom User via `npx daten-viz serve`
- **Koordination:** Ausschliesslich ueber `.erd.json` auf Disk

### Projekt-Struktur

**Phase 1 — minimal (4 Dateien):**

```
src/
  schema.ts       # Zod v4 Schemas + inferred Types (kein separates types/)
  store.ts        # DiagramFileStore: load(), save(), atomic writes
  tools.ts        # Alle 7 MCP Tool-Definitionen
  server.ts       # MCP Server init + stdio transport (Entry Point)
```

**Phase 2 — Preview hinzu:**

```
src/
  schema.ts
  store.ts
  tools.ts
  server.ts
  preview/
    vite-plugin.ts      # chokidar watch → WebSocket broadcast + Position-Write
    App.tsx              # React Flow Canvas mit MiniMap, Controls, Background
    components/
      TableNode.tsx      # Custom Node: Tabellenname als Header, Spalten als Rows
      RelationEdge.tsx   # Custom Edge mit Kardinalitaets-Label
    hooks/
      useDiagramSync.ts  # WebSocket Client Hook
    layout/
      elk-layout.ts      # ELK.js Auto-Layout
    index.html
    main.tsx
```

**Phase 3 — Export hinzu:**

```
src/
  ...
  export/
    mermaid.ts    # Internal → Mermaid ER Syntax
```

Struktur waechst mit dem Code. Keine leeren Verzeichnisse oder Platzhalter-Dateien.

### Dateiformat (.erd.json)

Vereinfacht — nur Felder die der MVP tatsaechlich braucht:

```json
{
  "name": "My Database Schema",
  "tables": {
    "users": {
      "columns": [
        { "name": "id", "type": "uuid", "primary": true },
        { "name": "email", "type": "varchar", "nullable": false },
        { "name": "name", "type": "varchar" },
        { "name": "created_at", "type": "timestamp" }
      ],
      "position": { "x": 0, "y": 0 }
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

**Design-Entscheidungen:**
- **Tables als keyed Object** (nicht Array) — git-diffs zeigen nur neue Keys, kein Array-Index-Shift
- **Keine Relation-IDs** — `from.table + from.column` ist der natuerliche Key. Zum Loeschen reicht `from`-Referenz
- **Keine `version`, `type`, `meta`, `layout`, `color`** — koennen spaeter als optionale Felder ergaenzt werden ohne Breaking Change
- **Positions pro Table** — optional, wenn absent berechnet Auto-Layout die Position
- **Kardinalitaeten:** `one-to-one`, `one-to-many`, `many-to-one`, `many-to-many`

### MCP Tools (Phase 1 — 7 Tools)

Reduziert auf das Minimum fuer einen funktionalen MVP. Alle mit Prefix `diagram_`, Zod v4 Schemas, `.describe()` auf jedem Feld:

| Tool | Beschreibung | Parameter |
|------|-------------|-----------|
| `diagram_create_table` | Neue Tabelle erstellen | `name`, `columns[]` (name, type, primary?, nullable?) |
| `diagram_remove_table` | Tabelle entfernen | `name` |
| `diagram_add_column` | Spalte zu Tabelle hinzufuegen | `table`, `column` (name, type, primary?, nullable?) |
| `diagram_remove_column` | Spalte entfernen | `table`, `column` |
| `diagram_add_relation` | FK-Beziehung erstellen | `from` (table, column), `to` (table, column), `type` |
| `diagram_remove_relation` | Beziehung entfernen | `from` (table, column) |
| `diagram_get_schema` | Gesamtes Schema auslesen | — |

**Bewusst rausgelassen fuer Phase 1:**
- `diagram_get_table` / `diagram_query_relations` — `get_schema` reicht, Schema ist <3000 Tokens fuer 10 Tabellen
- `diagram_update_table` / `diagram_update_column` — Remove + Create reicht
- `diagram_auto_layout` — erst relevant mit Browser in Phase 2
- `diagram_export_*` — erst in Phase 3

### Tech Stack

| Komponente | Technologie | Phase |
|-----------|-------------|-------|
| MCP Server | `@modelcontextprotocol/server` + `@modelcontextprotocol/node` | 1 |
| Schema Validation | `zod` (v4, import via `zod/v4`) | 1 |
| Build | `tsup` | 1 |
| Rendering | `@xyflow/react` (React Flow) | 2 |
| Auto-Layout | `elkjs` | 2 |
| Dev Server | `vite` + `@vitejs/plugin-react` | 2 |
| File Watcher | `chokidar` v5 (ESM) | 2 |
| WebSocket | `ws` | 2 |

**Bewusst entfernt:** `commander` (kein CLI-Framework noetig — `node dist/server.js` reicht fuer Phase 1, Vite hat eigenen Dev-Server fuer Phase 2).

### Implementation Phases

#### Phase 1: Foundation (Core + MCP Server)

Ziel: MCP Server funktioniert in Claude Code, Agent kann Schemas erstellen/lesen.

**Dependencies:** `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `zod`, `tsup`

- [ ] `package.json` + `tsconfig.json` (single package, strict mode)
- [ ] `src/schema.ts` — Zod v4 Schemas fuer DiagramSchema, TableSchema, ColumnSchema, RelationSchema + inferred Types
- [ ] `src/store.ts` — DiagramFileStore: `load()`, `save()` mit atomic writes (tmp + rename), Pfad-Validation, Dateigroessen-Limit
- [ ] `src/tools.ts` — Alle 7 MCP Tools mit Zod Input-Schemas und strukturierten Error-Responses
- [ ] `src/server.ts` — McpServer init, Tools registrieren, StdioServerTransport, `--file` Argument parsen
- [ ] Build mit `tsup` → `dist/server.js`
- [ ] **Tests:** Unit Tests fuer `schema.ts` (Validation Edge Cases), `store.ts` (load, save, missing file, corrupt file, atomic write)
- [ ] **Tests:** Integration Test: MCP Tool programmatisch aufrufen → `.erd.json` Output pruefen
- [ ] MCP Server in Claude Desktop konfigurieren und End-to-End testen

**Akzeptanzkriterien:**
- [ ] `npx daten-viz-mcp` startet MCP Server via stdio
- [ ] Claude kann `diagram_create_table` aufrufen und bekommt Bestaetigung
- [ ] `.erd.json` Datei wird korrekt geschrieben und ist valide
- [ ] `diagram_get_schema` gibt das komplette Schema zurueck
- [ ] Fehlerhafte Inputs (doppelter Tabellenname, fehlende Column) geben klare Fehlermeldungen

#### Phase 2: Browser Preview

Ziel: Live-Vorschau im Browser, die sich automatisch aktualisiert wenn der Agent Aenderungen macht.

**Neue Dependencies:** `@xyflow/react`, `elkjs`, `vite`, `@vitejs/plugin-react`, `chokidar`, `ws`

- [ ] `src/preview/App.tsx` — React Flow Canvas mit MiniMap, Controls, Background
- [ ] `src/preview/components/TableNode.tsx` — Custom Node: Tabellenname als Header, Spalten als Rows mit Typ-Badges (memoized)
- [ ] `src/preview/components/RelationEdge.tsx` — Custom Edge mit Kardinalitaets-Label
- [ ] `src/preview/hooks/useDiagramSync.ts` — WebSocket Client Hook mit Auto-Reconnect
- [ ] `src/preview/layout/elk-layout.ts` — ELK.js Auto-Layout Funktion
- [ ] `src/preview/vite-plugin.ts` — Vite Plugin: chokidar watch → WebSocket broadcast + Position-Write via `store.ts`
- [ ] `src/preview/index.html` + `src/preview/main.tsx` — Vite Entry Points
- [ ] WebSocket Origin-Validation (nur localhost), Zod-Validation auf eingehende Messages
- [ ] Chokidar Feedback-Loop verhindern (Self-Write-Flag oder Content-Hash-Vergleich)
- [ ] `diagram_auto_layout` MCP Tool hinzufuegen

**Akzeptanzkriterien:**
- [ ] `npx daten-viz serve` oeffnet Browser mit Canvas (bindet an 127.0.0.1)
- [ ] Wenn Agent via MCP eine Tabelle erstellt, erscheint sie innerhalb von <1s im Browser
- [ ] Tabellen sind drag-bar, Positionen werden in `.erd.json` gespeichert (debounced 500ms)
- [ ] Auto-Layout ordnet alle Tabellen sauber an (ELK.js)
- [ ] Relations zeigen Kardinalitaet (1:1, 1:N, N:M)

#### Phase 3: Mermaid Export

Ziel: Schema als Mermaid exportieren fuer Dokumentation und Sharing.

- [ ] `src/export/mermaid.ts` — Internal → Mermaid erDiagram Syntax (Column-Types escapen)
- [ ] `diagram_export_mermaid` MCP Tool
- [ ] Einfaches CLI-Script: `node dist/export-mermaid.js schema.erd.json`

**Bewusst rausgelassen:**
- D2 Export (YAGNI — Mermaid ist universeller, D2 kommt wenn Nachfrage da ist)
- Mermaid/SQL Import (Agent erstellt von Scratch via MCP — Import ist anderer Workflow)
- Commander.js CLI-Framework (einfaches `process.argv` Script reicht)

**Akzeptanzkriterien:**
- [ ] Export produziert valides Mermaid das in GitHub/GitLab rendert
- [ ] Agent kann `diagram_export_mermaid` aufrufen und das Ergebnis in eine Datei schreiben

## Alternative Approaches Considered

| Ansatz | Verworfen weil |
|--------|----------------|
| D3.js fuer Rendering | Zu low-level, kein Node/Edge-Konzept, alles manuell bauen |
| Konva (Canvas-based) | Kein DOM in Nodes → keine interaktiven Elemente, kein Edge-Routing |
| Dagre fuer Layout | Kein port-basiertes Edge-Routing, weniger Konfiguration als ELK |
| DBML als Format (wie dbdiagram.io) | Proprietaer, kein Standard, schlechter fuer LLM-Interaktion als JSON |
| Binaeresformat (wie Pencil .pen) | Nicht git-diffable, nicht human-readable, Overengineering fuer MVP |
| Version-Counter im Dateiformat | Over-engineered fuer MVP — atomic writes reichen (siehe Architecture Review) |
| Commander.js CLI | Kein CLI-Framework noetig — direkte Entry Points reichen fuer MVP |
| 14 MCP Tools | 7 reichen — get_schema deckt Queries ab, remove+create ersetzt update |

## Acceptance Criteria

### Functional Requirements

- [ ] MCP Server laeuft via stdio und ist in Claude Desktop/Code konfigurierbar
- [ ] 7 MCP Tools funktionieren korrekt (CRUD fuer Tables, Columns, Relations + Schema lesen)
- [ ] Browser Preview zeigt ER-Diagramm mit Tabellen, Spalten, Typen und Relations
- [ ] Live-Updates: MCP-Aenderungen erscheinen innerhalb von 1 Sekunde im Browser
- [ ] Auto-Layout mit ELK.js
- [ ] Export zu Mermaid produziert valide Syntax

### Non-Functional Requirements

- [ ] Lokal: Kein Netzwerk-Traffic, keine Cloud-Abhaengigkeit
- [ ] Performance: 50 Tabellen rendern fluessig (60fps Pan/Zoom)
- [ ] Dateigroesse: 10 Tabellen < 5KB JSON
- [ ] Token-Effizienz: `diagram_get_schema` fuer 10 Tabellen < 3000 Tokens

### Quality Gates

- [ ] TypeScript strict mode
- [ ] Zod-Validation auf allen Inputs (MCP Tools + File Load + WebSocket Messages)
- [ ] Unit Tests fuer Core (schema, store)
- [ ] Integration Test: MCP Tool → File → korrekte JSON-Ausgabe
- [ ] Security: Pfad-Validation, Name-Validation, Origin-Check auf WebSocket

## Dependencies & Prerequisites

- Node.js >= 20 (fuer ESM Support)
- Claude Desktop oder Claude Code mit MCP-Support
- Moderne Browser (Chrome, Firefox, Safari) fuer Preview

## Architektur-Entscheidungen (aus SpecFlow-Analyse + Reviews)

### E1: Browser → File Kommunikation (bidirektional)

**Entscheidung:** Browser sendet Position-Updates via WebSocket an den Vite-Server. Der Vite-Server delegiert den Write an `store.ts` (gleiche Logik wie MCP-Writes). Atomic Write (tmp + rename).

**Ablauf:** React Flow `onNodeDragStop` → WebSocket `{ type: 'position-update', nodeId, position }` → Vite Plugin validiert mit Zod → `store.ts` merged Position → Atomic Write.

**Wichtig:** Der Vite-Plugin schreibt NICHT selbst auf Disk, sondern nutzt `store.ts`. Single Writer Principle — `store.ts` ist die einzige Komponente die Dateien schreibt.

### E2: Concurrency-Modell (vereinfacht nach Architecture Review)

**Entscheidung:** Last-Write-Wins mit Atomic Writes. Kein Version-Counter.

- Atomic File Writes: Schreibe `.erd.json.tmp`, dann `rename()` → kein korrupter Zwischenzustand
- MCP-Server liest immer die aktuelle Datei vor jedem Write (read-before-write)
- Browser schreibt nur Positions (disjunkt von Schema-Aenderungen)
- Kein Locking, kein Merge, kein Retry — fuer MVP reicht das

**Warum kein Version-Counter:** Der Counter lebt in der Datei selbst. Read-Compare-Write ist nicht atomar auf OS-Ebene. Zwei Prozesse koennten gleichzeitig die gleiche Version lesen und beide den Check bestehen. Atomic Writes + Read-Before-Write ist einfacher und robuster fuer den MVP-Usecase (ein User, ein Agent, ein Browser).

### E3: First-Run Experience

**Entscheidung:**
- `diagram_get_schema` ohne existierende Datei → gibt leeres Schema zurueck `{ name: "", tables: {}, relations: [] }`
- `diagram_create_table` ohne existierende Datei → erstellt die Datei automatisch
- `npx daten-viz serve` ohne Datei → zeigt leeren Canvas mit Hint

### E4: File-Targeting (welche .erd.json?)

**Entscheidung:** MCP-Server empfaengt `--file` Argument beim Start. Default: `./schema.erd.json` im Working Directory.

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

**Security:** Pfad wird mit `path.resolve()` aufgeloest, muss auf `.erd.json` enden, darf kein `..`-Segment nach Resolution enthalten.

### E5: Validation Rules

- Self-referencing FKs: **erlaubt** (z.B. `employees.manager_id → employees.id`)
- Zirkulaere Relations: **erlaubt** (A→B→C→A ist valide)
- Tabelle ohne Spalten: **nicht erlaubt** (mindestens 1 Column)
- Column Types: **Freitext-Strings** (kein geschlossenes Enum — verschiedene DB-Dialekte)
- **Tabellen-/Spaltennamen:** Strikt validiert: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`. Prototype-Property-Namen (`__proto__`, `constructor`, `prototype`) explizit blockiert
- **String-Laengen:** Max 64 Zeichen fuer Namen, Max 128 Zeichen fuer Types
- Relation muss existierende Tabelle + Column referenzieren

### E6: Browser Scope (MVP)

**Entscheidung:** Browser ist **Preview mit Drag-to-Reposition**. Kein Editing von Tabellen/Columns/Relations im Browser. MCP-Server bleibt Single Source of Truth.

### E7: MCP Tool Error Responses

Alle Tools geben strukturierte Fehlermeldungen zurueck, die der LLM versteht:

```typescript
// Erfolg
{ content: [{ type: 'text', text: 'Created table "users" with 3 columns.' }] }

// Fehler
{ content: [{ type: 'text', text: 'Error: Table "users" already exists. Use diagram_get_schema to inspect it, or diagram_remove_table to delete it first.' }], isError: true }
```

### E8: MVP Scope — Explizite Ausschluesse

Folgende Features sind **bewusst nicht im MVP** (koennen spaeter ergaenzt werden ohne Breaking Changes):
- Browser-Editing (Tabellen/Columns/Relations im Browser anlegen/aendern)
- Undo/Redo (Git ist der Fallback)
- Multi-Diagram Support (ein .erd.json pro MCP-Session)
- D2 Export, Mermaid Import, SQL DDL Import
- Commander.js CLI-Framework
- Tauri Desktop-App
- Prozess-/BPMN-Diagramme
- Collaboration / Multiplayer
- Dark/Light Theme Toggle (kommt mit Phase 2+)
- Dateiformat-Felder: `version`, `type`, `meta`, `layout`, `color`, Relation-IDs

## Security Considerations

### Phase 1 (bei Implementation umsetzen)

| Finding | Severity | Mitigation |
|---------|----------|------------|
| Path Traversal via `--file` | MEDIUM | `path.resolve()`, `.erd.json`-Extension erzwingen, kein `..` nach Resolution |
| JSON-Dateigroesse | LOW | `fs.stat()` vor Parse, Limit 10MB |
| Prototype Pollution bei Tabellennamen | LOW | `__proto__`, `constructor`, `prototype` in Name-Regex blockieren |
| MCP Input Validation | LOW | Zod-Validation auf allen Tool-Inputs (bereits geplant) |

### Phase 2 (bei Preview-Implementation umsetzen)

| Finding | Severity | Mitigation |
|---------|----------|------------|
| WebSocket ohne Origin-Validation | MEDIUM | Origin-Header pruefen (nur localhost), Vite an `127.0.0.1` binden |
| Browser→Disk ohne Validation | MEDIUM | Zod-Schema fuer WS-Messages, nur `position`-Feld mergen, nach Merge re-validieren |
| Chokidar Feedback-Loop | LOW | Self-Write-Flag oder Content-Hash-Vergleich vor Broadcast |

## Risk Analysis & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Race Condition: MCP + Browser schreiben gleichzeitig | Mittel | Mittel | Atomic Writes (tmp + rename), Positions disjunkt von Schema |
| React Flow Performance bei 200+ Tabellen | Niedrig | Mittel | Virtualisierung, `nodesDraggable={false}` als Fallback |
| MCP SDK Breaking Changes | Niedrig | Hoch | SDK-Version pinnen, Changelog beobachten |
| WebSocket-Verbindung bricht ab | Mittel | Niedrig | Auto-Reconnect, Full-Sync bei Reconnect |
| Chokidar false-positives | Hoch | Niedrig | Debounce (100ms) + Atomic Writes verhindern Partial Reads |
| Korrupte .erd.json | Mittel | Mittel | Zod-Validation beim Load, klare Fehlermeldung, Git als Recovery |
| Onboarding-Friction | Hoch | Hoch | Klare README mit Copy-Paste `claude_desktop_config.json` Snippet |

## Success Metrics

- **MVP-Kriterium:** Ein Entwickler kann in Claude Code sagen "Erstelle ein Schema fuer eine Blog-App" und sieht das Ergebnis live im Browser
- **Adoption-Signal:** 10 Nutzer testen das Tool innerhalb der ersten Woche nach Release
- **Qualitaet:** Kein Datenverlust durch Race Conditions oder File-Corruption

## Future Considerations (Post-MVP)

- `version`-Feld im Dateiformat + Schema-Migrationen (`core/migrations/`)
- Update-Tools (`diagram_update_table`, `diagram_update_column`)
- Query-Tools (`diagram_get_table`, `diagram_query_relations`)
- D2 Export, Mermaid Import, SQL DDL Import
- Multi-Diagram Support via `diagram_open_file` Tool
- Tauri-Wrap fuer native Desktop-App
- Reverse-Engineering: Live-DB-Connection → Auto-Generate Schema
- Prozess-/BPMN-Visualisierung als zweiter Diagramm-Typ
- Cloud-Version mit Collaboration (Multiplayer-Editing)
- VS Code Extension mit Preview-Panel
- Dark/Light Theme Toggle
- `daten-viz setup` Command fuer automatische MCP-Konfiguration
- `package.json` bin-Feld: `{ "daten-viz": "dist/cli.js", "daten-viz-mcp": "dist/server.js" }`

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
- [Chokidar v5](https://www.npmjs.com/package/chokidar)

### Marktanalyse
- Eraser.io (Cloud-only, AI-native, kein MCP)
- D2 Language (Open Source, CLI, aber kein ER+Prozess)
- dbdiagram.io (DBML-basiert, kein AI)
- Mermaid (LLM-freundlich, visuell limitiert)

### Review-Protokoll (2026-03-30)
- **Architecture Strategist:** Architektur solide, separate Prozesse noetig, Concurrency vereinfachen, Tests in Phase 1
- **Code Simplicity Reviewer:** 14→7 Tools, 4 Dateien statt 8 Verzeichnisse, Format vereinfacht, ~45% weniger Code
- **Security Sentinel:** 5 Findings (alle LOW-MEDIUM), Pfad-Validation + WebSocket-Origin + Name-Regex
