---
title: "feat: BPMN Prozess-Diagramme + App-Shell mit shadcn/ui"
type: feat
status: active
date: 2026-03-30
brainstorm: docs/brainstorms/2026-03-30-bpmn-prozess-diagramme-brainstorm.md
---

# feat: BPMN Prozess-Diagramme + App-Shell mit shadcn/ui

## Overview

Zweiter Diagramm-Typ (Prozess-Diagramme) neben ER-Diagrammen, eingebettet in eine shadcn/ui App-Shell mit Sidebar, Tabs und Properties-Panel. Minimal-BPMN mit 5 Elementen reicht fuer zwei Kern-Use-Cases:

1. **Geschaeftsprozesse** — TAFKA-Kunden dokumentieren ihre Ablaeufe (Kundenanfrage -> Pruefen -> Genehmigen -> Fertig)
2. **Website User Flows** — Beim Bau komplexer Websites die Nutzerreise visualisieren (Landing Page -> CTA -> Formular -> Danke-Seite -> Follow-Up Email)

## Problem Statement / Motivation

- Das Tool kann bisher nur Datenbank-Schemas visualisieren
- Geschaeftsprozesse und User Flows sind der zweithaeufigste Visualisierungsbedarf bei TAFKA-Kunden
- Der bestehende Preview ist ein reiner Canvas ohne Navigation — bei mehreren Diagrammen braucht man eine App-Shell
- Die CSS Custom Properties muessen auf shadcn/ui migriert werden fuer ein konsistentes Design-System

## Technical Approach

### Architecture

Parallel zum bestehenden ER-System — gleiche Patterns, eigener Namespace:

```
src/
  # ERD (bestehend, unveraendert)
  schema.ts, store.ts, tools.ts, server.ts

  # BPMN (neu, spiegelt ERD)
  bpmn/
    schema.ts           # ProcessSchema + Zod Types
    store.ts            # ProcessStore (gleiche Patterns wie DiagramStore)
    tools.ts            # registerProcessTools()

  # Preview (Rewrite mit shadcn App-Shell)
  preview/
    App.tsx             # shadcn Layout Shell (Sidebar + Tabs + Canvas)
    main.tsx            # + Tailwind CSS Import + dark mode
    index.html          # + Tailwind
    vite-plugin.ts      # Erweitert: BPMN API Routes + WS Events
    components/
      shell/
        AppSidebar.tsx      # shadcn Sidebar: File-Browser + Properties
        DiagramTabs.tsx     # Tabs fuer offene Diagramme
        PropertiesPanel.tsx # Element-Properties Inspector
      erd/                  # Bestehende ERD-Nodes (verschoben)
        TableNode.tsx
        RelationEdge.tsx
      bpmn/                 # Neue BPMN-Nodes
        StartEventNode.tsx  # Kreis (gruen)
        EndEventNode.tsx    # Dicker Kreis (rot)
        TaskNode.tsx        # Abgerundetes Rechteck
        GatewayNode.tsx     # Raute mit X
        SequenceFlowEdge.tsx
      shared/
        EmptyState.tsx
        StatusIndicator.tsx
    hooks/
      useDiagramSync.ts    # ERD (bestehend)
      useProcessSync.ts    # BPMN (neu, spiegelt useDiagramSync)
    layout/
      elk-layout.ts        # Erweitert: Node-Size-Estimator per Typ
```

### Dateiformat

**Prozess-Datei (.bpmn.json)** — nur vom MCP-Server geschrieben:

```json
{
  "format": "daten-viz-bpmn-v1",
  "name": "Kundenanfrage bearbeiten",
  "nodes": {
    "start": {
      "type": "start-event",
      "label": "Anfrage eingang"
    },
    "pruefen": {
      "type": "task",
      "label": "Anfrage pruefen",
      "description": "Sachbearbeiter prueft Vollstaendigkeit"
    },
    "entscheidung": {
      "type": "gateway",
      "label": "Genehmigt?",
      "gatewayType": "exclusive"
    },
    "ende_ok": {
      "type": "end-event",
      "label": "Abgeschlossen"
    }
  },
  "flows": [
    {
      "from": "start",
      "to": "pruefen",
      "label": null
    },
    {
      "from": "pruefen",
      "to": "entscheidung",
      "label": null
    },
    {
      "from": "entscheidung",
      "to": "ende_ok",
      "label": "Ja"
    }
  ]
}
```

**Positions-Datei (.bpmn.pos.json)** — nur vom Browser geschrieben:

```json
{
  "start": { "x": 0, "y": 100 },
  "pruefen": { "x": 200, "y": 80 },
  "entscheidung": { "x": 400, "y": 90 }
}
```

### MCP Tools (6 Tools mit `process_` Prefix)

| Tool | Beschreibung | Parameter |
|------|-------------|-----------|
| `process_add_node` | Node hinzufuegen (Task, Gateway, Start/End Event) | `id`, `type`, `label`, `description?`, `gatewayType?` |
| `process_remove_node` | Node + zugehoerige Flows entfernen (cascade) | `id` |
| `process_add_flow` | Sequence Flow zwischen zwei Nodes | `from`, `to`, `label?` |
| `process_remove_flow` | Flow entfernen | `from`, `to` |
| `process_get_schema` | Prozess-Schema als JSON auslesen | — |
| `process_export_mermaid` | Export als Mermaid flowchart | — |

**Design-Regeln (gleich wie ERD):**
- `readOnlyHint: true` auf `get_schema` und `export_mermaid`
- Cascade-Delete bei `remove_node` (alle Flows die den Node referenzieren)
- Mutation-Responses mit Summary: `'Added task "pruefen". Process now has 4 nodes, 3 flows.'`
- Klare Fehlermeldungen: `'Node "xyz" not found. Available nodes: start, pruefen, entscheidung.'`

### BPMN Node Types (5 Elemente)

| Element | React Flow Type | Visuelle Form | Farbe |
|---------|----------------|---------------|-------|
| Start Event | `bpmnStart` | Kreis (thin stroke) | Gruen (`--status-connected`) |
| End Event | `bpmnEnd` | Kreis (thick stroke) | Rot (`destructive`) |
| Task | `bpmnTask` | Abgerundetes Rechteck | Card-Style (wie TableNode) |
| Exclusive Gateway | `bpmnGateway` | Raute mit X | Amber (`--pk-amber`) |
| Sequence Flow | `sequenceFlow` | Pfeil mit optionalem Label | Edge-Style (wie RelationEdge) |

### shadcn/ui App-Shell

**Layout:**

```
+------------------+----------------------------------------+
|                  |  [schema.erd.json] [process.bpmn.json] |  <- Tabs
|   File Browser   +----------------------------------------+
|   - schema.erd   |                                        |
|   - process.bpmn |          React Flow Canvas             |
|                  |                                        |
|   Properties     |                                        |
|   - Name: ...    |                                        |
|   - Type: ...    |                                        |
+------------------+----------------------------------------+
|                  Status: Connected                        |
+-----------------------------------------------------------+
```

**Sidebar (links, resizable):**
- **Oberer Bereich:** File-Browser — listet alle `.erd.json` und `.bpmn.json` im Arbeitsverzeichnis. Klick oeffnet als Tab.
- **Unterer Bereich:** Properties-Panel — zeigt Eigenschaften des selektierten Canvas-Elements (Tabelle, Column, BPMN Node, etc.)

**Tabs (oben):**
- Ein Tab pro geoeffnetes Diagramm
- Icon zeigt Typ (Tabellen-Icon fuer ERD, Prozess-Icon fuer BPMN)
- Schliessbar

**Theming:**
- Komplette Migration auf shadcn CSS Variables (OKLCH)
- Blueprint-Farben in shadcn `.dark` Klasse mappen
- `document.documentElement.classList.add('dark')` — immer Dark Mode
- Tailwind v4 via `@tailwindcss/vite` Plugin

### Tech Stack (Neue Dependencies)

| Paket | Zweck |
|-------|-------|
| `tailwindcss` + `@tailwindcss/vite` | Tailwind v4 CSS Framework |
| `class-variance-authority` | Component Variants |
| `clsx` + `tailwind-merge` | Class Merging |
| `lucide-react` | Icons |
| `@radix-ui/*` (via shadcn) | Headless UI Primitives |

shadcn Components: `sidebar`, `tabs`, `resizable`, `label`, `input`, `separator`, `scroll-area`

## Implementation Phases

### Phase 1: shadcn/ui App-Shell + Theming Migration

Ziel: Bestehende ER-Preview in eine shadcn App-Shell einbetten. Sidebar, Tabs, Dark Theme.

- [ ] Tailwind v4 + shadcn/ui initialisieren
  - `npm install tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react`
  - `npx shadcn@latest init` (Vite template, `rsc: false`, dark theme)
  - `vite.config.ts`: Tailwind Plugin hinzufuegen, `@` Alias
- [ ] shadcn Components installieren
  - `npx shadcn@latest add sidebar tabs resizable label input separator scroll-area`
- [ ] Dark Blueprint Theme auf shadcn migrieren
  - `canvas.css` Custom Properties -> shadcn OKLCH Variables in `.dark`
  - Blueprint-Farben: `--background: oklch(0.12 0.01 250)` (#0B0E14)
  - React Flow Overrides beibehalten, aber auf Tailwind Classes umstellen wo moeglich
  - `document.documentElement.classList.add('dark')` in `main.tsx`
- [ ] App-Shell Layout bauen
  - `src/preview/App.tsx`: `SidebarProvider` + `ResizablePanelGroup`
  - `src/preview/components/shell/AppSidebar.tsx`: File-Browser (hardcoded erstmal)
  - `src/preview/components/shell/DiagramTabs.tsx`: Tab-Leiste
  - React Flow Canvas in `ResizablePanel` mit `h-full w-full` + `min-h-0`
- [ ] Bestehende ERD-Preview in App-Shell integrieren
  - ERD-Canvas als Default-Tab
  - `StatusIndicator` in die Shell-Footer verschieben
  - Sicherstellen dass Drag, Zoom, MiniMap weiterhin funktionieren
- [ ] Tests: Bestehende 20 Tests muessen weiterhin passen

**Akzeptanzkriterien Phase 1:**
- [ ] shadcn App-Shell mit Sidebar und Tabs sichtbar
- [ ] ERD-Diagramm rendert korrekt im Canvas-Bereich
- [ ] Dark Blueprint Aesthetic bleibt erhalten
- [ ] WebSocket Live-Sync funktioniert weiterhin
- [ ] Alle 20 bestehenden Tests passen

### Phase 2: BPMN Backend (Schema + Store + MCP Tools)

Ziel: AI-Agent kann Prozess-Diagramme ueber MCP-Tools erstellen.

- [ ] `src/bpmn/schema.ts`:
  - `ProcessNodeType = z.enum(['start-event', 'end-event', 'task', 'gateway'])`
  - `GatewayType = z.enum(['exclusive'])` (spaeter: `parallel`, `inclusive`)
  - `ProcessNodeSchema`, `FlowSchema`, `ProcessSchema`
  - `format: z.literal('daten-viz-bpmn-v1')`
  - `emptyProcess()` Factory
- [ ] `src/bpmn/store.ts`:
  - `ProcessStore` — gleiche Patterns wie `DiagramStore`
  - Atomic writes (tmp + rename)
  - `.bpmn.json` / `.bpmn.pos.json` Dateipfade
- [ ] `src/bpmn/tools.ts`:
  - `registerProcessTools(server, store)` — 6 Tools
  - `process_add_node`: Validierung (max 1 Start-Event, min 1 End-Event ist kein Hard-Error)
  - `process_remove_node`: Cascade-Delete aller Flows
  - `process_add_flow` / `process_remove_flow`
  - `process_get_schema` / `process_export_mermaid`
- [ ] `src/server.ts` erweitern:
  - `--bpmn-file` Flag via `parseArgs` (Default: `./process.bpmn.json`)
  - `ProcessStore` instanziieren + `registerProcessTools()` aufrufen
- [ ] `src/bpmn/export-mermaid.ts`:
  - Process -> Mermaid `flowchart LR` Syntax
  - Gateway als Raute `{Genehmigt?}`
  - Sortierte Ausgabe fuer deterministische Diffs
- [ ] Tests:
  - Unit: `bpmn/schema.ts` — Validation Edge Cases
  - Unit: `bpmn/store.ts` — load, save, missing file
  - Unit: `bpmn/export-mermaid.ts` — Mermaid Output
  - Sicherstellen dass ERD-Tools weiterhin funktionieren

**Akzeptanzkriterien Phase 2:**
- [ ] `process_add_node` erstellt Nodes in `.bpmn.json`
- [ ] `process_add_flow` verbindet Nodes
- [ ] `process_remove_node` cascaded Flows
- [ ] `process_get_schema` gibt korrektes JSON
- [ ] `process_export_mermaid` produziert valides Mermaid
- [ ] ERD-Tools funktionieren weiterhin unveraendert

### Phase 3: BPMN Preview + Multi-Diagram Tabs

Ziel: Prozess-Diagramme im Browser anzeigen, zwischen ERD und BPMN wechseln.

- [ ] `src/preview/vite-plugin.ts` erweitern:
  - Neue API Routes: `/__daten-viz-api/bpmn/schema`, `/__daten-viz-api/bpmn/positions`
  - Chokidar Watcher fuer `.bpmn.json`
  - WS-Message: `{ type: 'schema-changed', diagramType: 'erd' | 'bpmn' }`
- [ ] BPMN React Flow Nodes:
  - `src/preview/components/bpmn/StartEventNode.tsx` — Gruen-umrandeter Kreis (SVG)
  - `src/preview/components/bpmn/EndEventNode.tsx` — Dick-umrandeter Kreis (SVG)
  - `src/preview/components/bpmn/TaskNode.tsx` — Abgerundetes Rechteck (shadcn Card-Style)
  - `src/preview/components/bpmn/GatewayNode.tsx` — Raute mit X-Symbol (SVG)
  - `src/preview/components/bpmn/SequenceFlowEdge.tsx` — Pfeil mit optionalem Label
- [ ] `src/preview/hooks/useProcessSync.ts`:
  - Spiegelt `useDiagramSync` — fetcht von `/bpmn/schema` und `/bpmn/positions`
  - `processToNodesAndEdges()` Mapping-Funktion
  - Position-Writes zu `.bpmn.pos.json`
- [ ] `src/preview/layout/elk-layout.ts` erweitern:
  - `estimateNodeSize()` erkennt BPMN-Typen (feste Groessen: Start/End 40x40, Task 160x60, Gateway 60x60)
- [ ] Multi-Diagram Tabs in der App-Shell:
  - File-Browser in Sidebar zeigt `.erd.json` und `.bpmn.json`
  - Klick oeffnet Diagramm als neuen Tab
  - Tab bestimmt welcher Canvas (ERD vs BPMN) gerendert wird
  - Beide Canvases behalten ihren State beim Tab-Wechsel
- [ ] Properties-Panel in der Sidebar:
  - Bei Selektion eines ERD-Elements: Tabellenname, Columns, Beschreibung
  - Bei Selektion eines BPMN-Elements: Node-Typ, Label, Description
  - Read-only (Editing nur ueber MCP-Tools)
- [ ] ELK Auto-Layout fuer BPMN:
  - `elk.algorithm: 'layered'`, `elk.direction: 'RIGHT'`
  - Start-Events links, End-Events rechts

**Akzeptanzkriterien Phase 3:**
- [ ] BPMN-Diagramm rendert im Browser mit korrekten Shapes
- [ ] Start = gruener Kreis, End = roter dicker Kreis, Task = Rechteck, Gateway = Raute
- [ ] Tabs wechseln zwischen ERD und BPMN
- [ ] Sidebar zeigt Dateien und Properties
- [ ] Live-Sync: MCP-Aenderungen erscheinen in <1s im Browser
- [ ] Positionen werden in `.bpmn.pos.json` gespeichert

## Acceptance Criteria

### Functional Requirements

- [ ] 6 neue MCP Tools (`process_*`) funktionieren korrekt
- [ ] shadcn App-Shell mit Sidebar, Tabs, Properties-Panel
- [ ] ERD + BPMN Diagramme koexistieren in der gleichen Anwendung
- [ ] Dark Blueprint Aesthetic bleibt erhalten (jetzt via shadcn)
- [ ] Live-Updates fuer beide Diagramm-Typen
- [ ] Mermaid Export fuer Prozess-Diagramme

### Non-Functional Requirements

- [ ] Bestehende 20 ERD-Tests passen weiterhin
- [ ] Neue BPMN-Tests (Schema, Store, Mermaid)
- [ ] TypeScript strict mode
- [ ] Keine Regression in ERD-Funktionalitaet

## Architektur-Entscheidungen

### E1: Getrennte Dateien, gleiches Ownership-Modell

`.bpmn.json` = Process Schema (MCP-Server only). `.bpmn.pos.json` = Positions (Browser only). Gleiche Trennung wie bei ERD. Kein Cross-Write.

### E2: `process_` statt `bpmn_` als Tool-Prefix

"Prozess" ist verstaendlicher fuer Nicht-Techniker. TAFKA-Kunden sagen "Prozess", nicht "BPMN". Techniker verstehen beides.

### E3: Komplett auf shadcn umstellen

Bestehende CSS Custom Properties werden durch shadcn OKLCH Variables ersetzt. Einmaliger Aufwand, danach konsistentes Design-System fuer alle zukuenftigen Features. Blueprint-Farben werden in `.dark` gemappt.

### E4: User Flows als Spezialfall von Prozess-Diagrammen

Website User Flows (Landing -> CTA -> Formular -> Danke-Seite) nutzen die gleichen BPMN-Elemente: Start-Event = Einstiegspunkt, Tasks = Seiten/Aktionen, Gateways = Entscheidungen (Nutzer klickt A oder B), End-Event = Conversion. Kein separater Diagramm-Typ noetig.

### E5: Properties-Panel ist Read-Only

Browser zeigt Properties, aber editiert nicht. MCP-Server bleibt Single Source of Truth. Editing im Browser ist Post-MVP.

## Risk Analysis

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| shadcn Migration bricht bestehende Canvas-Styles | Mittel | Hoch | Phase 1 macht nur Shell + Theme, testet ERD zuerst |
| Tailwind + React Flow CSS Konflikte | Niedrig | Mittel | Preflight-Reset deaktivieren wenn noetig |
| BPMN ELK Layout sieht schlecht aus | Niedrig | Mittel | Feste Node-Groessen, getestet mit Beispiel-Prozessen |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-03-30-bpmn-prozess-diagramme-brainstorm.md`
- MVP Plan: `docs/plans/2026-03-30-feat-mvp-daten-visualisierung-plan.md`
- Design Spec: `docs/plans/2026-03-30-phase2-browser-preview-design-spec.md`

### External
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite)
- [shadcn Sidebar Component](https://ui.shadcn.com/docs/components/sidebar)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [Tailwind v4 + Vite](https://tailwindcss.com/docs/installation/vite)
