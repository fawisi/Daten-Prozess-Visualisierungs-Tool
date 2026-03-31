---
title: "BPMN Prozess-Diagramme + App-Shell"
type: brainstorm
status: active
date: 2026-03-30
---

# BPMN Prozess-Diagramme + App-Shell

## Was wir bauen

Zwei zusammenhaengende Features:

1. **BPMN Prozess-Diagramme** — Zweiter Diagramm-Typ neben ER. AI-Agent kann Geschaeftsprozesse ueber MCP-Tools erstellen. Minimal-BPMN mit 5 Elementen: Start-Event, End-Event, Task, Gateway (Entscheidung), Sequence Flow (Verbindung).

2. **App-Shell mit shadcn/ui** — Navigation, Sidebar, Tab-System. Macht das Tool von einem reinen Canvas zu einer richtigen Anwendung. Beide Diagramm-Typen unter einem Dach.

## Warum dieser Ansatz

### Minimal BPMN (5 Elemente) reicht fuer den Start
- **Start-Event** (Kreis) — Wo der Prozess beginnt
- **End-Event** (dicker Kreis) — Wo er endet
- **Task** (Rechteck) — Ein Arbeitsschritt
- **Gateway** (Raute) — Eine Entscheidung (ja/nein)
- **Sequence Flow** (Pfeil) — Verbindung zwischen Elementen

Das deckt 90% der Prozesse ab die Mittelstands-Kunden dokumentieren wollen: "Kundenanfrage kommt rein -> Pruefen -> Genehmigen oder Ablehnen -> Fertig."

Spaeter erweiterbar: Lanes (wer macht was), Subprocess, Timer Events, etc.

### Getrennte Dateien, gleiches Muster
- `.bpmn.json` fuer Prozesse (analog zu `.erd.json`)
- `.bpmn.pos.json` fuer Positionen (analog zu `.erd.pos.json`)
- Gleiches Ownership-Modell: MCP-Server schreibt Schema, Browser schreibt Positions
- `format: 'daten-viz-bpmn-v1'` als Diskriminator

### shadcn/ui fuer die App-Shell
- Sidebar mit File-Browser (alle .erd.json und .bpmn.json im Verzeichnis)
- Tabs fuer offene Diagramme
- Konsistentes Design-System das zum Dark Blueprint Theme passt
- shadcn ist headless + Tailwind — passt gut zu unserem CSS Custom Properties Ansatz

## Zielgruppe

**Beides:** Mittelstands-Unternehmen (TAFKA-Kunden) die einfache Prozesse dokumentieren wollen UND technische Teams die IT-Flows modellieren. Start mit dem einfachen Use Case, spaeter technische Features nachlegen.

## Key Decisions

| Entscheidung | Gewaehlt | Alternativen |
|---|---|---|
| BPMN-Umfang im MVP | Minimal (5 Elemente) | Standard (8), Umfangreich (12+) |
| Dateiformat | Getrennte .bpmn.json Dateien | Eine Datei fuer alles |
| MCP Tool Prefix | `process_` (statt `diagram_`) | `bpmn_`, `diagram_` mit type-Parameter |
| Preview | App-Shell mit Tabs (ER + BPMN) | Getrennte Fenster pro Typ |
| UI Framework | shadcn/ui + Tailwind (komplett) | shadcn auf bestehende Vars mappen |
| Theming | shadcn Dark Mode als fuehrendes System | Eigene CSS Custom Properties behalten |
| Sidebar | File-Browser + Properties-Panel | Nur File-Browser |

## Resolved Questions

1. **Tool-Naming:** `process_` Prefix. Verstaendlicher fuer Nicht-Techniker.
2. **Theming:** Komplett auf shadcn umstellen. Bestehende CSS Custom Properties durch shadcn-System ersetzen. Canvas-Styles werden refactored.
3. **Sidebar:** File-Browser + Properties-Panel. Oben Dateien, unten Properties des selektierten Elements.

## Offene Fragen

1. **Routing:** Tabs im Browser-State (React-intern) oder URL-basiert (`/erd/schema` vs `/bpmn/process`)? Tendenz: React-intern ist einfacher.
