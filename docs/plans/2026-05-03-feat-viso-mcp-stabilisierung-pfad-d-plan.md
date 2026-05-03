---
title: viso-mcp Stabilisierung — Pfad D (Editor-First)
type: feat
status: active
date: 2026-05-03
brainstorm: docs/brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md
branch_plan: docs/brainstorm-stabilisierung-pfad-d
branch_implementation: feat/v1.2-stabilization-d
---

# viso-mcp Stabilisierung — Pfad D (Editor-First)

## Overview

`viso-mcp` braucht eine stabile Editor-Basis, bevor wir die Hub-Frage neu
aufrollen. Synthetic Tests sagen SUS 70.5 (gut), Fabians Real-Eindruck
sagt "noch nicht zuverlaessig nutzbar" — diese Luecke schliessen wir,
indem wir die 4 gemeldeten UX-Bugs (B1–B4) live im Browser
reproduzieren, fixen, und Fabians taegliche Kundenarbeit im Editor zur
primaeren Validierungsmethode machen. 6 Etappen, keine Deadline,
Quality-First.

**Drin:** B1–B4 Bug-Fixes, v1.1.3-Backlog (ERD-Rename, Auto-Layout-Perf,
Sample-Files), strukturierter Bug-Capture beim Real-Nutzen, Daily-Use-Run
mit echtem Kundenprojekt, Iteration auf Findings.

**Raus:** Hub-Integration, iframe-Embedding, npm-Package-Refactor in
`@tafka/viso-editor`, neue Features ueber die 3 Use Cases (ERD/BPMN/Landscape)
hinaus, Open-Source-Promotion.

---

## Problem Statement

### Symptom

Fabian erlebt den Editor in der taeglichen Anwendung als nicht zuverlaessig.
4 konkrete Bugs sind gemeldet (siehe Bug-Tabelle unten). Davon sind drei
laut Solution-Docs bereits gefixt — sie tauchen in Fabians Real-Eindruck
trotzdem als kaputt auf. Das ist ein Widerspruch, der vor jedem
Code-Schritt aufgeloest werden muss.

### Root Causes (drei moegliche Ursachen)

1. **Stale Build (Hauptverdacht).** Der MCP-Server faehrt aus
   `dist/server.cjs`. Diese Datei stammt vom 22.04., waehrend
   `src/preview/App.tsx` zuletzt am 26.04. geaendert wurde. Wenn Fabian
   `npx viso-mcp serve` benutzt, laeuft er auf einem 4 Tage alten Build,
   der die Fixes fuer B2/B3/B4 noch nicht enthaelt. Genau dieses
   Stale-Build-Pattern ist in
   [docs/solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md](../solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md)
   bereits einmal aufgetreten und identisch zu loesen
   (`npm run build`).

2. **Edge-Cases ausserhalb des Solution-Doc-Scopes.** Die Fixes fuer
   B2 (drag-drop-spawn-diagramm-typ-aware), B3 und B4 (react-flow-edges-readonly)
   wurden code-mässig verifiziert, aber nicht durch Real-User-Sessions.
   Es ist plausibel, dass Edge-Cases (kombinierte Aktionen, bestimmte
   Files, Tab-Wechsel-Sequenzen) noch brechen.

3. **Synthetic-Test-Blindspot.** Der v1.1.2-Re-Test hat bewusst auf
   den Live-Browser-Pfad verzichtet (Begruendung im Report:
   "Browser-MCP interagiert nicht zuverlaessig mit ReactFlow's
   SVG-Selektion"). Damit ist ein ganzer Klasse von Bugs strukturell
   unsichtbar — genau die, die Fabian beim Klicken erlebt.

### Bug-Liste (Stand 2026-05-01)

| # | Beschreibung | Use Case | Solution-Doc vorhanden? | Hypothese |
|---|---|---|---|---|
| **B1** | Drag-Drop legt Knoten an falscher Stelle ab (nicht beim Mauszeiger) | alle 3? | **Nein** | Coordinate-Transform-Bug — `screenToFlowPosition` vs. `getBoundingClientRect`-basierte Berechnung in `handleSpawnFromPointer` |
| **B2** | Drag-Drop greift manchmal gar nicht | unklar | Ja: [drag-drop-spawn-diagramm-typ-aware.md](../solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md) | Stale Build oder Edge-Case nach Tab-Wechsel (Commit `38ecee4` hat Cross-Pollination gefixt) |
| **B3** | Linien (Edges) lassen sich nicht ziehen | unklar | Ja: [react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) | Stale Build oder Legacy-File-Fall (Commit `51ce91e`) |
| **B4** | Linien lassen sich nicht loeschen | unklar | Ja: [react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) | Stale Build oder `interactionWidth` zu klein im Custom-Edge |

### Warum Pfad D (statt A/B/C)

A (Eine Codebase Hub+MCP), B (Shared Core / npm-Package), C (Zwei Welten)
— alle drei setzen voraus, dass der Editor selbst trägt. Wenn die
Drag-Drop-Position nach 4 Wochen Re-Test-Optimismus immer noch falsch
ist, ist jede Hub-Strategie auf Sand gebaut. Pfad D priorisiert die
Editor-Basis und vertagt die Hub-Frage auf E6 — dort wird sie mit
Real-Use-Daten entschieden, nicht im Voraus.

---

## Proposed Solution

Sechs Etappen, jede mit klarem Abschluss-Kriterium. Etappen sind
sequenziell — E2 startet erst, wenn E1 die Bugs reproduziert hat (oder
festgestellt hat, dass sie bereits gefixt sind und nur ein Re-Build
fehlte). E6 setzt voraus, dass E5 "kein Frust mehr" produziert hat.

```
E1 Reproduktion ──▶ E2 Critical Fixes ──▶ E3 Backlog-Sweep ──▶
E4 Daily-Use-Run ──▶ E5 Iteration ──▶ E6 Hub-Frage neu aufrollen
```

**Bug-driven, nicht use-case-driven:** B1 wird in allen 3 Diagrammtypen
(ERD, BPMN, Landscape) gemeinsam reproduziert und gefixt, dann B2, dann
B3/B4. Vorteil: Root-Cause oft im selben Modul — 1 Fix loest 3 Stellen.
Nachteil: kein "ein Use-Case komplett fertig"-Gefuehl bis ganz zum
Schluss.

---

## Technical Approach

### Etappe E1 — Live-Reproduktion (Gate)

**Ziel:** Klarheit, ob die 4 Bugs aktuell tatsaechlich im Editor auftreten,
und falls ja: was genau passiert (Repro-Steps + erwartetes-vs-tatsaechliches
Verhalten). Ohne diese Klarheit faellt jeder Fix in den Synthetic-vs-Real-Spalt.

#### E1.0 — Build-Freshness-Check (allererster Schritt)

Bevor irgendein Bug reproduziert wird:

- [ ] `stat dist/server.cjs src/tools.ts src/preview/App.tsx` — wenn `src/` neuer ist als `dist/`: `npm run build` ausfuehren
- [ ] `npm test` muss gruen sein (310/310 nach Unreleased-Block, Stand 2026-05-01)
- [ ] `npm run typecheck` muss durchgehen
- [ ] Erst dann den Editor starten

**Begruendung:** Wenn der Stale-Build die Bugs erklaert, ist das die
billigste Loesung. Wir muessen nur sicherstellen, dass es keine
Verwechslung gibt (Real-Eindruck aus altem Build vs. neuer Code-State).

#### E1.1 — Editor starten und Sample-Setup

- [ ] In sauberem Test-Verzeichnis: `npx viso-mcp init --with-samples` (zieht 4-Tabellen-DBML, 8-Node-BPMN, 5-Node-Landscape)
- [ ] `npx viso-mcp serve` — Browser auf `http://localhost:5555`
- [ ] Initial-Smoke: alle 3 Tabs öffnen, jeweils ein Knoten und eine Edge sichtbar? Wenn nicht: Note in Repro-Datei

#### E1.2 — Bug-Repro nach Bug-Gruppen

Repro-Datei: `docs/usage-log/2026-05-03-bug-repro.md`. Pro Bug:
Diagramm-Typ, Repro-Steps, erwartetes Verhalten, tatsaechliches
Verhalten, Screenshots wenn moeglich, Build-Hash (`git rev-parse HEAD`).

**B1 (Drop-Position) — alle 3 Diagrammtypen:**

- [ ] BPMN: Tool-Palette → Task ergreifen → auf Canvas droppen → liegt der Knoten am Mauszeiger oder verschoben?
- [ ] ERD: Tool-Palette → Table ergreifen → droppen → Position pruefen
- [ ] Landscape: Tool-Palette → Person ergreifen → droppen → Position pruefen
- [ ] Variation: bei verschiedenen Zoom-Stufen, bei gescrollter Canvas, bei aufgeklapptem Code-Panel
- [ ] Variation: Click-to-Place (paneClick) vergleichen — derselbe Bug oder anderes Verhalten?

**B2 (Drag greift nicht) — alle 3 Diagrammtypen:**

- [ ] BPMN → ERD → Landscape Tab-Wechsel, dann sofort drag-drop versuchen
- [ ] Tool selektieren, dann Tab wechseln, zurueckwechseln, drag-drop versuchen
- [ ] Tool selektieren, drag-drop wenn Tool-Highlight blau ist
- [ ] Tool selektieren, drag-drop wenn Tool-Highlight nicht mehr blau ist

**B3 (Edges nicht ziehbar) — alle 3 Diagrammtypen:**

- [ ] Zwei Knoten platzieren, Source-Handle anvisieren, ziehen zum Target-Handle
- [ ] ERD-Spezial: ueber Spalten-Handle (`column-source` → `column-target`)
- [ ] Mit Legacy-Files testen (notion-Pipeline-Output mit `cardinality: "N:1"`)

**B4 (Edges nicht loeschbar) — alle 3 Diagrammtypen:**

- [ ] Bestehende Edge anklicken, Backspace
- [ ] Bestehende Edge anklicken, Delete
- [ ] Bestehende Edge anklicken, Kontextmenue (Right-Click)? — gibt es das?
- [ ] Edge-Klick-Hitbox: kann man die Edge ueberhaupt selektieren? (`interactionWidth`-Test)

#### E1.3 — Klassifikation pro Bug

Nach den Repro-Runs ergibt sich pro Bug eine von drei Klassen:

- **Tatsaechlich offen** (Bug reproduziert sich auch nach Re-Build): Fix-Plan in E2 schreiben
- **Stale-Build-Effekt** (Bug verschwindet nach `npm run build`): Plan-Punkt in E2 streichen, in CHANGELOG/usage-log dokumentieren
- **Edge-Case ausserhalb Solution-Doc** (Bug tritt nur in spezifischer Situation auf): Solution-Doc erweitern + Fix in E2

**Abschluss-Kriterium E1:** `docs/usage-log/2026-05-03-bug-repro.md` enthaelt
fuer jeden der 4 Bugs eine Klassifikation und — falls "tatsaechlich offen" —
prazise Repro-Steps. Commit `docs(usage-log): E1 — Live-Repro 4 Bugs`.

---

### Etappe E2 — Critical Fixes

**Ziel:** Die in E1 als "tatsaechlich offen" klassifizierten Bugs fixen.
Pro Bug eine eigene Phase (E2.B1, E2.B2, E2.B3, E2.B4). Reihenfolge ist
fix nach Bug-Gruppe, weil Root-Cause zwischen den Bugs ueberlappt
(Coordinate-Transform betrifft B1 ueberall, Sync-Hooks betreffen B2/B3/B4).

#### E2.B1 — Drop-Position (vermutlich tatsaechlich offen)

**Datei-Verdaechtige (laut Repo-State):**
- `src/preview/App.tsx` Zeilen ~1077–1095 (`handleSpawnFromPointer`) — nutzt `getBoundingClientRect`-relative Berechnung
- `src/preview/hooks/usePaletteDrag.ts` — Pointer-Events Drag-Listener
- React-Flow API: `screenToFlowPosition` waere die kanonische Loesung fuer Coordinate-Transform unter Zoom + Pan

**Hypothese:** `clientPos.x - rect.left` ignoriert React-Flow-Viewport-Transform
(Zoom, Pan). Bei Zoom != 1 oder verschobenem Viewport landet der Knoten
verschoben.

**Fix-Skizze (in Plain Language):** Statt der einfachen Subtraktion `clientPos - paneRect`
muss die React-Flow-eigene Funktion `screenToFlowPosition` verwendet werden, die
Zoom und Pan korrekt einrechnet.

**Akzeptanzkriterien E2.B1:**
- [ ] Bei Zoom 100%, Default-Viewport: Knoten landet beim Mauszeiger (±5px)
- [ ] Bei Zoom 50% / 200%: Knoten landet beim Mauszeiger
- [ ] Nach Pan/Scroll des Viewports: Knoten landet beim Mauszeiger
- [ ] Bei aufgeklapptem Code-Panel: Knoten landet beim Mauszeiger
- [ ] Click-to-Place verhaelt sich identisch (gleicher Code-Pfad)
- [ ] Vitest-Test pro Diagramm-Typ: programmatischer Drop bei Zoom != 1 landet am erwarteten Schema-Position
- [ ] Solution-Doc neu: `docs/solutions/ui-bugs/drag-drop-position-zoom-aware.md`

#### E2.B2 — Drag-Drop greift nicht (Edge-Cases nach Tab-Wechsel)

**Wenn Stale-Build-Effekt:** keine Code-Aenderung, nur Build-Hinweis in
README + CI-Step `[ src/tools.ts -ot dist/server.cjs ]` als Build-Freshness-Test.

**Wenn echter Edge-Case:**
- Hypothese 1: Listener-Cleanup im `useSpawnListener` triggert vor Tab-Wechsel
- Hypothese 2: `data-viso-canvas-pane="<type>"`-Marker fehlt nach Tab-Wechsel
- Hypothese 3: `useToolStore` resettet Tool-Selection bei Tab-Wechsel

**Akzeptanzkriterien E2.B2:**
- [ ] Tool selektieren → Tab wechseln → zurueckwechseln → drag-drop spawnt Knoten
- [ ] Vitest: `useSpawnListener` enabled-State ueberlebt Re-Mount via Tab-Wechsel
- [ ] Smoke-Test: alle 3 Tabs ein Mal durchklicken, jeweils drag-drop am Anfang und am Ende der Session

#### E2.B3 / E2.B4 — Edges create/delete

Hauptverdacht: Stale-Build. Falls echter Edge-Case:

- Hypothese B3: ERD-Legacy-Files brechen vor `normalizeRelations` (Reader-Pfad)
- Hypothese B4: `interactionWidth` der Custom-Edge zu klein, Backspace greift ins Leere
- Hypothese B4 Variant: `onEdgesDelete` wird nicht gefeuert weil `selectionMode`/`selectionOnDrag` falsch

**Akzeptanzkriterien E2.B3:**
- [ ] Drag von Source-Handle zu Target-Handle erzeugt Edge in allen 3 Diagrammtypen
- [ ] In ERD: Edge auch zwischen `column-source` und `column-target` von Spalten mit Bindestrich im Namen (z.B. `customer-id-source`)
- [ ] Source-File enthaelt nach Connect die neue Relation/Flow in kanonischer Form
- [ ] Bei Legacy-Files: erstes Connect migriert opportunistisch zur v1.1-Form (`normalizeRelations`)

**Akzeptanzkriterien E2.B4:**
- [ ] Edge anklicken (Hitbox >= 20px), Backspace loescht aus Canvas und Source-File
- [ ] Edge anklicken, Delete loescht (gleicher Code-Pfad)
- [ ] In allen 3 Diagrammtypen reproduzierbar
- [ ] Pre-Release-Smoke nach Solution-Doc-Checklist (siehe `react-flow-edges-readonly.md`, Sektion "Sentinel-Check"): `EditableReactFlow`-Wrapper als TypeScript-Sentinel-Pflicht prüfen

**Abschluss-Kriterium E2:** Alle in E1 als "tatsaechlich offen"
klassifizierten Bugs sind:
- gefixt (Code-Aenderung) ODER
- als Stale-Build-Effekt verifiziert (Build-Hinweis dokumentiert) ODER
- als nicht reproduzierbar zurueckgestellt (in usage-log dokumentiert)

Conventional Commits pro Bug: `fix(canvas): B1 — Drop-Position respects React-Flow viewport transform` etc.
Solution-Doc pro fix in `docs/solutions/ui-bugs/`.

---

### Etappe E3 — v1.1.3 Backlog-Sweep

**Ziel:** Die im v1.1.2 Re-Test als "Top 3 remaining findings" markierten
Punkte schliessen. Diese sind keine Bugs, sondern UX-Polish und
Performance-Observation, aber sie liegen im selben Code-Bereich wie B1–B4
und passen daher in dieselbe Phase.

#### E3.1 — ERD-Tabellen-Rename in PropertiesPanel (S, ~3h)

**Status:** im CHANGELOG-Unreleased-Block schon notiert, vermutlich
teil-implementiert. Pruefen: ist `applyErdTableUpdate` in `node-update.ts`
bereits mit Rename-Logik versehen, oder fehlt das UI-Wiring?

**Akzeptanzkriterien:**
- [ ] Im PropertiesPanel-Header eines ERD-Tabellen-Knotens ist der Name editierbar
- [ ] On-Blur PATCH ruft `applyErdTableUpdate` mit neuem Namen auf — Tabellen-Schluessel und alle Relations (`from.table`, `to.table`) werden mitgezogen
- [ ] Validierung gegen `SafeIdentifier`-Regex; Trivial / Kollision / Invalid sind stille no-ops
- [ ] Vitest-Tests fuer Rename-Happy-Path, Kollision, Invalid (laut CHANGELOG bereits 6 neue Tests in `node-update.test.ts`)

#### E3.2 — Auto-Layout-Performance (Web Worker, M, ~5h)

**Status:** Beobachtet im Re-Test (600–900ms Freeze bei 47 Tabellen). Nicht
blockierend, aber nervig.

**Hypothese-Loesung A:** ELK in Web Worker fuer `nodes.length > 30`. Saubere
Trennung, kein Main-Thread-Block, aber zusaetzlicher Code.

**Hypothese-Loesung B:** Auto-Layout nicht automatisch beim Mount, sondern
nur via Button-Click (de-facto Opt-In). Trivial, kostet aber initiale
"sieht aufgeraeumt aus"-Erfahrung.

**Empfehlung:** Loesung B als Quick-Win in E3, Loesung A als Folge-Item
falls noch Frust.

**Akzeptanzkriterien:**
- [ ] Initial-Mount mit 47 Tabellen blockt UI nicht > 200ms
- [ ] "Layout"-Button im TopHeader manuell triggerbar
- [ ] Bestehender Auto-Layout-Test in `auto-layout.test.ts` weiter gruen

#### E3.3 — Sample-Files Distribution (XS, ~1h)

**Status:** MI-3 partial. `init --with-samples` shipped, aber `git clone +
npm run preview` ohne `init` faellt in EmptyState.

**Loesung:** Tiny pre-init `dev/sample.erd.json` (nicht .gitignored), nur
fuer den Demo-/Screenshot-Fall.

**Akzeptanzkriterien:**
- [ ] Frischer `git clone` + `npm run preview` zeigt einen sample-Zustand
- [ ] Production-Pfad (`init` ohne `--with-samples`) bleibt unveraendert (leeres Verzeichnis)

**Abschluss-Kriterium E3:** Alle 3 Backlog-Items entweder geschlossen
oder mit klarer Begruendung verworfen. CHANGELOG aktualisiert (Unreleased
→ v1.1.3 oder v1.2-rc).

---

### Etappe E4 — Daily-Use-Run

**Ziel:** Fabian nutzt den stabilisierten Editor fuer ein echtes
Kundenprojekt komplett ohne Workarounds. Das ist die einzige
Validierung, die die Synthetic-vs-Real-Luecke schliesst.

#### Setup

- [ ] Kundenprojekt auswaehlen, fuer das ERD oder BPMN gebraucht wird (Notion-Pipeline-Output OK, Greenfield OK)
- [ ] Vorab: Browser-Tab-Bookmark, Editor + `docs/usage-log/`-Verzeichnis erreichbar haben
- [ ] Vereinfachter Bug-Capture-Modus: wenn Frust, einfach in Chat schreiben — Claude legt `docs/usage-log/YYYY-MM-DD-<slug>.md` an mit Repro-Steps

#### Was Fabian probieren soll

- [ ] Mindestens 1 ERD von 5+ Tabellen vollstaendig im Editor zusammenklicken (kein Code-Panel, kein Terminal)
- [ ] Mindestens 1 BPMN von 5+ Knoten vollstaendig zusammenklicken
- [ ] Mindestens 1 Landscape mit 3+ Boundaries
- [ ] Bestehendes Notion-Pipeline-Output oeffnen, eine Tabelle umbenennen, eine Spalte hinzufuegen, eine Relation erstellen, alles speichern, Browser-Reload, alles noch da
- [ ] Export einmal pro Diagramm-Typ ausprobieren (Mermaid, SVG/PNG)

#### Was protokolliert wird

Pro Frust-Punkt im Chat → Claude legt `docs/usage-log/<datum>-<slug>.md` an mit:
- Datum + Diagramm-Typ + Build-Hash
- Repro-Steps (wenn moeglich)
- Erwartetes Verhalten
- Tatsaechliches Verhalten
- Schweregrad (klein / mittel / blockierend)

**Abschluss-Kriterium E4:** Mindestens ein abgeschlossenes
Kundenprojekt, dessen Diagramm-Output komplett im Editor entstanden ist.
`docs/usage-log/`-Verzeichnis enthaelt 0 oder mehr Eintraege — egal wie
viele, Hauptsache ehrlich.

---

### Etappe E5 — Iteration

**Ziel:** Die in E4 gemeldeten Bugs / Friction-Punkte fixen, sortiert
nach Schweregrad. Wiederhole, bis Fabian sagt: "ich nutze es taeglich
ohne Frust mehr."

#### Vorgehen

- [ ] Pro Eintrag in `docs/usage-log/`: Repro im Editor, Hypothese, Fix, Solution-Doc
- [ ] Fixes im selben Branch-Pattern wie E2 (`fix/<kurz-beschreibung>`)
- [ ] Nach jedem Fix: Smoke-Test alle 3 Diagrammtypen (kein Re-Frust durch Regression)
- [ ] CHANGELOG aktualisiert mit jedem Fix

#### Loop-Ende

E5 endet, wenn beide Indikatoren positiv sind:

- **Indikator 1 (subjektiv):** Fabian sagt explizit: _"ich nutze es jetzt taeglich, ohne Frust"_
- **Indikator 2 (objektiv):** Frequenz neuer `docs/usage-log/`-Eintraege ist seit > 1 Woche praktisch 0 (kein Cherry-Picking — auch wenn Fabian den Editor aktiv benutzt hat)

**Abschluss-Kriterium E5:** Beide Indikatoren positiv. Letzter Commit
auf dem Stabilisierungs-Branch ist `chore(release): v1.2.0 —
Stabilisierung` (oder analog je nach Versions-Strategie).

---

### Etappe E6 — Hub-Frage neu aufrollen

**Ziel:** Mit den Daten aus E1–E5 die in der Brainstorm-Tabelle vertagte
Hub-Strategie entscheiden.

#### Input fuer die Entscheidung

- `docs/usage-log/` als Frust-Tagebuch (Was war oft kaputt? Was hat sich gut angefuehlt?)
- E2/E3 Solution-Docs (Welche Fixes waren teuer? Welche trivial?)
- E4 Daily-Use-Erfahrung (Welche Workflows fehlen? Was passt schon?)
- Hub-Anforderungen (Was muss der Hub rendern? Inline-Edit? Read-only-View? Kommentare?)

#### Optionen (aus Brainstorm-Tabelle)

- **A — Eine Codebase Hub+MCP:** Ein einziges Repo, der Editor lebt im Hub. Vorteil: Zero-Drift. Nachteil: viso-mcp als Standalone-Tool wird obsolet.
- **B — Shared Core (`@tafka/viso-editor`):** npm-Package mit dem React-Editor, beide Hosts (Hub + viso-mcp) konsumieren. Vorteil: kein Duplikat-Code. Nachteil: Refactor-Kosten, Versions-Discipline.
- **C — Zwei Welten:** Hub iframe-embedded `viso-mcp/preview`, leichtes Coupling. Vorteil: minimale Eingriffe. Nachteil: iframe-Pain (Theme, Auth, Resize).

#### Entscheidungs-Format

Eigenes Brainstorm-Doc `docs/brainstorms/2026-MM-DD-viso-mcp-hub-strategie-brainstorm.md`, mit
identischer Struktur wie das Pfad-D-Doc (Decisions, Open Questions). Plan
folgt analog.

**Abschluss-Kriterium E6:** Klare Hub-Strategie-Entscheidung mit
schriftlicher Begruendung, basierend auf E1–E5-Daten — nicht auf
Vorab-Annahmen. Damit ist Phase D abgeschlossen.

---

## Alternative Approaches Considered

| Pfad | Beschreibung | Warum nicht in Phase D |
|---|---|---|
| **A — Eine Codebase** | Hub und MCP fusionieren | Wenn Editor nicht traegt, ist die Fusion eine schiefe Basis. Kommt in E6 wenn die Daten es rechtfertigen. |
| **B — Shared Core npm** | `@tafka/viso-editor`-Package | Refactor-Kosten ohne Validierung, dass der Editor traegt. Hub-Frage geht der Editor-Frage logisch nach. |
| **C — Zwei Welten** | iframe-Embedding | iframe-Pain (Theme, Auth, Resize) ist ein eigener Workstream. Kommt in E6. |
| **Synthetic-Tests v1.1.3** | Wie v1.1.2 nochmal, aber 8 Personas | Hat den Real-Eindruck nicht abgebildet. Doppelt machen heilt das nicht. |
| **Externer Real-User-Test (3-5 Berater)** | Wie im Re-Test empfohlen | Kommt nach E5, nicht waehrend. Fabian-zentriert ist die schnellere Feedback-Schleife. |

---

## Acceptance Criteria

### Funktional (pro Etappe)

| Etappe | Kriterium |
|---|---|
| E1 | `docs/usage-log/2026-05-03-bug-repro.md` enthaelt fuer B1–B4 jeweils Klassifikation (offen / stale-build / not-reproduzierbar) und Repro-Steps |
| E2 | Alle "tatsaechlich offen"-Bugs aus E1 sind gefixt; Vitest-Coverage erhalten oder erweitert; Solution-Doc pro Fix |
| E3 | ERD-Rename funktioniert; Auto-Layout blockt < 200ms bei 47 Tabellen; sample-Distribution funktioniert |
| E4 | Mindestens 1 abgeschlossenes Kundenprojekt komplett im Editor erstellt |
| E5 | Subjektiv: Fabian "ohne Frust"; Objektiv: > 1 Woche keine neuen usage-log-Eintraege bei aktiver Nutzung |
| E6 | Hub-Strategie-Entscheidung (A/B/C oder neue Option) als eigenes Brainstorm dokumentiert |

### Nicht-funktional

- **Tests gruen:** `npm test` muss am Ende jeder Etappe gruen sein (aktuell 310/310)
- **Typecheck gruen:** `npm run typecheck` ohne Fehler
- **Build aktuell:** Vor jedem Etappen-Abschluss `npm run build`, `dist/` darf nicht aelter sein als `src/`
- **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Branch-Hygiene:** Plan-Branch (`docs/brainstorm-stabilisierung-pfad-d`) fuer Plan; Implementation auf eigenem Branch (`feat/v1.2-stabilization-d`)
- **Solution-Doc nach jedem Fix:** kein Fix ohne dokumentierten Root-Cause + Prevention

---

## Success Metrics

### Primaer (subjektiv, du-zentriert)

- Fabian nutzt `viso-mcp` taeglich fuer Kundenarbeit ohne Workarounds (kein Code-Panel, kein Terminal, keine Notion-Pipeline-Hacks)
- Fabian sagt explizit: _"das geht jetzt"_

### Sekundaer (objektiv, als Korrektiv)

- Frequenz neuer Eintraege in `docs/usage-log/` sinkt monoton bis ~0/Woche
- Tests-Suite waechst (jeder Fix bringt Vitest-Coverage)
- CHANGELOG-Unreleased-Block hat < 5 offene Items am Ende

### Nicht-Ziele

- SUS-Score (kommt erst in E6+ wenn externer Test gemacht wird)
- Cross-Browser-Coverage (Safari iPad bleibt opportunistisch, kein Pflicht-Browser)
- Keyboard-Shortcuts-Vollstaendigkeit (Cmd+K + Pflicht-Tools sind genug)

---

## Dependencies & Prerequisites

### Tools / Setup

- [ ] Node 20.18+ (siehe `package.json` engines)
- [ ] `npm` mit funktionierendem `node_modules` (frisch: `npm ci`)
- [ ] Browser (Chrome/Firefox/Safari — Chrome bevorzugt fuer DevTools)
- [ ] Test-Verzeichnis ausserhalb des Repo-Roots fuer `npx viso-mcp init` (vermeidet Verschmutzung)

### Files / Daten

- [ ] Mindestens 1 echtes Kunden-ERD (Notion-Pipeline-Output OK) fuer E4
- [ ] Mindestens 1 BPMN-Use-Case (Greenfield OK)
- [ ] Optional: 1 Landscape-Sample fuer C4 L1/L2

### Knowledge

- [ ] Brainstorm `docs/brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md` muss internalisiert sein
- [ ] Solution-Docs aus `docs/solutions/ui-bugs/` und `docs/solutions/integration-issues/` als Referenz griffbereit
- [ ] CHANGELOG aktuell durchgelesen (v1.1.0 / v1.1.1 / v1.1.2 + Unreleased)

---

## Risk Analysis & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| **Stale-Build erklaert alle 4 Bugs** | hoch | hoch (positiv) | Erste Aktion in E1.0 ist `npm run build`. Wenn Bugs verschwinden, in CI-Step `[ src/ -ot dist/ ]` aufnehmen. |
| **B1 ist tiefer als nur Coordinate-Transform** | mittel | mittel | E1.2 mit verschiedenen Zoom-Stufen testet die Hypothese. Falls falsch, neue Hypothese (`reactFlowInstance` falsch geholt, `nodeOrigin` Konfig, etc.) |
| **E4 zeigt keinen Frust → falsche Sicherheit** | gering | hoch | Indikator 2 (objektive Eintragsfrequenz) als Korrektiv. Wenn Indikator 1 positiv, aber 0 Tage Daily-Use seit dem letzten Fix: nicht abschliessen. |
| **Fabian-Disziplin fuer Bug-Capture wankt** | mittel | gering | Vereinfachter Capture-Mode (Chat-Meldung statt formales Tagebuch) reduziert Reibung. Claude proaktiv: "willst du das in usage-log festhalten?" |
| **Hub-Frage (E6) muss frueher entschieden werden** | gering | mittel | Wenn extern getriggert (Stakeholder-Anfrage), separates Brainstorm — nicht in Phase D quetschen |
| **B1-Fix bricht Click-to-Place (paneClick)** | gering | hoch | Smoke-Test in E2.B1 vergleicht Drag-Drop und Click-to-Place — beide muessen identisches Verhalten zeigen |
| **`screenToFlowPosition`-Refactor bricht iPad-Drag** | gering | mittel | iPad-Smoke-Test in E2.B1 (auf Hardware oder DevTools-Simulation) |
| **Tests werden waehrend Fixes flaky** | gering | mittel | Bei Flake: Solution-Doc, kein Skip — Stabilisierung der Test-Suite ist Teil der Phase |

---

## Resource Requirements

- **Personal:** Fabian (Validator + Real-User), Claude (Implementor + Documenter)
- **Zeit:** keine Deadline. Etappen-getaktet, jede Etappe so lang wie noetig.
- **Infrastruktur:** keine — alles lokal. Keine CI/CD-Aenderungen noetig (vorhandene Github-Actions reichen).
- **Externe Abhaengigkeiten:** keine — keine neuen npm-Packages, keine API-Calls

---

## Future Considerations

- **Externer Real-User-Test (3-5 KMU-Berater) post-E5:** Empfehlung aus dem v1.1.2 Re-Test. TAFKA-Sparring-Pipeline als Recruitment-Channel.
- **Hub-Integration (E6):** mit Real-Use-Daten entscheidbar. A/B/C-Optionen siehe Alternatives.
- **Web-Worker fuer Auto-Layout:** wenn E3.2 Loesung B (Manual-Button) nicht reicht, Loesung A (Web-Worker) als Folge-PR.
- **CI-Step Stale-Build-Guard:** `[ src/ -ot dist/ ]` als Pre-Push-Hook, wenn das Pattern noch ein drittes Mal auftritt.
- **EditableReactFlow-Wrapper als TypeScript-Sentinel:** `react-flow-edges-readonly.md` schlaegt vor, wurde aber noch nicht implementiert. Sinnvoll vor E6 zu schliessen.
- **Performance-Budget initial mount:** "ELK initial layout < 400 ms fuer n ≤ 30 nodes" als Regression-Guard in CI ergaenzend zu Bundle-Size-Gates.

---

## Documentation Plan

| Wann | Was | Wohin |
|---|---|---|
| E1 | Repro-Steps fuer B1–B4 + Klassifikation | `docs/usage-log/2026-05-03-bug-repro.md` |
| E2 (pro Fix) | Solution-Doc mit Symptom / Root Cause / Fix / Prevention | `docs/solutions/ui-bugs/<slug>.md` |
| E2 / E3 (pro Fix) | CHANGELOG-Unreleased-Block-Eintrag | `CHANGELOG.md` |
| E4 (laufend) | Frust-Eintraege bei Real-Nutzung | `docs/usage-log/YYYY-MM-DD-<slug>.md` |
| E5 (pro Iteration) | Solution-Doc fuer Folge-Fixes | `docs/solutions/<kategorie>/<slug>.md` |
| E6 | Hub-Strategie-Entscheidung als neues Brainstorm | `docs/brainstorms/2026-MM-DD-viso-mcp-hub-strategie-brainstorm.md` |
| Phasen-Ende | Plan-Status auf `completed` setzen + Compound-Engineering-Doku der Lessons | `docs/knowledge/<topic>.md` via `compound-engineering:workflows:compound` |

---

## References & Research

### Internal References (Brainstorm + Tests)

- [docs/brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md](../brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md) — Hauptinput, alle 8 Decisions
- [docs/usertests/2026-04-25-viso-mcp-full-walkthrough/report.md](../usertests/2026-04-25-viso-mcp-full-walkthrough/report.md) — v1.1.0 Baseline (SUS 23)
- [docs/usertests/2026-04-26-viso-mcp-v1-1-2-re-test/report.md](../usertests/2026-04-26-viso-mcp-v1-1-2-re-test/report.md) — v1.1.2 Re-Test (SUS 70.5) + Top 3 remaining findings

### Internal References (Solution-Docs)

- [docs/solutions/ui-bugs/react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) — B3/B4 Fix-Hypothese, Sentinel-Check-Empfehlung
- [docs/solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md](../solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md) — B2 Fix-Hypothese, Pre-Merge-Checklist
- [docs/solutions/integration-issues/erd-add-column-silent-fail-legacy-relations.md](../solutions/integration-issues/erd-add-column-silent-fail-legacy-relations.md) — `normalizeRelations`-Migration als Pre-Zod-Pass
- [docs/solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md](../solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md) — Stale-Build-Pattern (relevant fuer E1.0)

### Internal References (Code-Hotspots)

- [src/preview/App.tsx:~1077–1095](../../src/preview/App.tsx) — `handleSpawnFromPointer` (B1, B2)
- [src/preview/hooks/usePaletteDrag.ts](../../src/preview/hooks/usePaletteDrag.ts) — Pointer-Events Drag-Listener (iPad-safe)
- [src/preview/hooks/useDiagramSync.ts](../../src/preview/hooks/useDiagramSync.ts) — ERD Sync inkl. `onConnect`/`onEdgesDelete` (B3, B4)
- [src/preview/hooks/useProcessSync.ts](../../src/preview/hooks/useProcessSync.ts) — BPMN Sync (B3, B4)
- [src/preview/hooks/useLandscapeSync.ts](../../src/preview/hooks/useLandscapeSync.ts) — Landscape Sync (B3, B4)
- [src/preview/normalize-relations.ts](../../src/preview/normalize-relations.ts) — Legacy-Relation-Migration (B3 mit Notion-Files)
- [src/types.ts](../../src/types.ts) — `Tool` + `DiagramType`-Union (Pre-Merge-Checklist)
- [CHANGELOG.md](../../CHANGELOG.md) — v1.1.0 / v1.1.1 / v1.1.2 + Unreleased ERD-Rename

### External References

- [React Flow API: `screenToFlowPosition`](https://reactflow.dev/api-reference/types/react-flow-instance#screen-to-flow-position) — kanonische Coordinate-Transform fuer Zoom + Pan (relevant fuer B1)
- [React Flow Examples: Drag and Drop](https://reactflow.dev/examples/interaction/drag-and-drop) — Referenz-Implementation fuer Drop-Position
- [DBML Spec](https://dbml.dbdiagram.io/docs/) — Source-of-truth fuer ERD-Format
- [Vitest Docs](https://vitest.dev/) — Test-Runner (3.0+, vorhanden)

### Related Work

- Commit `38ecee4` — Tool/Diagramm-Cross-Pollination Guard (B2-Fix, ein Aspekt)
- Commit `51ce91e` — Edge create/delete fuer BPMN + Landscape (B3/B4-Fix)
- Commit `05f953e` — ERD Spalte hinzufuegen + `normalizeRelations` (B3-Vorbereitung)
- Commit `d61345a` — ERD-Tabellen-Rename (E3.1-Vorbereitung)
- Commit `aaa9cd0` — v1.1.2 Release Open-Items-Sweep
